
-- AlterTable
ALTER TABLE "servis_guzergah_durak_saat" ADD COLUMN     "aktif" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "servis_guzergah_durak_saat_aktif_idx" ON "servis_guzergah_durak_saat"("aktif");

