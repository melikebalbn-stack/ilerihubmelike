-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobApplicationStatus" ADD VALUE 'DEGERLENDIRICI';
ALTER TYPE "JobApplicationStatus" ADD VALUE 'URETIM_MUDUR_YRD';
ALTER TYPE "JobApplicationStatus" ADD VALUE 'FABRIKA_MUDURU';

