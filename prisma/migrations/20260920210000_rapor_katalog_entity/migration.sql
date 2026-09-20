
-- CreateTable
CREATE TABLE "rapor_katalog_entity" (
    "id" TEXT NOT NULL,
    "kaynakAd" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "etiket" TEXT,
    "aciklama" TEXT,
    "guncellenme" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rapor_katalog_entity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rapor_katalog_entity_kaynakAd_entity_key" ON "rapor_katalog_entity"("kaynakAd", "entity");

