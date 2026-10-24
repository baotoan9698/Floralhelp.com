import "server-only";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { accessReason } from "./access";
import { redirect } from "next/navigation";
import { firebaseSessionValid } from "./firebase-auth";
import { cache } from "react";
const checkFirebaseSession = cache(firebaseSessionValid);
const cookieName = "floralhelp_session";
// Persistent browser cookie, refreshed during the shop's session check.
const sessionCookieDays = 400;
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  if (!salt || !key || !/^[a-f0-9]{128}$/i.test(key)) return false;
  return timingSafeEqual(
    Buffer.from(key, "hex"),
    scryptSync(password, salt, 64),
  );
}
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function createSession(shopId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionCookieDays * 86400000);
  await db.session.create({ data: { id: digest(token), shopId, expiresAt } });
  (await cookies()).set(cookieName, token, {
    ...cookieOptions,
    expires: expiresAt,
  });
}
export async function shopSessionState(renewCookie = false) {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return { shop: null, reason: "signed-out" };
  const session = await db.session.findUnique({
    where: { id: digest(token) },
    include: { shop: true },
  });
  if (!session) return { shop: null, reason: "signed-out" };
  if (session.shop.firebaseUid) {
    try {
      if (!(await checkFirebaseSession(session.shop.firebaseUid, session.shop.email, session.createdAt))) {
        await db.session.deleteMany({ where: { id: session.id } });
        return { shop: null, reason: "password-changed" };
      }
    } catch {
      return { shop: null, reason: "auth-unavailable" };
    }
  }
  const reason = accessReason(session.shop);
  if (reason) {
    await db.session.deleteMany({ where: { shopId: session.shopId } });
    return { shop: null, reason };
  }
  // Shop access and explicit revocation govern validity, not a fixed login age.
  // Only route handlers may renew cookies; ordinary server reads stay read-only.
  if (renewCookie && session.expiresAt.getTime() < Date.now() + (sessionCookieDays - 1) * 86400000) {
    const expiresAt = new Date(Date.now() + sessionCookieDays * 86400000);
    const renewed = await db.session.updateMany({
      where: { id: session.id }, data: { expiresAt },
    });
    if (!renewed.count) return { shop: null, reason: "signed-out" };
    (await cookies()).set(cookieName, token, { ...cookieOptions, expires: expiresAt });
  }
  return { shop: session.shop, reason: null };
}
export async function currentShop() {
  return (await shopSessionState()).shop;
}
export async function requireShop() {
  const { shop, reason } = await shopSessionState();
  if (!shop) redirect(reason && reason !== "signed-out" ? `/login?reason=${encodeURIComponent(reason)}` : "/login");
  return shop;
}
export async function deleteSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db.session.deleteMany({ where: { id: digest(token) } });
  if (token) jar.delete(cookieName);
}
