-- Başvuru Değerlendirme Workflow — additive migration.
-- JobApplicationStatus'a müdür kademesi 2 değer; PublicJobApplication'a 2 nullable alan + FK.
-- Mevcut 16 enum değeri / 80 kolon / veri DEĞİŞMEZ.
-- Not: ADD VALUE aynı transaction'da değer KULLANMADIĞI için güvenli (repo deseni).

-- AlterEnum
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'MUDUR_DEGERLENDIRME';
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'MUDUR_MULAKATI';

-- AlterTable (2 nullable kolon; DEFAULT yok → mevcut satırlar bozulmaz)
ALTER TABLE "PublicJobApplication" ADD COLUMN     "assignedManagerId" TEXT,
ADD COLUMN     "assignedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PublicJobApplication_assignedManagerId_idx" ON "PublicJobApplication"("assignedManagerId");

-- AddForeignKey (User.id text ile uyumlu; SetNull — müdür silinirse atama boşalır, başvuru kalır)
ALTER TABLE "PublicJobApplication" ADD CONSTRAINT "PublicJobApplication_assignedManagerId_fkey" FOREIGN KEY ("assignedManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
