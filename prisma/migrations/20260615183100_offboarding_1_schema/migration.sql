-- CreateEnum
CREATE TYPE "OffboardingPersonnelType" AS ENUM ('ILERI_MEKANIK', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "OffboardingSeparationType" AS ENUM ('RESIGNATION', 'TERMINATION', 'RETIREMENT', 'CONTRACT_END', 'OTHER');

-- CreateEnum
CREATE TYPE "OffboardingStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "OffboardingForm" (
    "id" TEXT NOT NULL,
    "formNo" TEXT NOT NULL,
    "personnelId" TEXT,
    "adSoyad" TEXT NOT NULL,
    "sicilNo" TEXT,
    "departman" TEXT,
    "gorev" TEXT,
    "iseGirisTarihi" DATE,
    "ayrilisTarihi" DATE NOT NULL,
    "personelTuru" "OffboardingPersonnelType" NOT NULL,
    "ayrilisTuru" "OffboardingSeparationType" NOT NULL,
    "beyanOnay" BOOLEAN NOT NULL DEFAULT false,
    "teslimEdenAd" TEXT,
    "teslimAlanId" TEXT,
    "status" "OffboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "hazirlayanId" TEXT,
    "onaylayan1Id" TEXT,
    "onaylayan2Id" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffboardingForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffboardingAssetItem" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "sira" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "returned" BOOLEAN NOT NULL DEFAULT false,
    "notApplicable" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "OffboardingAssetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffboardingAccessItem" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "sira" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" DATE,
    "appliedBy" TEXT,

    CONSTRAINT "OffboardingAccessItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OffboardingForm_formNo_key" ON "OffboardingForm"("formNo");

-- CreateIndex
CREATE INDEX "OffboardingForm_status_idx" ON "OffboardingForm"("status");

-- CreateIndex
CREATE INDEX "OffboardingForm_personnelId_idx" ON "OffboardingForm"("personnelId");

-- CreateIndex
CREATE INDEX "OffboardingAssetItem_formId_idx" ON "OffboardingAssetItem"("formId");

-- CreateIndex
CREATE INDEX "OffboardingAccessItem_formId_idx" ON "OffboardingAccessItem"("formId");

-- AddForeignKey
ALTER TABLE "OffboardingForm" ADD CONSTRAINT "OffboardingForm_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingForm" ADD CONSTRAINT "OffboardingForm_teslimAlanId_fkey" FOREIGN KEY ("teslimAlanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingForm" ADD CONSTRAINT "OffboardingForm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingAssetItem" ADD CONSTRAINT "OffboardingAssetItem_formId_fkey" FOREIGN KEY ("formId") REFERENCES "OffboardingForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingAccessItem" ADD CONSTRAINT "OffboardingAccessItem_formId_fkey" FOREIGN KEY ("formId") REFERENCES "OffboardingForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

