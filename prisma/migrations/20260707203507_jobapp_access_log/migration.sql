-- CreateTable
CREATE TABLE "JobApplicationAccessLog" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "accessedBy" TEXT NOT NULL,
    "accessType" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobApplicationAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobApplicationAccessLog_applicationId_idx" ON "JobApplicationAccessLog"("applicationId");

-- CreateIndex
CREATE INDEX "JobApplicationAccessLog_accessedBy_idx" ON "JobApplicationAccessLog"("accessedBy");

-- AddForeignKey
ALTER TABLE "JobApplicationAccessLog" ADD CONSTRAINT "JobApplicationAccessLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PublicJobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
