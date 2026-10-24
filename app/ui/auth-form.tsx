"use client";
import { useActionState, useState, useEffect, useRef } from "react";
import {
  Flower2,
  ArrowRight,
  CalendarDays,
  Smartphone,
} from "lucide-react";
import { authenticate, forgotPassword } from "../auth-actions";
export default function AuthForm({ notice }: { notice?: string }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [state, action, pending] = useActionState(authenticate, { error: "" });
  const [resetState, resetAction, resetPending] = useActionState(forgotPassword, { error: "" });
  const verificationDialog = useRef<HTMLDialogElement>(null);
  const loginForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.verificationEmail) verificationDialog.current?.showModal();
  }, [state]);
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
            {mode === "forgot" ? "Quên mật khẩu" : mode === "login"
              ? "Chào mừng trở lại"
              : "Bắt đầu với shop của bạn"}
          </h2>
          <p>
            {mode === "forgot" ? "Nhập email của shop để nhận liên kết đặt lại mật khẩu." : mode === "login"
              ? "Một ngày mới, những bó hoa mới đang chờ."
              : "Xác minh email để nhận 15 ngày dùng thử miễn phí."}
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
          {mode === "forgot" ? <form action={resetAction}>
            <label>Email<input type="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="email" /></label>
            {resetState.error && <p className="error" role="alert">{resetState.error}</p>}
            {resetState.message && <p className="auth-message" role="status">{resetState.message}</p>}
            <button className="primary wide" disabled={resetPending}>{resetPending ? "Đang gửi…" : "Gửi liên kết đặt lại mật khẩu"}</button>
            <button type="button" className="auth-text-button" onClick={() => setMode("login")}>Quay lại đăng nhập</button>
          </form> : <form ref={loginForm} action={action}>
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
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
            {mode === "login" && <button type="button" className="auth-text-button" onClick={() => setMode("forgot")}>Quên mật khẩu?</button>}
          </form>}
          <dialog ref={verificationDialog} className="auth-verification" aria-labelledby="verify-title" onCancel={() => setMode("login")}>
            <h2 id="verify-title">Kiểm tra email để xác minh tài khoản</h2>
            <p>Email đăng ký: <strong>{state.verificationEmail}</strong></p>
            <p role="status">{state.message}</p>
            {state.error && <p className="error" role="alert">{state.error}</p>}
            <p>Gói: <strong>Dùng Thử · 15 ngày</strong><br />Thời hạn bắt đầu khi bạn xác minh email và đăng nhập lần đầu.</p>
            <div className="auth-verification-actions">
              <button type="button" className="primary" disabled={pending} onClick={() => { verificationDialog.current?.close(); setMode("login"); }}>Tôi đã xác minh · Đăng nhập</button>
              <button type="button" disabled={pending} onClick={() => {
                setMode("resend");
                // Wait for the hidden mode field to reflect the chosen action.
                requestAnimationFrame(() => loginForm.current?.requestSubmit());
              }}>{pending ? "Đang gửi…" : "Gửi lại email xác minh"}</button>
              <button type="button" onClick={() => { verificationDialog.current?.close(); setMode("login"); }}>Đóng</button>
            </div>
          </dialog>
        </div>
      </section>
    </main>
  );
}
