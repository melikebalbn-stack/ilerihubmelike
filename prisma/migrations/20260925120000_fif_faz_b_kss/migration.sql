-- FİF (KAL-FR-10) FAZ B — KSS adımları
-- Additive: FifDurum'a iki değer + Fif'e iki kolon. Mevcut kayıtlar etkilenmez.
--
-- PostgreSQL 14 (prod): ALTER TYPE ... ADD VALUE transaction içinde çalışır
-- (PG 12+). Yeni değerler AYNI transaction'da KULLANILMAZ — yalnız tanımlanır,
-- bu yüzden tek dosyada iki değer eklemek güvenlidir.

-- AlterEnum
ALTER TYPE "FifDurum" ADD VALUE 'KSS_KAYIT_BEKLIYOR';
ALTER TYPE "FifDurum" ADD VALUE 'KSS_KAPANIS_BEKLIYOR';

-- AlterTable: KSS snapshot'ı (zincir çözümünden gelir) + kayda alma anı.
ALTER TABLE "Fif" ADD COLUMN     "kayitTarihi" TIMESTAMP(3),
ADD COLUMN     "kssUserId" TEXT;
