-- Parça+op(+tezgah) → PLC sayaç çarpanı. carpanBul çözüm sırası: tezgahlı > tezgahsız(NULL) > 1.
-- CreateTable
CREATE TABLE "ipro_sayac_carpani" (
    "id" TEXT NOT NULL,
    "parcaNo" TEXT NOT NULL,
    "operasyonNo" TEXT NOT NULL,
    "tezgahKod" TEXT,
    "carpan" INTEGER NOT NULL,
    "kaynak" TEXT NOT NULL DEFAULT 'MAS',
    "baskinPay" DECIMAL(65,30),
    "isSayisi" INTEGER,
    "dogrulanacak" BOOLEAN NOT NULL DEFAULT false,
    "guncelleyenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ipro_sayac_carpani_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (@@unique — tezgahlı üçlü tekilliği; PG'de birden çok NULL'a izin verir, tezgahsız tekilliği partial index'te)
CREATE UNIQUE INDEX "ipro_sayac_carpani_parcaNo_operasyonNo_tezgahKod_key" ON "ipro_sayac_carpani"("parcaNo", "operasyonNo", "tezgahKod");

-- CreateIndex
CREATE INDEX "ipro_sayac_carpani_dogrulanacak_idx" ON "ipro_sayac_carpani"("dogrulanacak");

-- Partial UNIQUE: tezgahsız (genel) satır parça+op başına TEK (PG14 NULLS NOT DISTINCT yok → WHERE ile).
CREATE UNIQUE INDEX "ipro_sayac_carpani_genel_uq" ON "ipro_sayac_carpani"("parcaNo", "operasyonNo") WHERE "tezgahKod" IS NULL;
