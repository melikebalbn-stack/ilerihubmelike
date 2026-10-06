
-- CreateTable
CREATE TABLE "rapor_katalog_deger" (
    "id" TEXT NOT NULL,
    "kaynakAd" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "alan" TEXT NOT NULL,
    "deger" TEXT NOT NULL,
    "etiket" TEXT,
    "kaynak" TEXT NOT NULL DEFAULT 'ENUM',
    "guncellenme" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rapor_katalog_deger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rapor_katalog_deger_kaynakAd_alan_idx" ON "rapor_katalog_deger"("kaynakAd", "alan");

-- CreateIndex
CREATE UNIQUE INDEX "rapor_katalog_deger_kaynakAd_entity_alan_deger_key" ON "rapor_katalog_deger"("kaynakAd", "entity", "alan", "deger");

