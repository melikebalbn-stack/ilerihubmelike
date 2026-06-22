
-- DropForeignKey
ALTER TABLE "course_packages" DROP CONSTRAINT "course_packages_courseId_fkey";

-- DropForeignKey
ALTER TABLE "department_packages" DROP CONSTRAINT "department_packages_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "department_packages" DROP CONSTRAINT "department_packages_packageId_fkey";

-- DropIndex
DROP INDEX "department_packages_packageId_departmentId_key";

-- AlterTable
ALTER TABLE "course_packages" DROP COLUMN "courseId",
DROP COLUMN "title",
ADD COLUMN     "iconColor" TEXT,
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "department_packages" DROP COLUMN "departmentId",
ADD COLUMN     "bolum" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "package_courses" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "package_courses_packageId_order_idx" ON "package_courses"("packageId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "package_courses_packageId_courseId_key" ON "package_courses"("packageId", "courseId");

-- CreateIndex
CREATE INDEX "department_packages_bolum_idx" ON "department_packages"("bolum");

-- CreateIndex
CREATE UNIQUE INDEX "department_packages_packageId_bolum_key" ON "department_packages"("packageId", "bolum");

-- AddForeignKey
ALTER TABLE "package_courses" ADD CONSTRAINT "package_courses_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "course_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_courses" ADD CONSTRAINT "package_courses_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_packages" ADD CONSTRAINT "department_packages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "course_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

