-- AlterTable
ALTER TABLE "QdmsNonConformance" ADD COLUMN     "actionApproverId" TEXT,
ADD COLUMN     "actionCompletionDate" TIMESTAMP(3),
ADD COLUMN     "actionResponsibleId" TEXT,
ADD COLUMN     "causedByDepartmentId" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "interimAction" TEXT,
ADD COLUMN     "lessonsLearned" TEXT[],
ADD COLUMN     "permanentAction" TEXT,
ADD COLUMN     "plannedActionDate" TIMESTAMP(3),
ADD COLUMN     "reworkQuantity" INTEGER,
ADD COLUMN     "rootCauseEscape" TEXT,
ADD COLUMN     "rootCauseOccurrence" TEXT,
ADD COLUMN     "scrapQuantity" INTEGER,
ADD COLUMN     "subPartCode" TEXT,
ADD COLUMN     "workOrderNo" TEXT,
ADD COLUMN     "workOrderQuantity" INTEGER;

-- CreateTable
CREATE TABLE "QdmsNonConformanceParticipant" (
    "id" TEXT NOT NULL,
    "ncrId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QdmsNonConformanceParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsNonConformanceDateHistory" (
    "id" TEXT NOT NULL,
    "ncrId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TIMESTAMP(3),
    "newValue" TIMESTAMP(3),
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QdmsNonConformanceDateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsNonConformanceAttachment" (
    "id" TEXT NOT NULL,
    "ncrId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QdmsNonConformanceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QdmsNonConformanceParticipant_ncrId_idx" ON "QdmsNonConformanceParticipant"("ncrId");

-- CreateIndex
CREATE INDEX "QdmsNonConformanceParticipant_userId_idx" ON "QdmsNonConformanceParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "QdmsNonConformanceParticipant_ncrId_userId_key" ON "QdmsNonConformanceParticipant"("ncrId", "userId");

-- CreateIndex
CREATE INDEX "QdmsNonConformanceDateHistory_ncrId_idx" ON "QdmsNonConformanceDateHistory"("ncrId");

-- CreateIndex
CREATE INDEX "QdmsNonConformanceAttachment_ncrId_idx" ON "QdmsNonConformanceAttachment"("ncrId");

-- CreateIndex
CREATE INDEX "QdmsNonConformance_causedByDepartmentId_idx" ON "QdmsNonConformance"("causedByDepartmentId");

-- CreateIndex
CREATE INDEX "QdmsNonConformance_actionResponsibleId_idx" ON "QdmsNonConformance"("actionResponsibleId");

-- CreateIndex
CREATE INDEX "QdmsNonConformance_actionApproverId_idx" ON "QdmsNonConformance"("actionApproverId");

-- AddForeignKey
ALTER TABLE "QdmsNonConformance" ADD CONSTRAINT "QdmsNonConformance_causedByDepartmentId_fkey" FOREIGN KEY ("causedByDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsNonConformance" ADD CONSTRAINT "QdmsNonConformance_actionResponsibleId_fkey" FOREIGN KEY ("actionResponsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsNonConformance" ADD CONSTRAINT "QdmsNonConformance_actionApproverId_fkey" FOREIGN KEY ("actionApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsNonConformanceParticipant" ADD CONSTRAINT "QdmsNonConformanceParticipant_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "QdmsNonConformance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsNonConformanceParticipant" ADD CONSTRAINT "QdmsNonConformanceParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsNonConformanceDateHistory" ADD CONSTRAINT "QdmsNonConformanceDateHistory_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "QdmsNonConformance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsNonConformanceDateHistory" ADD CONSTRAINT "QdmsNonConformanceDateHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsNonConformanceAttachment" ADD CONSTRAINT "QdmsNonConformanceAttachment_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "QdmsNonConformance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsNonConformanceAttachment" ADD CONSTRAINT "QdmsNonConformanceAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
