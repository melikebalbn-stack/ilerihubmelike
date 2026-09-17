-- AlterTable
ALTER TABLE "KPIAction" ADD COLUMN     "sorumluPersonelId" TEXT;

-- AddForeignKey
ALTER TABLE "KPIAction" ADD CONSTRAINT "KPIAction_sorumluPersonelId_fkey" FOREIGN KEY ("sorumluPersonelId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

