"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { paymentMethods, type OrderView, type OrderPaymentInput } from "@/lib/validation";
import MoneyInput from "./money-input";
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";
export default function PaymentFields({ order, suggestedPrice }: { order: OrderView | "new"; suggestedPrice: { value: number } | null }) {
  const [shipping, setShipping] = useState(order === "new" ? "0" : String(order.shippingFee ?? 0));
  const [discount, setDiscount] = useState(order === "new" ? "0" : String(order.discount ?? 0));
  const [rows, setRows] = useState(() => {
    const initial = order === "new" ? [] : order.payments?.length ? order.payments : order.paidAmount ? [{ amount: order.paidAmount, method: "unknown" as const }] : [];
    return (initial.length ? initial : [{ amount: 0, method: "cash" as const }]).map((payment, key) => ({ key, amount: String(payment.amount), method: payment.method, legacy: payment.method === "unknown" }));
  });
  const [nextKey, setNextKey] = useState(rows.length);
  const subtotal = suggestedPrice?.value ?? (order === "new" ? 0 : order.price - (order.shippingFee ?? 0) + (order.discount ?? 0));
  const total = subtotal + Number(shipping) - Number(discount);
  const paid = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const paymentLimit = Math.max(0, total);
  if (paid > paymentLimit) {
    let remaining = paymentLimit;
    setRows(rows.map((row) => {
      const amount = Math.min(Number(row.amount), remaining);
      remaining -= amount;
      return { ...row, amount: String(amount) };
    }));
  }
  const payments = rows.filter((row) => Number(row.amount) !== 0).map((row) => ({ amount: Number(row.amount), method: row.method }));
  return <div className="order-payment-columns">
    <section className="order-section order-payment payment-value"><h3>Thanh toán</h3>
    <label>Tiền sản phẩm (₫)<input readOnly value={money(subtotal)} /></label>
    <label>Chi phí vận chuyển (₫)<MoneyInput name="shippingFee" value={shipping} onChange={setShipping} /></label>
    <label>Giảm giá (₫)<MoneyInput name="discount" value={discount} onChange={setDiscount} /></label>
    <label className="payment-grand-total">Tổng tiền cần phải thu khách<input readOnly value={money(total)} /><input type="hidden" name="price" value={total} /></label>
    {total < 0 && <p className="danger-text" role="alert">Giảm giá không được vượt tiền sản phẩm và vận chuyển.</p>}
    </section>
    <section className="order-section payment-installments">
      <div className="payment-installments-heading"><h4>Các lượt thanh toán</h4><button type="button" className="secondary" aria-label="Thêm lượt thanh toán" disabled={rows.length >= 100} onClick={() => { setRows([...rows, { key: nextKey, amount: "0", method: "cash", legacy: false }]); setNextKey(nextKey + 1); }}><Plus size={16} />Thêm</button></div>
      <input type="hidden" name="payments" value={JSON.stringify(payments)} />
      <input type="hidden" name="paidAmount" value={paid} />
      <div className="payment-installment-list">
      {rows.map((row, index) => <div className="payment-installment" key={row.key}>
        <label>Số tiền · lần {index + 1}<MoneyInput ariaLabel={`Số tiền thanh toán ${index + 1}`} name={`payment-${row.key}`} value={row.amount} max={Math.max(0, paymentLimit - (paid - Number(row.amount)))} onChange={(amount) => setRows(rows.map((item) => item.key === row.key ? { ...item, amount } : item))} /></label>
        <label>Phương thức<select aria-label={`Phương thức thanh toán ${index + 1}`} value={row.method} onChange={(event) => setRows(rows.map((item) => item.key === row.key ? { ...item, method: event.target.value as OrderPaymentInput["method"] } : item))}>
          {row.legacy && <option value="unknown">{paymentMethods.unknown}</option>}
          <option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option>
        </select></label>
        <button className="icon-button danger-text" type="button" aria-label={`Xóa lượt thanh toán ${index + 1}`} onClick={() => setRows(rows.filter((item) => item.key !== row.key))}><X size={16} /></button>
      </div>)}
      {!rows.length && <p className="customer-code-hint">Chưa có lượt thanh toán.</p>}
      </div>
    <label>Đã thanh toán (₫)<input readOnly value={money(paid)} /></label>
    <label>Còn lại (₫)<input readOnly value={money(total - paid)} aria-live="polite" />{paid > total && <span className="danger-text">Đã thanh toán không được vượt giá trị đơn.</span>}</label>
    </section>
  </div>;
}
