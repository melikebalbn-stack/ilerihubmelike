-- CreateEnum
CREATE TYPE "KartOkutamamaOnayDurumu" AS ENUM ('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI');

-- AlterTable
ALTER TABLE "BulkCardScanFailure"
  ADD COLUMN "onayDurumu" "KartOkutamamaOnayDurumu" NOT NULL DEFAULT 'ONAYLANDI',
  ADD COLUMN "approverId" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BulkCardScanFailure_approverId_idx" ON "BulkCardScanFailure"("approverId");

-- AddForeignKey
ALTER TABLE "BulkCardScanFailure" ADD CONSTRAINT "BulkCardScanFailure_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
