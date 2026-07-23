-- AlterTable
ALTER TABLE "CalibrationProductionSection" ADD COLUMN     "departmentId" TEXT;

-- CreateIndex
CREATE INDEX "CalibrationProductionSection_departmentId_idx" ON "CalibrationProductionSection"("departmentId");

-- AddForeignKey
ALTER TABLE "CalibrationProductionSection" ADD CONSTRAINT "CalibrationProductionSection_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
