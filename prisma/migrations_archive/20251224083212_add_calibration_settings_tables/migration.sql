-- CreateTable
CREATE TABLE "CalibrationLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationDeviceType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationDeviceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationDeviceModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationDeviceModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationLocation_name_key" ON "CalibrationLocation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationLocation_code_key" ON "CalibrationLocation"("code");

-- CreateIndex
CREATE INDEX "CalibrationLocation_isActive_sortOrder_idx" ON "CalibrationLocation"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationDeviceType_name_key" ON "CalibrationDeviceType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationDeviceType_code_key" ON "CalibrationDeviceType"("code");

-- CreateIndex
CREATE INDEX "CalibrationDeviceType_isActive_sortOrder_idx" ON "CalibrationDeviceType"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationDeviceModel_name_key" ON "CalibrationDeviceModel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationDeviceModel_code_key" ON "CalibrationDeviceModel"("code");

-- CreateIndex
CREATE INDEX "CalibrationDeviceModel_isActive_sortOrder_idx" ON "CalibrationDeviceModel"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "CalibrationDeviceModel_manufacturer_idx" ON "CalibrationDeviceModel"("manufacturer");
