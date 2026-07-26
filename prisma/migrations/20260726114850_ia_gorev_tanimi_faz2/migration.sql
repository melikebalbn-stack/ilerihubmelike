-- CreateEnum
CREATE TYPE "IaGorevTip" AS ENUM ('CEKIRDEK', 'DEGISKEN');

-- CreateEnum
CREATE TYPE "IaGereklilikTip" AS ENUM ('EGITIM_DUZEYI', 'EGITIM_ALANI', 'DENEYIM', 'YABANCI_DIL', 'ZORUNLU_BECERI', 'TERCIH_BECERI', 'GENEL_BECERI');

-- CreateEnum
CREATE TYPE "IaStandartBlokTip" AS ENUM ('KALITE', 'ISG', 'GIZLILIK', 'YONETMELIK');

-- CreateEnum
CREATE TYPE "IaImzaDurum" AS ENUM ('BEKLIYOR', 'IMZALANDI', 'REDDEDILDI');

-- AlterTable
ALTER TABLE "ia_gorev_tanimi" ADD COLUMN     "amacEn" TEXT,
ADD COLUMN     "anaSorumluluklarEn" TEXT,
ADD COLUMN     "dokumanNo" TEXT,
ADD COLUMN     "genelMudurId" TEXT,
ADD COLUMN     "hazirlayanId" TEXT,
ADD COLUMN     "isoMadde" TEXT DEFAULT '7.3.2',
ADD COLUMN     "kaynakAnalizIdler" TEXT[],
ADD COLUMN     "revizyonNo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "yonetimTemsilcisiId" TEXT;

-- CreateTable
CREATE TABLE "ia_gorev_tanimi_gorev" (
    "id" TEXT NOT NULL,
    "gorevTanimiId" TEXT NOT NULL,
    "gorevAdi" TEXT NOT NULL,
    "gorevAdiEn" TEXT,
    "tip" "IaGorevTip" NOT NULL DEFAULT 'CEKIRDEK',
    "harcananZamanYuzde" INTEGER,
    "ilgiliProsedur" TEXT,
    "kaynakSayisi" INTEGER NOT NULL DEFAULT 0,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_gorev_tanimi_gorev_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_gorev_tanimi_gorev_kisi" (
    "id" TEXT NOT NULL,
    "gorevId" TEXT NOT NULL,
    "personelId" TEXT NOT NULL,
    "yedekMi" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ia_gorev_tanimi_gorev_kisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_gorev_tanimi_kpi" (
    "id" TEXT NOT NULL,
    "gorevTanimiId" TEXT NOT NULL,
    "gorev" TEXT NOT NULL,
    "gosterge" TEXT NOT NULL,
    "gostergeEn" TEXT,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ia_gorev_tanimi_kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_gorev_tanimi_gereklilik" (
    "id" TEXT NOT NULL,
    "gorevTanimiId" TEXT NOT NULL,
    "tip" "IaGereklilikTip" NOT NULL,
    "deger" TEXT NOT NULL,
    "degerEn" TEXT,
    "sira" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ia_gorev_tanimi_gereklilik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_standart_blok" (
    "id" TEXT NOT NULL,
    "tip" "IaStandartBlokTip" NOT NULL,
    "baslikTr" TEXT NOT NULL,
    "baslikEn" TEXT,
    "icerikTr" TEXT NOT NULL,
    "icerikEn" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ia_standart_blok_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_gorev_tanimi_imza" (
    "id" TEXT NOT NULL,
    "gorevTanimiId" TEXT NOT NULL,
    "personelId" TEXT NOT NULL,
    "durum" "IaImzaDurum" NOT NULL DEFAULT 'BEKLIYOR',
    "imzaVerisi" TEXT,
    "imzaTarihi" TIMESTAMP(3),
    "kepReferans" TEXT,
    "gonderimTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_gorev_tanimi_imza_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ia_gorev_tanimi_gorev_gorevTanimiId_idx" ON "ia_gorev_tanimi_gorev"("gorevTanimiId");

-- CreateIndex
CREATE INDEX "ia_gorev_tanimi_gorev_kisi_gorevId_idx" ON "ia_gorev_tanimi_gorev_kisi"("gorevId");

-- CreateIndex
CREATE UNIQUE INDEX "ia_gorev_tanimi_gorev_kisi_gorevId_personelId_key" ON "ia_gorev_tanimi_gorev_kisi"("gorevId", "personelId");

-- CreateIndex
CREATE INDEX "ia_gorev_tanimi_kpi_gorevTanimiId_idx" ON "ia_gorev_tanimi_kpi"("gorevTanimiId");

-- CreateIndex
CREATE INDEX "ia_gorev_tanimi_gereklilik_gorevTanimiId_idx" ON "ia_gorev_tanimi_gereklilik"("gorevTanimiId");

-- CreateIndex
CREATE INDEX "ia_gorev_tanimi_imza_gorevTanimiId_idx" ON "ia_gorev_tanimi_imza"("gorevTanimiId");

-- CreateIndex
CREATE INDEX "ia_gorev_tanimi_imza_personelId_idx" ON "ia_gorev_tanimi_imza"("personelId");

-- AddForeignKey
ALTER TABLE "ia_gorev_tanimi_gorev" ADD CONSTRAINT "ia_gorev_tanimi_gorev_gorevTanimiId_fkey" FOREIGN KEY ("gorevTanimiId") REFERENCES "ia_gorev_tanimi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_gorev_tanimi_gorev_kisi" ADD CONSTRAINT "ia_gorev_tanimi_gorev_kisi_gorevId_fkey" FOREIGN KEY ("gorevId") REFERENCES "ia_gorev_tanimi_gorev"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_gorev_tanimi_kpi" ADD CONSTRAINT "ia_gorev_tanimi_kpi_gorevTanimiId_fkey" FOREIGN KEY ("gorevTanimiId") REFERENCES "ia_gorev_tanimi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_gorev_tanimi_gereklilik" ADD CONSTRAINT "ia_gorev_tanimi_gereklilik_gorevTanimiId_fkey" FOREIGN KEY ("gorevTanimiId") REFERENCES "ia_gorev_tanimi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_gorev_tanimi_imza" ADD CONSTRAINT "ia_gorev_tanimi_imza_gorevTanimiId_fkey" FOREIGN KEY ("gorevTanimiId") REFERENCES "ia_gorev_tanimi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
