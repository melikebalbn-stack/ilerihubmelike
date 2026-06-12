-- CreateEnum
CREATE TYPE "OrnekStatus" AS ENUM ('PENDING', 'BASARILI', 'TEKRAR_GEREKLI');

-- CreateEnum
CREATE TYPE "IfsCourseSeviye" AS ENUM ('BASARILI', 'EGITIM_GEREKLI', 'BASARISIZ');

-- AlterTable
ALTER TABLE "ifs_task_evaluations" ADD COLUMN     "degerlendirenId" TEXT,
ADD COLUMN     "degerlendirildiAt" TIMESTAMP(3),
ADD COLUMN     "ornekStatus" "OrnekStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "ifs_course_evaluations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "seviye" "IfsCourseSeviye",
    "not" TEXT,
    "degerlendirenId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ifs_course_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ifs_course_evaluations_courseId_idx" ON "ifs_course_evaluations"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "ifs_course_evaluations_userId_courseId_key" ON "ifs_course_evaluations"("userId", "courseId");

-- AddForeignKey
ALTER TABLE "ifs_course_evaluations" ADD CONSTRAINT "ifs_course_evaluations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ifs_course_evaluations" ADD CONSTRAINT "ifs_course_evaluations_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

