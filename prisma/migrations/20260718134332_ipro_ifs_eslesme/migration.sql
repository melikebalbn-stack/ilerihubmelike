-- IPRO personel senkronu — ILERIHub serbest metin ↔ IFS kod eşlemesi.
-- Additive-only. Tek tablo + tip ayrımı (ORG/POZISYON).

-- CreateEnum
CREATE TYPE "IproIfsEslesmeTipi" AS ENUM ('ORG', 'POZISYON');

-- CreateTable
CREATE TABLE "ipro_ifs_eslesme" (
    "id" TEXT NOT NULL,
    "tip" "IproIfsEslesmeTipi" NOT NULL,
    "ilerihubDeger" TEXT NOT NULL,
    "ifsKod" TEXT NOT NULL,
    "aciklama" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ipro_ifs_eslesme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ipro_ifs_eslesme_tip_aktif_idx" ON "ipro_ifs_eslesme"("tip", "aktif");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_ifs_eslesme_tip_ilerihubDeger_key" ON "ipro_ifs_eslesme"("tip", "ilerihubDeger");

