-- CreateEnum
CREATE TYPE "KartOkutamamaNedeni" AS ENUM ('UNUTMA', 'BOZULMA', 'KAYBETME', 'VAZIFE');

-- AlterTable
ALTER TABLE "BulkCardScanFailure" ADD COLUMN "neden" "KartOkutamamaNedeni";
