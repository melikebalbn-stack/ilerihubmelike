-- CreateEnum
CREATE TYPE "EnvanterZimmetDurum" AS ENUM ('AKTIF', 'IADE_EDILDI', 'IPTAL');

-- CreateTable
CREATE TABLE "envanter_zimmet" (
    "id" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "stokId" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "miktar" INTEGER NOT NULL DEFAULT 1,
    "teslimTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iadeTarihi" TIMESTAMP(3),
    "durum" "EnvanterZimmetDurum" NOT NULL DEFAULT 'AKTIF',
    "aciklama" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envanter_zimmet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "envanter_zimmet_personnelId_idx" ON "envanter_zimmet"("personnelId");

-- CreateIndex
CREATE INDEX "envanter_zimmet_stokId_idx" ON "envanter_zimmet"("stokId");

-- CreateIndex
CREATE INDEX "envanter_zimmet_urunId_idx" ON "envanter_zimmet"("urunId");

-- CreateIndex
CREATE INDEX "envanter_zimmet_durum_idx" ON "envanter_zimmet"("durum");

-- AddForeignKey
ALTER TABLE "envanter_zimmet" ADD CONSTRAINT "envanter_zimmet_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "envanter_urun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envanter_zimmet" ADD CONSTRAINT "envanter_zimmet_stokId_fkey" FOREIGN KEY ("stokId") REFERENCES "envanter_stok"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envanter_zimmet" ADD CONSTRAINT "envanter_zimmet_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
