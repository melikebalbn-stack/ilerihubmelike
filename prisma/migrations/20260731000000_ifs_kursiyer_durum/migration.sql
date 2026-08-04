-- IFS-DURUM: Kursiyer görev durumu (Farklı Departman + Eğitim Gerekli dahil).
-- Additive: yeni enum + kolon (NOT NULL DEFAULT BEKLIYOR) + backfill.
-- ornekYapildi boolean'ı KORUNUR (raporlar + ContentProgress mirror kullanır).

-- CreateEnum
CREATE TYPE "KursiyerGorevDurum" AS ENUM ('BEKLIYOR', 'ORNEK_YAPILDI', 'FARKLI_DEPARTMAN', 'EGITIM_GEREKLI');

-- AlterTable
ALTER TABLE "ifs_task_evaluations"
  ADD COLUMN "kursiyerDurum" "KursiyerGorevDurum" NOT NULL DEFAULT 'BEKLIYOR';

-- Backfill: mevcut durumu koru — ornekYapildi=true → ORNEK_YAPILDI
-- (ornekYapildi=false zaten default BEKLIYOR'da kalır).
UPDATE "ifs_task_evaluations" SET "kursiyerDurum" = 'ORNEK_YAPILDI' WHERE "ornekYapildi" = true;
