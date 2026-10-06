-- CreateEnum
CREATE TYPE "FormTipi" AS ENUM ('MESAI', 'VARDIYA');

-- AlterTable
ALTER TABLE "OvertimeForm" ADD COLUMN     "formTipi" "FormTipi" NOT NULL DEFAULT 'MESAI';
