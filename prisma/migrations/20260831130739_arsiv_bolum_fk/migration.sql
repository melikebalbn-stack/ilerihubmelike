
-- AlterTable
ALTER TABLE "DepartmentDefinition" ADD COLUMN     "arsivBolumId" INTEGER;

-- CreateIndex
CREATE INDEX "DepartmentDefinition_arsivBolumId_idx" ON "DepartmentDefinition"("arsivBolumId");

-- AddForeignKey
ALTER TABLE "DepartmentDefinition" ADD CONSTRAINT "DepartmentDefinition_arsivBolumId_fkey" FOREIGN KEY ("arsivBolumId") REFERENCES "arsiv_bolum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

