"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { deleteStoredImage } from "@/lib/image-storage";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { randomBytes } from "node:crypto";
import { adminHostAllowed, createAdminSession, deleteAdminSession, requireAdmin } from "@/lib/admin-auth";
export async function adminLogin(_: { error: string }, form: FormData) {
  if (!(await adminHostAllowed())) return { error: "Vui lòng sử dụng địa chỉ quản trị." };
  const parsed = z.object({ email: z.email().max(254), password: z.string().min(10).max(128) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Kiểm tra email và mật khẩu." };
  const email = parsed.data.email.toLowerCase().trim(); const key = `admin:${email}`;
  await db.authAttempt.deleteMany({ where: { key, resetsAt: { lte: new Date() } } });
  const attempt = await db.authAttempt.upsert({ where: { key }, create: { key, resetsAt: new Date(Date.now() + 900000) }, update: { count: { increment: 1 } } });
  if (attempt.count > 10) return { error: "Thử lại sau 15 phút." };
  const admin = await db.admin.findUnique({ where: { email } });
  const valid = verifyPassword(parsed.data.password, admin?.passwordHash ?? ("0".repeat(32) + ":" + "0".repeat(128)));
  if (!admin || !valid) return { error: "Email hoặc mật khẩu không đúng." };
  await db.authAttempt.deleteMany({ where: { key } });
  await createAdminSession(admin.id);
  redirect("/admin");
}
export async function adminLogout() { await deleteAdminSession(); redirect("/admin/login"); }
export async function resetShopPassword(id: string) {
  const admin = await requireAdmin();
  if (typeof id !== "string" || !id || id.length > 128) return { error: "Shop không hợp lệ." };
  const password = `Fh!9${randomBytes(24).toString("base64url")}`;
  const changed = await db.$transaction(async (tx) => {
    const shop = await tx.shop.findUnique({ where: { id } });
    if (!shop) return false;
    await tx.shop.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
    await tx.session.deleteMany({ where: { shopId: id } });
    await tx.authAttempt.deleteMany({ where: { key: { in: [shop.email, `change-password:${id}`] } } });
    await tx.adminEvent.create({ data: { adminId: admin.id, shopId: id, details: JSON.stringify({ type: "password-reset" }) } });
    return true;
  });
  if (!changed) return { error: "Không tìm thấy shop." };
  revalidatePath("/admin");
  return { error: "", password };
}
export async function deleteShopAccount(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const shop = await db.shop.findUnique({ where: { id } });
  if (!shop || shop.email !== email) return { error: "Nhập chính xác email của shop để xác nhận xóa." };
  // Revoke access before removing private files, so failed cleanup can be retried safely.
  await db.$transaction(async (tx) => {
    await tx.shop.update({ where: { id }, data: { accessStatus: "suspended" } });
    await tx.session.deleteMany({ where: { shopId: id } });
  });
  const images = await db.productImage.findMany({ where: { shopId: id } });
  try {
    for (const image of images) {
      await deleteStoredImage(id, image.storageKey, image.storageDriver);
      await db.productImage.deleteMany({ where: { id: image.id, shopId: id } });
    }
  } catch {
    revalidatePath("/admin");
    return { error: "Shop đã khóa. Chưa xóa hết ảnh do lỗi kho lưu trữ; kiểm tra kết nối và bấm xóa lại để hoàn tất." };
  }
  await db.$transaction(async (tx) => {
    await tx.order.deleteMany({ where: { shopId: id } });
    await tx.customer.deleteMany({ where: { shopId: id } });
    await tx.product.deleteMany({ where: { shopId: id } });
    await tx.authAttempt.deleteMany({ where: { key: email } });
    await tx.shop.delete({ where: { id } });
  });
  revalidatePath("/admin");
  return { error: "" };
}
export async function setShopAccess(_: { error: string; success?: string }, form: FormData) {
  const admin = await requireAdmin();
  const parsed = z.object({ id: z.string().min(1), status: z.enum(["active", "pending", "suspended", "rejected"]), plan: z.enum(["trial", "paid", "legacy"]), until: z.union([z.literal(""), z.iso.date()]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Chọn trạng thái và ngày hết hạn hợp lệ." };
  const { id, status, until, plan } = parsed.data;
  const accessUntil = until ? new Date(`${until}T23:59:59.999+07:00`) : null;
  if (status === "active" && (!accessUntil || accessUntil <= new Date())) return { error: "Ngày hết hạn phải từ hôm nay trở đi khi mở sử dụng." };
  await db.$transaction(async (tx) => {
    const before = await tx.shop.findUniqueOrThrow({ where: { id } });
    if (before.plan === plan && before.accessStatus === status && (before.accessUntil?.getTime() ?? null) === (accessUntil?.getTime() ?? null)) return;
    await tx.shop.update({ where: { id }, data: { accessStatus: status, accessUntil, plan } });
    if (before.accessStatus !== status || (before.accessUntil?.getTime() ?? null) !== (accessUntil?.getTime() ?? null)) await tx.session.deleteMany({ where: { shopId: id } });
    await tx.adminEvent.create({ data: { adminId: admin.id, shopId: id, details: JSON.stringify({ before: { plan: before.plan, status: before.accessStatus, until: before.accessUntil?.toISOString() ?? null }, after: { plan, status, until: accessUntil?.toISOString() ?? null } }) } });
  });
  revalidatePath("/admin");
  return { error: "", success: "Đã cập nhật quyền sử dụng." };
}
