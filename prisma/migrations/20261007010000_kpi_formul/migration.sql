-- AlterTable
ALTER TABLE "KPIDefinition" ADD COLUMN     "gerceklesenFormul" JSONB,
ADD COLUMN     "hedefFormul" JSONB;

-- AlterTable
ALTER TABLE "KPIOzelAlan" ADD COLUMN     "formul" JSONB;
