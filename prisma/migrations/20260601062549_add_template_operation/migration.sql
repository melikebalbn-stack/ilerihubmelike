-- AlterTable: MeasurementTemplate.operation (default '') — operasyon ayrımı
-- (KALITE-7B.0: aynı parçanın farklı operasyon şablonlarını ayırt etmek için)
ALTER TABLE "MeasurementTemplate" ADD COLUMN "operation" TEXT NOT NULL DEFAULT '';

-- Unique index'i 3'lü → 4'lüye değiştir
-- (Prisma @@unique map'i PostgreSQL UNIQUE INDEX üretir, CONSTRAINT değil)
DROP INDEX "uq_template_form_drawing_rev";
CREATE UNIQUE INDEX "uq_template_form_drawing_rev_op"
  ON "MeasurementTemplate"("formNo", "drawingNo", "revision", "operation");
