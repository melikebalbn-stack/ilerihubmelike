-- CreateEnum
CREATE TYPE "BakimYonlendirmeDurum" AS ENUM ('TESPIT_EDILDI', 'BAKIMA_YONLENDIRILDI', 'BAKIM_INCELEDI', 'KENDI_COZDU', 'SERVIS_TALEBI_ACILDI', 'TAMAMLANDI', 'IPTAL');

-- CreateTable
CREATE TABLE "envanter_bakim_yonlendirme" (
    "id" TEXT NOT NULL,
    "kayitNo" TEXT NOT NULL,
    "tespitEdenId" TEXT,
    "tespitEdenAd" TEXT NOT NULL,
    "konu" TEXT NOT NULL,
    "lokasyon" TEXT,
    "aciklama" TEXT,
    "yonlendirilenBirim" TEXT NOT NULL DEFAULT 'Bakım',
    "durum" "BakimYonlendirmeDurum" NOT NULL DEFAULT 'TESPIT_EDILDI',
    "servisReferansi" TEXT,
    "sonucNotu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envanter_bakim_yonlendirme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "envanter_bakim_yonlendirme_kayitNo_key" ON "envanter_bakim_yonlendirme"("kayitNo");

-- CreateIndex
CREATE INDEX "envanter_bakim_yonlendirme_durum_idx" ON "envanter_bakim_yonlendirme"("durum");
