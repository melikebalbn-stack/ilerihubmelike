-- AlterTable
ALTER TABLE "personnel_department_transfer" ADD COLUMN     "isHistorical" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "talepTarihi" DROP NOT NULL,
ALTER COLUMN "talepEden" DROP NOT NULL,
ALTER COLUMN "isgOnayi" DROP NOT NULL,
ALTER COLUMN "doktorOnayi" DROP NOT NULL,
ALTER COLUMN "transferTarihi" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "personnel_department_transfer_isHistorical_idx" ON "personnel_department_transfer"("isHistorical");
