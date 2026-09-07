-- CreateIndex
CREATE INDEX "exams_courseId_idx" ON "exams"("courseId");

-- CreateIndex
CREATE INDEX "user_exam_attempts_examId_userId_idx" ON "user_exam_attempts"("examId", "userId");

