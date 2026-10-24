"use server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  createSession,
  deleteSession,
  hashPassword,
  verifyPassword,
  requireShop,
} from "@/lib/auth";
import { orderSchema, orderItemSchema, orderPaymentSchema, productSchema, cashSchema, customerSchema } from "@/lib/validation";
import { shopData } from "@/lib/shop-data";
import { vietnamToday, vietnamTime } from "@/lib/dates";
import type { OrderChange } from "@/lib/order-history";
import { accessReason, accessMessages } from "@/lib/access";
import { firebaseSignIn, setFirebasePassword } from "@/lib/firebase-auth";

export async function getOrderHistory(orderId: string) {
  const data = await shopData();
  const entries = await data.orderHistory(orderId);
  return entries.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString(), changes: JSON.parse(entry.changes) as OrderChange[] }));
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
export async function changeShopPassword(form: FormData) {
  const shop = await requireShop();
  const parsed = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(10).max(128), confirmPassword: z.string() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Mật khẩu mới cần từ 10 đến 128 ký tự." };
  const { currentPassword, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) return { error: "Nhập lại mật khẩu mới chưa khớp." };
  if (newPassword === currentPassword) return { error: "Mật khẩu mới phải khác mật khẩu hiện tại." };
  const key = `change-password:${shop.id}`;
  await db.authAttempt.deleteMany({ where: { key, resetsAt: { lte: new Date() } } });
  const attempt = await db.authAttempt.upsert({ where: { key }, create: { key, resetsAt: new Date(Date.now() + 900000) }, update: { count: { increment: 1 } } });
  if (attempt.count > 10) return { error: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút." };
  if (shop.firebaseUid) {
    try {
      await firebaseSignIn(shop.email, currentPassword, shop.firebaseUid);
      await setFirebasePassword(shop.firebaseUid, newPassword);
    } catch { return { error: "Mật khẩu hiện tại không đúng hoặc dịch vụ xác thực chưa kết nối được." }; }
  } else if (!verifyPassword(currentPassword, shop.passwordHash)) return { error: "Mật khẩu hiện tại không đúng." };
  const changed = await db.$transaction(async (tx) => {
    const result = await tx.shop.updateMany({ where: { id: shop.id, passwordHash: shop.passwordHash }, data: { passwordHash: hashPassword(newPassword) } });
    if (!result.count) return false;
    await tx.session.deleteMany({ where: { shopId: shop.id } });
    await tx.authAttempt.deleteMany({ where: { key } });
    return true;
  });
  if (!changed) return { error: "Mật khẩu vừa được thay đổi. Vui lòng đăng nhập lại." };
  await deleteSession();
  return { error: "" };
}
export async function addCustomer(form: FormData) {
  const data = await shopData();
  const parsed = customerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Kiểm tra tên, SĐT (8–20 ký tự), email, ngày sinh và địa chỉ (tối đa 300 ký tự)." };
  const result = await data.createCustomer(parsed.data, String(form.get("id") ?? ""));
  if (!result.error) {
    revalidatePath("/customers");
    revalidatePath("/");
    revalidatePath("/orders");
  }
  return result;
}
export async function saveOrder(form: FormData) {
  const data = await shopData();
  const id = String(form.get("id") ?? "");
  const existingOrder = id ? await data.findOrder(id) : null;
  if (id && !existingOrder) return { error: "Không tìm thấy đơn hàng." };
  const raw: Record<string, unknown> = Object.fromEntries(form);
  raw.orderDate = existingOrder?.orderDate ?? vietnamToday();
  raw.orderTime = existingOrder?.orderTime ?? vietnamTime();
  if (form.has("items")) {
    let items;
    try { items = z.array(orderItemSchema).min(1).max(100).parse(JSON.parse(String(form.get("items")))); }
    catch { return { error: "Kiểm tra sản phẩm, số lượng và đơn giá của từng dòng." }; }
    raw.items = items;
    raw.product = items.map((item) => item.name).join(" + ").slice(0, 160);
    raw.productId = items[0].productId;
    raw.price = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) + Number(form.get("shippingFee") ?? 0) - Number(form.get("discount") ?? 0);
  }
  if (form.has("payments")) {
    try {
      const payments = z.array(orderPaymentSchema).max(100).parse(JSON.parse(String(form.get("payments"))));
      raw.payments = payments;
      raw.paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    } catch { return { error: "Kiểm tra số tiền và phương thức của từng lượt thanh toán." }; }
  }
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success)
    return {
      error: parsed.error.issues.some((issue) => issue.path[0] === "paidAmount")
        ? "Số tiền đã thanh toán phải là số nguyên từ 0 đến giá trị đơn hàng."
        : "Vui lòng kiểm tra các trường, số điện thoại, ngày và giá tiền.",
    };
  if (!parsed.data.items && parsed.data.productId) {
    const product = await data.findProduct(parsed.data.productId);
    const existing = id ? await data.findOrder(id) : null;
    if (!product || (product.archived && existing?.productId !== product.id))
      return { error: "Không tìm thấy sản phẩm đang bán trong shop của bạn." };
    // Keep the historical product name for existing orders; snapshots belong to the order.
    if (!existing || existing.productId !== product.id)
      parsed.data.product = product.name;
  }
  const result = await data.saveOrder(id, parsed.data);
  if (result.error) return result;
  revalidatePath("/processing");
  if (id) revalidatePath(`/orders/${id}`);
  revalidatePath("/cashflow");
  revalidatePath("/customers");
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/reports");
  return { error: "" };
}
export async function changeOrderStatus(id: string, status: string) {
  const data = await shopData();
  const parsed = orderSchema.shape.status.safeParse(status);
  if (!parsed.success || typeof id !== "string" || !id) return { error: "Trạng thái đơn hàng không hợp lệ." };
  const result = await data.updateOrderStatus(id, parsed.data);
  if (!result.error) {
    for (const path of ["/", "/orders", "/processing", `/orders/${id}`, "/reports"]) revalidatePath(path);
  }
  return result;
}
export async function removeOrder(id: string) {
  const data = await shopData();
  const result = await data.deleteOrder(id);
  revalidatePath("/processing");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/cashflow");
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/reports");
  return { error: result.count ? "" : "Không tìm thấy đơn hàng." };
}
export async function renameShop(form: FormData) {
  const data = await shopData();
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 100)
    return { error: "Tên shop cần từ 1 đến 100 ký tự." };
  await data.rename(name);
  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/reports");
  revalidatePath("/products");
  return { error: "" };
}

