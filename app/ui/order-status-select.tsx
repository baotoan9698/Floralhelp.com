"use client";
import { useState, useTransition } from "react";
import { updateOrderStatus } from "@/lib/update-order-status";
import { useRouter } from "next/navigation";
import { statuses, type OrderView } from "@/lib/validation";

export default function OrderStatusSelect({ order }: { order: OrderView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return <div className="order-status-control" onClick={(event) => event.stopPropagation()}>
    <select className={`order-status-select ${order.status}`} aria-label={`Trạng thái đơn ${order.code}`} value={order.status} disabled={pending} aria-busy={pending} onChange={(event) => {
      const status = event.target.value;
      setError("");
      start(async () => {
        try { const result = await updateOrderStatus(order.id, status); setError(result.error); if (!result.error) router.refresh(); }
        catch { router.refresh(); setError("Mất kết nối khi cập nhật. Vui lòng kiểm tra trạng thái và thử lại."); }
      });
    }}>
      {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    {pending && <small role="status">Đang lưu…</small>}
    {error && <small role="alert" className="danger-text">{error}</small>}
  </div>;
}
