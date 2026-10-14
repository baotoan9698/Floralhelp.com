"use client";
import { useActionState, useState } from "react";
import {
  Flower2,
  ArrowRight,
  CalendarDays,
  Smartphone,
} from "lucide-react";
import { authenticate } from "../actions";
export default function AuthForm({ notice }: { notice?: string }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState(authenticate, { error: "" });
  return (
    <main className="auth-page">
      <section className="auth-story">
        <a className="brand" href="/">
          <img className="floralhelp-logo" src="/floralhelp-logo.svg" alt="Floralhelp" width={520} height={128} />
        </a>
        <div className="story-content">
          <span className="eyebrow">MỖI ĐƠN HOA, MỘT NIỀM VUI</span>
          <h1>
            Chăm chút từng bông hoa.
            <br />
            <em>
              Để việc quản lý
              <br />
              nhẹ nhàng hơn.
            </em>
          </h1>
          <p>
            Một góc làm việc riêng cho shop của bạn — từ lúc nhận đơn đến khi
            trao hoa tận tay.
          </p>
          <div className="story-flower">✳</div>
          <div className="feature">
            <CalendarDays /> Lịch giao hàng rõ ràng mỗi ngày
          </div>
          <div className="feature">
            <Smartphone /> Thuận tiện trên máy tính và điện thoại
          </div>
        </div>
        <small>FLORALHELP · MADE FOR FLOWER SHOPS</small>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <span className="small-flower">
            <Flower2 size={30} />
          </span>
          <h2>
            {mode === "login"
              ? "Chào mừng trở lại"
              : "Bắt đầu với shop của bạn"}
          </h2>
          <p>
            {mode === "login"
              ? "Một ngày mới, những bó hoa mới đang chờ."
              : "Tạo shop và bắt đầu dùng thử miễn phí 15 ngày."}
          </p>
          <div className="auth-tabs">
            <button
              onClick={() => setMode("login")}
              className={mode === "login" ? "active" : ""}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => setMode("register")}
              className={mode === "register" ? "active" : ""}
            >
              Tạo shop mới
            </button>
          </div>
          <form action={action}>
            <input type="hidden" name="mode" value={mode} />
            {mode === "register" && (
              <label>
                Tên shop
                <input
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ví dụ: Tiệm hoa Mộc"
                  required
                  maxLength={100}
                  autoComplete="organization"
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ban@shophoa.vn"
                required
                autoComplete="email"
              />
            </label>
            <label>
              Mật khẩu
              <input
                type="password"
                name="password"
                placeholder="Ít nhất 10 ký tự"
                minLength={10}
                maxLength={128}
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
            {notice && !state.error && <p className="error" role="alert">{notice}</p>}
            {state.error && (
              <p className="error" role="alert">
                {state.error}
              </p>
            )}
            <button className="primary wide" disabled={pending}>
              {pending
                ? "Đang xử lý…"
                : mode === "login"
                  ? "Vào shop của bạn"
                  : "Tạo shop"}
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
