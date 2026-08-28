-- AlterTable
ALTER TABLE "ifs_course_evaluations" ADD COLUMN     "keyUserAt" TIMESTAMP(3),
ADD COLUMN     "keyUserId" TEXT,
ADD COLUMN     "keyUserNot" TEXT,
ADD COLUMN     "keyUserSeviye" "IfsCourseSeviye";

-- CreateIndex
CREATE INDEX "ifs_course_evaluations_keyUserId_idx" ON "ifs_course_evaluations"("keyUserId");

-- AddForeignKey
ALTER TABLE "ifs_course_evaluations" ADD CONSTRAINT "ifs_course_evaluations_keyUserId_fkey" FOREIGN KEY ("keyUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

