import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";

test("Create orders on a dedicated responsive page", { timeout: 90000 }, async () => {
  const db = new PrismaClient();
  const browser = await chromium.launch({ headless: true, executablePath: ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(existsSync) });
  let shop;
  try {
    const anonymous = await browser.newPage();
    await anonymous.goto("http://127.0.0.1:3000/orders/new");
    await expect(anonymous).toHaveURL(/\/login/);
    shop = await db.shop.create({ data: { name: "New page test", email: `new-page-${Date.now()}@example.com`, passwordHash: "unused", accessStatus: "active" } });
    const context = await browser.newContext();
    const token = randomBytes(32).toString("hex");
    await db.session.create({ data: { id: createHash("sha256").update(token).digest("hex"), shopId: shop.id, expiresAt: new Date(Date.now() + 600000) } });
    await context.addCookies([{ name: "floralhelp_session", value: token, url: "http://127.0.0.1:3000" }]);
    const page = await context.newPage();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("http://127.0.0.1:3000/orders");
      await page.getByRole("button", { name: /Tạo đơn|Thêm đơn/ }).first().click();
      await expect(page).toHaveURL(/\/orders\/new$/);
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Tạo đơn hàng mới" })).toBeVisible();
      await page.getByRole("button", { name: "Hủy", exact: true }).click();
      await expect(page).toHaveURL(/\/orders$/);
      await page.goto("http://127.0.0.1:3000/orders/new?date=2026-10-20");
      await expect(page.locator('input[name="date"]')).toHaveValue("2026-10-20");
      await page.getByRole("combobox", { name: "Khách hàng", exact: true }).fill(`Khách thử ${width}`);
      await page.getByLabel("Số điện thoại", { exact: true }).fill("0000000000");
      await page.getByLabel("Địa chỉ", { exact: true }).fill("Địa chỉ mẫu");
      await page.getByRole("combobox", { name: "Sản phẩm", exact: true }).fill("Hoa mẫu");
      await page.getByLabel("Đơn giá (₫)", { exact: true }).fill("250000");
      await page.getByLabel("Số tiền thanh toán 1", { exact: true }).fill("100000");
      await page.getByRole("button", { name: "Thêm lượt thanh toán" }).click();
      await page.getByLabel("Số tiền thanh toán 2", { exact: true }).fill("999999999");
      await expect(page.getByLabel("Số tiền thanh toán 2", { exact: true })).toHaveValue("150.000");
      await page.getByLabel("Số tiền thanh toán 1", { exact: true }).fill("999999999");
      await expect(page.getByLabel("Số tiền thanh toán 1", { exact: true })).toHaveValue("100.000");
      await page.getByLabel("Giảm giá (₫)", { exact: true }).fill("50000");
      await expect(page.getByLabel("Số tiền thanh toán 2", { exact: true })).toHaveValue("100.000");
      await page.getByLabel("Giảm giá (₫)", { exact: true }).fill("0");
      mkdirSync("artifacts", { recursive: true });
      await page.screenshot({ path: `artifacts/new-order-${width}.png`, fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole("button", { name: "Lưu đơn hàng", exact: true }).click();
      await expect(page).toHaveURL(/\/orders$/);
      const created = await db.order.findFirstOrThrow({ where: { shopId: shop.id, customer: `Khách thử ${width}` }, include: { items: true } });
      assert.equal(created.price, 250000);
      assert.equal(created.date, "2026-10-20");
      assert.equal(created.items.length, 1);
      assert.equal(created.paidAmount, 200000);
    }
  } finally {
    if (shop) { await db.order.deleteMany({ where: { shopId: shop.id } }); await db.customer.deleteMany({ where: { shopId: shop.id } }); await db.shop.delete({ where: { id: shop.id } }); }
    await browser.close(); await db.$disconnect();
  }
});
