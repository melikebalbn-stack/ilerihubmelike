/*
  Warnings:

  - You are about to drop the column `exitCode` on the `Personnel` table. All the data in the column will be lost.
  - You are about to drop the column `exitDate` on the `Personnel` table. All the data in the column will be lost.
  - You are about to drop the column `exitGeneralNote` on the `Personnel` table. All the data in the column will be lost.
  - You are about to drop the column `exitParty` on the `Personnel` table. All the data in the column will be lost.
  - You are about to drop the column `exitReason` on the `Personnel` table. All the data in the column will be lost.
  - You are about to drop the column `exitRecordedAt` on the `Personnel` table. All the data in the column will be lost.
  - You are about to drop the column `exitRecordedById` on the `Personnel` table. All the data in the column will be lost.
  - You are about to drop the column `exitRootCause` on the `Personnel` table. All the data in the column will be lost.
  - You are about to drop the column `exitTurnoverType` on the `Personnel` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Personnel" DROP CONSTRAINT "Personnel_exitRecordedById_fkey";

-- AlterTable
ALTER TABLE "Personnel" DROP COLUMN "exitCode",
DROP COLUMN "exitDate",
DROP COLUMN "exitGeneralNote",
DROP COLUMN "exitParty",
DROP COLUMN "exitReason",
DROP COLUMN "exitRecordedAt",
DROP COLUMN "exitRecordedById",
DROP COLUMN "exitRootCause",
DROP COLUMN "exitTurnoverType";
