-- Kalibrasyon cihazına Üretim Bölümü alanı (additive nullable — mevcut veri dokunulmaz).
-- Departman=Üretim iken seçilir; Lokasyon'dan bağımsız saklanır.
ALTER TABLE "CalibrationDevice" ADD COLUMN "productionSection" TEXT;
