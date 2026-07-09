-- AlterTable
ALTER TABLE "DepartmentDefinition" ADD COLUMN     "sorumlu4Id" TEXT;

-- AddForeignKey
ALTER TABLE "DepartmentDefinition" ADD CONSTRAINT "DepartmentDefinition_sorumlu4Id_fkey" FOREIGN KEY ("sorumlu4Id") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
