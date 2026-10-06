-- CreateEnum
CREATE TYPE "IfsGorevKaynak" AS ENUM ('IMPORT', 'MANUEL');

-- AlterTable
ALTER TABLE "ifs_task_meta" ADD COLUMN     "kaynak" "IfsGorevKaynak" NOT NULL DEFAULT 'IMPORT';

