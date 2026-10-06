-- NOT: Orijinalinde ZimmetFormu.imzaModu/islakImzaDosyasi ALTER TABLE'i vardi;
-- prod DB'de bu kolonlar zaten mevcut oldugu icin cikarildi (avans-only migration).

-- CreateTable
CREATE TABLE "AvansTalebi" (
    "id" TEXT NOT NULL,
    "sorumluId" TEXT NOT NULL,
    "bolum" TEXT NOT NULL,
    "donemYil" INTEGER NOT NULL,
    "donemAy" INTEGER NOT NULL,
    "gonderimTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvansTalebi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvansTalebiSatiri" (
    "id" TEXT NOT NULL,
    "avansTalebiId" TEXT NOT NULL,
    "calisanId" TEXT NOT NULL,
    "avansIstiyorMu" BOOLEAN NOT NULL,

    CONSTRAINT "AvansTalebiSatiri_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_avans_talebi_sorumlu_donem" ON "AvansTalebi"("sorumluId", "bolum", "donemYil", "donemAy");

-- CreateIndex
CREATE UNIQUE INDEX "uq_avans_satiri_talep_calisan" ON "AvansTalebiSatiri"("avansTalebiId", "calisanId");

-- AddForeignKey
ALTER TABLE "AvansTalebiSatiri" ADD CONSTRAINT "AvansTalebiSatiri_avansTalebiId_fkey" FOREIGN KEY ("avansTalebiId") REFERENCES "AvansTalebi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
