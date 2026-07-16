-- CreateTable
CREATE TABLE "AssessmentAttemptLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAttemptLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentAttemptLog_sessionId_idx" ON "AssessmentAttemptLog"("sessionId");

-- CreateIndex
CREATE INDEX "AssessmentAttemptLog_createdAt_idx" ON "AssessmentAttemptLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AssessmentAttemptLog" ADD CONSTRAINT "AssessmentAttemptLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
