-- PENDING: bu migration, avans modülü ana branch'e (main) TAMAMIYLA
-- taşınana kadar prod'a gitmeyecek. Vekil senaryosu (c) — bkz.
-- AvansTalebi.sorumluId zaten vekilin kendi id'si; bu alan sadece
-- "eşleşme vekil-işaretli bir alan üzerinden mi kuruldu" bilgisini tutar.

-- AlterTable
ALTER TABLE "AvansTalebi" ADD COLUMN     "vekaletenMi" BOOLEAN NOT NULL DEFAULT false;
