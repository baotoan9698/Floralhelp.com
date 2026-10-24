import Link from "next/link";
import { shopStorage, bytes, planLabels } from "@/lib/admin-metrics";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { accessReason } from "@/lib/access";
import { adminLogout } from "./actions";
import ShopAccessForm from "./shop-access-form";
import DeleteShop from "./delete-shop";
import ResetPassword from "./reset-password";
const labels: Record<string, string> = { unverified: "Chờ xác minh email", active: "Đang hoạt động", expired: "Hết hạn", pending: "Chờ duyệt", suspended: "Tạm khóa", rejected: "Từ chối" };
const date = (value: Date) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(value);
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requireAdmin();
  const { q = "" } = await searchParams;
  const shops = await db.shop.findMany({ where: q ? { OR: [{ name: { contains: q.slice(0, 100) } }, { email: { contains: q.slice(0, 100) } }] } : {}, orderBy: { createdAt: "desc" }, take: 100, include: { _count: { select: { orders: true, customers: true, products: true } }, adminEvents: { take: 5, orderBy: { createdAt: "desc" }, include: { admin: { select: { name: true } } } } } });
  const all = await db.shop.findMany({select:{accessStatus:true,accessUntil:true,plan:true,emailVerificationRequired:true,emailVerifiedAt:true}});
  const active = all.filter(shop=>!accessReason(shop)).length;
  const storage = await shopStorage(shops.map(shop=>shop.id));
  return <main className="admin-page"><header><div><h1>Quản trị shop</h1><p>{admin.name} · {admin.email}</p></div><form action={adminLogout}><button className="secondary">Đăng xuất admin</button></form></header>
    <nav className="admin-tabs"><Link href="/admin" aria-current="page">Quản trị shop</Link><Link href="/admin/server">Thông số server</Link></nav>
    <div className="admin-metric-grid">{[["Tổng số shop",all.length],["Đang hoạt động / tổng",`${active} / ${all.length}`],["Không hoạt động",all.length-active],["Dùng thử",all.filter(shop=>shop.plan==='trial').length],["Trả phí",all.filter(shop=>shop.plan==='paid').length],["Chưa phân loại",all.filter(shop=>shop.plan==='legacy').length]].map(([label,value])=><article className="card" key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>
    <p>Đang hoạt động = được cho phép sử dụng và chưa hết hạn. Shop mới nhận gói dùng thử 15 ngày. Gói trả phí do admin xác nhận; không suy đoán từ thời hạn.</p>
    <form className="admin-search"><input name="q" aria-label="Tìm shop" placeholder="Tên shop hoặc email…" defaultValue={q} /><button className="secondary">Tìm kiếm</button></form>
    <p>Hiển thị tối đa 100 shop. Thời hạn được tính theo giờ Việt Nam.</p>
    <div className="admin-shop-grid">{shops.map((shop) => <article className="card admin-shop" key={shop.id}>
      <div className="admin-shop-row">
        <div className="admin-shop-identity"><h2>{shop.name}</h2><p>{shop.email}</p><small className="badge">{planLabels[shop.plan] ?? shop.plan}</small></div>
        <div className="admin-shop-counts"><strong>{shop._count.orders} đơn</strong><small>{shop._count.products} sản phẩm · {shop._count.customers} khách hàng</small></div>
        <div className="admin-shop-dates"><span>Hết hạn: {shop.accessUntil ? date(shop.accessUntil) : "Chưa đặt hạn"}</span><small>Đăng ký: {date(shop.createdAt)}</small></div>
        <strong className={`badge admin-status admin-status-${accessReason(shop) ?? "active"}`}>{labels[accessReason(shop) ?? "active"]}</strong>
      </div>
      <p className="admin-storage">Ảnh: {bytes(storage.get(shop.id)?.images ?? 0)} · DB ước tính: {bytes(storage.get(shop.id)?.data ?? null)} · Tổng: {(storage.get(shop.id)?.data == null || !!storage.get(shop.id)?.missing) ? "Chưa đủ dữ liệu" : bytes((storage.get(shop.id)?.images ?? 0)+(storage.get(shop.id)?.data ?? 0))}{!!storage.get(shop.id)?.missing && ` · ${storage.get(shop.id)?.missing} ảnh chưa đo được`}</p>
      <details className="admin-shop-management"><summary aria-label={`Quản lý ${shop.name}`}>Quản lý</summary><div className="admin-shop-management-body">
      <ShopAccessForm key={`${shop.id}-${shop.plan}`} plan={shop.plan} id={shop.id} status={shop.accessStatus} until={shop.accessUntil ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(shop.accessUntil) : ""} />
      <small>DB là kích thước bản ghi, không gồm index, WAL, backup dùng chung. Ảnh ngoài server hoặc thiếu file được báo riêng.</small>
      <details><summary>Lịch sử quản trị gần đây</summary>{shop.adminEvents.map((entry) => { const change = JSON.parse(entry.details); return <p key={entry.id}>{date(entry.createdAt)} · {entry.admin.name}<br />{change.type === "password-reset" ? "Đã reset mật khẩu shop" : <>{labels[change.before.status]} → {labels[change.after.status]}<br />{change.after.plan && <>Gói: {planLabels[change.before.plan] ?? "Chưa phân loại"} → {planLabels[change.after.plan]}<br /></>}Hạn cũ: {change.before.until ? date(new Date(change.before.until)) : "Chưa đặt"} → {change.after.until ? date(new Date(change.after.until)) : "?"}</>}</p>; })}{!shop.adminEvents.length && <p>Chưa có thay đổi.</p>}</details>
      <ResetPassword id={shop.id} />
      <DeleteShop id={shop.id} email={shop.email} />
      </div></details>
    </article>)}</div>{!shops.length && <p>Không tìm thấy shop.</p>}
  </main>;
}
