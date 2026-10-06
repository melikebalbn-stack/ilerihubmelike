-- Duyuru popup eylem butonu: Announcement.eylemUrl + eylemMetni (nullable, additive)
-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "eylemMetni" TEXT,
ADD COLUMN     "eylemUrl" TEXT;
