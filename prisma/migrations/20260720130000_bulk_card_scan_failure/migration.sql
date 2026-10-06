-- CreateTable
CREATE TABLE "BulkCardScanFailure" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "sicilNo" TEXT,
    "adSoyad" TEXT NOT NULL,
    "tarih" DATE NOT NULL,
    "girisSaati" TEXT,
    "cikisSaati" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkCardScanFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkCardScanFailure_personnelId_idx" ON "BulkCardScanFailure"("personnelId");

-- CreateIndex
CREATE INDEX "BulkCardScanFailure_tarih_idx" ON "BulkCardScanFailure"("tarih");

-- CreateIndex
CREATE INDEX "BulkCardScanFailure_createdById_idx" ON "BulkCardScanFailure"("createdById");

-- AddForeignKey
ALTER TABLE "BulkCardScanFailure" ADD CONSTRAINT "BulkCardScanFailure_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkCardScanFailure" ADD CONSTRAINT "BulkCardScanFailure_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
