-- AlterTable
ALTER TABLE "ipro_tezgah" ADD COLUMN "ifsResourceId" TEXT;

-- CreateIndex
CREATE INDEX "ipro_tezgah_ifsResourceId_idx" ON "ipro_tezgah"("ifsResourceId");
