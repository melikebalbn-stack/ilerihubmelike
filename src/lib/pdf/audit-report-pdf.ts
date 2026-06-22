import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { PoppinsRegular, PoppinsBold, PoppinsSemiBold } from "./fonts/poppins"
import { IleriGroupLogo } from "./fonts/logo"

interface AuditTeamMember {
  id: string
  memberId: string | null
  memberName: string
  memberEmail: string
  role: string | null
}

interface AuditFinding {
  id: string
  findingNumber: string
  findingType: string
  title: string
  description: string
  evidence?: string | null
  severity: string
  status: string
  controlId?: string | null
  clause?: string | null
  correctiveAction?: string | null
  responsibleName?: string | null
  dueDate?: string | null
  completedDate?: string | null
}

export interface AuditForPDF {
  id: string
  auditNumber: string
  title: string
  description?: string | null
  auditType: string
  scope?: string | null
  clauses?: string[]
  controls?: string[]
  plannedDate: string
  startDate?: string | null
  endDate?: string | null
  leadAuditorName: string
  leadAuditorEmail: string
  auditeeName?: string | null
  auditeeEmail?: string | null
  auditeeDepartment?: string | null
  status: string
  summary?: string | null
  conclusion?: string | null
  teamMembers: AuditTeamMember[]
  findings: AuditFinding[]
}

const auditTypeLabels: Record<string, string> = {
  INTERNAL: "İç Denetim",
  EXTERNAL: "Dış Denetim",
  SURVEILLANCE: "Gözetim Denetimi",
  CERTIFICATION: "Belgelendirme Denetimi",
  SUPPLIER: "Tedarikçi Denetimi",
}

const auditStatusLabels: Record<string, string> = {
  PLANNED: "Planlandı",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal Edildi",
}

const findingTypeLabels: Record<string, string> = {
  MAJOR_NC: "Majör Uygunsuzluk",
  MINOR_NC: "Minör Uygunsuzluk",
  OBSERVATION: "Gözlem",
  OPPORTUNITY: "İyileştirme Fırsatı",
  POSITIVE: "Olumlu Bulgu",
}

const severityLabels: Record<string, string> = {
  CRITICAL: "Kritik",
  MAJOR: "Majör",
  MINOR: "Minör",
  LOW: "Düşük",
  TRIVIAL: "Önemsiz",
}

