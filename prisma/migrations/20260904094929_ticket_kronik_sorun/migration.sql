-- CreateEnum
CREATE TYPE "KronikSorunDurumu" AS ENUM ('AKTIF', 'COZULDU');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "kronikSorunId" TEXT;

-- CreateTable
CREATE TABLE "KronikSorun" (
    "id" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "aciklama" TEXT,
    "durum" "KronikSorunDurumu" NOT NULL DEFAULT 'AKTIF',
    "cozumNotu" TEXT,
    "cozulenAt" TIMESTAMP(3),
    "cozenByEmail" TEXT,
    "cozenByName" TEXT,
    "createdByEmail" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KronikSorun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KronikSorun_durum_idx" ON "KronikSorun"("durum");

-- CreateIndex
CREATE INDEX "Ticket_kronikSorunId_idx" ON "Ticket"("kronikSorunId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_kronikSorunId_fkey" FOREIGN KEY ("kronikSorunId") REFERENCES "KronikSorun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

