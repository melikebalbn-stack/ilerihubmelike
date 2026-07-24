-- AlterTable
ALTER TABLE "BulkCardScanFailure" ADD COLUMN "approverId2" TEXT;

-- CreateIndex
CREATE INDEX "BulkCardScanFailure_approverId2_idx" ON "BulkCardScanFailure"("approverId2");

-- AddForeignKey
ALTER TABLE "BulkCardScanFailure" ADD CONSTRAINT "BulkCardScanFailure_approverId2_fkey" FOREIGN KEY ("approverId2") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
