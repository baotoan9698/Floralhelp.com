// Run once with the new Prisma schema, before enabling FIREBASE_AUTH_ENABLED.
// Existing shop IDs, access dates and data are untouched. No email is sent.
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
const apply = process.argv.includes("--apply");
const db = new PrismaClient();
const auth = getAuth(initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID }));
try {
  const shops = await db.shop.findMany({ where: { firebaseUid: null, emailVerificationRequired: false } });
  console.log(`Legacy accounts to link: ${shops.length}; apply=${apply}`);
  if (!apply) process.exitCode = 0;
  else for (const shop of shops) {
    const [salt, hash] = shop.passwordHash.split(":");
    if (!/^[a-f0-9]{32}$/i.test(salt || "") || !/^[a-f0-9]{128}$/i.test(hash || "")) throw new Error(`Unsupported hash for shop ${shop.id}`);
    let created = false;
    let user;
    try { user = await auth.getUser(shop.id); }
    catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
      // createUser checks email uniqueness; importUsers alone does NOT.
      user = await auth.createUser({ uid: shop.id, email: shop.email, emailVerified: false, password: randomBytes(48).toString("base64url") });
      created = true;
    }
    if (user.email?.toLowerCase() !== shop.email.toLowerCase()) throw new Error(`Identity collision for shop ${shop.id}`);
    // Retry safely after an interrupted import: this local account is still unlinked.
    {
      try {
        const imported = await auth.importUsers([{ uid: shop.id, email: shop.email, emailVerified: false,
          passwordHash: Buffer.from(hash, "hex"), passwordSalt: Buffer.from(salt, "utf8") }],
          { hash: { algorithm: "STANDARD_SCRYPT", memoryCost: 16384, parallelization: 1, blockSize: 8, derivedKeyLength: 64 } });
        if (imported.failureCount) throw new Error(`Password import failed for shop ${shop.id}`);
      } catch (error) { if (created) await auth.deleteUser(shop.id); throw error; }
    }
    const changed = await db.$transaction(async (tx) => {
      const result = await tx.shop.updateMany({ where: { id: shop.id, firebaseUid: null, passwordHash: shop.passwordHash }, data: { firebaseUid: shop.id } });
      if (result.count) await tx.session.updateMany({ where: { shopId: shop.id }, data: { createdAt: new Date() } });
      return result.count;
    });
    if (!changed && created) { await auth.deleteUser(shop.id); throw new Error(`Concurrent change for ${shop.id}; retry import`); }
    console.log(`Linked shop ${shop.id}`);
  }
} finally { await db.$disconnect(); }
