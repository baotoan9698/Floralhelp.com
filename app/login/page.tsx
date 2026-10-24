import { redirect } from "next/navigation";
import { currentShop } from "@/lib/auth";
import AuthForm from "../ui/auth-form";
import { accessMessages } from "@/lib/access";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  if (await currentShop()) redirect("/");
  const { reason } = await searchParams;
  if (reason === "signed-out") redirect("/login");
  return <AuthForm notice={reason === "email-verified" ? "Sau khi xác minh email thành công, hãy đăng nhập để bắt đầu sử dụng." : reason === "password-changed" ? "Vui lòng đăng nhập bằng mật khẩu mới sau khi hoàn tất đặt lại mật khẩu." : accessMessages[reason ?? ""]} />;
}
