-- CreateEnum
CREATE TYPE "RmaTip" AS ENUM ('RMA', 'SMA');

-- CreateEnum
CREATE TYPE "RmaIadeTuru" AS ENUM ('GIRIS_KALITE', 'HAT', 'GARANTI');

-- CreateEnum
CREATE TYPE "RmaKarar" AS ENUM ('HURDA', 'REWORK', 'TAMIR', 'TEDARIKCIYE_IADE', 'MUSTERIYE_IADE', 'DEPOYA_KABUL', 'URUN_BIZE_AIT_DEGIL');


-- CreateTable
CREATE TABLE "RmaKayit" (
    "id" TEXT NOT NULL,
    "tip" "RmaTip" NOT NULL,
    "no" INTEGER NOT NULL,
    "urunGelisTarihi" TIMESTAMP(3),
    "irsaliyeTarihi" TIMESTAMP(3),
    "irsaliyeNo" TEXT,
    "musteriId" TEXT NOT NULL,
    "iadeTuru" "RmaIadeTuru" NOT NULL,
    "sorumluId" TEXT,
    "termin" TIMESTAMP(3),
    "kapanisTarihi" TIMESTAMP(3),
    "maliyet" DECIMAL(12,2),
    "olusturanId" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleyenId" TEXT,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RmaKayit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RmaSatir" (
    "id" TEXT NOT NULL,
    "rmaKayitId" TEXT NOT NULL,
    "siraNo" INTEGER NOT NULL,
    "urunKodu" TEXT NOT NULL,
    "lotNo" TEXT,
    "iadeMiktari" INTEGER NOT NULL,
    "musteriIadeSebebi" TEXT NOT NULL,
    "ilkIncelemeSonucu" TEXT,
    "karar" "RmaKarar",
    "kararAciklama" TEXT,
    "hurdaAdedi" INTEGER,
    "reworkAdedi" INTEGER,
    "kokNeden" TEXT,
    "aksiyon" TEXT,

    CONSTRAINT "RmaSatir_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RmaKayit_no_key" ON "RmaKayit"("no");

-- CreateIndex
CREATE INDEX "RmaKayit_musteriId_idx" ON "RmaKayit"("musteriId");

-- CreateIndex
CREATE INDEX "RmaKayit_kapanisTarihi_idx" ON "RmaKayit"("kapanisTarihi");

-- CreateIndex
CREATE INDEX "RmaKayit_irsaliyeTarihi_idx" ON "RmaKayit"("irsaliyeTarihi");

-- CreateIndex
CREATE INDEX "RmaSatir_rmaKayitId_idx" ON "RmaSatir"("rmaKayitId");

-- AddForeignKey
ALTER TABLE "RmaKayit" ADD CONSTRAINT "RmaKayit_musteriId_fkey" FOREIGN KEY ("musteriId") REFERENCES "CostCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RmaKayit" ADD CONSTRAINT "RmaKayit_sorumluId_fkey" FOREIGN KEY ("sorumluId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RmaSatir" ADD CONSTRAINT "RmaSatir_rmaKayitId_fkey" FOREIGN KEY ("rmaKayitId") REFERENCES "RmaKayit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

