"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  Flower2,
  Flower,
  Menu,
  House,
  ClipboardList,
  Columns3,
  Settings,
  LogOut,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Package,
  Truck,
  CheckCheck,
  ArrowUpRight,
  MapPin,
  Phone,
  Clock,
  Pencil,
  Trash2,
} from "lucide-react";
import { statuses, type OrderView, type ProductView, type CashView, type CustomerView } from "@/lib/validation";
import { logout, saveOrder, removeOrder, renameShop } from "../actions";
import Reports from "./reports";
import Products from "./products";
import Cashflow from "./cashflow";
import Customers from "./customers";
import OrdersTable from "./orders-table";
import OrderProcessing from "./order-processing";
import OrderForm from "./order-form";
import OrderHistoryLoader from "./order-history-loader";
import OrderItemSummary from "./order-item-summary";
import CuteFlower from "./cute-flower";
import ChangePassword from "./change-password";
import { Users } from "lucide-react";
import { Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChartNoAxesCombined } from "lucide-react";
const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function Modal({
  title,
  close,
  children,
  className,
  headerActions,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      className={className}
      aria-labelledby={titleId}
      ref={ref}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        backdropPress.current = event.target === event.currentTarget &&
          (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
      }}
      onPointerCancel={() => { backdropPress.current = false; }}
      onClick={(e) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        const outside = e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom;
        if (backdropPress.current && e.target === e.currentTarget && outside) close();
        backdropPress.current = false;
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        {headerActions ?? <button className="icon-button" aria-label="Đóng" onClick={close}>
          <X />
        </button>}
      </div>
      {children}
    </dialog>
  );
}
export default function Dashboard({
  shop,
  orders,
  products,
  cashEntries,
  customers,
  initialView = "calendar",
}: {
  shop: { name: string; email: string; accessUntil: string | null };
  orders: OrderView[];
  products: ProductView[];
  cashEntries: CashView[];
  customers: CustomerView[];
  initialView?: "calendar" | "reports" | "orders" | "processing" | "products" | "cashflow" | "customers";
}) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [day, setDay] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  useEffect(() => {
    setDesktopExpanded(sessionStorage.getItem("shop-menu-expanded") === "true");
  }, []);
  function toggleDesktopMenu() {
    setDesktopExpanded((expanded) => {
      sessionStorage.setItem("shop-menu-expanded", String(!expanded));
      return !expanded;
    });
  }
  const menuDialog = useRef<HTMLDialogElement>(null);
  const menuToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1001px)");
    const sync = () => {
      if (desktop.matches) { menuDialog.current?.close(); setMenuOpen(false); }
    };
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);
  function closeMenu() {
    menuDialog.current?.close();
    setMenuOpen(false);
    menuToggle.current?.focus();
  }
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [orderFrom, setOrderFrom] = useState("");
  const [orderTo, setOrderTo] = useState("");
  const [draftOrderFrom, setDraftOrderFrom] = useState("");
  const [draftOrderTo, setDraftOrderTo] = useState("");
  const [receivablesOnly, setReceivablesOnly] = useState(false);
  const orderList = useRef<HTMLElement>(null);
  const view = initialView;
  const router = useRouter();
  const [editing, setEditingState] = useState<OrderView | "new" | null>(null);
  function setEditing(value: OrderView | "new" | null) {
    if (value === "new") {
      router.push(`/orders/new${day ? `?date=${encodeURIComponent(day)}` : ""}`);
      return;
    }
    setEditingState(value);
  }
  const [deleting, setDeleting] = useState<OrderView | null>(null);
  const [settings, setSettings] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ key: "", page: 1 });
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const settingsFormId = useId();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const prefix = dateKey(month).slice(0, 7);
  const monthOrders = orders.filter((o) => o.date.startsWith(prefix));
  const unpaidOrders = monthOrders.filter((o) => o.price > o.paidAmount);
  const receivable = unpaidOrders.reduce((sum, o) => sum + o.price - o.paidAmount, 0);
  const filtered = (view === "orders" ? orders : monthOrders).filter(
    (o) =>
      (view === "orders" || !day || o.date === day) &&
      (view === "orders" || !receivablesOnly || o.price > o.paidAmount) &&
      (filter === "all" || o.status === filter) &&
      (view !== "orders" || ((!orderFrom || o.orderDate >= orderFrom) && (!orderTo || o.orderDate <= orderTo))) &&
      `${o.code} ${o.customerRecord.code} ${o.product} ${o.items?.map((item) => item.name).join(" ") ?? ""} ${o.customer} ${o.phone}`
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")),
  );
  const today = dateKey(new Date());
  if (view === "orders") {
    filtered.sort((a, b) =>
      b.code.localeCompare(a.code, "vi", { numeric: true }),
    );
  }
  const paginationKey = JSON.stringify([prefix, day, receivablesOnly, filter, query, orderFrom, orderTo, pageSize]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = pagination.key === paginationKey ? Math.min(pagination.page, pageCount) : 1;
  if (pagination.key !== paginationKey || pagination.page !== currentPage) {
    setPagination({ key: paginationKey, page: currentPage });
  }
  const pageStart = (currentPage - 1) * pageSize;
  const visibleOrders = filtered.slice(pageStart, pageStart + pageSize);
  const selectionKey = JSON.stringify([view, filter, query, orderFrom, orderTo]);
  if (selection.key !== selectionKey) setSelection({ key: selectionKey, ids: [] });
  const selectedIds = new Set(selection.key === selectionKey ? selection.ids.filter((id) => filtered.some((order) => order.id === id)) : []);
  function selectOrders(ids: string[], checked: boolean) {
    const next = new Set(selectedIds);
    ids.forEach((id) => checked ? next.add(id) : next.delete(id));
    setSelection({ key: selectionKey, ids: [...next] });
  }
  const offset =
    (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  function move(delta: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
    setDay("");
  }
  function task(work: () => Promise<{ error: string }>, success: () => void) {
    setError("");
    start(async () => {
      try {
        const result = await work();
        if (result.error) setError(result.error);
        else success();
      } catch {
        setError("Chưa thể lưu thay đổi. Vui lòng thử lại hoặc đăng nhập lại.");
      }
    });
  }
  const stats = [
    {
      label: "Tổng đơn hàng",
      value: monthOrders.length,
      icon: Package,
      tint: "rose",
      sub: "Đơn hàng trong tháng",
    },
    {
      label: "Đang thực hiện",
      value: monthOrders.filter((o) => o.status !== "done").length,
      icon: Truck,
      tint: "amber",
      sub: "Cần shop chăm chút",
    },
    {
      label: "Đã giao thành công",
      value: monthOrders.filter((o) => o.status === "done").length,
      icon: CheckCheck,
      tint: "green",
      sub: "Niềm vui đã trao đi",
    },
    {
      label: "Giá trị đơn hàng",
      value: money(monthOrders.reduce((s, o) => s + o.price, 0)),
      icon: ArrowUpRight,
      tint: "purple",
      sub: "Tổng giá trị trong tháng",
    },
  ];
  return (
    <div className={`app-shell${desktopExpanded ? " desktop-menu-expanded" : ""}`}>
      <aside className="sidebar desktop-sidebar" aria-label="Menu PC">
        <button className="desktop-menu-toggle" type="button" aria-label={desktopExpanded ? "Thu gọn menu" : "Mở rộng menu"} aria-expanded={desktopExpanded} aria-controls="desktop-shop-navigation" onClick={toggleDesktopMenu} title={desktopExpanded ? "Thu gọn menu" : "Mở rộng menu"}>
          {desktopExpanded ? <ChevronLeft size={21} /> : <Menu size={21} />}<span>Thu gọn menu</span>
        </button>
        <nav id="desktop-shop-navigation">
          {[
            { label: "Tổng quan", path: "/", view: "calendar", icon: House },
            { label: "Danh sách đơn", path: "/orders", view: "orders", icon: ClipboardList },
            { label: "Xử Lí đơn", path: "/processing", view: "processing", icon: Columns3 },
            { label: "Sản phẩm", path: "/products", view: "products", icon: Flower2 },
            { label: "Báo cáo", path: "/reports", view: "reports", icon: ChartNoAxesCombined },
            { label: "Khách hàng", path: "/customers", view: "customers", icon: Users },
            { label: "Thu chi", path: "/cashflow", view: "cashflow", icon: Wallet },
          ].map((item) => <button type="button" key={item.view} aria-label={item.label} title={desktopExpanded ? undefined : item.label} className={view === item.view ? "active" : ""} aria-current={view === item.view ? "page" : undefined} onClick={() => router.push(item.path)}><item.icon size={21} /><span>{item.label}</span></button>)}
          <button type="button" aria-label="Cài đặt shop" title={desktopExpanded ? undefined : "Cài đặt shop"} onClick={() => { setError(""); setSettings(true); }}><Settings size={21} /><span>Cài đặt shop</span></button>
        </nav>
        <form action={logout} className="desktop-logout"><button aria-label="Đăng xuất" title={desktopExpanded ? undefined : "Đăng xuất"}><LogOut size={21} /><span>Đăng xuất</span></button></form>
      </aside>
      <dialog ref={menuDialog} id="shop-menu" className="sidebar menu-drawer" aria-label="Menu quản lý shop" onCancel={(e) => { e.preventDefault(); closeMenu(); }} onClose={() => setMenuOpen(false)} onClick={(e) => {
        if (e.target === e.currentTarget) {
          const bounds = e.currentTarget.getBoundingClientRect();
          if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) closeMenu();
        }
      }}>
        <button className="icon-button menu-close" aria-label="Đóng menu" onClick={closeMenu}><X size={21} /></button>
        <div className="shop-tag">
          <span className="avatar">{shop.name.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{shop.name}</strong>
            <small>Không gian của bạn</small>
          </div>
          <span className="online" />
        </div>
        <span className="nav-label">QUẢN LÝ SHOP</span>
        <nav onClick={(e) => { if ((e.target as HTMLElement).closest("button")) closeMenu(); }}>
          <button
            className={view === "calendar" ? "active" : ""}
            onClick={() => router.push("/")}
          >
            <House size={20} /> Tổng quan
          </button>
          <button
            className={view === "orders" ? "active" : ""}
            onClick={() => router.push("/orders")}
          >
            <ClipboardList size={20} /> Danh sách đơn
          </button>
          <button className={view === "processing" ? "active" : ""} onClick={() => router.push("/processing")}>
            <Columns3 size={20} /> Xử Lí đơn
          </button>
          <button
            className={view === "products" ? "active" : ""}
            onClick={() => router.push("/products")}
          >
            <Flower2 size={20} /> Sản phẩm
          </button>
          <button
            className={view === "reports" ? "active" : ""}
            onClick={() => router.push("/reports")}
          >
            <ChartNoAxesCombined size={20} /> Báo cáo
          </button>
          <button className={view === "customers" ? "active" : ""} onClick={() => router.push("/customers")}>
            <Users size={20} /> Khách hàng
          </button>
          <button className={view === "cashflow" ? "active" : ""} onClick={() => router.push("/cashflow")}>
            <Wallet size={20} /> Thu chi
          </button>
          <button
            onClick={() => {
              setError("");
              setSettings(true);
            }}
          >
            <Settings size={20} /> Cài đặt shop
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="little-note">
            <Flower2 />
            <strong>Mỗi ngày một chút nở hoa</strong>
            <p>Mọi đơn hàng đều xứng đáng được chăm chút.</p>
          </div>
          <form action={logout}>
            <button className="logout">
              <LogOut size={18} /> Đăng xuất
            </button>
          </form>
        </div>
      </dialog>
      <div className="workspace drawer-workspace">
        <header className="topbar drawer-topbar">
          <button ref={menuToggle} className="icon-button menu-toggle" aria-label="Mở menu" aria-expanded={menuOpen} aria-controls="shop-menu" onClick={() => { menuDialog.current?.showModal(); setMenuOpen(true); }}><Menu size={24} /></button>
        </header>
        <main className="dashboard">
          {view === "processing" ? (
            <OrderProcessing orders={orders} products={products} />
          ) : view === "customers" ? (
            <Customers customers={customers} />
          ) : view === "cashflow" ? (
            <Cashflow entries={cashEntries} orders={orders} />
          ) : view === "products" ? (
            <Products products={products} />
          ) : view === "reports" ? (
            <Reports orders={orders} cashEntries={cashEntries} />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">MỘT NGÀY THẬT ĐẸP ĐỂ TRAO HOA</span>
                  <h1>
                    {view === "calendar"
                      ? `Xin chào, ${shop.name}`
                      : "Danh sách đơn hàng"}
                    {view !== "calendar" && <span className="heading-flower">✳</span>}
                  </h1>
                  <p>Sắp xếp gọn gàng, chăm chút từng đơn hoa.</p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setError("");
                    setEditing("new");
                  }}
                >
                  <Plus size={19} /> Tạo đơn hàng
                </button>
              </div>
              {view === "calendar" && <section className="stats overview-stats">
                {stats.map((s) => (
                  <article className="stat" key={s.label}>
                    <div>
                      <span>{s.label}</span>
                      <div className={`stat-icon ${s.tint}`}>
                        <s.icon size={20} />
                      </div>
                    </div>
                    <strong>{s.value}</strong>
                    <small>{s.sub}</small>
                  </article>
                ))}
                <button
                  type="button"
                  className={`stat receivable-stat ${receivablesOnly ? "selected" : ""}`}
                  aria-label="Cần phải thu — xem đơn còn thiếu tiền"
                  aria-pressed={receivablesOnly}
                  aria-controls="orders-section"
                  onClick={() => {
                    setReceivablesOnly(true);
                    setDay("");
                    setFilter("all");
                    setQuery("");
                    orderList.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    orderList.current?.focus({ preventScroll: true });
                  }}
                >
                  <div><span>Cần phải thu</span><div className="stat-icon amber"><Wallet size={20} /></div></div>
                  <strong>{money(receivable)}</strong>
                  <small>{unpaidOrders.length} đơn còn thiếu · Tháng {month.getMonth() + 1}/{month.getFullYear()} theo ngày giao</small>
                  <span className="receivable-link">Xem đơn cần thu thêm →</span>
                </button>
              </section>}
              {notice && (
                <div className="notice" role="status">
                  {notice}
                  <button
                    onClick={() => setNotice("")}
                    aria-label="Đóng thông báo"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              {view === "calendar" && <div className="content-grid">
                <section
                  className="calendar card"
                >
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">LỊCH GIAO HOA</span>
                      <h2>
                        Tháng {month.getMonth() + 1}, {month.getFullYear()}
                      </h2>
                    </div>
                    <div className="calendar-controls">
                      <button
                        className="today-btn"
                        onClick={() => {
                          setMonth(
                            new Date(
                              new Date().getFullYear(),
                              new Date().getMonth(),
                              1,
                            ),
                          );
                          setDay(today);
                        }}
                      >
                        Hôm nay
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Tháng trước"
                        onClick={() => move(-1)}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Tháng sau"
                        onClick={() => move(1)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                  {view === "calendar" && (
                    <>
                      <div className="calendar-grid">
                        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
                          <div className="weekday" key={d}>
                            {d}
                          </div>
                        ))}
                        {Array.from({ length: offset }, (_, i) => (
                          <div className="day blank" key={`blank${i}`} />
                        ))}
                        {Array.from({ length: days }, (_, i) => {
                          const key = `${prefix}-${String(i + 1).padStart(2, "0")}`;
                          const items = monthOrders.filter(
                            (o) => o.date === key,
                          );
                          return (
                            <button
                              key={key}
                              className={`day ${day === key ? "selected" : ""} ${key === today ? "is-today" : ""}`}
                              onClick={() => setDay(day === key ? "" : key)}
                              aria-label={`${i + 1}/${month.getMonth() + 1}, ${items.length} đơn hàng`}
                              aria-pressed={day === key}
                            >
                              <span className="day-number">{i + 1}</span>
                              {items.length > 0 && (
                                <>
                                  <span className="day-count">
                                    {items.length} đơn
                                  </span>
                                  <span className="calendar-flowers" aria-hidden="true">
                                    {items.slice(0, 20).map((order) => <Flower key={order.id} size={9} strokeWidth={1.8} />)}
                                  </span>
                                </>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </section>
                <section className="day-insight">
                  <span className="eyebrow">GÓC NHỎ CỦA SHOP</span>
                  <CuteFlower className="insight-flower cute-mascot" />
                  <h2>
                    Hoa đẹp đúng hẹn,
                    <br />
                    khách thương quay lại.
                  </h2>
                  <p>
                    Theo dõi lịch giao để mỗi bó hoa đến tay người nhận vào đúng
                    khoảnh khắc.
                  </p>
                  <div className="today-delivery-reminder">
                    <Clock size={17} />
                    <span>
                      <strong>
                        {
                          orders.filter(
                            (o) => o.date === today && o.status !== "done",
                          ).length
                        }{" "}
                        đơn cần giao hôm nay
                      </strong>
                      <small>Chúc shop một ngày nhiều niềm vui!</small>
                    </span>
                  </div>
                </section>
              </div>}
              <section className="orders-section" id="orders-section" ref={orderList} tabIndex={-1} aria-label="Danh sách đơn hàng">
                {view === "calendar" && receivablesOnly && <div className="notice receivable-notice">
                  <span>Đang xem đơn cần phải thu · {filtered.length} đơn · Còn {money(filtered.reduce((sum, o) => sum + o.price - o.paidAmount, 0))}</span>
                  <button type="button" onClick={() => setReceivablesOnly(false)}>Bỏ lọc cần thu <X size={15} /></button>
                </div>}
                <div className="orders-title-row">
                  <div>
                    <h2>
                      {view === "orders" ? "Danh sách đơn" : day
                        ? `Đơn ngày ${day.split("-").reverse().join("/")}`
                        : receivablesOnly ? "Đơn cần phải thu trong tháng" : "Đơn hàng trong tháng"}{" "}
                      <span className="count">{filtered.length}</span>
                    </h2>
                    {view === "calendar" && day && (
                      <button
                        className="text-button"
                        onClick={() => setDay("")}
                      >
                        Xem cả tháng <X size={13} />
                      </button>
                    )}
                  </div>
                  <label className="search">
                    <Search size={18} />
                    <input
                      aria-label="Tìm đơn hàng"
                      placeholder="Tìm mã đơn, mã khách, tên, SĐT…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                </div>
                <div className="orders-filter-toolbar">
                <div className="filters">
                  {Object.entries({ all: "Tất cả", ...statuses }).map(
                    ([key, label]) => (
                      <button
                        className={filter === key ? "active" : ""}
                        key={key}
                        onClick={() => setFilter(key)}
                      >
                        {label}
                      </button>
                    ),
                  )}
                </div>
                {view === "orders" && <form className="order-date-filter" aria-label="Lọc theo ngày tạo đơn" onSubmit={(event) => {
                  event.preventDefault();
                  if (draftOrderFrom && draftOrderTo && draftOrderFrom > draftOrderTo) return;
                  setOrderFrom(draftOrderFrom); setOrderTo(draftOrderTo);
                }}>
                  <input aria-label="Ngày bắt đầu" title="Ngày tạo đơn bắt đầu" type="date" value={draftOrderFrom} max={draftOrderTo || undefined} onChange={(e) => setDraftOrderFrom(e.target.value)} />
                  <span aria-hidden="true">–</span>
                  <input aria-label="Ngày kết thúc" title="Ngày tạo đơn kết thúc" type="date" value={draftOrderTo} min={draftOrderFrom || undefined} onChange={(e) => setDraftOrderTo(e.target.value)} />
                  <button type="submit" className="secondary">Áp dụng</button>
                </form>}
                </div>
                {filtered.length === 0 ? (
                  <div className="empty card">
                    <span>
                      <Flower2 size={34} strokeWidth={1.3} />
                    </span>
                    <h3>
                      {view === "orders" ? "Chưa có đơn phù hợp" : receivablesOnly ? "Không có đơn cần thu phù hợp" : monthOrders.length
                        ? "Chưa có đơn phù hợp"
                        : "Những đơn hoa đầu tiên đang chờ"}
                    </h3>
                    <p>
                      {view === "orders" ? "Thêm đơn mới hoặc thay đổi bộ lọc tìm kiếm và trạng thái." : receivablesOnly ? "Các đơn trong phạm vi đang lọc đã thanh toán đủ hoặc chưa phát sinh. Bạn có thể bỏ lọc hoặc đổi tháng để xem thêm." : monthOrders.length
                        ? "Thử chọn ngày khác hoặc thay đổi bộ lọc tìm kiếm."
                        : "Thêm đơn hàng để bắt đầu sắp xếp lịch giao cho shop."}
                    </p>
                    <button
                      className="secondary"
                      onClick={() => {
                        setError("");
                        setEditing("new");
                      }}
                    >
                      <Plus size={17} /> Thêm đơn hàng
                    </button>
                  </div>
                ) : view === "orders" ? (
                  <><div className="order-selection-toolbar"><span role="status">Đã chọn {selectedIds.size} đơn{selectedIds.size > 0 ? " (qua các trang)" : ""}</span>{selectedIds.size > 0 && <button type="button" className="text-button" onClick={() => setSelection({ key: selectionKey, ids: [] })}>Bỏ chọn tất cả</button>}</div>
                  <OrdersTable orders={visibleOrders} selectedIds={selectedIds} onSelect={selectOrders} onEdit={(order) => { setError(""); setEditing(order); }} onDelete={(order) => { setError(""); setDeleting(order); }} /></>
                ) : (
                  <div className="order-list">
                    {visibleOrders.map((o) => (
                      <article className="order-card clickable-order" key={o.id} onClick={(event) => {
                        if (!(event.target as HTMLElement).closest("a, button, input, select") && !window.getSelection()?.toString()) router.push(`/orders/${o.id}`);
                      }}>
                        <div className="order-date">
                          <span className="delivery-date-label">Ngày giao hoa</span>
                          <strong>{o.date.slice(8)}</strong>
                          <small>THÁNG {Number(o.date.slice(5, 7))}</small>
                          <span>{o.time}</span>
                        </div>
                        <div className="order-main">
                          <div className="order-codes"><Link className="order-code-link" href={`/orders/${o.id}`}>{o.code}</Link><span>Khách hàng: {o.customerRecord.code}</span></div>
                          <p className="order-placed-at">Lên đơn: {o.orderTime || "Chưa có giờ"} · {o.orderDate.split("-").reverse().join("/")}</p>
                          {o.source && <p className="order-placed-at">Nguồn: {o.source}</p>}
                          <div className="order-head">
                            {products
                              .find((product) => product.id === o.productId)
                              ?.images.slice(0, 1)
                              .map((image) => (
                                <img
                                  className="order-product-thumb"
                                  key={image.id}
                                  src={`/api/images/${image.id}`}
                                  alt={o.product}
                                  loading="lazy"
                                />
                              ))}
                            <h3><OrderItemSummary order={o} /></h3>
                            <span className={`badge ${o.status}`}>
                              {statuses[o.status]}
                            </span>
                          </div>
                          <div className="customer">
                            <strong>{o.customer}</strong>
                            <a href={`tel:${o.phone}`}>
                              <Phone size={13} />
                              {o.phone}
                            </a>
                          </div>
                          <p className="address">
                            <MapPin size={14} />
                            {o.address}
                          </p>
                          {o.note && <p className="order-note">{o.note}</p>}
                        </div>
                        <div className="order-end">
                          <div className="payment-summary">
                            <strong>{money(o.price)}</strong>
                            <span>
                              Đã thanh toán <b>{money(o.paidAmount)}</b>
                            </span>
                            <span
                              className={
                                o.price === o.paidAmount
                                  ? "payment-complete"
                                  : "payment-due"
                              }
                            >
                              Còn lại <b>{money(o.price - o.paidAmount)}</b>
                            </span>
                          </div>
                          <div>
                            <button
                              className="icon-button"
                              aria-label={`Sửa đơn ${o.product}`}
                              onClick={() => {
                                setError("");
                                setEditing(o);
                              }}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button danger-text"
                              aria-label={`Xóa đơn ${o.product}`}
                              onClick={() => {
                                setError("");
                                setDeleting(o);
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {filtered.length > 0 && <nav className="overview-pagination" aria-label={view === "orders" ? "Phân trang danh sách đơn hàng" : "Phân trang đơn hàng tổng quan"}>
                  <label>Hiển thị<select aria-label="Số đơn mỗi trang" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{[10, 20, 50].map((size) => <option key={size} value={size}>{size} đơn</option>)}</select></label>
                  <span role="status">{pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} / {filtered.length} đơn</span>
                  <div className="overview-page-buttons">
                    <button type="button" className="secondary" disabled={currentPage === 1} onClick={() => setPagination({ key: paginationKey, page: currentPage - 1 })}><ChevronLeft size={16} /> Trước</button>
                    <span>Trang {currentPage}/{pageCount}</span>
                    <button type="button" className="secondary" disabled={currentPage === pageCount} onClick={() => setPagination({ key: paginationKey, page: currentPage + 1 })}>Sau <ChevronRight size={16} /></button>
                  </div>
                </nav>}
              </section>
            </>
          )}
          <footer>
            Powered by Floral Help
          </footer>
        </main>
      </div>
      {editing && (
        <Modal
          title={editing === "new" ? "Tạo đơn hàng mới" : "Chỉnh sửa đơn hàng"}
          className="order-modal"
          headerActions={<div className="order-header-actions">
            <button type="button" className="secondary" disabled={pending} onClick={() => setEditing(null)}>Hủy</button>
            <button type="submit" form="order-editor-form" className="primary" disabled={pending}>{pending ? "Đang lưu…" : "Lưu đơn hàng"}</button>
          </div>}
          close={() => !pending && setEditing(null)}
        >
          <OrderForm order={editing} products={products} customers={customers} defaultDate={day || today} error={error}
            onSubmit={(form) => task(() => saveOrder(form), () => { setEditing(null); setNotice("\u0110\u00e3 l\u01b0u \u0111\u01a1n h\u00e0ng."); })} />
          {editing !== "new" && <OrderHistoryLoader key={editing.id} orderId={editing.id} />}
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Xóa đơn hàng?"
          close={() => !pending && setDeleting(null)}
        >
          <p>
            Bạn muốn xóa đơn “{deleting.product}” của {deleting.customer}? Thao
            tác này không thể hoàn tác.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              Giữ lại
            </button>
            <button
              className="primary danger"
              disabled={pending}
              onClick={() =>
                task(
                  () => removeOrder(deleting.id),
                  () => {
                    setDeleting(null);
                    setNotice("Đã xóa đơn hàng.");
                  },
                )
              }
            >
              {pending ? "Đang xóa…" : "Xóa đơn hàng"}
            </button>
          </div>
        </Modal>
      )}
      {settings && (
        <Modal
          title="Cài đặt shop"
          close={() => !pending && setSettings(false)}
        >
          <form
            id={settingsFormId}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              task(
                () => renameShop(form),
                () => {
                  setSettings(false);
                  setNotice("Đã cập nhật tên shop.");
                },
              );
            }}
          >
            <label>
              Tên shop
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={shop.name}
              />
            </label>
            <label>
              Email đăng nhập
              <input value={shop.email} readOnly />
            </label>
            <label>
              Thời hạn sử dụng tài khoản
              <input readOnly value={shop.accessUntil ?? "Chưa đặt thời hạn sử dụng"} />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
            <div className="modal-actions shop-settings-actions">
              <ChangePassword />
              <button className="primary" form={settingsFormId} type="submit" disabled={pending}>
                {pending ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}
