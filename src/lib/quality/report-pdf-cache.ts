import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import {
  generateMeasurementReportPdfBuffer,
  type MeasurementReportForPDF,
  type MeasurementResult,
} from '@/lib/pdf/measurement-report-pdf'

const STORAGE_REL_DIR = '/uploads/kalite/raporlar'

function safeFileName(reportNo: string): string {
  return reportNo.replace(/[/\\?%*:|"<>]/g, '-')
}

export interface ReportPdfCacheResult {
  buffer: Buffer
  filename: string
  reportNo: string
}

/**
 * KALITE-5 PDF üretimi için get-or-create cache wrapper.
 *
 * 1. Rapor + ilişkilerini fetch et (createdBy, finalizedBy, characteristics + symbol)
 * 2. `pdfPath` set & file disk'te varsa → readFile, return
 * 3. Yoksa → generateMeasurementReportPdfBuffer + disk'e yaz + pdfPath persist
 *
 * Finalize kontrolü YAPMAZ — caller (endpoint) gate'i yönetir. Helper sadece
 * "verilen rapor için PDF buffer'ı sağla" sözleşmesini taşır.
 *
 * @throws Error rapor bulunamazsa
 */
export async function getOrCreateReportPdfBuffer(
  reportId: string,
): Promise<ReportPdfCacheResult> {
  const report = await prisma.measurementReport.findUnique({
    where: { id: reportId },
    include: {
      createdBy: { select: { name: true } },
      finalizedBy: { select: { name: true } },
      characteristics: {
        orderBy: { orderIndex: 'asc' },
        include: { symbol: { select: { key: true } } },
      },
    },
  })
  if (!report) {
    throw new Error('Rapor bulunamadı')
  }

  const fileName = `${safeFileName(report.reportNo)}.pdf`

  // 1) Disk cache
  if (report.pdfPath) {
    const fullPath = path.join(process.cwd(), 'public', report.pdfPath)
    try {
      const cached = await fs.readFile(fullPath)
      return { buffer: cached, filename: fileName, reportNo: report.reportNo }
    } catch {
      // file silinmiş — regenerate
    }
  }

  // 2) Generate
  const pdfData: MeasurementReportForPDF = {
    reportNo: report.reportNo,
    qrKey: report.qrKey,
    formNo: report.formNo,
    partName: report.partName,
    drawingNo: report.drawingNo,
    revision: report.revision,
    lotNo: report.lotNo,
    operatorNo: report.operatorNo,
    orderQty: report.orderQty,
    machine: report.machine,
    gaugeNo: report.gaugeNo,
    measurementDate: report.measurementDate,
    notes: report.notes,
    result: report.result as MeasurementResult,
    finalizedAt: report.finalizedAt,
    createdByName: report.createdBy?.name ?? null,
    finalizedByName: report.finalizedBy?.name ?? null,
    characteristics: report.characteristics.map((c) => {
      const raw = Array.isArray(c.measurements) ? c.measurements : []
      const measurements: (string | null)[] = Array.from(
        { length: 10 },
        (_, i) => {
          const v = raw[i]
          if (v === null || v === undefined || v === '') return null
          return String(v)
        },
      )
      return {
        orderIndex: c.orderIndex,
        charName: c.charName,
        critical: c.critical,
        symbolKey: c.symbol?.key ?? null,
        nominal: c.nominal !== null ? c.nominal.toString() : null,
        maxValue: c.maxValue !== null ? c.maxValue.toString() : null,
        minValue: c.minValue !== null ? c.minValue.toString() : null,
        hasNumericRange: c.hasNumericRange,
        measurements,
        result: c.result as MeasurementResult,
      }
    }),
  }

  const buffer = await generateMeasurementReportPdfBuffer(pdfData)

  // 3) Persist (best-effort)
  const absDir = path.join(process.cwd(), 'public', STORAGE_REL_DIR)
  try {
    await fs.mkdir(absDir, { recursive: true })
    await fs.writeFile(path.join(absDir, fileName), buffer)
    await prisma.measurementReport.update({
      where: { id: report.id },
      data: { pdfPath: `${STORAGE_REL_DIR}/${fileName}` },
    })
  } catch (e) {
    console.error('[report-pdf-cache] persist failed:', e)
    // buffer hala dön
  }

  return { buffer, filename: fileName, reportNo: report.reportNo }
}
