
-- AlterTable
ALTER TABLE "Fif" ADD COLUMN     "redNedeni" TEXT;

-- CreateTable
CREATE TABLE "FifGecmis" (
    "id" TEXT NOT NULL,
    "fifId" TEXT NOT NULL,
    "eskiDurum" "FifDurum",
    "yeniDurum" "FifDurum" NOT NULL,
    "userId" TEXT,
    "aciklama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FifGecmis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FifGecmis_fifId_idx" ON "FifGecmis"("fifId");

-- AddForeignKey
ALTER TABLE "FifGecmis" ADD CONSTRAINT "FifGecmis_fifId_fkey" FOREIGN KEY ("fifId") REFERENCES "Fif"("id") ON DELETE CASCADE ON UPDATE CASCADE;

