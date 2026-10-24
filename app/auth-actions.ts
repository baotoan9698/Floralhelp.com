"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { accessMessages, accessReason } from "@/lib/access";
import { authIpLimit, authRateLimit } from "@/lib/auth-rate-limit";
import { firebaseAuth, firebaseEnabled, firebaseSignIn, isFirebaseError, sendVerification, sendPasswordReset, assertFirebaseIdentity } from "@/lib/firebase-auth";

type AuthState = { error: string; verificationEmail?: string; message?: string };
export async function authenticate(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(10).max(128), mode: z.enum(["login", "register", "resend"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Nhập email hợp lệ và mật khẩu từ 10 đến 128 ký tự." };
  const { email, password, mode } = parsed.data;
  const name = String(form.get("name") ?? "").trim();
  if (mode === "register" && (!name || name.length > 100)) return { error: "Tên shop cần từ 1 đến 100 ký tự." };
  if (!(await authIpLimit()) || !(await authRateLimit(email, 10))) return { error: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút." };
  let shop = await db.shop.findUnique({ where: { email } });
  let welcome = false;
  try {
    if (mode === "register") {
      if (shop) return { error: "Email này đã được đăng ký. Vui lòng đăng nhập để tiếp tục hoặc gửi lại email xác minh." };
      const enabled = firebaseEnabled();
      const now = new Date();
      shop = await db.shop.create({ data: { email, name, passwordHash: hashPassword(password),
        emailVerificationRequired: enabled, accessStatus: enabled ? "unverified" : "active",
        accessUntil: enabled ? null : new Date(now.getTime() + 15 * 86400000), plan: "trial" } });
      welcome = !enabled;
    }
    if (!shop) return { error: "Email hoặc mật khẩu không đúng." };
    // Linked accounts never fall back to the old password hash, even if Firebase is disabled.
    if (shop.firebaseUid || firebaseEnabled()) {
      if (!shop.firebaseUid) {
        if (!verifyPassword(password, shop.passwordHash)) return { error: "Email hoặc mật khẩu không đúng." };
        // Lock the shop while attaching the deterministic UID, so concurrent logins cannot
        // create different identities. A retry after a network failure reuses that UID.
        shop = await db.$transaction(async (tx) => {
          const claimed = await tx.shop.updateMany({ where: { id: shop!.id, firebaseUid: null }, data: { firebaseUid: shop!.id } });
          const current = await tx.shop.findUniqueOrThrow({ where: { id: shop!.id } });
          if (claimed.count) {
            let user;
            try { user = await firebaseAuth().getUser(current.id); }
            catch (error) {
              if (!isFirebaseError(error, "auth/user-not-found")) throw error;
              user = await firebaseAuth().createUser({ uid: current.id, email: current.email, password, emailVerified: false });
            }
            assertFirebaseIdentity(user, current.id, current.email);
            // Existing local sessions remain valid after linking; future resets revoke them.
            await tx.session.updateMany({ where: { shopId: current.id }, data: { createdAt: new Date() } });
          }
          return current;
        }, { timeout: 30000, maxWait: 10000 });
      }
      const { user, idToken } = await firebaseSignIn(email, password, shop.firebaseUid!);
      if (shop.emailVerificationRequired && !user.emailVerified) {
        if (shop.accessStatus === "suspended" || shop.accessStatus === "rejected") return { error: accessMessages[shop.accessStatus] };
        let message = "Mở email xác minh, sau đó quay lại đăng nhập để nhận 15 ngày dùng thử. Kiểm tra cả thư mục Spam.";
        if (mode === "register" || mode === "resend") {
          if (!(await authRateLimit(`verify:${shop.id}`, 1, 1))) message = "Vui lòng đợi 1 phút trước khi gửi lại email xác minh.";
          else {
            try { await sendVerification(idToken); }
            catch { message = "Tài khoản đã được tạo nhưng chưa gửi được email. Vui lòng đợi một phút rồi bấm Gửi lại email xác minh."; }
          }
        }
        return { error: "", verificationEmail: email, message };
      }
      if (user.emailVerified && shop.emailVerificationRequired && !shop.emailVerifiedAt) {
        const now = new Date();
        // Only the original unverified trial is activated; suspended/rejected accounts
        // cannot regain access, and repeated logins never extend the trial.
        const activated = await db.shop.updateMany({ where: { id: shop.id, firebaseUid: user.uid,
          emailVerificationRequired: true, emailVerifiedAt: null, trialStartedAt: null, accessStatus: "unverified" },
          data: { emailVerifiedAt: now, trialStartedAt: now, accessStatus: "active", accessUntil: new Date(now.getTime() + 15 * 86400000), plan: "trial" } });
        welcome = activated.count === 1;
        shop = await db.shop.findUniqueOrThrow({ where: { id: shop.id } });
      } else if (user.emailVerified && !shop.emailVerifiedAt) {
        shop = await db.shop.update({ where: { id: shop.id }, data: { emailVerifiedAt: new Date() } });
      }
    } else if (!verifyPassword(password, shop.passwordHash)) return { error: "Email hoặc mật khẩu không đúng." };
  } catch (error) {
    if (["INVALID_LOGIN_CREDENTIALS", "INVALID_PASSWORD", "EMAIL_NOT_FOUND", "USER_DISABLED"].some((code) => isFirebaseError(error, code)))
      return { error: "Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa." };
    if (isFirebaseError(error, "auth/email-already-exists") || isFirebaseError(error, "identity-mismatch"))
      return { error: "Chưa thể liên kết tài khoản. Vui lòng liên hệ quản trị viên để kiểm tra email." };
    return { error: "Dịch vụ đăng nhập tạm thời chưa kết nối được. Vui lòng thử lại; thông tin đăng ký đã lưu có thể tiếp tục bằng Đăng nhập." };
  }
  const reason = accessReason(shop);
  if (reason) {
    await db.session.deleteMany({ where: { shopId: shop.id } });
    return { error: accessMessages[reason] ?? "Shop chưa được cấp quyền sử dụng." };
  }
  await db.authAttempt.deleteMany({ where: { key: email } });
  await createSession(shop.id);
  redirect(welcome ? "/welcome" : "/");
}

export async function forgotPassword(_: { error: string; message?: string }, form: FormData) {
  const parsed = z.string().trim().toLowerCase().pipe(z.email().max(254)).safeParse(form.get("email"));
  if (!parsed.success) return { error: "Vui lòng nhập email hợp lệ." };
  if (!firebaseEnabled()) return { error: "Chưa thể gửi email đặt lại mật khẩu. Vui lòng liên hệ quản trị viên." };
  if (!(await authIpLimit()) || !(await authRateLimit(`reset:${parsed.data}`, 3))) return { error: "Vui lòng đợi 15 phút trước khi yêu cầu lại." };
  const message = "Nếu email đã đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu. Hãy kiểm tra cả thư mục Spam.";
  const shop = await db.shop.findUnique({ where: { email: parsed.data } });
  try {
    if (shop?.firebaseUid) await sendPasswordReset(shop.email);
    // Legacy accounts are imported before production enablement. Unknown emails
    // deliberately return the same response to avoid disclosing account existence.
  } catch { return { error: "Chưa gửi được email lúc này. Vui lòng thử lại sau." }; }
  return { error: "", message };
}
