-- AlterTable
ALTER TABLE "course_packages" ADD COLUMN     "isIfs" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "isIfs" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ifs_task_meta" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "modul" TEXT,
    "altModul" TEXT,
    "ifsEkran" TEXT,
    "refDocUrl" TEXT,
    "refVideoUrl" TEXT,

    CONSTRAINT "ifs_task_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ifs_task_evaluations" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "egitimVerildi" BOOLEAN NOT NULL DEFAULT false,
    "uygulamaliYapildi" BOOLEAN NOT NULL DEFAULT false,
    "ornekYapildi" BOOLEAN NOT NULL DEFAULT false,
    "projeEkibiYorum" TEXT,
    "danismanYorum" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ifs_task_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ifs_task_meta_contentId_key" ON "ifs_task_meta"("contentId");

-- CreateIndex
CREATE INDEX "ifs_task_evaluations_contentId_idx" ON "ifs_task_evaluations"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "ifs_task_evaluations_userId_contentId_key" ON "ifs_task_evaluations"("userId", "contentId");

-- AddForeignKey
ALTER TABLE "ifs_task_meta" ADD CONSTRAINT "ifs_task_meta_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ifs_task_evaluations" ADD CONSTRAINT "ifs_task_evaluations_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ifs_task_evaluations" ADD CONSTRAINT "ifs_task_evaluations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

