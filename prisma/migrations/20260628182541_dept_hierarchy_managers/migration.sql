-- AlterTable
ALTER TABLE "DepartmentDefinition" ADD COLUMN     "mudurId" TEXT,
ADD COLUMN     "mudurYardimcisiId" TEXT,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sorumlu1Id" TEXT,
ADD COLUMN     "sorumlu2Id" TEXT,
ADD COLUMN     "sorumlu3Id" TEXT;
-- CreateIndex
CREATE INDEX "DepartmentDefinition_parentId_idx" ON "DepartmentDefinition"("parentId");
-- AddForeignKey
ALTER TABLE "DepartmentDefinition" ADD CONSTRAINT "DepartmentDefinition_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DepartmentDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DepartmentDefinition" ADD CONSTRAINT "DepartmentDefinition_sorumlu1Id_fkey" FOREIGN KEY ("sorumlu1Id") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DepartmentDefinition" ADD CONSTRAINT "DepartmentDefinition_sorumlu2Id_fkey" FOREIGN KEY ("sorumlu2Id") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DepartmentDefinition" ADD CONSTRAINT "DepartmentDefinition_sorumlu3Id_fkey" FOREIGN KEY ("sorumlu3Id") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DepartmentDefinition" ADD CONSTRAINT "DepartmentDefinition_mudurYardimcisiId_fkey" FOREIGN KEY ("mudurYardimcisiId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DepartmentDefinition" ADD CONSTRAINT "DepartmentDefinition_mudurId_fkey" FOREIGN KEY ("mudurId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
