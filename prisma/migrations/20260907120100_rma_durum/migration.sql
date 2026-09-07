-- RMA/SMA durumu artık ELLE seçilir; kapanisTarihi'nden türetme kalkıyor.
-- Kolon NOT NULL + DEFAULT 'ACIK' → mevcut satırlar önce ACIK olur,
-- kapanisTarihi dolu olanlar bir sonraki migration'da (backfill) KAPALI'ya çekilir.

-- CreateEnum
CREATE TYPE "RmaDurum" AS ENUM ('ACIK', 'KAPALI');

-- AlterTable
ALTER TABLE "RmaKayit" ADD COLUMN "durum" "RmaDurum" NOT NULL DEFAULT 'ACIK';

-- CreateIndex
CREATE INDEX "RmaKayit_durum_idx" ON "RmaKayit"("durum");