const findingStatusLabels: Record<string, string> = {
  OPEN: "Açık",
  IN_PROGRESS: "Devam Ediyor",
  CLOSED: "Kapalı",
  VERIFIED: "Doğrulandı",
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

export function generateAuditReportPDFBuffer(audit: AuditForPDF): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  // Register Poppins fonts
  doc.addFileToVFS("Poppins-Regular.ttf", PoppinsRegular)
  doc.addFileToVFS("Poppins-Bold.ttf", PoppinsBold)
  doc.addFileToVFS("Poppins-SemiBold.ttf", PoppinsSemiBold)

  doc.addFont("Poppins-Regular.ttf", "Poppins", "normal")
  doc.addFont("Poppins-Bold.ttf", "Poppins", "bold")
  doc.addFont("Poppins-SemiBold.ttf", "Poppins", "semibold")

  doc.setFont("Poppins", "normal")

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let yPos = margin

  // Color definitions
  const primaryColor: [number, number, number] = [30, 58, 95]
  const accentColor: [number, number, number] = [41, 128, 185]
  const lightGray: [number, number, number] = [245, 247, 250]
  const darkGray: [number, number, number] = [80, 80, 80]
  const mediumGray: [number, number, number] = [120, 120, 120]
  const redColor: [number, number, number] = [220, 53, 69]
  const orangeColor: [number, number, number] = [255, 152, 0]
  const greenColor: [number, number, number] = [40, 167, 69]

  // Helper: Page break check
  function checkPageBreak(requiredSpace: number) {
    if (yPos + requiredSpace > pageHeight - 25) {
      doc.addPage()
      yPos = margin + 5
      return true
    }
    return false
  }

  // Helper: Draw section header
  function drawSectionHeader(title: string) {
    checkPageBreak(15)
    doc.setFillColor(...primaryColor)
    doc.rect(margin, yPos, contentWidth, 8, "F")
    doc.setFont("Poppins", "bold")
    doc.setFontSize(10)
    doc.setTextColor(255, 255, 255)
    doc.text(title, margin + 4, yPos + 5.5)
    yPos += 12
  }

  // Helper: Draw info row
  function drawInfoRow(label: string, value: string, labelWidth: number = 45) {
    doc.setFont("Poppins", "semibold")
    doc.setFontSize(9)
    doc.setTextColor(...darkGray)
    doc.text(label + ":", margin + 2, yPos)
    doc.setFont("Poppins", "normal")
    doc.setTextColor(...primaryColor)

    const textValue = value || "-"
    const lines = doc.splitTextToSize(textValue, contentWidth - labelWidth - 5)

    if (lines.length > 0) {
      doc.text(lines[0], margin + labelWidth, yPos)
      yPos += 4

      for (let i = 1; i < lines.length; i++) {
        if (lines[i]) {
          doc.text(lines[i], margin + labelWidth, yPos)
        }
        yPos += 4
      }
    }
    yPos += 2
  }

  // ========== HEADER ==========
  try {
    doc.addImage(IleriGroupLogo, "PNG", margin, yPos, 35, 14)
  } catch {
    doc.setFont("Poppins", "bold")
    doc.setFontSize(14)
    doc.setTextColor(...primaryColor)
    doc.text("ILERI GROUP", margin, yPos + 10)
  }

  // Title
  doc.setFont("Poppins", "bold")
  doc.setFontSize(13)
  doc.setTextColor(...primaryColor)
  doc.text("İÇ DENETİM RAPORU", pageWidth - margin, yPos + 5, { align: "right" })

  doc.setFont("Poppins", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...mediumGray)
  doc.text(audit.auditNumber, pageWidth - margin, yPos + 10, { align: "right" })

  yPos += 20

  // Separator line
  doc.setDrawColor(...accentColor)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 8

  // ========== AUDIT INFO ==========
  drawSectionHeader("DENETİM BİLGİLERİ")

  drawInfoRow("Denetim Başlığı", audit.title)
  drawInfoRow("Denetim Tipi", auditTypeLabels[audit.auditType] || audit.auditType)
  drawInfoRow("Durum", auditStatusLabels[audit.status] || audit.status)
  drawInfoRow("Planlanan Tarih", format(toDate(audit.plannedDate), "d MMMM yyyy EEEE", { locale: tr }))

  if (audit.startDate) {
    drawInfoRow("Başlama Tarihi", format(toDate(audit.startDate), "d MMMM yyyy", { locale: tr }))
  }
  if (audit.endDate) {
    drawInfoRow("Bitiş Tarihi", format(toDate(audit.endDate), "d MMMM yyyy", { locale: tr }))
  }

  yPos += 3

  // ========== SCOPE ==========
  if (audit.scope) {
    drawSectionHeader("DENETİM KAPSAMI")
    doc.setFont("Poppins", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...darkGray)
    const scopeLines = doc.splitTextToSize(audit.scope, contentWidth - 5)
    scopeLines.forEach((line: string) => {
      checkPageBreak(5)
      doc.text(line, margin + 2, yPos)
      yPos += 4
    })
    yPos += 3
  }

  // ========== CONTROLS ==========
  if (audit.controls && audit.controls.length > 0) {
    drawSectionHeader("DENETLENEN KONTROLLER")
    doc.setFont("Poppins", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...darkGray)
    const controlsText = audit.controls.join(", ")
    const controlLines = doc.splitTextToSize(controlsText, contentWidth - 5)
    controlLines.forEach((line: string) => {
      checkPageBreak(5)
      doc.text(line, margin + 2, yPos)
      yPos += 4
    })
    yPos += 3
  }

  // ========== DESCRIPTION ==========
  if (audit.description) {
    drawSectionHeader("DENETİM AÇIKLAMASI")
    doc.setFont("Poppins", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...darkGray)
    const descLines = doc.splitTextToSize(audit.description, contentWidth - 5)
    descLines.forEach((line: string) => {
      checkPageBreak(5)
      doc.text(line, margin + 2, yPos)
      yPos += 4
    })
    yPos += 3
  }

  // ========== AUDIT TEAM ==========
  if (audit.teamMembers.length > 0) {
    drawSectionHeader("DENETİM EKİBİ")

    const teamData = audit.teamMembers.map((m, i) => [
      String(i + 1),
      m.memberName,
      m.role || "-",
      m.memberEmail,
    ])

    autoTable(doc, {
      startY: yPos,
      head: [["No", "Ad Soyad", "Rol", "E-posta"]],
      body: teamData,
      margin: { left: margin, right: margin },
      styles: {
        font: "Poppins",
        fontSize: 8,
        cellPadding: 3,
        textColor: darkGray,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: accentColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: lightGray,
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 45 },
        2: { cellWidth: 50 },
        3: { cellWidth: "auto" },
      },
    })

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // ========== AUDITOR / AUDITEE INFO ==========
  drawSectionHeader("DENETÇİ VE DENETLENEN BİLGİLERİ")

  drawInfoRow("Baş Denetçi", audit.leadAuditorName)
  drawInfoRow("Denetçi E-posta", audit.leadAuditorEmail)

  if (audit.auditeeName) {
    drawInfoRow("Denetlenen Kişi", audit.auditeeName)
  }
  if (audit.auditeeDepartment) {
    drawInfoRow("Denetlenen Birim", audit.auditeeDepartment)
  }

  yPos += 3

  // ========== FINDINGS SUMMARY ==========
  const majorNCs = audit.findings.filter(f => f.findingType === "MAJOR_NC")
  const minorNCs = audit.findings.filter(f => f.findingType === "MINOR_NC")
  const observations = audit.findings.filter(f => f.findingType === "OBSERVATION")
  const opportunities = audit.findings.filter(f => f.findingType === "OPPORTUNITY")
  const positives = audit.findings.filter(f => f.findingType === "POSITIVE")

  drawSectionHeader(`BULGU ÖZETİ (${audit.findings.length} Bulgu)`)

  // Summary boxes
  checkPageBreak(20)
  const boxWidth = (contentWidth - 16) / 5
  const boxes = [
    { label: "Majör UY", count: majorNCs.length, color: redColor },
    { label: "Minör UY", count: minorNCs.length, color: orangeColor },
    { label: "Gözlem", count: observations.length, color: [255, 193, 7] as [number, number, number] },
    { label: "İyileştirme", count: opportunities.length, color: accentColor },
    { label: "Olumlu", count: positives.length, color: greenColor },
  ]

  boxes.forEach((box, i) => {
    const x = margin + i * (boxWidth + 4)
    doc.setFillColor(...box.color)
    doc.roundedRect(x, yPos, boxWidth, 14, 2, 2, "F")
    doc.setFont("Poppins", "bold")
    doc.setFontSize(14)
    doc.setTextColor(255, 255, 255)
    doc.text(String(box.count), x + boxWidth / 2, yPos + 7, { align: "center" })
    doc.setFont("Poppins", "normal")
    doc.setFontSize(6)
    doc.text(box.label, x + boxWidth / 2, yPos + 11.5, { align: "center" })
  })

  yPos += 20

  // ========== FINDINGS TABLE ==========
  if (audit.findings.length > 0) {
    drawSectionHeader("BULGU DETAYLARI")

    const findingsData = audit.findings.map((f, i) => [
      String(i + 1),
      f.clause || "-",
      f.title,
      findingTypeLabels[f.findingType] || f.findingType,
      severityLabels[f.severity] || f.severity,
      findingStatusLabels[f.status] || f.status,
    ])

    autoTable(doc, {
      startY: yPos,
      head: [["No", "Madde", "Bulgu", "Tip", "Ciddiyet", "Durum"]],
      body: findingsData,
      margin: { left: margin, right: margin },
      styles: {
        font: "Poppins",
        fontSize: 7.5,
        cellPadding: 3,
        textColor: darkGray,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: accentColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: lightGray,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 18 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 30 },
        4: { cellWidth: 20 },
        5: { cellWidth: 22 },
      },
      didParseCell: (data) => {
        // Color code finding type
        if (data.column.index === 3 && data.section === "body") {
          const val = audit.findings[data.row.index]?.findingType
          if (val === "MAJOR_NC") {
            data.cell.styles.textColor = [220, 53, 69]
            data.cell.styles.fontStyle = "bold"
          } else if (val === "MINOR_NC") {
            data.cell.styles.textColor = [255, 152, 0]
            data.cell.styles.fontStyle = "bold"
          } else if (val === "POSITIVE") {
            data.cell.styles.textColor = [40, 167, 69]
          }
        }
        // Color code status
        if (data.column.index === 5 && data.section === "body") {
          const val = audit.findings[data.row.index]?.status
          if (val === "OPEN") {
            data.cell.styles.textColor = [220, 53, 69]
          } else if (val === "CLOSED" || val === "VERIFIED") {
            data.cell.styles.textColor = [40, 167, 69]
          }
        }
      },
    })

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // ========== NC DETAILS ==========
  const ncFindings = audit.findings.filter(f => f.findingType === "MAJOR_NC" || f.findingType === "MINOR_NC")
  if (ncFindings.length > 0) {
    drawSectionHeader("UYGUNSUZLUK DETAYLARI")

    ncFindings.forEach((f) => {
      checkPageBreak(35)

      // NC header bar
      const isMajor = f.findingType === "MAJOR_NC"
      doc.setFillColor(...(isMajor ? redColor : orangeColor))
      doc.rect(margin, yPos, contentWidth, 7, "F")
      doc.setFont("Poppins", "bold")
      doc.setFontSize(9)
      doc.setTextColor(255, 255, 255)
      doc.text(
        `${f.findingNumber} - ${isMajor ? "MAJÖR" : "MİNÖR"} UYGUNSUZLUK`,
        margin + 3,
        yPos + 5
      )
      if (f.clause) {
        doc.text(`[${f.clause}]`, pageWidth - margin - 3, yPos + 5, { align: "right" })
      }
      yPos += 10

      // NC details
      drawInfoRow("Başlık", f.title, 35)
      drawInfoRow("Açıklama", f.description, 35)
      if (f.evidence) {
        drawInfoRow("Kanıt", f.evidence, 35)
      }
      if (f.correctiveAction) {
        drawInfoRow("Düzeltici Faaliyet", f.correctiveAction, 35)
      }
      if (f.responsibleName) {
        drawInfoRow("Sorumlu", f.responsibleName, 35)
      }
      if (f.dueDate) {
        drawInfoRow("Termin Tarihi", format(toDate(f.dueDate), "d MMMM yyyy", { locale: tr }), 35)
      }
      drawInfoRow("Durum", findingStatusLabels[f.status] || f.status, 35)

      yPos += 3
    })
  }

  // ========== SUMMARY & CONCLUSION ==========
  if (audit.summary) {
    drawSectionHeader("DENETİM ÖZETİ")
    doc.setFont("Poppins", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...darkGray)
    const sumLines = doc.splitTextToSize(audit.summary, contentWidth - 5)
    sumLines.forEach((line: string) => {
      checkPageBreak(5)
      doc.text(line, margin + 2, yPos)
      yPos += 4
    })
    yPos += 5
  }

  if (audit.conclusion) {
    drawSectionHeader("SONUÇ VE DEĞERLENDİRME")
    doc.setFont("Poppins", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...darkGray)
    const concLines = doc.splitTextToSize(audit.conclusion, contentWidth - 5)
    concLines.forEach((line: string) => {
      checkPageBreak(5)
      doc.text(line, margin + 2, yPos)
      yPos += 4
    })
    yPos += 5
  }

  // Helper: Draw digital signature box
  function drawDigitalSignatureBox(x: number, y: number, w: number, h: number, name: string, email: string, date: string) {
    // Light green background with green border
    doc.setFillColor(240, 253, 244)
    doc.setDrawColor(34, 197, 94)
    doc.setLineWidth(0.5)
    doc.roundedRect(x, y, w, h, 2, 2, "FD")

    // Checkmark circle
    doc.setFillColor(34, 197, 94)
    doc.circle(x + 6, y + h / 2, 3.5, "F")
    doc.setFont("Poppins", "bold")
    doc.setFontSize(7)
    doc.setTextColor(255, 255, 255)
    doc.text("OK", x + 6, y + h / 2 + 1, { align: "center" })

    // Signature text
    const textX = x + 13
    doc.setFont("Poppins", "bold")
    doc.setFontSize(7)
    doc.setTextColor(22, 101, 52)
    doc.text("Dijital olarak imzalanmıştır", textX, y + 5)

    doc.setFont("Poppins", "semibold")
    doc.setFontSize(7)
    doc.setTextColor(34, 100, 50)
    doc.text(name, textX, y + 9.5)

    doc.setFont("Poppins", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(60, 120, 70)
    doc.text(email, textX, y + 13.5)
    doc.text(`Tarih: ${date}`, textX, y + 17)

    doc.setFontSize(5.5)
    doc.setTextColor(100, 140, 110)
    doc.text("ILERIHub BGYS", textX, y + 20.5)
  }

  // ========== SIGNATURES ==========
  checkPageBreak(50)
  yPos += 5

  drawSectionHeader("İMZALAR")

  doc.setFont("Poppins", "semibold")
  doc.setFontSize(9)
  doc.setTextColor(...darkGray)

  const sigBoxWidth = (contentWidth - 10) / 2
  const isCompleted = audit.status === "COMPLETED"
  const signDate = audit.endDate
    ? format(toDate(audit.endDate), "dd.MM.yyyy HH:mm")
    : audit.startDate
      ? format(toDate(audit.startDate), "dd.MM.yyyy HH:mm")
      : ""

  // Left: Lead Auditor
  doc.text("Baş Denetçi:", margin + 2, yPos)
  yPos += 3

  if (isCompleted && signDate) {
    drawDigitalSignatureBox(
      margin + 2, yPos,
      sigBoxWidth - 4, 23,
      audit.leadAuditorName,
      audit.leadAuditorEmail,
      signDate
    )
  } else {
    doc.setFont("Poppins", "normal")
    doc.text(audit.leadAuditorName, margin + 2, yPos + 5)
    doc.text("İmza:", margin + 2, yPos + 12)
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.rect(margin + 2, yPos + 14, sigBoxWidth - 4, 15)
  }

  // Right: Auditee
  const rightX = margin + sigBoxWidth + 10
  doc.setFont("Poppins", "semibold")
  doc.setFontSize(9)
  doc.setTextColor(...darkGray)
  doc.text("Denetlenen Birim Yetkilisi:", rightX, yPos - 3)

  if (isCompleted && audit.auditeeName && signDate) {
    drawDigitalSignatureBox(
      rightX, yPos,
      sigBoxWidth - 4, 23,
      audit.auditeeName,
      audit.auditeeEmail || "",
      signDate
    )
  } else {
    doc.setFont("Poppins", "normal")
    doc.text(audit.auditeeName || "________________________", rightX, yPos + 5)
    doc.text("İmza:", rightX, yPos + 12)
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.rect(rightX, yPos + 14, sigBoxWidth - 4, 15)
  }

  yPos += 28

  // ========== FOOTER ==========
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont("Poppins", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...mediumGray)
    doc.text(`Sayfa ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" })
    doc.text(
      `Doküman No: ${audit.auditNumber} | ISO 27001 BGYS İç Denetim Raporu | ILERIHub`,
      margin,
      pageHeight - 10
    )
  }

  return Buffer.from(doc.output("arraybuffer"))
}
