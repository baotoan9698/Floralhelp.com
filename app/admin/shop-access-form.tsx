"use client";
import { useState, useTransition } from "react";
import { setShopAccess } from "./actions";
export default function ShopAccessForm({ id, status, until, plan }: { id: string; status: string; until: string; plan: string }) {
  const [state, setState] = useState<{ error: string; success?: string }>({ error: "" });
  const [pending, startTransition] = useTransition();
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [selectedUntil, setSelectedUntil] = useState(until);
  const [savedValues, setSavedValues] = useState({ status, until });
  if (savedValues.status !== status || savedValues.until !== until) {
    setSavedValues({ status, until });
    setSelectedStatus(status); setSelectedUntil(until);
  }
  return <form onSubmit={(event) => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setState({ error: "" });
    startTransition(async () => {
      try { setState(await setShopAccess({ error: "" }, form)); }
      catch { setState({ error: "Chưa lưu được quyền sử dụng. Vui lòng thử lại." }); }
    });
  }} className="admin-access-form">
    <input name="id" type="hidden" value={id} />
    <label>Gói sử dụng<select name="plan" defaultValue={plan} key={plan}><option value="trial">Dùng thử</option><option value="paid">Trả phí</option><option value="legacy">Chưa phân loại</option></select></label>
    <label>Trạng thái<select aria-label="Trạng thái" name="status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}><option value="unverified">Chờ xác minh email</option><option value="pending">Chờ duyệt</option><option value="active">Cho phép sử dụng</option><option value="suspended">Tạm khóa</option><option value="rejected">Từ chối</option></select></label>
    <label>Sử dụng đến hết ngày<input type="date" name="until" value={selectedUntil} onChange={(event) => setSelectedUntil(event.target.value)} /></label>
    <button className="primary" disabled={pending}>{pending ? "Đang lưu…" : "Lưu quyền sử dụng"}</button>
    {state.error && <p className="error" role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
  </form>;
}
