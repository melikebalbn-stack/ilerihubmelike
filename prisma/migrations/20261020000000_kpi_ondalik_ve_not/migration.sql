-- AlterTable
ALTER TABLE "KPIDefinition" ADD COLUMN     "ondalikBasamak" INTEGER NOT NULL DEFAULT 4;

-- AlterTable
ALTER TABLE "KPIMeasurement" ADD COLUMN     "not" TEXT;
