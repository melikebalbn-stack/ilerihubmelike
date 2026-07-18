-- CreateEnum
CREATE TYPE "SatinAlmaDurum" AS ENUM ('TASLAK', 'IDARI_ISLER_ONAYI', 'MUDUR_YRD_ONAYI', 'MUDUR_ONAYI', 'SATINALMA_ONAYI', 'SIPARIS_ACILDI', 'TERMIN_GIRILDI', 'TESLIM_ALINDI', 'STOGA_ISLENDI', 'REDDEDILDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "SatinAlmaOnayAksiyon" AS ENUM ('ONAYLA', 'REDDET', 'REVIZE');

-- CreateTable
CREATE TABLE "envanter_satinalma_talep" (
    "id" TEXT NOT NULL,
    "formNo" TEXT NOT NULL,
    "talepEdenId" TEXT,
    "talepEdenAd" TEXT NOT NULL,
    "bolum" TEXT,
    "masrafYeri" TEXT,
    "asansorMekanik" TEXT,
    "durum" "SatinAlmaDurum" NOT NULL DEFAULT 'TASLAK',
    "aciklama" TEXT,
    "redSebebi" TEXT,
    "terminTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envanter_satinalma_talep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envanter_satinalma_kalem" (
    "id" TEXT NOT NULL,
    "talepId" TEXT NOT NULL,
    "urunId" TEXT,
    "malzemeKodu" TEXT,
    "malzemeAdi" TEXT NOT NULL,
    "talepMiktar" INTEGER NOT NULL,
    "uygunMiktar" INTEGER,
    "depoMiktar" INTEGER,
    "teslimAlinanMiktar" INTEGER NOT NULL DEFAULT 0,
    "aciklama" TEXT,

    CONSTRAINT "envanter_satinalma_kalem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envanter_satinalma_gecmis" (
    "id" TEXT NOT NULL,
    "talepId" TEXT NOT NULL,
    "durum" "SatinAlmaDurum" NOT NULL,
    "aksiyon" "SatinAlmaOnayAksiyon",
    "yapanId" TEXT,
    "yapanAd" TEXT NOT NULL,
    "not" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envanter_satinalma_gecmis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "envanter_satinalma_talep_formNo_key" ON "envanter_satinalma_talep"("formNo");

-- CreateIndex
CREATE INDEX "envanter_satinalma_talep_durum_idx" ON "envanter_satinalma_talep"("durum");

-- CreateIndex
CREATE INDEX "envanter_satinalma_kalem_talepId_idx" ON "envanter_satinalma_kalem"("talepId");

-- CreateIndex
CREATE INDEX "envanter_satinalma_gecmis_talepId_idx" ON "envanter_satinalma_gecmis"("talepId");

-- AddForeignKey
ALTER TABLE "envanter_satinalma_kalem" ADD CONSTRAINT "envanter_satinalma_kalem_talepId_fkey" FOREIGN KEY ("talepId") REFERENCES "envanter_satinalma_talep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envanter_satinalma_gecmis" ADD CONSTRAINT "envanter_satinalma_gecmis_talepId_fkey" FOREIGN KEY ("talepId") REFERENCES "envanter_satinalma_talep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
