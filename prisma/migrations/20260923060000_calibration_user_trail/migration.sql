-- Kalibrasyon kullanıcı izi (ISO 9001 7.1.5.2 / 27001 izlenebilirlik)
-- Additive: yeni kolonlar NULL, varsayılan yok, NOT NULL yok.
--
-- CalibrationHistory."createdBy": modül 2025-12'de bu alanla doğdu ama hiçbir uç
-- doldurmadı (prod: 46/46 NULL, okuyan kod yok). FK'ye çevirmek için sütun
-- YENİDEN ADLANDIRILIR — prisma migrate diff DROP+ADD üretiyordu, veri kaybı
-- riskini almamak için RENAME ile değiştirildi (sonuç şema aynı).

-- AlterTable
ALTER TABLE "CalibrationDevice" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable (DROP+ADD yerine RENAME)
ALTER TABLE "CalibrationHistory" RENAME COLUMN "createdBy" TO "createdById";

-- CreateIndex
CREATE INDEX "CalibrationHistory_createdById_idx" ON "CalibrationHistory"("createdById");

-- AddForeignKey
ALTER TABLE "CalibrationDevice" ADD CONSTRAINT "CalibrationDevice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationDevice" ADD CONSTRAINT "CalibrationDevice_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationHistory" ADD CONSTRAINT "CalibrationHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
