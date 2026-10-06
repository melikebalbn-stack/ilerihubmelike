-- CreateEnum
CREATE TYPE "ZimmetTuru" AS ENUM ('NOTEBOOK_BILGISAYAR', 'DESKTOP_BILGISAYAR', 'CEP_TELEFONU', 'EL_TERMINALI', 'OFFICE_365', 'DIGER');

-- CreateEnum
CREATE TYPE "ZimmetCihazDurumu" AS ENUM ('AKTIF', 'PASIF');

-- CreateEnum
CREATE TYPE "ZimmetOnayDurumu" AS ENUM ('ONAY_BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI');

-- CreateTable
CREATE TABLE "ZimmetFormu" (
    "id" TEXT NOT NULL,
    "zimmetSahibiId" TEXT NOT NULL,
    "altZimmetSahibi" TEXT,
    "departman" TEXT,
    "tur" "ZimmetTuru" NOT NULL,
    "turDiger" TEXT,
    "seriNumarasi" TEXT,
    "aciklama" TEXT,
    "ozellik" TEXT,
    "macAdresi" TEXT,
    "pcAdi" TEXT,
    "imeiNumarasi" TEXT,
    "verilisTarihi" TIMESTAMP(3),
    "cihazDurumu" "ZimmetCihazDurumu" NOT NULL DEFAULT 'AKTIF',
    "teslimNotu" TEXT,
    "durum" "ZimmetOnayDurumu" NOT NULL DEFAULT 'ONAY_BEKLIYOR',
    "onaylayanId" TEXT,
    "onayTarihi" TIMESTAMP(3),
    "zimmetSahibiImzaTarihi" TIMESTAMP(3),
    "teslimEdenImzaTarihi" TIMESTAMP(3),
    "imzaModu" TEXT,
    "islakImzaDosyasi" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZimmetFormu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZimmetFormu_zimmetSahibiId_idx" ON "ZimmetFormu"("zimmetSahibiId");

-- CreateIndex
CREATE INDEX "ZimmetFormu_durum_idx" ON "ZimmetFormu"("durum");

-- AddForeignKey
ALTER TABLE "ZimmetFormu" ADD CONSTRAINT "ZimmetFormu_zimmetSahibiId_fkey" FOREIGN KEY ("zimmetSahibiId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZimmetFormu" ADD CONSTRAINT "ZimmetFormu_onaylayanId_fkey" FOREIGN KEY ("onaylayanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZimmetFormu" ADD CONSTRAINT "ZimmetFormu_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

