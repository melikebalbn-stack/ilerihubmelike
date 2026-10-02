-- QDMS NCR genisletmesi geri alma (f3c2bd1a7 / 20260924184607_qdms_ncr_genisletme)
-- Genisletme yanlis module yapilmisti; gercek is /kalite/uygunsuzluk modulunde surecek.
-- DESTRUCTIVE: once yedek (pg_dump), sonra uygulanir. Uygulama onayi Melih'te.

-- DropForeignKey
ALTER TABLE "QdmsNonConformanceAttachment" DROP CONSTRAINT IF EXISTS "QdmsNonConformanceAttachment_ncrId_fkey";
ALTER TABLE "QdmsNonConformanceAttachment" DROP CONSTRAINT IF EXISTS "QdmsNonConformanceAttachment_uploadedById_fkey";
ALTER TABLE "QdmsNonConformanceDateHistory" DROP CONSTRAINT IF EXISTS "QdmsNonConformanceDateHistory_ncrId_fkey";
ALTER TABLE "QdmsNonConformanceDateHistory" DROP CONSTRAINT IF EXISTS "QdmsNonConformanceDateHistory_changedById_fkey";
ALTER TABLE "QdmsNonConformanceParticipant" DROP CONSTRAINT IF EXISTS "QdmsNonConformanceParticipant_ncrId_fkey";
ALTER TABLE "QdmsNonConformanceParticipant" DROP CONSTRAINT IF EXISTS "QdmsNonConformanceParticipant_userId_fkey";
ALTER TABLE "QdmsNonConformance" DROP CONSTRAINT IF EXISTS "QdmsNonConformance_causedByDepartmentId_fkey";
ALTER TABLE "QdmsNonConformance" DROP CONSTRAINT IF EXISTS "QdmsNonConformance_actionResponsibleId_fkey";
ALTER TABLE "QdmsNonConformance" DROP CONSTRAINT IF EXISTS "QdmsNonConformance_actionApproverId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "QdmsNonConformance_causedByDepartmentId_idx";
DROP INDEX IF EXISTS "QdmsNonConformance_actionResponsibleId_idx";
DROP INDEX IF EXISTS "QdmsNonConformance_actionApproverId_idx";

-- DropTable
DROP TABLE IF EXISTS "QdmsNonConformanceAttachment";
DROP TABLE IF EXISTS "QdmsNonConformanceDateHistory";
DROP TABLE IF EXISTS "QdmsNonConformanceParticipant";

-- AlterTable
ALTER TABLE "QdmsNonConformance"
  DROP COLUMN IF EXISTS "actionApproverId",
  DROP COLUMN IF EXISTS "actionCompletionDate",
  DROP COLUMN IF EXISTS "actionResponsibleId",
  DROP COLUMN IF EXISTS "causedByDepartmentId",
  DROP COLUMN IF EXISTS "customerName",
  DROP COLUMN IF EXISTS "interimAction",
  DROP COLUMN IF EXISTS "lessonsLearned",
  DROP COLUMN IF EXISTS "permanentAction",
  DROP COLUMN IF EXISTS "plannedActionDate",
  DROP COLUMN IF EXISTS "reworkQuantity",
  DROP COLUMN IF EXISTS "rootCauseEscape",
  DROP COLUMN IF EXISTS "rootCauseOccurrence",
  DROP COLUMN IF EXISTS "scrapQuantity",
  DROP COLUMN IF EXISTS "subPartCode",
  DROP COLUMN IF EXISTS "workOrderNo",
  DROP COLUMN IF EXISTS "workOrderQuantity";
