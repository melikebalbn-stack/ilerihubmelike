-- PDKS Faz 3 — geçiş olayı toplama (push + AcsEvent boşluk doldurma). Plan §3.1.
-- ADDITIVE: pdks_cihaz'a 4 sağlık kolonu, pdks_gecis'e sensör→kart olay bağı. DROP yok.
-- pdks_gecis'in değişmezlik trigger'ı (Faz 1) DDL'i etkilemez; tabloya kolon eklemek UPDATE değildir.
-- Prod: psql -f + prisma migrate resolve --applied (migrate deploy YASAK).
-- AlterTable
ALTER TABLE "pdks_cihaz" ADD COLUMN     "saatKontrolAt" TIMESTAMP(3),
ADD COLUMN     "saatSapmaSn" INTEGER,
ADD COLUMN     "sonPollAt" TIMESTAMP(3),
ADD COLUMN     "sonPushAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pdks_gecis" ADD COLUMN     "bagliGecisId" TEXT;

-- CreateIndex
CREATE INDEX "pdks_gecis_bagliGecisId_idx" ON "pdks_gecis"("bagliGecisId");

-- CreateIndex
CREATE INDEX "pdks_gecis_olayTipi_olayZamani_idx" ON "pdks_gecis"("olayTipi", "olayZamani");

-- AddForeignKey
ALTER TABLE "pdks_gecis" ADD CONSTRAINT "pdks_gecis_bagliGecisId_fkey" FOREIGN KEY ("bagliGecisId") REFERENCES "pdks_gecis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
