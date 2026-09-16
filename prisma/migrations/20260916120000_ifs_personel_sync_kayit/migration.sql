-- Hub → IFS personel senkronu kuyruğu (feat/ifs-personel-sync faz 1)
CREATE TABLE "ifs_personel_sync_kayit" (
    "id" TEXT NOT NULL,
    "varlikTipi" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "ifsAnahtar" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "islem" TEXT,
    "hata" TEXT,
    "denemeSayisi" INTEGER NOT NULL DEFAULT 0,
    "sonDenemeAt" TIMESTAMP(3),
    "tetik" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ifs_personel_sync_kayit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ifs_personel_sync_kayit_varlikTipi_hubId_key" ON "ifs_personel_sync_kayit"("varlikTipi", "hubId");
CREATE INDEX "ifs_personel_sync_kayit_durum_idx" ON "ifs_personel_sync_kayit"("durum");
