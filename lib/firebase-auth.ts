import "server-only";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";

export const firebaseEnabled = () => process.env.FIREBASE_AUTH_ENABLED === "1";
export class FirebaseAuthError extends Error {
  constructor(public code: string) { super(code); }
}
export function firebaseAuth() {
  if (!firebaseEnabled()) throw new FirebaseAuthError("unavailable");
  const app = getApps().find((app) => app.name === "floralhelp-auth") ?? initializeApp({
    credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID,
  }, "floralhelp-auth");
  return getAuth(app);
}
export function isFirebaseError(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
async function authRequest(path: string, body: Record<string, unknown>) {
  if (!firebaseEnabled() || !process.env.FIREBASE_WEB_API_KEY) throw new FirebaseAuthError("unavailable");
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${encodeURIComponent(process.env.FIREBASE_WEB_API_KEY)}`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Firebase-Locale": "vi" },
    body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) throw new FirebaseAuthError(String(result.error?.message ?? "unavailable").split(" : ")[0]);
  return result;
}
export async function firebaseSignIn(email: string, password: string, expectedUid: string) {
  const result = await authRequest("signInWithPassword", { email, password, returnSecureToken: true });
  if (result.localId !== expectedUid) throw new FirebaseAuthError("identity-mismatch");
  const user = await firebaseAuth().getUser(expectedUid);
  assertFirebaseIdentity(user, expectedUid, email);
  return { user, idToken: result.idToken as string };
}
export function assertFirebaseIdentity(user: UserRecord, uid: string, email: string) {
  if (user.uid !== uid || user.email?.toLowerCase() !== email.toLowerCase() || user.disabled)
    throw new FirebaseAuthError("identity-mismatch");
}
export async function sendVerification(idToken: string) {
  await authRequest("sendOobCode", { requestType: "VERIFY_EMAIL", idToken,
    continueUrl: `${process.env.SITE_URL || "https://sale.floralhelp.com"}/login?reason=email-verified` });
}
export async function sendPasswordReset(email: string) {
  await authRequest("sendOobCode", { requestType: "PASSWORD_RESET", email,
    continueUrl: `${process.env.SITE_URL || "https://sale.floralhelp.com"}/login?reason=password-changed` });
}
export async function setFirebasePassword(uid: string, password: string) {
  await firebaseAuth().updateUser(uid, { password });
  await firebaseAuth().revokeRefreshTokens(uid);
}
export async function deleteFirebaseUser(uid: string) {
  try { await firebaseAuth().deleteUser(uid); }
  catch (error) { if (!isFirebaseError(error, "auth/user-not-found")) throw error; }
}

// No positive cache: password resets and disabled Firebase users must be checked
// before each authenticated request, including mutations.
export async function firebaseSessionValid(uid: string, email: string, createdAt: Date) {
  try {
    const user = await firebaseAuth().getUser(uid);
    assertFirebaseIdentity(user, uid, email);
    return createdAt.getTime() >= Date.parse(user.tokensValidAfterTime || "1970-01-01");
  } catch (error) {
    if (isFirebaseError(error, "auth/user-not-found") || isFirebaseError(error, "identity-mismatch")) return false;
    throw error;
  }
}
