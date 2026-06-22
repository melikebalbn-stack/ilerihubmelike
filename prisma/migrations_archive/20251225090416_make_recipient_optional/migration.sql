-- DropForeignKey
ALTER TABLE "CalibrationEmailLog" DROP CONSTRAINT "CalibrationEmailLog_recipientId_fkey";

-- AlterTable
ALTER TABLE "CalibrationEmailLog" ADD COLUMN     "recipientEmails" TEXT,
ALTER COLUMN "recipientId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CalibrationEmailLog" ADD CONSTRAINT "CalibrationEmailLog_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
