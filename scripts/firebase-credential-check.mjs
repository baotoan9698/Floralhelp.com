// Explicit disposable integration check. Never logs passwords, tokens or email links.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { randomBytes, scryptSync } from "node:crypto";
import assert from "node:assert/strict";
const auth = getAuth(initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID }));
const uid = `floralhelp-auth-check-${Date.now()}`;
const email = `${uid}@example.invalid`;
const password = randomBytes(30).toString("base64url");
const salt = randomBytes(16).toString("hex");
let created = false;
async function request(path, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${process.env.FIREBASE_WEB_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message?.split(" : ")[0] || `HTTP ${response.status}`);
  return data;
}
try {
  await auth.createUser({ uid, email, password: randomBytes(30).toString("base64url") }); created = true;
  const imported = await auth.importUsers([{ uid, email, emailVerified: false, passwordHash: scryptSync(password, salt, 64), passwordSalt: Buffer.from(salt) }], {
    hash: { algorithm: "STANDARD_SCRYPT", memoryCost: 16384, parallelization: 1, blockSize: 8, derivedKeyLength: 64 } });
  assert.equal(imported.failureCount, 0);
  const signed = await request("signInWithPassword", { email, password, returnSecureToken: true });
  assert.equal(signed.localId, uid);
  assert.equal((await auth.getUser(uid)).emailVerified, false);
  // Exercise the real verification code flow without sending mail to a fake inbox.
  const verifyLink = await auth.generateEmailVerificationLink(email);
  await request("update", { oobCode: new URL(verifyLink).searchParams.get("oobCode") });
  assert.equal((await auth.getUser(uid)).emailVerified, true);
  const resetLink = await auth.generatePasswordResetLink(email);
  const replacement = randomBytes(30).toString("base64url");
  await request("resetPassword", { oobCode: new URL(resetLink).searchParams.get("oobCode"), newPassword: replacement });
  await assert.rejects(request("signInWithPassword", { email, password, returnSecureToken: true }));
  assert.equal((await request("signInWithPassword", { email, password: replacement, returnSecureToken: true })).localId, uid);
  console.log("PASS: Firebase Admin permissions, legacy scrypt password, verification code, password reset, old password rejected.");
} finally { if (created) { await auth.deleteUser(uid); console.log("Disposable Firebase account removed."); } }
