ALTER TABLE "Shop" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'trial';
UPDATE "Shop" SET "plan" = 'legacy';
UPDATE "Shop" SET "plan" = 'trial' WHERE ABS(EXTRACT(EPOCH FROM ("accessUntil" - "createdAt")) - 1296000) < 60;
