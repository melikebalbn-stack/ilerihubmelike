-- CreateEnum
CREATE TYPE "SezonTipi" AS ENUM ('YAZLIK', 'KISLIK');

-- CreateTable
CREATE TABLE "envanter_sezon_plan" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "sezonTipi" "SezonTipi" NOT NULL,
    "yil" INTEGER NOT NULL,
    "dagitimTarihi" TIMESTAMP(3),
    "siparisKilitTarihi" TIMESTAMP(3),
    "durum" "EnvanterDurum" NOT NULL DEFAULT 'AKTIF',
    "not" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envanter_sezon_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envanter_sezon_kalem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "kisiBasiAdet" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "envanter_sezon_kalem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "envanter_sezon_kalem_planId_idx" ON "envanter_sezon_kalem"("planId");

-- AddForeignKey
ALTER TABLE "envanter_sezon_kalem" ADD CONSTRAINT "envanter_sezon_kalem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "envanter_sezon_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envanter_sezon_kalem" ADD CONSTRAINT "envanter_sezon_kalem_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "envanter_urun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
