import "server-only";
import { db } from "./db";
import { requireShop } from "./auth";
import { Prisma } from "@prisma/client";
import type { OrderInput, ProductInput, CashInput, CustomerInput } from "./validation";
import { statuses } from "./validation";
import { orderChanges } from "./order-history";

// The tenant identity is derived only from the authenticated server session.
// No public function in this module accepts a shop ID from the browser.
export async function shopData() {
  const shop = await requireShop();
  const shopId = shop.id;
  return {
    shop,
    createCustomer: async (input: CustomerInput, id = "") => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await db.$transaction(async (tx) => {
            // Serialize customer creation with the same shop counter used by order creation.
            await tx.shop.update({ where: { id: shopId }, data: { customerSequence: { increment: 0 } } });
            const current = id ? await tx.customer.findFirst({ where: { id, shopId } }) : null;
            if (id && !current) return { error: "Không tìm thấy khách hàng trong shop của bạn." };
            const identityKey = `${input.name.trim()}|${input.phone.trim().replace(/[ ()-]/g, "")}`;
            const existing = await tx.customer.findUnique({ where: { shopId_identityKey: { shopId, identityKey } } });
            if (existing && existing.id !== id) return { error: `Khách hàng đã có trong danh bạ (${existing.code}).` };
            if (current) {
              await tx.customer.updateMany({ where: { id, shopId }, data: { ...input, identityKey } });
              return { error: "", code: current.code, customer: { id: current.id, code: current.code, ...input } };
            }
            const counter = await tx.shop.update({ where: { id: shopId }, data: { customerSequence: { increment: 1 } } });
            const customer = await tx.customer.create({ data: { ...input, shopId, identityKey, code: `KH${String(counter.customerSequence).padStart(6, "0")}` } });
            return { error: "", code: customer.code, customer: { id: customer.id, code: customer.code, ...input } };
          });
        } catch (error) {
          if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) continue;
          throw error;
        }
      }
      return { error: "Chưa thể thêm khách hàng. Vui lòng thử lại." };
    },
    customers: () => db.customer.findMany({ where: { shopId }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, phone: true, address: true, email: true, birthday: true, gender: true } }),
    saveOrder: async (id: string, input: OrderInput) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await db.$transaction(async (tx) => {
            // Lock this shop's counter before assigning either code; concurrent shops remain independent.
            const sequence = await tx.shop.update({ where: { id: shopId }, data: { orderSequence: { increment: id ? 0 : 1 } }, select: { orderSequence: true } });
            const existingOrder = id ? await tx.order.findFirst({ where: { id, shopId }, include: { payments: { orderBy: { position: "asc" } }, items: { orderBy: { position: "asc" } }, customerRecord: { select: { code: true } } } }) : null;
            if (id && !existingOrder) return { error: "Không tìm thấy đơn hàng." };
            const { customerId, customerEmail, customerBirthday, customerGender, items: submittedItems, payments: submittedPayments, ...snapshot } = input;
            const payments = submittedPayments ?? (input.paidAmount > 0 ? [{ amount: input.paidAmount, method: "unknown" as const }] : []);
            const oldUnknown = existingOrder ? (existingOrder.payments.length ? existingOrder.payments.filter((payment) => payment.method === "unknown").reduce((sum, payment) => sum + payment.amount, 0) : existingOrder.paidAmount) : 0;
            if (submittedPayments && payments.filter((payment) => payment.method === "unknown").reduce((sum, payment) => sum + payment.amount, 0) > oldUnknown) throw new Error("INVALID_PAYMENT_METHOD");
            const items = submittedItems ?? [{ name: input.product, productId: input.productId, quantity: 1, unitPrice: input.price - input.shippingFee + input.discount }];
            for (const item of items) {
              if (!item.productId) continue;
              const product = await tx.product.findFirst({ where: { id: item.productId, shopId } });
              const historical = existingOrder?.items.find((previous) => previous.productId === item.productId);
              if (!product || (product.archived && !historical && existingOrder?.productId !== product.id)) throw new Error("PRODUCT_NOT_FOUND");
              item.name = historical?.name ?? (existingOrder?.productId === product.id ? existingOrder.product : product.name);
            }
            snapshot.product = items.map((item) => item.name).join(" + ").slice(0, 160);
            snapshot.productId = items[0].productId;
            snapshot.price = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) + input.shippingFee - input.discount;
            snapshot.paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
            if (snapshot.price < 0 || snapshot.price > 2000000000 || snapshot.paidAmount > snapshot.price) throw new Error("INVALID_TOTAL");
            let customer;
            if (customerId) {
              customer = await tx.customer.findFirst({ where: { id: customerId, shopId } });
              if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
              snapshot.customer = customer.name;
              snapshot.phone = customer.phone;
            } else {
              const identityKey = `${input.customer.trim()}|${input.phone.trim().replace(/[ ()-]/g, "")}`;
              customer = await tx.customer.findUnique({ where: { shopId_identityKey: { shopId, identityKey } } });
              if (!customer) {
                const counter = await tx.shop.update({ where: { id: shopId }, data: { customerSequence: { increment: 1 } }, select: { customerSequence: true } });
                customer = await tx.customer.create({ data: { shopId, code: `KH${String(counter.customerSequence).padStart(6, "0")}`, name: input.customer, phone: input.phone, address: input.address, identityKey, email: customerEmail, birthday: customerBirthday, gender: customerGender } });
              }
            }
            const data = { ...snapshot, customerId: customer.id };
            let orderId = id;
            if (id) {
              await tx.order.updateMany({ where: { id, shopId }, data });
              await tx.orderItem.deleteMany({ where: { orderId: id, shopId } });
              await tx.orderPayment.deleteMany({ where: { orderId: id, shopId } });
            } else {
              const created = await tx.order.create({ data: { ...data, shopId, code: `DH${String(sequence.orderSequence).padStart(6, "0")}` } });
              orderId = created.id;
            }
            await tx.orderItem.createMany({ data: items.map((item, position) => ({ ...item, orderId, shopId, position })) });
            if (payments.length) await tx.orderPayment.createMany({ data: payments.map((payment, position) => ({ ...payment, orderId, shopId, position })) });
            const changes = orderChanges(existingOrder ? {
              ...existingOrder,
              customerCode: existingOrder.customerRecord.code,
              payments: existingOrder.payments.length ? existingOrder.payments : existingOrder.paidAmount > 0 ? [{ amount: existingOrder.paidAmount, method: "unknown" }] : [],
              items: existingOrder.items.length ? existingOrder.items : [{ productId: existingOrder.productId, name: existingOrder.product, quantity: 1, unitPrice: existingOrder.price }],
            } : null, { ...data, customerCode: customer.code, items, payments });
            if (!existingOrder || changes.length) await tx.orderHistory.create({ data: {
              orderId, shopId, actorId: shop.id, actorName: shop.name, actorEmail: shop.email,
              action: id ? "updated" : "created", changes: JSON.stringify(changes),
            } });
            return { error: "" };
          });
        } catch (error) {
          if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") return { error: "Không tìm thấy khách hàng trong shop của bạn." };
          if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") return { error: "Không tìm thấy sản phẩm đang bán trong shop của bạn." };
          if (error instanceof Error && error.message === "INVALID_PAYMENT_METHOD") return { error: "Chọn Tiền mặt hoặc Chuyển khoản cho lượt thanh toán mới." };
          if (error instanceof Error && error.message === "INVALID_TOTAL") return { error: "Tổng đơn tối đa 2 tỷ đồng và không được nhỏ hơn số đã thanh toán." };
          if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) continue;
          throw error;
        }
      }
      return { error: "Chưa thể cấp mã đơn. Vui lòng thử lại." };
    },
    updateOrderStatus: (id: string, status: OrderInput["status"]) => db.$transaction(async (tx) => {
      // Use the same shop lock as full order saves so history reflects the committed value.
      await tx.shop.update({ where: { id: shopId }, data: { orderSequence: { increment: 0 } } });
      const order = await tx.order.findFirst({ where: { id, shopId }, select: { status: true } });
      if (!order) return { error: "Không tìm thấy đơn hàng trong shop của bạn." };
      if (order.status === status) return { error: "" };
      await tx.order.updateMany({ where: { id, shopId }, data: { status } });
      await tx.orderHistory.create({ data: {
        orderId: id, shopId, actorId: shop.id, actorName: shop.name, actorEmail: shop.email,
        action: "updated", changes: JSON.stringify([{ field: "Trạng thái", before: statuses[order.status as keyof typeof statuses] ?? order.status, after: statuses[status] }]),
      } });
      return { error: "" };
    }),
    cashEntries: () => db.cashEntry.findMany({ where: { shopId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], select: { id: true, type: true, date: true, title: true, category: true, amount: true, note: true } }),
    createCashEntry: (data: CashInput) => db.cashEntry.create({ data: { ...data, shopId } }),
    updateCashEntry: (id: string, data: CashInput) => db.cashEntry.updateMany({ where: { id, shopId }, data }),
    deleteCashEntry: (id: string) => db.cashEntry.deleteMany({ where: { id, shopId } }),
    orders: () =>
      db.order.findMany({
        where: { shopId },
        orderBy: [{ date: "asc" }, { time: "asc" }],
        select: {
          id: true,
          code: true,
          customerId: true,
          customerRecord: { select: { code: true } },
          product: true,
          productId: true,
          customer: true,
          phone: true,
          address: true,
          date: true,
          orderDate: true,
          orderTime: true,
          source: true,
          items: { orderBy: { position: "asc" }, select: { productId: true, name: true, quantity: true, unitPrice: true } },
          time: true,
          price: true,
          paidAmount: true,
          shippingFee: true,
          discount: true,
          payments: { orderBy: { position: "asc" }, select: { amount: true, method: true } },
          status: true,
          note: true,
        },
      }),
    findOrder: (id: string) => db.order.findFirst({ where: { id, shopId } }),
    orderHistory: (orderId: string) => db.orderHistory.findMany({ where: { orderId, shopId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, actorName: true, actorEmail: true, action: true, changes: true, createdAt: true } }),
    orderDetail: (id: string) => db.order.findFirst({ where: { id, shopId }, include: { payments: { orderBy: { position: "asc" }, select: { amount: true, method: true } }, customerRecord: { select: { code: true } }, items: { orderBy: { position: "asc" }, select: { productId: true, name: true, quantity: true, unitPrice: true } } } }),
    deleteOrder: (id: string) => db.order.deleteMany({ where: { id, shopId } }),
    rename: (name: string) =>
      db.shop.update({ where: { id: shopId }, data: { name } }),
    products: () =>
      db.product.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          archived: true,
          images: {
            where: { shopId },
            orderBy: { slot: "asc" },
            select: { id: true, slot: true },
          },
        },
      }),
    findProduct: (id: string) =>
      db.product.findFirst({ where: { id, shopId } }),
    createProduct: (data: ProductInput) =>
      db.product.create({ data: { ...data, shopId } }),
    updateProduct: (id: string, data: ProductInput) =>
      db.product.updateMany({ where: { id, shopId }, data }),
    archiveProduct: (id: string, archived: boolean) =>
      db.product.updateMany({ where: { id, shopId }, data: { archived } }),
    findImage: (id: string) =>
      db.productImage.findFirst({ where: { id, shopId, product: { shopId } } }),
    imageSlots: (productId: string) =>
      db.productImage.findMany({
        where: { productId, shopId },
        select: { slot: true },
      }),
    createImage: (data: {
      productId: string;
      slot: number;
      storageKey: string;
      storageDriver: string;
    }) => db.productImage.create({ data: { ...data, shopId } }),
    deleteImage: (id: string) =>
      db.productImage.deleteMany({ where: { id, shopId } }),
  };
}
