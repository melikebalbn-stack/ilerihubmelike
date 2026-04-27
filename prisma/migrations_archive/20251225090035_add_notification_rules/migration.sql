-- CreateEnum
CREATE TYPE "NotificationRuleType" AS ENUM ('EXPIRING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationRulePeriod" AS ENUM ('BEFORE', 'AFTER');

-- CreateTable
CREATE TABLE "CalibrationNotificationRule" (
    "id" TEXT NOT NULL,
    "type" "NotificationRuleType" NOT NULL,
    "period" "NotificationRulePeriod" NOT NULL,
    "days" INTEGER NOT NULL,
    "repeatWeekly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationNotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalibrationNotificationRule_isActive_idx" ON "CalibrationNotificationRule"("isActive");

-- CreateIndex
CREATE INDEX "CalibrationNotificationRule_type_idx" ON "CalibrationNotificationRule"("type");
