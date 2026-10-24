ALTER TABLE "Shop" ADD COLUMN "firebaseUid" TEXT;
ALTER TABLE "Shop" ADD COLUMN "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN "emailVerifiedAt" DATETIME;
ALTER TABLE "Shop" ADD COLUMN "trialStartedAt" DATETIME;
CREATE UNIQUE INDEX "Shop_firebaseUid_key" ON "Shop"("firebaseUid");
ALTER TABLE "Session" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT 0;
UPDATE "Session" SET "createdAt" = CURRENT_TIMESTAMP;
