-- ADDITIVE: iki yeni tablo (ipro_ideal_cevrim + ipro_oee_kaydi). DROP yok, mevcut tablolara dokunmaz.
-- CreateTable
CREATE TABLE "ipro_ideal_cevrim" (
    "id" TEXT NOT NULL,
    "tezgahKod" TEXT NOT NULL,
    "parcaKod" TEXT NOT NULL,
    "idealSaniyeAdet" DOUBLE PRECISION NOT NULL,
    "ornekSayisi" INTEGER NOT NULL DEFAULT 0,
    "guvenilir" BOOLEAN NOT NULL DEFAULT false,
    "hesaplananAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipro_ideal_cevrim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_oee_kaydi" (
    "id" TEXT NOT NULL,
    "productionLogId" TEXT NOT NULL,
    "tezgahKod" TEXT NOT NULL,
    "parcaKod" TEXT,
    "vardiyaId" TEXT,
    "planliSaniye" INTEGER NOT NULL,
    "durusSaniye" INTEGER NOT NULL DEFAULT 0,
    "uretilenAdet" INTEGER NOT NULL DEFAULT 0,
    "iyiAdet" INTEGER NOT NULL DEFAULT 0,
    "idealSaniyeAdet" DOUBLE PRECISION,
    "availability" DOUBLE PRECISION,
    "performance" DOUBLE PRECISION,
    "quality" DOUBLE PRECISION,
    "oee" DOUBLE PRECISION,
    "hesapKaynagi" TEXT NOT NULL,
    "hesaplananAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipro_oee_kaydi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ipro_ideal_cevrim_parcaKod_idx" ON "ipro_ideal_cevrim"("parcaKod");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_ideal_cevrim_tezgahKod_parcaKod_key" ON "ipro_ideal_cevrim"("tezgahKod", "parcaKod");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_oee_kaydi_productionLogId_key" ON "ipro_oee_kaydi"("productionLogId");

-- CreateIndex
CREATE INDEX "ipro_oee_kaydi_tezgahKod_hesaplananAt_idx" ON "ipro_oee_kaydi"("tezgahKod", "hesaplananAt");

-- CreateIndex
CREATE INDEX "ipro_oee_kaydi_vardiyaId_idx" ON "ipro_oee_kaydi"("vardiyaId");

