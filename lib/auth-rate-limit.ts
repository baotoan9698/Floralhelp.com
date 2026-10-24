import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db } from "./db";

export async function authRateLimit(key: string, maximum: number, minutes = 15) {
  await db.authAttempt.deleteMany({ where: { key, resetsAt: { lte: new Date() } } });
  const attempt = await db.authAttempt.upsert({ where: { key },
    create: { key, resetsAt: new Date(Date.now() + minutes * 60000) }, update: { count: { increment: 1 } } });
  return attempt.count <= maximum;
}
export async function authIpLimit() {
  const h = await headers();
  // Nginx overwrites X-Real-IP; do not trust client-supplied X-Forwarded-For.
  const ip = h.get("x-real-ip") || "unknown";
  return authRateLimit(`auth-ip:${createHash("sha256").update(ip).digest("hex")}`, 60);
}
