import { shopData } from "@/lib/shop-data";
import { vietnamToday } from "@/lib/dates";
import NewOrder from "../../ui/new-order";

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const data = await shopData();
  const { date } = await searchParams;
  const valid = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  const [products, customers] = await Promise.all([data.products(), data.customers()]);
  return <NewOrder products={products} customers={customers} defaultDate={valid ? date : vietnamToday()} />;
}
