-- AlterTable
ALTER TABLE "ZimmetFormu" ADD COLUMN     "iadeAlanId" TEXT,
ADD COLUMN     "iadeTarihi" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ZimmetFormu_iadeTarihi_idx" ON "ZimmetFormu"("iadeTarihi");

-- AddForeignKey
ALTER TABLE "ZimmetFormu" ADD CONSTRAINT "ZimmetFormu_iadeAlanId_fkey" FOREIGN KEY ("iadeAlanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

