-- AlterEnum
ALTER TYPE "JobApplicationStatus" ADD VALUE 'TEKNIK_MULAKAT_UST_ONAY';

-- CreateTable
CREATE TABLE "PublicJobApplicationApproval" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "kademe" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "approverId" TEXT,
    "decision" "ApprovalDecision",
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicJobApplicationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicJobApplicationApproval_applicationId_idx" ON "PublicJobApplicationApproval"("applicationId");

-- CreateIndex
CREATE INDEX "PublicJobApplicationApproval_approverId_idx" ON "PublicJobApplicationApproval"("approverId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicJobApplicationApproval_applicationId_step_key" ON "PublicJobApplicationApproval"("applicationId", "step");

-- AddForeignKey
ALTER TABLE "PublicJobApplicationApproval" ADD CONSTRAINT "PublicJobApplicationApproval_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PublicJobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicJobApplicationApproval" ADD CONSTRAINT "PublicJobApplicationApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

