"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Phone, UserRound, Flower2, MapPin } from "lucide-react";
import { type OrderView } from "@/lib/validation";
import OrderStatusSelect from "./order-status-select";
import OrderItemSummary from "./order-item-summary";
const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";
const date = (value: string) => value.split("-").reverse().join("/");
export default function OrdersTable({ orders, selectedIds, onSelect, onEdit, onDelete }: { orders: OrderView[]; selectedIds: Set<string>; onSelect: (ids: string[], checked: boolean) => void; onEdit: (order: OrderView) => void; onDelete: (order: OrderView) => void }) {
  const router = useRouter();
  const allSelected = orders.length > 0 && orders.every((order) => selectedIds.has(order.id));
  const someSelected = !allSelected && orders.some((order) => selectedIds.has(order.id));
  const selectPage = () => <input type="checkbox" className="order-checkbox" aria-label="Chọn tất cả đơn trên trang này" checked={allSelected} ref={(node) => { if (node) node.indeterminate = someSelected; }} onChange={(event) => onSelect(orders.map((order) => order.id), event.target.checked)} />;
  const open = (event: React.MouseEvent, order: OrderView) => {
    if (!(event.target as HTMLElement).closest("a, button, input, select") && !window.getSelection()?.toString()) router.push(`/orders/${order.id}`);
  };
  return <><div className="card orders-table-wrap" role="region" aria-label="Bảng đơn hàng" tabIndex={0}>
    <table className="orders-table">
      <thead><tr><th className="order-select-cell" scope="col">{selectPage()}</th><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Ngày đặt</th><th>Ngày giao hoa</th><th>Thanh toán</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
      <tbody>{orders.map((order) => <tr key={order.id} className="clickable-order" onClick={(event) => open(event, order)}>
        <td className="order-select-cell" onClick={(event) => event.stopPropagation()}><input type="checkbox" className="order-checkbox" aria-label={`Chọn đơn ${order.code}`} checked={selectedIds.has(order.id)} onChange={(event) => onSelect([order.id], event.target.checked)} /></td>
        <th scope="row"><Link className="order-code-link" href={`/orders/${order.id}`}>{order.code}</Link>{order.source && <small>{order.source}</small>}</th>
        <td><strong>{order.customer}</strong><small>{order.customerRecord.code}</small><a href={`tel:${order.phone}`}>{order.phone}</a><p>{order.address}</p></td>
        <td><strong><OrderItemSummary order={order} /></strong>{order.note && <p className="table-order-note">{order.note}</p>}</td>
        <td className="table-date"><strong>{date(order.orderDate)}</strong><small>{order.orderTime || "Chưa có giờ"}</small></td>
        <td className="table-date"><strong>{date(order.date)}</strong><small>{order.time}</small></td>
        <td className="table-payment"><strong>{money(order.price)}</strong><small>Đã trả: {money(order.paidAmount)}</small><span className={order.price > order.paidAmount ? "danger-text" : "cash-income"}>Còn: {money(order.price - order.paidAmount)}</span></td>
        <td><OrderStatusSelect order={order} /></td>
        <td><div className="table-actions"><button className="icon-button" aria-label={`Sửa đơn ${order.code}`} onClick={() => onEdit(order)}><Pencil size={16} /></button><button className="icon-button danger-text" aria-label={`Xóa đơn ${order.code}`} onClick={() => onDelete(order)}><Trash2 size={16} /></button></div></td>
      </tr>)}</tbody>
    </table>
  </div>
    <div className="mobile-orders" aria-label="Danh sách thẻ đơn hàng">
      <label className="mobile-select-page">{selectPage()} Chọn tất cả đơn trên trang này</label>
      {orders.map((order) => <article className="mobile-order card clickable-order" key={order.id} onClick={(event) => open(event, order)}>
        <div className="mobile-order-content">
          <div className="mobile-order-heading"><input type="checkbox" className="order-checkbox" aria-label={`Chọn đơn ${order.code}`} checked={selectedIds.has(order.id)} onChange={(event) => onSelect([order.id], event.target.checked)} /><Link className="order-code-link" href={`/orders/${order.id}`}>{order.code}</Link><span>Giao {order.time} · {date(order.date)}</span></div>
          <OrderStatusSelect order={order} />
          {order.source && <small className="mobile-order-source">Nguồn: {order.source}</small>}
          <div className="mobile-order-customer"><span><UserRound size={16} /><strong>{order.customer}</strong></span><a href={`tel:${order.phone}`}><Phone size={15} />{order.phone}</a></div>
          <div className="mobile-order-product"><span><Flower2 size={17} /><OrderItemSummary order={order} /></span><div className="mobile-order-money"><small>Tổng đơn</small><strong>{money(order.price)}</strong><small>Còn phải thu</small><strong className={order.price > order.paidAmount ? "danger-text" : "cash-income"}>{money(order.price - order.paidAmount)}</strong></div></div>
          <p className="mobile-order-address"><MapPin size={15} /><span>{order.address}</span></p>
          {order.note && <p className="mobile-order-note">{order.note}</p>}
          <small className="mobile-order-meta">{order.customerRecord.code} · Lên đơn {order.orderTime || "Chưa có giờ"} · {date(order.orderDate)}</small>
        </div>
        <div className="mobile-order-actions"><button aria-label={`Sửa đơn ${order.code}`} onClick={() => onEdit(order)}><Pencil size={16} />Sửa / Trạng thái</button><button className="danger-text" aria-label={`Xóa đơn ${order.code}`} onClick={() => onDelete(order)}><Trash2 size={16} />Xóa đơn</button></div>
      </article>)}
    </div>
  </>;
}
