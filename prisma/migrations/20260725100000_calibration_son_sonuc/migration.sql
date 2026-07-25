-- CalibrationDevice.sonKalibrasyonSonucu — son geçmiş kaydının sonucu (denormalize).
-- Additive: nullable ADD COLUMN + mevcut cihazlara en-güncel history'den backfill.

-- AlterTable
ALTER TABLE "CalibrationDevice" ADD COLUMN "sonKalibrasyonSonucu" "CalibrationResult";

-- Backfill: her cihaza EN GÜNCEL kalibrasyon geçmişinin sonucunu yaz.
-- En güncel = calibrationDate en büyük; eşitlikte id ile deterministik.
UPDATE "CalibrationDevice" d
SET "sonKalibrasyonSonucu" = h.result
FROM (
  SELECT DISTINCT ON ("deviceId") "deviceId", result
  FROM "CalibrationHistory"
  ORDER BY "deviceId", "calibrationDate" DESC, id DESC
) h
WHERE d.id = h."deviceId";
