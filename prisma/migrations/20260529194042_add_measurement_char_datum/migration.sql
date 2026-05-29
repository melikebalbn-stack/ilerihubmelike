-- AlterTable: MeasurementTemplateChar datum1/2/3 opsiyonel etiket alanları
ALTER TABLE "MeasurementTemplateChar" ADD COLUMN "datum1" TEXT;
ALTER TABLE "MeasurementTemplateChar" ADD COLUMN "datum2" TEXT;
ALTER TABLE "MeasurementTemplateChar" ADD COLUMN "datum3" TEXT;

-- AlterTable: MeasurementReportChar — snapshot için aynı 3 alan
ALTER TABLE "MeasurementReportChar" ADD COLUMN "datum1" TEXT;
ALTER TABLE "MeasurementReportChar" ADD COLUMN "datum2" TEXT;
ALTER TABLE "MeasurementReportChar" ADD COLUMN "datum3" TEXT;
