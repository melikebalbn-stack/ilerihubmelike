-- CreateEnum
CREATE TYPE "IzinBirim" AS ENUM ('GUN', 'SAAT');

-- CreateEnum
CREATE TYPE "IzinErkenDonusDurumu" AS ENUM ('BEKLIYOR', 'ONAYLANDI', 'REDDEDILDI');

-- AlterEnum
ALTER TYPE "IzinGunSayimi" ADD VALUE 'PZT_CMT';

-- AlterTable
ALTER TABLE "izin_turu" ADD COLUMN     "birim" "IzinBirim" NOT NULL DEFAULT 'GUN',
ADD COLUMN     "yakaKisiti" "YakaRengi",
ADD COLUMN     "yillikKotaDakika" INTEGER;

-- AlterTable
ALTER TABLE "izin_talep" ADD COLUMN     "baslangicSaat" TEXT,
ADD COLUMN     "bitisSaat" TEXT,
ADD COLUMN     "dakika" INTEGER;

-- AlterTable
ALTER TABLE "izin_talep_gun" ADD COLUMN     "iadeAt" TIMESTAMP(3),
ADD COLUMN     "iadeNedeni" TEXT,
ADD COLUMN     "iadeTalepId" TEXT;

-- AlterTable
ALTER TABLE "izin_belge" ADD COLUMN     "silindiAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "izin_erken_donus" (
    "id" TEXT NOT NULL,
    "talepId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "tarih" DATE NOT NULL,
    "durum" "IzinErkenDonusDurumu" NOT NULL DEFAULT 'BEKLIYOR',
    "iadeGun" DECIMAL(5,1),
    "kararVerenId" TEXT,
    "kararAt" TIMESTAMP(3),
    "kararNotu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "izin_erken_donus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "izin_erken_donus_talepId_key" ON "izin_erken_donus"("talepId");

-- CreateIndex
CREATE INDEX "izin_erken_donus_durum_idx" ON "izin_erken_donus"("durum");

-- CreateIndex
CREATE INDEX "izin_erken_donus_personnelId_idx" ON "izin_erken_donus"("personnelId");

-- AddForeignKey
ALTER TABLE "izin_erken_donus" ADD CONSTRAINT "izin_erken_donus_talepId_fkey" FOREIGN KEY ("talepId") REFERENCES "izin_talep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin_erken_donus" ADD CONSTRAINT "izin_erken_donus_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

