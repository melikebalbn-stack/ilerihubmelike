-- CreateEnum
CREATE TYPE "CalibrationStatus" AS ENUM ('VALID', 'EXPIRING', 'EXPIRED', 'IN_PROCESS', 'OUT_OF_ORDER');

-- CreateEnum
CREATE TYPE "CalibrationResult" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL');

-- CreateTable
CREATE TABLE "CalibrationDevice" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "location" TEXT,
    "department" TEXT,
    "responsiblePerson" TEXT,
    "calibrationInterval" INTEGER NOT NULL,
    "lastCalibrationDate" TIMESTAMP(3) NOT NULL,
    "nextCalibrationDate" TIMESTAMP(3) NOT NULL,
    "certificateNumber" TEXT,
    "status" "CalibrationStatus" NOT NULL DEFAULT 'VALID',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationHistory" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "calibrationDate" TIMESTAMP(3) NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "certificateNumber" TEXT,
    "calibratedBy" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "result" "CalibrationResult" NOT NULL DEFAULT 'PASS',
    "notes" TEXT,
    "certificatePath" TEXT,
    "attachments" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationDevice_deviceId_key" ON "CalibrationDevice"("deviceId");

-- CreateIndex
CREATE INDEX "CalibrationDevice_status_idx" ON "CalibrationDevice"("status");

-- CreateIndex
CREATE INDEX "CalibrationDevice_nextCalibrationDate_idx" ON "CalibrationDevice"("nextCalibrationDate");

-- CreateIndex
CREATE INDEX "CalibrationHistory_deviceId_idx" ON "CalibrationHistory"("deviceId");

-- CreateIndex
CREATE INDEX "CalibrationHistory_calibrationDate_idx" ON "CalibrationHistory"("calibrationDate");

-- AddForeignKey
ALTER TABLE "CalibrationHistory" ADD CONSTRAINT "CalibrationHistory_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "CalibrationDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
