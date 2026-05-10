-- AlterTable
ALTER TABLE "Personnel" ADD COLUMN     "exitCode" TEXT,
ADD COLUMN     "exitDate" DATE,
ADD COLUMN     "exitGeneralNote" TEXT,
ADD COLUMN     "exitParty" TEXT,
ADD COLUMN     "exitReason" TEXT,
ADD COLUMN     "exitRecordedAt" TIMESTAMP(3),
ADD COLUMN     "exitRecordedById" TEXT,
ADD COLUMN     "exitRootCause" TEXT,
ADD COLUMN     "exitTurnoverType" TEXT;

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_exitRecordedById_fkey" FOREIGN KEY ("exitRecordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
