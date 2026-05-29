import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth/require-permission"
import {
  generateMeasurementReportPdfBuffer,
  type MeasurementReportForPDF,
  type MeasurementResult,
} from "@/lib/pdf/measurement-report-pdf"

const STORAGE_REL_DIR = "/uploads/kalite/raporlar"

function safeFileName(reportNo: string): string {
  return reportNo.replace(/[/\\?%*:|"<>]/g, "-")
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("quality.report.read")
  if (error) return error

  const { id } = await params

  const report = await prisma.measurementReport.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      finalizedBy: { select: { name: true } },
      characteristics: {
        orderBy: { orderIndex: "asc" },
        include: { symbol: { select: { key: true } } },
      },
    },
  })

  if (!report) {
    return NextResponse.json({ error: "Rapor bulunamadı" }, { status: 404 })
  }
  if (!report.finalizedAt) {
    return NextResponse.json(
      { error: "Rapor henüz finalize edilmedi" },
      { status: 400 },
    )
  }

  // Disk cache
  let buffer: Buffer | null = null
  if (report.pdfPath) {
    const fullPath = path.join(process.cwd(), "public", report.pdfPath)
    try {
      buffer = await fs.readFile(fullPath)
    } catch {
      buffer = null
    }
  }

  if (!buffer) {
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
            if (v === null || v === undefined || v === "") return null
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

    buffer = generateMeasurementReportPdfBuffer(pdfData)

    // Persist (best-effort; stream her durumda devam eder)
    const fileName = `${safeFileName(report.reportNo)}.pdf`
    const absDir = path.join(process.cwd(), "public", STORAGE_REL_DIR)
    try {
      await fs.mkdir(absDir, { recursive: true })
      await fs.writeFile(path.join(absDir, fileName), buffer)
      await prisma.measurementReport.update({
        where: { id: report.id },
        data: { pdfPath: `${STORAGE_REL_DIR}/${fileName}` },
      })
    } catch (e) {
      console.error("[quality-report-pdf] persist failed:", e)
    }
  }

  const fileName = `${safeFileName(report.reportNo)}.pdf`
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-cache",
    },
  })
}
