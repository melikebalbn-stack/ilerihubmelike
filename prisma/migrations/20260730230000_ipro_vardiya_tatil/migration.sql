-- Vardiya modeli (Melike #5) — vardiya tanımları + İK çalışma takvimi.
-- ADDITIVE: iki yeni tablo. DROP yok, mevcut tablolara dokunmaz.

CREATE TABLE "ipro_vardiya" (
    "id" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "baslangicSaat" TEXT NOT NULL,
    "bitisSaat" TEXT NOT NULL,
    "ertesiGuneTasar" BOOLEAN NOT NULL DEFAULT false,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ipro_vardiya_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ipro_vardiya_kod_key" ON "ipro_vardiya"("kod");

CREATE TABLE "ipro_tatil" (
    "id" TEXT NOT NULL,
    "tarih" DATE NOT NULL,
    "tip" TEXT NOT NULL,
    "aciklama" TEXT NOT NULL,
    "yil" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ipro_tatil_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ipro_tatil_tarih_key" ON "ipro_tatil"("tarih");
CREATE INDEX "ipro_tatil_yil_idx" ON "ipro_tatil"("yil");
