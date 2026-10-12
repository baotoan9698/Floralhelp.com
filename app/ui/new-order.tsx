"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ProductView, CustomerView } from "@/lib/validation";
import { saveOrder } from "../actions";
import OrderForm from "./order-form";

export default function NewOrder({ products, customers, defaultDate }: { products: ProductView[]; customers: CustomerView[]; defaultDate: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return <main className="order-detail-page new-order-page">
    <Link className="order-back-link" href="/orders"><ArrowLeft size={17} />Danh sách đơn hàng</Link>
    <section className="order-modal order-detail card">
      <div className="modal-head">
        <h1>Tạo đơn hàng mới</h1>
        <div className="order-header-actions"><button className="secondary" type="button" disabled={pending} onClick={() => router.push("/orders")}>Hủy</button><button className="primary" type="submit" form="order-editor-form" disabled={pending}>{pending ? "Đang lưu…" : "Lưu đơn hàng"}</button></div>
      </div>
      <OrderForm order="new" products={products} customers={customers} defaultDate={defaultDate} error={error} onSubmit={(form) => {
        if (pending) return;
        setError("");
        start(async () => {
          try {
            const result = await saveOrder(form);
            if (result.error) setError(result.error);
            else { router.push("/orders"); router.refresh(); }
          } catch { setError("Chưa thể lưu đơn hàng. Vui lòng thử lại."); }
        });
      }} />
    </section>
  </main>;
}
