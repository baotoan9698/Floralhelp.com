ALTER TABLE "Shop" ADD COLUMN "reminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN "reminderMinutes" INTEGER NOT NULL DEFAULT 120;
CREATE TABLE "PushDevice" ("id" TEXT NOT NULL PRIMARY KEY, "shopId" TEXT NOT NULL, "endpoint" TEXT NOT NULL, "p256dh" TEXT NOT NULL, "auth" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE);
CREATE UNIQUE INDEX "PushDevice_endpoint_key" ON "PushDevice"("endpoint");
CREATE TABLE "DeliveryReminder" ("id" TEXT NOT NULL PRIMARY KEY, "shopId" TEXT NOT NULL, "orderId" TEXT NOT NULL, "scheduleKey" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "readAt" TIMESTAMP(3), FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE);
CREATE UNIQUE INDEX "DeliveryReminder_scheduleKey_key" ON "DeliveryReminder"("scheduleKey");
CREATE INDEX "DeliveryReminder_shopId_createdAt_idx" ON "DeliveryReminder"("shopId","createdAt");
