"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCheck, Clock, Flower2, GripVertical, MessageSquare, Plus, Search, Truck, UserRound } from "lucide-react";
import { changeOrderStatus } from "@/app/actions";
import { statuses, type OrderView } from "@/lib/validation";
import OrderStatusSelect from "./order-status-select";
import { vietnamToday } from "@/lib/dates";

type Status = keyof typeof statuses;
type Drag = { id: string; x: number; y: number; startX: number; startY: number; active: boolean };
const icons = { pending: Clock, preparing: Flower2, delivering: Truck, done: CheckCheck };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";
const addDays = (day: string, amount: number) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); };

export default function OrderProcessing({ orders }: { orders: OrderView[] }) {
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState("today");
  const [range, setRange] = useState(() => ({ from: vietnamToday(), to: vietnamToday() }));
  const [draft, setDraft] = useState(() => ({ from: vietnamToday(), to: vietnamToday() }));
  function choosePeriod(value: string) {
    setPreset(value);
    if (value === "custom") { setDraft(range); return; }
    const today = vietnamToday();
    const next = value === "all" ? { from: "", to: "" } : value === "tomorrow" ? { from: addDays(today, 1), to: addDays(today, 1) } : { from: today, to: value === "week" ? addDays(today, 6) : today };
    setRange(next); setDraft(next);
  }
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const board = useRef<HTMLDivElement>(null);
  const visible = orders.filter(order => (!range.from || order.date >= range.from) && (!range.to || order.date <= range.to) && `${order.code} ${order.customer} ${order.phone} ${order.product}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")))
    .sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.code.localeCompare(b.code));
  const columnAt = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-processing-column]");
    return element && board.current?.contains(element) ? element.dataset.processingColumn as Status : null;
  };
  function cancelDrag() { dragRef.current = null; setDrag(null); setOver(null); }
  useEffect(() => {
    if (!drag?.active) return;
    let frame: number;
    const tick = () => {
      const current = dragRef.current;
      const container = board.current;
      if (!current || !container) return;
      const rect = container.getBoundingClientRect();
      if (current.x < rect.left + 45) container.scrollLeft -= 10;
      else if (current.x > rect.right - 45) container.scrollLeft += 10;
      if (current.y < 70) window.scrollBy(0, -8);
      else if (current.y > window.innerHeight - 70) window.scrollBy(0, 8);
      const column = document.elementFromPoint(current.x, current.y)?.closest("[data-processing-column]");
      const cards = column?.querySelector<HTMLElement>(".processing-cards");
      if (cards) {
        const bounds = cards.getBoundingClientRect();
        if (current.y > bounds.bottom - 45) cards.scrollTop += 8;
        else if (current.y < bounds.top + 45) cards.scrollTop -= 8;
      }
      setOver(columnAt(current.x, current.y));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancelDrag(); };
    const blur = () => cancelDrag();
    window.addEventListener("keydown", escape);
    window.addEventListener("blur", blur);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", escape); window.removeEventListener("blur", blur); };
  }, [drag?.active]);
  function finishDrag(event: React.PointerEvent<HTMLElement>) {
    const current = dragRef.current;
    const target = columnAt(event.clientX, event.clientY);
    cancelDrag();
    const order = orders.find(order => order.id === current?.id);
    if (!current?.active || !order || !target || order.status === target || pending) return;
    setError(""); setMessage("");
    start(async () => {
      try {
        const result = await changeOrderStatus(order.id, target);
        if (result.error) setError(result.error);
        else setMessage(`${order.code} đã chuyển sang ${statuses[target]}.`);
      } catch { setError("Chưa chuyển được đơn. Vui lòng tải lại trang và thử lại."); }
    });
  }
  return <section className="processing-page">
    <div className="page-heading">
      <div><span className="eyebrow">CHĂM CHÚT TỪNG ĐƠN HOA</span><h1>Xử Lí đơn <span className="heading-flower">✳</span></h1><p>Kéo thả đơn hàng giữa các trạng thái để cập nhật tiến độ.</p></div>
      <Link className="primary" href="/orders/new"><Plus size={19} />Tạo đơn hàng</Link>
    </div>
    <div className="processing-toolbar"><span>{visible.length} đơn hàng</span><label className="search"><Search size={18} /><input aria-label="Tìm đơn cần xử lí" placeholder="Tìm mã đơn, khách hàng, số điện thoại…" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
    <div className="processing-periods" role="group" aria-label="Lọc ngày giao hoa"><strong>Ngày giao hoa</strong>{[["today","Hôm nay"],["tomorrow","Ngày mai"],["week","7 ngày tới"],["all","Tất cả"],["custom","Khoảng ngày"]].map(([value,label]) => <button type="button" key={value} className={preset===value ? "active" : ""} aria-pressed={preset===value} onClick={()=>choosePeriod(value)}>{label}</button>)}
    <form className="processing-custom-range" aria-label="Khoảng ngày giao hoa" onSubmit={event=>{event.preventDefault(); if(draft.from && draft.to && draft.from>draft.to) return; setRange(draft); setPreset("custom");}}>
      <input aria-label="Từ ngày" type="date" value={draft.from} max={draft.to || undefined} onChange={event=>setDraft({...draft,from:event.target.value})}/>
      <span aria-hidden="true">→</span>
      <input aria-label="Đến ngày" type="date" value={draft.to} min={draft.from || undefined} onChange={event=>setDraft({...draft,to:event.target.value})}/>
      <button type="submit">Áp dụng</button>
    </form>
    </div>
    <p className="processing-feedback" role={error ? "alert" : "status"}>{error || (pending ? "Đang cập nhật trạng thái…" : message || "Kéo trực tiếp thẻ đơn sang cột khác để đổi trạng thái.")}</p>
    <div ref={board} className={`processing-board${drag?.active ? " is-dragging" : ""}`} aria-label="Bảng xử lí đơn hàng">
      {(Object.keys(statuses) as Status[]).map(status => {
        const items = visible.filter(order => order.status === status);
        const Icon = icons[status];
        return <section key={status} data-processing-column={status} className={`processing-column ${status}${over === status ? " drag-over" : ""}`} aria-label={statuses[status]}>
          <header><Icon size={22} /><h2>{statuses[status]}</h2><span className="processing-count">{items.length}</span></header>
          <div className="processing-cards">
            {items.map(order => <article key={order.id} data-order-id={order.id} aria-label={`Đơn ${order.code}`} className={`processing-card${drag?.active && drag.id === order.id ? " dragging" : ""}`} onPointerDown={event => {
                  if (pending || event.button !== 0 || !event.isPrimary || (event.target as HTMLElement).closest("a, select, option, .order-status-control")) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const current = { id: order.id, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, active: false };
                  dragRef.current = current; setDrag(current);
                }} onPointerMove={event => {
                  const current = dragRef.current;
                  if (!current || current.id !== order.id) return;
                  const next = { ...current, x: event.clientX, y: event.clientY, active: current.active || Math.hypot(event.clientX-current.startX,event.clientY-current.startY)>6 };
                  dragRef.current = next; setDrag(next); setOver(columnAt(event.clientX,event.clientY));
                }} onPointerUp={finishDrag} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}>
              <div className="processing-card-heading">
                <button type="button" className="processing-drag-handle" aria-label={`Kéo đơn ${order.code}`} title="Kéo thẻ để đổi trạng thái" disabled={pending}><GripVertical size={17} /></button>
                <Link href={`/orders/${order.id}`} className="order-code-link">{order.code}</Link>
                <span className="processing-delivery"><Clock size={12} />{order.time} · {order.date.slice(5).split("-").reverse().join("/")}</span>
              </div>
              <p className="processing-customer"><UserRound size={14} /><strong title={order.customer}>{order.customer}</strong><a href={`tel:${order.phone}`}>{order.phone}</a></p>
              <ul className="processing-products">{(order.items?.length ? order.items : [{name:order.product,quantity:1}]).slice(0,1).map((item,index)=><li key={index}><Flower2 size={14}/><span title={item.name}>{item.name}</span><b>×{item.quantity}</b></li>)}{(order.items?.length ?? 0)>1 && <li className="processing-more">+{(order.items?.length ?? 0)-1} sản phẩm</li>}</ul>
              {order.note && <p className="processing-note"><MessageSquare size={15}/><span>{order.note}</span></p>}
              <div className="processing-money"><div><span>Tổng đơn</span><strong>{money(order.price)}</strong></div><div><span>Còn phải thu</span><strong>{money(order.price-order.paidAmount)}</strong></div></div>
              <OrderStatusSelect order={order} />
            </article>)}
            {!items.length && <div className="processing-empty">{drag?.active ? "Thả đơn vào đây" : "Chưa có đơn hàng"}</div>}
          </div>
        </section>;
      })}
    </div>
    {drag?.active && <div className="processing-drag-preview" aria-hidden="true" style={{left:Math.min(drag.x+12,window.innerWidth-245),top:drag.y+12}}><strong>{orders.find(order=>order.id===drag.id)?.code}</strong><p>{orders.find(order=>order.id===drag.id)?.customer}</p><p>{orders.find(order=>order.id===drag.id)?.product}</p><small>{over ? `→ ${statuses[over]}` : "Chọn cột trạng thái"}</small></div>}
  </section>;
}
