-- Partial unique index: en fazla BİR bölüm isHurdaTarget=true olabilir (DB garantisi).
-- Setter'daki $transaction (updateMany others -> false) mantık katmanı olarak kalır;
-- bu index eşzamanlı iki düzenlemenin "iki true" bırakma yarışını DB seviyesinde keser.
-- Additive: yalnız index ekler, mevcut veriye dokunmaz.
CREATE UNIQUE INDEX "CalibrationProductionSection_single_hurda_target"
  ON "CalibrationProductionSection" ("isHurdaTarget")
  WHERE "isHurdaTarget" = true;
