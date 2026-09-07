-- Durum backfill: kapanisTarihi dolu → KAPALI; boş → ACIK (kolon default'u).
-- Ayrı dosya: şema değişikliği ile veri düzeltmesi ayrışsın (emsal:
-- 20260831130940_arsiv_bolum_fk_veri, 20260901132951_personnel_dept_fk_backfill).
--
-- PROD'da bugün 0 satır etkiler: 115 kaydın hiçbirinde kapanisTarihi dolu değil.
UPDATE "RmaKayit" SET "durum" = 'KAPALI' WHERE "kapanisTarihi" IS NOT NULL;
