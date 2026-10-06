
-- AlterEnum
ALTER TYPE "IfsCourseSeviye" ADD VALUE 'YENIDEN_DEGERLENDIRILECEK';

-- CreateTable
CREATE TABLE "ifs_egitim_kayitlari" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "egitmenId" TEXT NOT NULL,
    "tarih" DATE NOT NULL,
    "not" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ifs_egitim_kayitlari_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ifs_egitim_kayitlari_userId_courseId_idx" ON "ifs_egitim_kayitlari"("userId", "courseId");

-- CreateIndex
CREATE INDEX "ifs_egitim_kayitlari_courseId_idx" ON "ifs_egitim_kayitlari"("courseId");

-- AddForeignKey
ALTER TABLE "ifs_egitim_kayitlari" ADD CONSTRAINT "ifs_egitim_kayitlari_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ifs_egitim_kayitlari" ADD CONSTRAINT "ifs_egitim_kayitlari_egitmenId_fkey" FOREIGN KEY ("egitmenId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ifs_egitim_kayitlari" ADD CONSTRAINT "ifs_egitim_kayitlari_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

