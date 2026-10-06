-- PDKS Faz 4 — vardiya/mola tanımları + puantaj alanları. Plan §4, §5.
-- 1) Yeni: pdks_vardiya, pdks_vardiya_mola, enum PdksYakaTipi / PdksMolaTuru.
-- 2) PdksGunDurum'a TAM_FORMLA, MESAI (PG14: ADD VALUE transaction içinde olur; bu migration'da KULLANILMAZ).
-- 3) pdks_personel_vardiya.vardiyaId ve pdks_puantaj_gun.vardiyaId FK'sı ipro_vardiya → pdks_vardiya
--    (kolonlar aynı; yalnız FK hedefi değişir). İKİ TABLO DA BOŞ olmalı — aşağıdaki koruma boş değilse
--    hiçbir şey yapmadan DURUR (veri taşıma gerekmez, veri kaybı olmaz).
-- 4) pdks_puantaj_gun'a fiiliDakika, dusulenMolaDakika, mesaiPersonelId (→ OvertimePersonnel, SET NULL), kilitAt.
-- Prod: psql -f --single-transaction + prisma migrate resolve --applied (migrate deploy YASAK).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "pdks_personel_vardiya") OR EXISTS (SELECT 1 FROM "pdks_puantaj_gun") THEN
    RAISE EXCEPTION 'pdks_personel_vardiya / pdks_puantaj_gun boş değil — vardiya FK taşıması veri eşlemesi ister, migration DURDU';
  END IF;
END $$;
-- CreateEnum
CREATE TYPE "PdksYakaTipi" AS ENUM ('BEYAZ', 'MAVI', 'HEPSI');

-- CreateEnum
CREATE TYPE "PdksMolaTuru" AS ENUM ('YEMEK', 'CAY');

-- AlterEnum


ALTER TYPE "PdksGunDurum" ADD VALUE 'TAM_FORMLA';
ALTER TYPE "PdksGunDurum" ADD VALUE 'MESAI';

-- DropForeignKey
ALTER TABLE "pdks_puantaj_gun" DROP CONSTRAINT "pdks_puantaj_gun_vardiyaId_fkey";

-- DropForeignKey
ALTER TABLE "pdks_personel_vardiya" DROP CONSTRAINT "pdks_personel_vardiya_vardiyaId_fkey";

-- AlterTable
ALTER TABLE "pdks_puantaj_gun" ADD COLUMN     "dusulenMolaDakika" INTEGER,
ADD COLUMN     "fiiliDakika" INTEGER,
ADD COLUMN     "kilitAt" TIMESTAMP(3),
ADD COLUMN     "mesaiPersonelId" TEXT;

-- CreateTable
CREATE TABLE "pdks_vardiya" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "girisSaat" TEXT NOT NULL,
    "cikisSaat" TEXT NOT NULL,
    "gunDonumSaat" TEXT NOT NULL,
    "yakaTipi" "PdksYakaTipi" NOT NULL DEFAULT 'HEPSI',
    "gecToleransDk" INTEGER NOT NULL DEFAULT 0,
    "erkenToleransDk" INTEGER NOT NULL DEFAULT 0,
    "varsayilan" BOOLEAN NOT NULL DEFAULT false,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdks_vardiya_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdks_vardiya_mola" (
    "id" TEXT NOT NULL,
    "vardiyaId" TEXT NOT NULL,
    "tur" "PdksMolaTuru" NOT NULL,
    "baslangic" TEXT NOT NULL,
    "bitis" TEXT NOT NULL,
    "dusulur" BOOLEAN NOT NULL,
    "departmentId" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdks_vardiya_mola_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pdks_vardiya_kod_key" ON "pdks_vardiya"("kod");

-- CreateIndex
CREATE INDEX "pdks_vardiya_mola_vardiyaId_idx" ON "pdks_vardiya_mola"("vardiyaId");

-- CreateIndex
CREATE INDEX "pdks_vardiya_mola_departmentId_idx" ON "pdks_vardiya_mola"("departmentId");

-- CreateIndex
CREATE INDEX "pdks_puantaj_gun_mesaiPersonelId_idx" ON "pdks_puantaj_gun"("mesaiPersonelId");

-- AddForeignKey
ALTER TABLE "pdks_puantaj_gun" ADD CONSTRAINT "pdks_puantaj_gun_vardiyaId_fkey" FOREIGN KEY ("vardiyaId") REFERENCES "pdks_vardiya"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_puantaj_gun" ADD CONSTRAINT "pdks_puantaj_gun_mesaiPersonelId_fkey" FOREIGN KEY ("mesaiPersonelId") REFERENCES "OvertimePersonnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_personel_vardiya" ADD CONSTRAINT "pdks_personel_vardiya_vardiyaId_fkey" FOREIGN KEY ("vardiyaId") REFERENCES "pdks_vardiya"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_vardiya_mola" ADD CONSTRAINT "pdks_vardiya_mola_vardiyaId_fkey" FOREIGN KEY ("vardiyaId") REFERENCES "pdks_vardiya"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdks_vardiya_mola" ADD CONSTRAINT "pdks_vardiya_mola_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "DepartmentDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
