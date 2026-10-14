import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { requireShop } from "@/lib/auth";

export default async function WelcomePage() {
  const shop = await requireShop();
  const until = shop.accessUntil ? new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short",
  }).format(shop.accessUntil) : "Chưa đặt hạn";
  return <main className="trial-welcome card">
    <CheckCircle2 size={48} aria-hidden="true" />
    <h1>Đăng ký sử dụng thành công</h1>
    <p>Chào mừng {shop.name} đến với Floralhelp!</p>
    <dl><div><dt>Gói</dt><dd>Dùng Thử</dd></div><div><dt>Hạn sử dụng</dt><dd>{until}</dd></div></dl>
    <p>Bạn có 15 ngày dùng thử kể từ khi đăng ký. Thời gian hiển thị theo giờ Việt Nam.</p>
    <Link href="/" className="primary">Bắt đầu sử dụng</Link>
  </main>;
}
