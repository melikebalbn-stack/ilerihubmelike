-- Sevkiyat okutma listesi (el terminali) — ADDITIVE: yeni tablo + FK + index. Mevcut tablolara dokunmaz.
-- Geri alma: DROP TABLE "sevkiyat_okutma";

-- CreateTable
CREATE TABLE "sevkiyat_okutma" (
    "id" TEXT NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "satirAnahtari" TEXT NOT NULL,
    "pickListNo" TEXT,
    "barkodId" INTEGER,
    "partNo" TEXT NOT NULL,
    "lotBatchNo" TEXT,
    "lokasyon" TEXT NOT NULL,
    "miktar" DECIMAL(18,6) NOT NULL,
    "userId" TEXT NOT NULL,
    "kullaniciAd" TEXT NOT NULL,
    "raporlandi" BOOLEAN NOT NULL DEFAULT false,
    "raporlandiAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sevkiyat_okutma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sevkiyat_okutma_shipmentId_raporlandi_idx" ON "sevkiyat_okutma"("shipmentId", "raporlandi");

-- CreateIndex
CREATE INDEX "sevkiyat_okutma_userId_createdAt_idx" ON "sevkiyat_okutma"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "sevkiyat_okutma" ADD CONSTRAINT "sevkiyat_okutma_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

