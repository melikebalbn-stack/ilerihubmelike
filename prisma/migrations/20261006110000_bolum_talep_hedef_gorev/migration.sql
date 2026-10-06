-- Bölüm Değişikliği Talebi: yeni görev seçimi + onay anındaki koltuk sonucu (additive)
ALTER TABLE "bolum_degisiklik_talep" ADD COLUMN "hedefGorev" TEXT;
ALTER TABLE "bolum_degisiklik_talep" ADD COLUMN "koltukTasindi" BOOLEAN;
ALTER TABLE "bolum_degisiklik_talep" ADD COLUMN "koltukSebep" TEXT;
