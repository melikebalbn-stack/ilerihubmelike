-- AlterTable
ALTER TABLE "User" ADD COLUMN     "groups" TEXT[] DEFAULT ARRAY[]::TEXT[];
