-- AlterTable
ALTER TABLE "PublicJobApplication" ADD COLUMN     "mudurKarari" "ApprovalDecision",
ADD COLUMN     "mudurKarariNotu" TEXT,
ADD COLUMN     "mudurKarariTarihi" TIMESTAMP(3),
ADD COLUMN     "mudurKarariVeren" TEXT;

-- CreateIndex
CREATE INDEX "PublicJobApplication_mudurKarari_idx" ON "PublicJobApplication"("mudurKarari");

