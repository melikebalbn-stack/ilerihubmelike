-- CreateEnum
CREATE TYPE "TransferTalepEden" AS ENUM ('PERSONEL', 'BOLUM_YONETICISI');

-- CreateEnum
CREATE TYPE "TransferOnay" AS ENUM ('UYGUN', 'UYGUN_DEGIL');

-- CreateTable
CREATE TABLE "personnel_department_transfer" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "talepTarihi" DATE NOT NULL,
    "talepEden" "TransferTalepEden" NOT NULL,
    "isgOnayi" "TransferOnay" NOT NULL,
    "doktorOnayi" "TransferOnay" NOT NULL,
    "gerekceler" TEXT[],
    "gerekceAciklamasi" TEXT,
    "gerekceDigerKisi" TEXT,
    "gerekceDigerIs" TEXT,
    "transferEdenBolum" TEXT NOT NULL,
    "transferEdilenBolum" TEXT NOT NULL,
    "transferTarihi" DATE NOT NULL,
    "kayitEdenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personnel_department_transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personnel_department_transfer_personnelId_idx" ON "personnel_department_transfer"("personnelId");

-- CreateIndex
CREATE INDEX "personnel_department_transfer_transferTarihi_idx" ON "personnel_department_transfer"("transferTarihi");

-- AddForeignKey
ALTER TABLE "personnel_department_transfer" ADD CONSTRAINT "personnel_department_transfer_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_department_transfer" ADD CONSTRAINT "personnel_department_transfer_kayitEdenId_fkey" FOREIGN KEY ("kayitEdenId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
