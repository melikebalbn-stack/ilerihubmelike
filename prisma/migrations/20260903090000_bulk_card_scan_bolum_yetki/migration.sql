
-- CreateTable
CREATE TABLE "BulkCardScanBolumYetki" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bolumAdi" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkCardScanBolumYetki_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BulkCardScanBolumYetki_userId_key" ON "BulkCardScanBolumYetki"("userId");

-- CreateIndex
CREATE INDEX "BulkCardScanBolumYetki_bolumAdi_idx" ON "BulkCardScanBolumYetki"("bolumAdi");

-- AddForeignKey
ALTER TABLE "BulkCardScanBolumYetki" ADD CONSTRAINT "BulkCardScanBolumYetki_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

