
-- AlterEnum
ALTER TYPE "JobApplicationStatus" ADD VALUE 'EVRAK_HAZIRLIK';

-- AlterTable
ALTER TABLE "Personnel" ADD COLUMN     "jobApplicationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_jobApplicationId_key" ON "Personnel"("jobApplicationId");

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "PublicJobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

