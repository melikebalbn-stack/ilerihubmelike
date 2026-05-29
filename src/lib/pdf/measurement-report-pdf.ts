import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { PoppinsRegular, PoppinsBold, PoppinsSemiBold } from "./fonts/poppins"
import { IleriGroupLogo } from "./fonts/logo"

export type MeasurementResult = "PENDING" | "OK" | "RED"

export interface MeasurementReportCharForPDF {
  orderIndex: number
  charName: string
  critical: boolean
  symbolKey: string | null
  nominal: string | null
  maxValue: string | null
  minValue: string | null
  hasNumericRange: boolean
  /** 10 ölçüm slot — eksikler null */
  measurements: (string | null)[]
  result: MeasurementResult
}

export interface MeasurementReportForPDF {
  reportNo: string
  qrKey: string
  formNo: string
  partName: string
  drawingNo: string
  revision: string
  lotNo: string | null
  operatorNo: string | null
  orderQty: number | null
  machine: string | null
  gaugeNo: string | null
  measurementDate: Date
  notes: string | null
  result: MeasurementResult
  finalizedAt: Date | null
  createdByName: string | null
  finalizedByName: string | null
  characteristics: MeasurementReportCharForPDF[]
}

const resultLabels: Record<MeasurementResult, string> = {
  PENDING: "Bekliyor",
  OK: "OK",
  RED: "RED",
}

const resultColors: Record<MeasurementResult, [number, number, number]> = {
  PENDING: [148, 163, 184],
  OK: [16, 122, 87],
  RED: [185, 28, 28],
}

