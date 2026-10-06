-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "resolutionDueAt" TIMESTAMP(3),
ADD COLUMN     "responseDueAt" TIMESTAMP(3),
ADD COLUMN     "slaPausedAt" TIMESTAMP(3),
ADD COLUMN     "slaPausedMinutes" INTEGER NOT NULL DEFAULT 0;

