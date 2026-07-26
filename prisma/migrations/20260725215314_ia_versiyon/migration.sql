-- AlterTable
ALTER TABLE "ia_is_analizi" ADD COLUMN     "oncekiVersiyonId" TEXT,
ADD COLUMN     "versiyon" INTEGER NOT NULL DEFAULT 1;
