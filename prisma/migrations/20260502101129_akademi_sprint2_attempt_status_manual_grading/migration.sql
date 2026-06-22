-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'PENDING_REVIEW', 'COMPLETED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'TRUE_FALSE';

-- AlterTable
ALTER TABLE "exam_questions" ADD COLUMN     "explanation" TEXT,
ADD COLUMN     "isManualGraded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_exam_answers" ADD COLUMN     "dateValue" TIMESTAMP(3),
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "gradedAt" TIMESTAMP(3),
ADD COLUMN     "gradedById" TEXT,
ADD COLUMN     "manualFeedback" TEXT,
ADD COLUMN     "manualScore" DOUBLE PRECISION,
ADD COLUMN     "matrixAnswer" JSONB,
ADD COLUMN     "ratingValue" INTEGER,
ADD COLUMN     "scaleValue" INTEGER,
ADD COLUMN     "selectedOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "user_exam_attempts" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS';

-- AddForeignKey
ALTER TABLE "user_exam_answers" ADD CONSTRAINT "user_exam_answers_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
