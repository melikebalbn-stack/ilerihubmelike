-- CreateEnum
CREATE TYPE "RejectionReasonCategory" AS ENUM ('TEKLIF_REDDI', 'ISE_ALMAMA', 'SUREC_KAYBI');

-- CreateTable
CREATE TABLE "RejectionReason" (
    "id" TEXT NOT NULL,
    "category" "RejectionReasonCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RejectionReason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RejectionReason_isActive_idx" ON "RejectionReason"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RejectionReason_category_name_key" ON "RejectionReason"("category", "name");

-- AlterTable (çekirdeğe 1 nullable kolon — kabul edilen tek core dokunuş)
ALTER TABLE "PublicJobApplication" ADD COLUMN "rejectionReasonId" TEXT;

-- CreateIndex
CREATE INDEX "PublicJobApplication_rejectionReasonId_idx" ON "PublicJobApplication"("rejectionReasonId");

-- AddForeignKey
ALTER TABLE "PublicJobApplication" ADD CONSTRAINT "PublicJobApplication_rejectionReasonId_fkey" FOREIGN KEY ("rejectionReasonId") REFERENCES "RejectionReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
