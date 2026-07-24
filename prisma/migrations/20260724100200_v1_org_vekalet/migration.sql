-- AlterTable
ALTER TABLE "OrgUnit" ADD COLUMN     "vekaletDurumu" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vekilPersonnelId" TEXT;

-- CreateIndex
CREATE INDEX "OrgUnit_vekilPersonnelId_idx" ON "OrgUnit"("vekilPersonnelId");
