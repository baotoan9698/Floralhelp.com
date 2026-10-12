"use client";
import { useState, useTransition } from "react";
import { changeOrderStatus } from "@/app/actions";
import { statuses, type OrderView } from "@/lib/validation";

export default function OrderStatusSelect({ order }: { order: OrderView }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return <div className="order-status-control" onClick={(event) => event.stopPropagation()}>
    <select className={`order-status-select ${order.status}`} aria-label={`Trạng thái đơn ${order.code}`} value={order.status} disabled={pending} aria-busy={pending} onChange={(event) => {
      const status = event.target.value;
      setError("");
      start(async () => {
        try { const result = await changeOrderStatus(order.id, status); setError(result.error); }
        catch { setError("Chưa đổi được trạng thái. Vui lòng tải lại trang và thử lại."); }
      });
    }}>
      {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    {pending && <small role="status">Đang lưu…</small>}
    {error && <small role="alert" className="danger-text">{error}</small>}
  </div>;
}
