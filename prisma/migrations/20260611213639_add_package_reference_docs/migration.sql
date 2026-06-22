-- CreateTable
CREATE TABLE "package_reference_docs" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_reference_docs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "package_reference_docs_packageId_sortOrder_idx" ON "package_reference_docs"("packageId", "sortOrder");

-- AddForeignKey
ALTER TABLE "package_reference_docs" ADD CONSTRAINT "package_reference_docs_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "course_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

