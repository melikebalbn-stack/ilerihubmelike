
-- AlterTable
ALTER TABLE "OvertimeForm" ADD COLUMN     "periodEnd" DATE,
ADD COLUMN     "periodStart" DATE;

-- AlterTable
ALTER TABLE "DepartmentDefinition" ADD COLUMN     "uretimYapar" BOOLEAN NOT NULL DEFAULT true;

