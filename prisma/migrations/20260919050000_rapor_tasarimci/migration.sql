-- CreateEnum
CREATE TYPE "RaporKaynakTipi" AS ENUM ('IFS_ODATA', 'POSTGRES');

-- CreateEnum
CREATE TYPE "RaporSablonDurum" AS ENUM ('TASLAK', 'YAYINDA', 'ARSIV');

-- CreateEnum
CREATE TYPE "RaporCiktiTipi" AS ENUM ('EKRAN', 'XLSX', 'PDF');


-- CreateTable
CREATE TABLE "rapor_katalog" (
    "id" TEXT NOT NULL,
    "kaynakTipi" "RaporKaynakTipi" NOT NULL,
    "kaynakAd" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "alan" TEXT NOT NULL,
    "veriTipi" TEXT NOT NULL,
    "etiket" TEXT,
    "anahtarMi" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "guncellenme" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rapor_katalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rapor_veri_seti" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "tanim" JSONB NOT NULL,
    "onbellekSn" INTEGER NOT NULL DEFAULT 300,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturanId" TEXT,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellenme" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rapor_veri_seti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rapor_sablon" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "veriSetiId" TEXT NOT NULL,
    "icerik" JSONB NOT NULL,
    "surum" INTEGER NOT NULL DEFAULT 1,
    "durum" "RaporSablonDurum" NOT NULL DEFAULT 'TASLAK',
    "izinAnahtari" TEXT,
    "olusturanId" TEXT,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellenme" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rapor_sablon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rapor_sablon_surum" (
    "id" TEXT NOT NULL,
    "sablonId" TEXT NOT NULL,
    "surum" INTEGER NOT NULL,
    "icerik" JSONB NOT NULL,
    "kaydedenId" TEXT,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rapor_sablon_surum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rapor_calistirma" (
    "id" TEXT NOT NULL,
    "sablonId" TEXT NOT NULL,
    "calistiranId" TEXT,
    "parametreler" JSONB,
    "satirSayisi" INTEGER,
    "sureMs" INTEGER,
    "cikti" "RaporCiktiTipi" NOT NULL DEFAULT 'EKRAN',
    "hata" TEXT,
    "olusturma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rapor_calistirma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rapor_katalog_entity_idx" ON "rapor_katalog"("entity");

-- CreateIndex
CREATE UNIQUE INDEX "rapor_katalog_kaynakAd_entity_alan_key" ON "rapor_katalog"("kaynakAd", "entity", "alan");

-- CreateIndex
CREATE UNIQUE INDEX "rapor_veri_seti_ad_key" ON "rapor_veri_seti"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "rapor_sablon_kod_key" ON "rapor_sablon"("kod");

-- CreateIndex
CREATE INDEX "rapor_sablon_durum_idx" ON "rapor_sablon"("durum");

-- CreateIndex
CREATE UNIQUE INDEX "rapor_sablon_surum_sablonId_surum_key" ON "rapor_sablon_surum"("sablonId", "surum");

-- CreateIndex
CREATE INDEX "rapor_calistirma_sablonId_olusturma_idx" ON "rapor_calistirma"("sablonId", "olusturma");

-- AddForeignKey
ALTER TABLE "rapor_veri_seti" ADD CONSTRAINT "rapor_veri_seti_olusturanId_fkey" FOREIGN KEY ("olusturanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapor_sablon" ADD CONSTRAINT "rapor_sablon_veriSetiId_fkey" FOREIGN KEY ("veriSetiId") REFERENCES "rapor_veri_seti"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapor_sablon" ADD CONSTRAINT "rapor_sablon_olusturanId_fkey" FOREIGN KEY ("olusturanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapor_sablon_surum" ADD CONSTRAINT "rapor_sablon_surum_sablonId_fkey" FOREIGN KEY ("sablonId") REFERENCES "rapor_sablon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapor_sablon_surum" ADD CONSTRAINT "rapor_sablon_surum_kaydedenId_fkey" FOREIGN KEY ("kaydedenId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapor_calistirma" ADD CONSTRAINT "rapor_calistirma_sablonId_fkey" FOREIGN KEY ("sablonId") REFERENCES "rapor_sablon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapor_calistirma" ADD CONSTRAINT "rapor_calistirma_calistiranId_fkey" FOREIGN KEY ("calistiranId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

