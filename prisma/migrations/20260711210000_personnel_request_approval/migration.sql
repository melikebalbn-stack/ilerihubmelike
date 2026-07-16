-- CreateTable
CREATE TABLE "PersonnelRequestApproval" (
    "id" TEXT NOT NULL,
    "personnelRequestId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "kademe" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "approverId" TEXT,
    "decision" "ApprovalDecision",
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonnelRequestApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonnelRequestApproval_personnelRequestId_idx" ON "PersonnelRequestApproval"("personnelRequestId");

-- CreateIndex
CREATE INDEX "PersonnelRequestApproval_approverId_idx" ON "PersonnelRequestApproval"("approverId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelRequestApproval_personnelRequestId_step_key" ON "PersonnelRequestApproval"("personnelRequestId", "step");

-- AddForeignKey
ALTER TABLE "PersonnelRequestApproval" ADD CONSTRAINT "PersonnelRequestApproval_personnelRequestId_fkey" FOREIGN KEY ("personnelRequestId") REFERENCES "PersonnelRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelRequestApproval" ADD CONSTRAINT "PersonnelRequestApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
