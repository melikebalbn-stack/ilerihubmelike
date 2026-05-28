-- CreateEnum
CREATE TYPE "MeasurementReportResult" AS ENUM ('PENDING', 'OK', 'RED');

-- CreateEnum
CREATE TYPE "MeasurementCharResult" AS ENUM ('PENDING', 'OK', 'RED');

-- CreateTable
CREATE TABLE "QualitySymbol" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameTr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "svgContent" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "QualitySymbol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementTemplate" (
    "id" TEXT NOT NULL,
    "formNo" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "drawingNo" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "department" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "MeasurementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementTemplateChar" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "department" TEXT,
    "inspectionTool" TEXT,
    "sampleFreq" TEXT,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "symbolId" TEXT,
    "charName" TEXT NOT NULL,
    "nominal" DECIMAL(12,4),
    "maxValue" DECIMAL(12,4),
    "minValue" DECIMAL(12,4),
    "hasNumericRange" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeasurementTemplateChar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementReport" (
    "id" TEXT NOT NULL,
    "reportNo" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "formNo" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "drawingNo" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "operatorNo" TEXT,
    "lotNo" TEXT,
    "orderQty" INTEGER,
    "machine" TEXT,
    "gaugeNo" TEXT,
    "escalationContact" TEXT,
    "measurementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" "MeasurementReportResult" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "controllerOpNo" TEXT,
    "qrKey" TEXT NOT NULL,
    "pdfPath" TEXT,
    "createdById" TEXT,
    "finalizedById" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeasurementReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementReportChar" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "department" TEXT,
    "inspectionTool" TEXT,
    "sampleFreq" TEXT,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "symbolId" TEXT,
    "charName" TEXT NOT NULL,
    "nominal" DECIMAL(12,4),
    "maxValue" DECIMAL(12,4),
    "minValue" DECIMAL(12,4),
    "hasNumericRange" BOOLEAN NOT NULL DEFAULT true,
    "measurements" JSONB NOT NULL DEFAULT '[]',
    "result" "MeasurementCharResult" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "MeasurementReportChar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QualitySymbol_key_key" ON "QualitySymbol"("key");

-- CreateIndex
CREATE INDEX "QualitySymbol_active_displayOrder_idx" ON "QualitySymbol"("active", "displayOrder");

-- CreateIndex
CREATE INDEX "MeasurementTemplate_active_idx" ON "MeasurementTemplate"("active");

-- CreateIndex
CREATE INDEX "MeasurementTemplate_partName_idx" ON "MeasurementTemplate"("partName");

-- CreateIndex
CREATE UNIQUE INDEX "uq_template_form_drawing_rev" ON "MeasurementTemplate"("formNo", "drawingNo", "revision");

-- CreateIndex
CREATE INDEX "MeasurementTemplateChar_templateId_idx" ON "MeasurementTemplateChar"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "uq_template_char_order" ON "MeasurementTemplateChar"("templateId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementReport_reportNo_key" ON "MeasurementReport"("reportNo");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementReport_qrKey_key" ON "MeasurementReport"("qrKey");

-- CreateIndex
CREATE INDEX "MeasurementReport_templateId_idx" ON "MeasurementReport"("templateId");

-- CreateIndex
CREATE INDEX "MeasurementReport_measurementDate_idx" ON "MeasurementReport"("measurementDate");

-- CreateIndex
CREATE INDEX "MeasurementReport_result_idx" ON "MeasurementReport"("result");

-- CreateIndex
CREATE INDEX "MeasurementReport_lotNo_idx" ON "MeasurementReport"("lotNo");

-- CreateIndex
CREATE INDEX "MeasurementReport_drawingNo_idx" ON "MeasurementReport"("drawingNo");

-- CreateIndex
CREATE INDEX "MeasurementReportChar_reportId_idx" ON "MeasurementReportChar"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "uq_report_char_order" ON "MeasurementReportChar"("reportId", "orderIndex");

-- AddForeignKey
ALTER TABLE "QualitySymbol" ADD CONSTRAINT "QualitySymbol_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementTemplate" ADD CONSTRAINT "MeasurementTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementTemplateChar" ADD CONSTRAINT "MeasurementTemplateChar_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MeasurementTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementTemplateChar" ADD CONSTRAINT "MeasurementTemplateChar_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "QualitySymbol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReport" ADD CONSTRAINT "MeasurementReport_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MeasurementTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReport" ADD CONSTRAINT "MeasurementReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReport" ADD CONSTRAINT "MeasurementReport_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReportChar" ADD CONSTRAINT "MeasurementReportChar_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MeasurementReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReportChar" ADD CONSTRAINT "MeasurementReportChar_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "QualitySymbol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

