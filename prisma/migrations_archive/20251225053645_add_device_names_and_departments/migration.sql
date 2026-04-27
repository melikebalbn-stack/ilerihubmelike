-- CreateTable
CREATE TABLE "CalibrationDeviceName" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationDeviceName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationDepartment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationDeviceName_name_key" ON "CalibrationDeviceName"("name");

-- CreateIndex
CREATE INDEX "CalibrationDeviceName_isActive_sortOrder_idx" ON "CalibrationDeviceName"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationDepartment_name_key" ON "CalibrationDepartment"("name");

-- CreateIndex
CREATE INDEX "CalibrationDepartment_isActive_sortOrder_idx" ON "CalibrationDepartment"("isActive", "sortOrder");
