-- Syteline → IFS malzeme senkronu v1 (feat/syteline-part-sync)
-- El ile yazıldı (Prisma 7 migrate diff --from-config-datasource boş-baz sorunu; DDL Prisma şeması ile birebir).

-- CreateTable
CREATE TABLE "syte_sync_kayit" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "kaynakAnahtar" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "durum" TEXT NOT NULL,
    "ifsAnahtar" TEXT,
    "hata" TEXT,
    "denemeSayisi" INTEGER NOT NULL DEFAULT 0,
    "sonDenemeAt" TIMESTAMP(3),
    "kaynakRecordDate" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "syte_sync_kayit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syte_sync_durum" (
    "entity" TEXT NOT NULL,
    "sonRecordDate" TIMESTAMP(3),
    "sonCalismaAt" TIMESTAMP(3),
    "calisiyorAt" TIMESTAMP(3),
    "sonOzet" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "syte_sync_durum_pkey" PRIMARY KEY ("entity")
);

-- CreateIndex
CREATE UNIQUE INDEX "syte_sync_kayit_entity_kaynakAnahtar_key" ON "syte_sync_kayit"("entity", "kaynakAnahtar");

-- CreateIndex
CREATE INDEX "syte_sync_kayit_entity_durum_idx" ON "syte_sync_kayit"("entity", "durum");
