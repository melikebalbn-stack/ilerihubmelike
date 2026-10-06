ALTER TABLE "ZimmetFormu" ADD COLUMN     "marka" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "silenId" TEXT,
ADD COLUMN     "silindiMi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "silinmeTarihi" TIMESTAMP(3);
CREATE TABLE "ZimmetDurumGecmisi" (
    "id" TEXT NOT NULL,
    "zimmetId" TEXT NOT NULL,
    "eskiDurum" TEXT,
    "yeniDurum" TEXT NOT NULL,
    "islemYapanId" TEXT NOT NULL,
    "not" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ZimmetDurumGecmisi_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ZimmetDurumGecmisi_zimmetId_idx" ON "ZimmetDurumGecmisi"("zimmetId");
