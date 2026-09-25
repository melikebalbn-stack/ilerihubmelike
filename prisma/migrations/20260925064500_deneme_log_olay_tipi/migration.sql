-- IV-FR-27 · Deneme değerlendirme yönlendirme (FAZ 2)
--
-- ADDITIVE: yeni enum + log tablosuna NULLABLE kolon. Mevcut satırlar NULL
-- kalır (NULL = klasik durum geçişi), varsayılan yok, backfill yok, veri
-- dönüşümü yok. Geri alma: kolonu ve tipi DROP etmek yeterli.

-- CreateEnum
CREATE TYPE "DenemeLogOlayTipi" AS ENUM ('YONLENDIRME');

-- AlterTable
ALTER TABLE "deneme_degerlendirme_log" ADD COLUMN "olayTipi" "DenemeLogOlayTipi";
