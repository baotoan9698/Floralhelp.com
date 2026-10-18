import { requireShop } from "@/lib/auth";
import { shopData } from "@/lib/shop-data";
import type { OrderView, CashView } from "@/lib/validation";
import { redirect } from "next/navigation";
import Dashboard from "./dashboard";
export default async function ShopPage({
  initialView = "calendar",
}: {
  initialView?: "calendar" | "reports" | "orders" | "processing" | "reminders" | "products" | "cashflow" | "customers";
}) {
  const shop = await requireShop();
  const data = await shopData();
  const [orders, products, cashEntries, customers] = await Promise.all([
    data.orders(),
    data.products(),
    initialView === "cashflow" || initialView === "reports" ? data.cashEntries() : Promise.resolve([]),
    data.customers(),
  ]);
  return (
    <Dashboard
      key={`${shop.id}:${initialView}`}
      initialView={initialView}
      shop={{ name: shop.name, email: shop.email, accessUntil: shop.accessUntil ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(shop.accessUntil) + " (giờ Việt Nam)" : null }}
      orders={orders as OrderView[]}
      products={products}
      customers={customers}
      cashEntries={cashEntries as CashView[]}
    />
  );
}
