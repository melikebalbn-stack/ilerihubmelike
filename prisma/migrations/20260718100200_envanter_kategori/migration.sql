-- CreateTable
CREATE TABLE "envanter_kategori" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "yenilemePeriyoduAy" INTEGER,
    "minStokVarsayilan" INTEGER,
    "not" TEXT,
    "durum" "EnvanterDurum" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envanter_kategori_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "envanter_kategori_ad_key" ON "envanter_kategori"("ad");

