-- CreateTable
CREATE TABLE "PublicJobApplicationStageLog" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "JobApplicationStatus",
    "toStatus" "JobApplicationStatus" NOT NULL,
    "changedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicJobApplicationStageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicJobApplicationStageLog_applicationId_idx" ON "PublicJobApplicationStageLog"("applicationId");

-- CreateIndex
CREATE INDEX "PublicJobApplicationStageLog_createdAt_idx" ON "PublicJobApplicationStageLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PublicJobApplicationStageLog" ADD CONSTRAINT "PublicJobApplicationStageLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PublicJobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
