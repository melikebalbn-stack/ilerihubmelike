-- AlterTable
ALTER TABLE "PlannedTask" ADD COLUMN     "notificationEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];
