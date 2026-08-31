-- AlterTable
ALTER TABLE "DepartmentDefinition" ADD COLUMN     "orgUnitId" TEXT;

-- CreateIndex
CREATE INDEX "DepartmentDefinition_orgUnitId_idx" ON "DepartmentDefinition"("orgUnitId");

-- AddForeignKey
ALTER TABLE "DepartmentDefinition" ADD CONSTRAINT "DepartmentDefinition_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

