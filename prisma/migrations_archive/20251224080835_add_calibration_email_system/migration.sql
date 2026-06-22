-- CreateEnum
CREATE TYPE "CalibrationEmailType" AS ENUM ('EXPIRING_SOON', 'EXPIRED', 'REMINDER', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "CalibrationDevice" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "responsibleUserId" TEXT;

-- CreateTable
CREATE TABLE "CalibrationEmailLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "emailType" "CalibrationEmailType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,

    CONSTRAINT "CalibrationEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalibrationEmailLog_deviceId_idx" ON "CalibrationEmailLog"("deviceId");

-- CreateIndex
CREATE INDEX "CalibrationEmailLog_recipientId_idx" ON "CalibrationEmailLog"("recipientId");

-- CreateIndex
CREATE INDEX "CalibrationEmailLog_sentAt_idx" ON "CalibrationEmailLog"("sentAt");

-- AddForeignKey
ALTER TABLE "CalibrationDevice" ADD CONSTRAINT "CalibrationDevice_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationDevice" ADD CONSTRAINT "CalibrationDevice_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationEmailLog" ADD CONSTRAINT "CalibrationEmailLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "CalibrationDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationEmailLog" ADD CONSTRAINT "CalibrationEmailLog_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
