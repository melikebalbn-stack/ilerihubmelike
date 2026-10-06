/*
  Warnings:

  - Added the required column `updatedAt` to the `AvansTalebi` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AvansTalebi" ADD COLUMN     "updatedAt" TIMESTAMP(3);

UPDATE "AvansTalebi" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "AvansTalebi" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "idx_avans_talebi_donem" ON "AvansTalebi"("donemYil", "donemAy");
