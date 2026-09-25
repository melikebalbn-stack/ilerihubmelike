-- AlterTable
ALTER TABLE "servis_sikayet" ADD COLUMN     "durakId" TEXT;

-- CreateIndex
CREATE INDEX "servis_sikayet_durakId_idx" ON "servis_sikayet"("durakId");

-- AddForeignKey
ALTER TABLE "servis_sikayet" ADD CONSTRAINT "servis_sikayet_durakId_fkey" FOREIGN KEY ("durakId") REFERENCES "servis_durak"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

