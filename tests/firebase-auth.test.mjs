import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { mkdirSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";

test("Firebase registration, verification, trial once, reset revocation and legacy continuity", { timeout: 240000 }, async () => {
  const db = new PrismaClient();
  const auth = getAuth(initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID }));
  const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const base = "http://127.0.0.1:3100";
  const email = `floralhelp-ui-${Date.now()}@example.invalid`;
  const legacyEmail = `legacy-${email}`;
  const password = `Fh!${randomBytes(18).toString("hex")}`;
  const ids = [];
  async function login(email, value = password) {
    await page.goto(`${base}/login`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(value);
    await page.getByRole("button", { name: "Vào shop của bạn", exact: true }).click();
  }
  try {
    await page.goto(`${base}/login`);
    await page.getByRole("button", { name: "Tạo shop mới", exact: true }).click();
    await page.getByLabel("Tên shop", { exact: true }).fill("Tiệm hoa kiểm thử xác minh");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Tạo shop", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 60000 });
    const shop = await db.shop.findUniqueOrThrow({ where: { email } }); ids.push(shop.id);
    assert.equal(shop.accessStatus, "unverified"); assert.equal(shop.accessUntil, null);
    assert.equal(await db.session.count({ where: { shopId: shop.id } }), 0);
    mkdirSync("artifacts/firebase-setup", { recursive: true });
    await page.screenshot({ path: "artifacts/firebase-setup/verify-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "artifacts/firebase-setup/verify-mobile.png" });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole("button", { name: "Gửi lại email xác minh", exact: true }).click();
    await page.getByText("Vui lòng đợi 1 phút", { exact: false }).waitFor();
    // Verification proof is changed only for this disposable test identity.
    await auth.updateUser(shop.id, { emailVerified: true });
    await page.getByRole("button", { name: "Tôi đã xác minh · Đăng nhập", exact: true }).click();
    await page.getByRole("button", { name: "Vào shop của bạn", exact: true }).click();
    await page.waitForURL("**/welcome", { timeout: 30000 });
    const active = await db.shop.findUniqueOrThrow({ where: { id: shop.id } });
    assert.equal(active.accessStatus, "active");
    assert.equal(active.accessUntil - active.trialStartedAt, 15 * 86400000);
    await page.goto("about:blank"); await page.context().clearCookies(); await login(email); await page.waitForURL(base + "/", { timeout: 30000 });
    assert.equal((await db.shop.findUniqueOrThrow({ where: { id: shop.id } })).accessUntil.getTime(), active.accessUntil.getTime());
    await new Promise(resolve => setTimeout(resolve, 1100));
    await auth.updateUser(shop.id, { password: password + "new" }); await auth.revokeRefreshTokens(shop.id);
    await page.goto(base + "/orders").catch(error => { if (!error.message.includes("ERR_ABORTED")) throw error; }); await page.waitForURL("**/login**", { timeout: 30000 });
    await login(email); await page.getByText("Email hoặc mật khẩu không đúng", { exact: false }).waitFor();
    await login(email, password + "new"); await page.waitForURL(base + "/", { timeout: 30000 });
    await db.shop.update({ where: { id: shop.id }, data: { accessUntil: new Date(Date.now() - 10000) } });
    await page.goto(base + "/orders").catch(error => { if (!error.message.includes("ERR_ABORTED")) throw error; }); await page.waitForURL("**/login?reason=expired");
    assert.equal(await db.shop.count({ where: { id: shop.id } }), 1);
    const salt = randomBytes(16).toString("hex");
    const expiry = new Date(Date.now() + 40 * 86400000);
    const legacy = await db.shop.create({ data: { email: legacyEmail, name: "Shop cũ kiểm thử", passwordHash: `${salt}:${scryptSync(password, salt, 64).toString("hex")}`, accessStatus: "active", accessUntil: expiry } }); ids.push(legacy.id);
    await page.goto("about:blank"); await page.context().clearCookies(); await login(legacyEmail); await page.waitForURL(base + "/", { timeout: 30000 });
    const linked = await db.shop.findUniqueOrThrow({ where: { id: legacy.id } });
    assert.equal(linked.firebaseUid, legacy.id); assert.equal(linked.accessUntil.getTime(), expiry.getTime()); assert.equal(linked.trialStartedAt, null);
    await page.goto("about:blank"); await page.context().clearCookies(); await page.goto(base + "/login");
    await page.getByRole("button", { name: "Quên mật khẩu?", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(`unknown-${email}`);
    await page.getByRole("button", { name: "Gửi liên kết đặt lại mật khẩu", exact: true }).click();
    await page.getByText("Nếu email đã đăng ký", { exact: false }).waitFor();
    await page.screenshot({ path: "artifacts/firebase-setup/forgot-mobile.png" });
    console.log("PASS: no unverified session, trial exactly 15 days/once, resend cooldown, mobile layout, reset revocation, expired data retained, legacy identity/expiry preserved.");
  } finally {
    const found = await db.shop.findMany({ where: { email: { in: [email, legacyEmail] } } });
    for (const shop of found) { await auth.deleteUser(shop.id).catch(() => {}); await db.shop.delete({ where: { id: shop.id } }); }
    await db.$disconnect(); await browser.close();
  }
});
