-- Kalite Uygunsuzluk eksikleri — alt parca kodu + kategori lookup tablosu.
-- Tamamen additive: nullable kolonlar + 1 yeni tablo. DROP / RENAME / NOT NULL yok.

-- AlterTable
ALTER TABLE "KaliteUygunsuzluk" ADD COLUMN     "altParcaKodu" TEXT,
ADD COLUMN     "kategoriId" TEXT;

-- CreateTable
CREATE TABLE "KaliteUygunsuzlukKategori" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "siraNo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KaliteUygunsuzlukKategori_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KaliteUygunsuzlukKategori_ad_key" ON "KaliteUygunsuzlukKategori"("ad");

-- CreateIndex
CREATE INDEX "KaliteUygunsuzlukKategori_aktif_siraNo_idx" ON "KaliteUygunsuzlukKategori"("aktif", "siraNo");

-- AddForeignKey
ALTER TABLE "KaliteUygunsuzluk" ADD CONSTRAINT "KaliteUygunsuzluk_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "KaliteUygunsuzlukKategori"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
