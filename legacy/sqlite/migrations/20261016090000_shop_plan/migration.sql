ALTER TABLE "Shop" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'trial';
UPDATE "Shop" SET "plan" = 'legacy';
UPDATE "Shop" SET "plan" = 'trial' WHERE ABS(("accessUntil" - "createdAt") - 1296000000) < 60000;
