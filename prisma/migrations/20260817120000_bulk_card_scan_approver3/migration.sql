-- AlterTable
ALTER TABLE "BulkCardScanFailure" ADD COLUMN "approverId3" TEXT;

-- CreateIndex
CREATE INDEX "BulkCardScanFailure_approverId3_idx" ON "BulkCardScanFailure"("approverId3");

-- AddForeignKey
ALTER TABLE "BulkCardScanFailure" ADD CONSTRAINT "BulkCardScanFailure_approverId3_fkey" FOREIGN KEY ("approverId3") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
