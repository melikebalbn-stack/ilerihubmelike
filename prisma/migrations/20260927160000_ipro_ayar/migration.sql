-- CreateTable
CREATE TABLE "ipro_ayar" (
    "id" TEXT NOT NULL,
    "anahtar" TEXT NOT NULL,
    "deger" TEXT NOT NULL,
    "guncelleyenId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ipro_ayar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_tezgah_ayar" (
    "id" TEXT NOT NULL,
    "tezgahId" TEXT NOT NULL,
    "tabanSn" INTEGER,
    "tavanSn" INTEGER,
    "not" TEXT,
    "guncelleyenId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ipro_tezgah_ayar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipro_ayar_gecmis" (
    "id" TEXT NOT NULL,
    "zaman" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kullaniciId" TEXT,
    "alan" TEXT NOT NULL,
    "kayitRef" TEXT,
    "eski" TEXT,
    "yeni" TEXT,

    CONSTRAINT "ipro_ayar_gecmis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ipro_ayar_anahtar_key" ON "ipro_ayar"("anahtar");

-- CreateIndex
CREATE UNIQUE INDEX "ipro_tezgah_ayar_tezgahId_key" ON "ipro_tezgah_ayar"("tezgahId");

-- CreateIndex
CREATE INDEX "ipro_ayar_gecmis_zaman_idx" ON "ipro_ayar_gecmis"("zaman");

-- AddForeignKey
ALTER TABLE "ipro_tezgah_ayar" ADD CONSTRAINT "ipro_tezgah_ayar_tezgahId_fkey" FOREIGN KEY ("tezgahId") REFERENCES "ipro_tezgah"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed: mevcut sabitlerle genel eşik ayarları (idempotent — anahtar UNIQUE).
INSERT INTO "ipro_ayar" ("id","anahtar","deger","updatedAt") VALUES
 (gen_random_uuid()::text,'durus_esik_carpan','3.5',CURRENT_TIMESTAMP),
 (gen_random_uuid()::text,'durus_esik_taban_sn','180',CURRENT_TIMESTAMP),
 (gen_random_uuid()::text,'durus_esik_tavan_sn','900',CURRENT_TIMESTAMP)
ON CONFLICT ("anahtar") DO NOTHING;
