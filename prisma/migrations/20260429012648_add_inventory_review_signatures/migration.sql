-- AlterTable
ALTER TABLE "inventory_review" ADD COLUMN     "content_hash" TEXT,
ADD COLUMN     "signatures" JSONB;
