-- AlterTable
ALTER TABLE "PlannedTask" ADD COLUMN     "parentTaskId" TEXT;

-- CreateIndex
CREATE INDEX "PlannedTask_parentTaskId_idx" ON "PlannedTask"("parentTaskId");

-- AddForeignKey
ALTER TABLE "PlannedTask" ADD CONSTRAINT "PlannedTask_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "PlannedTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
