-- AlterTable
ALTER TABLE "OvertimePersonnelUretim" ADD COLUMN     "duzeltenById" TEXT,
ADD COLUMN     "duzeltmeTarihi" TIMESTAMP(3),
ADD COLUMN     "eskiParcaKodu" TEXT,
ADD COLUMN     "parcaKoduDuzeltmeNote" TEXT;

-- CreateIndex
CREATE INDEX "OvertimePersonnelUretim_duzeltenById_idx" ON "OvertimePersonnelUretim"("duzeltenById");

-- AddForeignKey
ALTER TABLE "OvertimePersonnelUretim" ADD CONSTRAINT "OvertimePersonnelUretim_duzeltenById_fkey" FOREIGN KEY ("duzeltenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