export async function saveProduct(form: FormData) {
  const data = await shopData();
  const parsed = productSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Kiểm tra tên, mô tả và giá sản phẩm (0–2.000.000.000₫)." };
  let id = String(form.get("id") ?? "");
  if (id) {
    if (!(await data.updateProduct(id, parsed.data)).count)
      return { error: "Không tìm thấy sản phẩm." };
  } else id = (await data.createProduct(parsed.data)).id;
  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/orders");
  return { error: "", id };
}

export async function saveCashEntry(form: FormData) {
  const data = await shopData();
  const parsed = cashSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Kiểm tra nội dung, ngày giao dịch và số tiền (1–2.000.000.000₫)." };
  const id = String(form.get("id") ?? "");
  if (id) {
    if (!(await data.updateCashEntry(id, parsed.data)).count) return { error: "Không tìm thấy phiếu thu chi." };
  } else await data.createCashEntry(parsed.data);
  revalidatePath("/cashflow");
  revalidatePath("/reports");
  return { error: "" };
}

export async function removeCashEntry(id: string) {
  const data = await shopData();
  const result = await data.deleteCashEntry(id);
  revalidatePath("/cashflow");
  revalidatePath("/reports");
  return { error: result.count ? "" : "Không tìm thấy phiếu thu chi." };
}

export async function archiveProduct(id: string, archived: boolean) {
  const data = await shopData();
  if (typeof archived !== "boolean")
    return { error: "Trạng thái không hợp lệ." };
  if (!(await data.archiveProduct(id, archived)).count)
    return { error: "Không tìm thấy sản phẩm." };
  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/orders");
  return { error: "" };
}
