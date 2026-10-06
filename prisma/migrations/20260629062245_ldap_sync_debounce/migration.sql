-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabledStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastDisabledSeenAt" TIMESTAMP(3);
