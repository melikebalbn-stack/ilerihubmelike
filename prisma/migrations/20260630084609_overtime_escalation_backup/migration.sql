-- AlterTable
ALTER TABLE "ApprovalPosition" ADD COLUMN     "backupUserId" TEXT;

-- AlterTable
ALTER TABLE "OvertimeApproval" ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "escalatedToId" TEXT;

-- AddForeignKey
ALTER TABLE "OvertimeApproval" ADD CONSTRAINT "OvertimeApproval_escalatedToId_fkey" FOREIGN KEY ("escalatedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPosition" ADD CONSTRAINT "ApprovalPosition_backupUserId_fkey" FOREIGN KEY ("backupUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