export function generateMeasurementReportPdfBuffer(
  report: MeasurementReportForPDF,
): Buffer {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  })

  doc.addFileToVFS("Poppins-Regular.ttf", PoppinsRegular)
  doc.addFileToVFS("Poppins-Bold.ttf", PoppinsBold)
  doc.addFileToVFS("Poppins-SemiBold.ttf", PoppinsSemiBold)
  doc.addFont("Poppins-Regular.ttf", "Poppins", "normal")
  doc.addFont("Poppins-Bold.ttf", "Poppins", "bold")
  doc.addFont("Poppins-SemiBold.ttf", "Poppins", "semibold")
  doc.setFont("Poppins", "normal")

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - margin * 2

  // ILERI navy
  const primaryColor: [number, number, number] = [27, 79, 114]
  const accentColor: [number, number, number] = [41, 128, 185]
  const darkGray: [number, number, number] = [60, 60, 60]
  const mediumGray: [number, number, number] = [120, 120, 120]

  let yPos = margin

  // ========== HEADER ==========
  try {
    doc.addImage(IleriGroupLogo, "PNG", margin, yPos, 32, 13)
  } catch {
    // logo opsiyonel
  }

  doc.setFont("Poppins", "bold")
  doc.setFontSize(15)
  doc.setTextColor(...primaryColor)
  doc.text("ÖLÇÜM RAPORU", pageWidth / 2, yPos + 7, { align: "center" })

  doc.setFont("Poppins", "semibold")
  doc.setFontSize(11)
  doc.text(report.reportNo, pageWidth - margin, yPos + 5, { align: "right" })

  const badgeColor = resultColors[report.result]
  const badgeWidth = 22
  const badgeX = pageWidth - margin - badgeWidth
  doc.setFillColor(...badgeColor)
  doc.roundedRect(badgeX, yPos + 8, badgeWidth, 6, 1, 1, "F")
  doc.setFont("Poppins", "bold")
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(
    resultLabels[report.result],
    badgeX + badgeWidth / 2,
    yPos + 12,
    { align: "center" },
  )

  yPos += 18

  doc.setDrawColor(...accentColor)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 4

  // ========== INFO GRID ==========
  const infoRow1: ReadonlyArray<readonly [string, string]> = [
    ["Parça Adı", report.partName],
    ["Resim No / Rev", `${report.drawingNo} / ${report.revision}`],
    ["Form No", report.formNo],
    ["Lot No", report.lotNo || "—"],
  ]
  const infoRow2: ReadonlyArray<readonly [string, string]> = [
    ["Operatör", report.operatorNo || "—"],
    ["Adet", report.orderQty != null ? String(report.orderQty) : "—"],
    ["Makina", report.machine || "—"],
    ["Mastar No", report.gaugeNo || "—"],
  ]

  function drawInfoRow(
    cells: ReadonlyArray<readonly [string, string]>,
    rowY: number,
  ) {
    const colWidth = contentWidth / 4
    cells.forEach((cell, i) => {
      const x = margin + i * colWidth
      doc.setFont("Poppins", "semibold")
      doc.setFontSize(7.5)
      doc.setTextColor(...mediumGray)
      doc.text(cell[0].toUpperCase(), x + 1, rowY)
      doc.setFont("Poppins", "normal")
      doc.setFontSize(9)
      doc.setTextColor(...darkGray)
      const lines = doc.splitTextToSize(cell[1] || "—", colWidth - 3)
      doc.text(lines[0] || "—", x + 1, rowY + 4)
    })
  }
  drawInfoRow(infoRow1, yPos + 4)
  drawInfoRow(infoRow2, yPos + 13)
  yPos += 22

  // ========== CHARACTERISTICS TABLE ==========
  const head = [[
    "#",
    "Karakter",
    "Nominal",
    "Maks",
    "Min",
    ...Array.from({ length: 10 }, (_, i) => `Ö${i + 1}`),
    "Sonuç",
  ]]

  const body = report.characteristics.map((c) => {
    const critPrefix = c.critical ? "● " : ""
    const symPrefix = c.symbolKey ? `[${c.symbolKey}] ` : ""
    return [
      String(c.orderIndex),
      `${critPrefix}${symPrefix}${c.charName}`,
      c.hasNumericRange && c.nominal !== null ? c.nominal : "—",
      c.hasNumericRange && c.maxValue !== null ? c.maxValue : "—",
      c.hasNumericRange && c.minValue !== null ? c.minValue : "—",
      ...Array.from({ length: 10 }, (_, i) => c.measurements[i] ?? "—"),
      resultLabels[c.result],
    ]
  })

  autoTable(doc, {
    head,
    body,
    startY: yPos,
    margin: { left: margin, right: margin },
    styles: {
      font: "Poppins",
      fontSize: 7,
      cellPadding: 1.5,
      valign: "middle",
      halign: "center",
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 7 },
      1: { cellWidth: 44, halign: "left" },
      2: { cellWidth: 14 },
      3: { cellWidth: 14 },
      4: { cellWidth: 14 },
      5: { cellWidth: 13 },
      6: { cellWidth: 13 },
      7: { cellWidth: 13 },
      8: { cellWidth: 13 },
      9: { cellWidth: 13 },
      10: { cellWidth: 13 },
      11: { cellWidth: 13 },
      12: { cellWidth: 13 },
      13: { cellWidth: 13 },
      14: { cellWidth: 13 },
      15: { cellWidth: 17, fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 15) {
        const rowResult = report.characteristics[data.row.index]?.result
        if (rowResult) {
          data.cell.styles.textColor = resultColors[rowResult]
        }
      }
    },
  })

  // jspdf-autotable instance state
  yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // ========== NOTES ==========
  if (report.notes) {
    if (yPos + 20 > pageHeight - 14) {
      doc.addPage()
      yPos = margin
    }
    doc.setFont("Poppins", "semibold")
    doc.setFontSize(9)
    doc.setTextColor(...primaryColor)
    doc.text("NOTLAR", margin, yPos)
    yPos += 4
    doc.setFont("Poppins", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...darkGray)
    const noteLines = doc.splitTextToSize(report.notes, contentWidth)
    for (const line of noteLines) {
      if (yPos > pageHeight - 14) {
        doc.addPage()
        yPos = margin
      }
      doc.text(line, margin, yPos)
      yPos += 4
    }
  }

  // ========== FOOTER (every page) ==========
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    const footerY = pageHeight - 6
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.2)
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3)
    doc.setFont("Poppins", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...mediumGray)

    const finalizedAtStr = report.finalizedAt
      ? format(report.finalizedAt, "d MMM yyyy HH:mm", { locale: tr })
      : "—"
    doc.text(
      `Hazırlayan: ${report.createdByName || "—"}    Finalize: ${report.finalizedByName || "—"} (${finalizedAtStr})`,
      margin,
      footerY,
    )
    doc.text(
      `Doğrulama: ${report.qrKey.slice(0, 8)}`,
      pageWidth / 2,
      footerY,
      { align: "center" },
    )
    doc.text(`Sayfa ${i} / ${totalPages}`, pageWidth - margin, footerY, {
      align: "right",
    })
  }

  return Buffer.from(doc.output("arraybuffer"))
}
