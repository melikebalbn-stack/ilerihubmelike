-- AlterTable
ALTER TABLE "BulkCardScanFailure"
  ADD COLUMN "ivOnaylandi" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ivOnaylayanId" TEXT,
  ADD COLUMN "ivOnaylandiAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "BulkCardScanFailure" ADD CONSTRAINT "BulkCardScanFailure_ivOnaylayanId_fkey" FOREIGN KEY ("ivOnaylayanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
