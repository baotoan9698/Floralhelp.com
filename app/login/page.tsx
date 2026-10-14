import { redirect } from "next/navigation";
import { currentShop } from "@/lib/auth";
import AuthForm from "../ui/auth-form";
import { accessMessages } from "@/lib/access";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  if (await currentShop()) redirect("/");
  const { reason } = await searchParams;
  if (reason === "signed-out") redirect("/login");
  return <AuthForm notice={reason === "password-changed" ? "Đã đổi mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới." : accessMessages[reason ?? ""]} />;
}
