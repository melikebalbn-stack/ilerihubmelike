-- CreateEnum
CREATE TYPE "UygunsuzlukKarar" AS ENUM ('HURDA', 'IADE', 'TAMIR');

-- CreateTable
CREATE TABLE "KaliteUygunsuzluk" (
    "id" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL,
    "mamulUrunKodu" TEXT NOT NULL,
    "isEmriNo" TEXT NOT NULL,
    "isEmriAdeti" INTEGER,
    "tespitEdenBolumId" TEXT,
    "kokNeden" TEXT,
    "duzelticiFaaliyet" TEXT,
    "sorumluId" TEXT,
    "termin" TIMESTAMP(3),
    "kapanisTarihi" TIMESTAMP(3),
    "olusturanId" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleyenId" TEXT,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KaliteUygunsuzluk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KaliteUygunsuzlukSatir" (
    "id" TEXT NOT NULL,
    "uygunsuzlukId" TEXT NOT NULL,
    "siraNo" INTEGER NOT NULL,
    "yariMamulKodu" TEXT,
    "malzemeAdi" TEXT,
    "redAdeti" INTEGER NOT NULL,
    "reworkAdedi" INTEGER,
    "olusanBolumId" TEXT,
    "hataKoduId" TEXT,
    "hataDetayi" TEXT,
    "karar" "UygunsuzlukKarar",

    CONSTRAINT "KaliteUygunsuzlukSatir_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KaliteUygunsuzluk_no_key" ON "KaliteUygunsuzluk"("no");

-- CreateIndex
CREATE INDEX "KaliteUygunsuzluk_isEmriNo_idx" ON "KaliteUygunsuzluk"("isEmriNo");

-- CreateIndex
CREATE INDEX "KaliteUygunsuzluk_tarih_idx" ON "KaliteUygunsuzluk"("tarih");

-- CreateIndex
CREATE INDEX "KaliteUygunsuzluk_kapanisTarihi_idx" ON "KaliteUygunsuzluk"("kapanisTarihi");

-- CreateIndex
CREATE INDEX "KaliteUygunsuzlukSatir_uygunsuzlukId_idx" ON "KaliteUygunsuzlukSatir"("uygunsuzlukId");

-- CreateIndex
CREATE INDEX "KaliteUygunsuzlukSatir_hataKoduId_idx" ON "KaliteUygunsuzlukSatir"("hataKoduId");

-- AddForeignKey
ALTER TABLE "KaliteUygunsuzluk" ADD CONSTRAINT "KaliteUygunsuzluk_tespitEdenBolumId_fkey" FOREIGN KEY ("tespitEdenBolumId") REFERENCES "HataKodu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaliteUygunsuzluk" ADD CONSTRAINT "KaliteUygunsuzluk_sorumluId_fkey" FOREIGN KEY ("sorumluId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaliteUygunsuzlukSatir" ADD CONSTRAINT "KaliteUygunsuzlukSatir_uygunsuzlukId_fkey" FOREIGN KEY ("uygunsuzlukId") REFERENCES "KaliteUygunsuzluk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaliteUygunsuzlukSatir" ADD CONSTRAINT "KaliteUygunsuzlukSatir_olusanBolumId_fkey" FOREIGN KEY ("olusanBolumId") REFERENCES "HataKodu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaliteUygunsuzlukSatir" ADD CONSTRAINT "KaliteUygunsuzlukSatir_hataKoduId_fkey" FOREIGN KEY ("hataKoduId") REFERENCES "HataKodu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

