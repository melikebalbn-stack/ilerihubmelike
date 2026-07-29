-- FAZ 2 (IPRO_FAZ2_DELTA): sayaç delta zaman serisi + iş kaydı özet alanları.
-- ADDITIVE: yeni tablo + 2 nullable kolon. DROP yok, mevcut satırlar etkilenmez.

-- 1) Zaman serisi tablosu (poller delta>0 append eder)
CREATE TABLE "ipro_sayac_okuma" (
    "id" BIGSERIAL NOT NULL,
    "tezgahKod" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "mutlakSayac" BIGINT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ipro_sayac_okuma_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ipro_sayac_okuma_tezgahKod_ts_idx" ON "ipro_sayac_okuma"("tezgahKod", "ts");

-- 2) İş kaydı özet alanları (kapanışta yazılır)
ALTER TABLE "ipro_production_log" ADD COLUMN "uretimAdet" INTEGER;
ALTER TABLE "ipro_production_log" ADD COLUMN "hesapKaynagi" TEXT;
