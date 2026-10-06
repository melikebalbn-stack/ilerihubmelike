-- AlterTable
ALTER TABLE "Personnel" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "sorumlu1Id" TEXT,
ADD COLUMN     "sorumlu2Id" TEXT,
ADD COLUMN     "sorumlu3Id" TEXT;

-- CreateIndex
CREATE INDEX "Personnel_departmentId_idx" ON "Personnel"("departmentId");

-- CreateIndex
CREATE INDEX "Personnel_sorumlu1Id_idx" ON "Personnel"("sorumlu1Id");

-- CreateIndex
CREATE INDEX "Personnel_sorumlu2Id_idx" ON "Personnel"("sorumlu2Id");

-- CreateIndex
CREATE INDEX "Personnel_sorumlu3Id_idx" ON "Personnel"("sorumlu3Id");

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "DepartmentDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_sorumlu1Id_fkey" FOREIGN KEY ("sorumlu1Id") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_sorumlu2Id_fkey" FOREIGN KEY ("sorumlu2Id") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_sorumlu3Id_fkey" FOREIGN KEY ("sorumlu3Id") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
