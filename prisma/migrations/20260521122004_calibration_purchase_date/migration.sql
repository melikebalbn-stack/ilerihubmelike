-- Replace CalibrationDevice.certificateNumber with purchaseDate
ALTER TABLE "CalibrationDevice" DROP COLUMN "certificateNumber";
ALTER TABLE "CalibrationDevice" ADD COLUMN "purchaseDate" TIMESTAMP(3);
