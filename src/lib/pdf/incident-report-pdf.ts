import { jsPDF } from "jspdf"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { PoppinsRegular, PoppinsBold, PoppinsSemiBold } from "./fonts/poppins"
import { IleriGroupLogo } from "./fonts/logo"

export interface IncidentForPDF {
  id: string
  incidentNumber: string
  title: string
  description: string
  category: string
  severity: string
  status: string
  detectedAt: string
  detectionMethod?: string | null
  reportedAt: string
  containmentAt?: string | null
  resolvedAt?: string | null
  closedAt?: string | null
  reportedByName: string
  reportedByEmail: string
  assignedToName?: string | null
  assignedToEmail?: string | null
  affectedSystems?: string | null
  affectedAssets?: string | null
  impactScope?: string | null
  immediateActions?: string | null
  rootCause?: string | null
  rootCauseAnalyzedAt?: string | null
  resolution?: string | null
  correctiveAction?: string | null
  preventiveAction?: string | null
  closureNotes?: string | null
  lessonsLearned?: string | null
  relatedControls?: string | null
  relatedRiskIds?: string[]
  timeline: {
    action: string
    description?: string | null
    performedByName?: string | null
    performedAt: string
  }[]
  // İmza bilgileri
  signerName: string
  signerEmail: string
  signerTitle: string
}

const categoryLabels: Record<string, string> = {
  CYBER_ATTACK: "Siber Saldırı",
  UNAUTHORIZED_ACCESS: "Yetkisiz Erişim",
  DATA_BREACH: "Veri İhlali",
  SYSTEM_FAILURE: "Sistem Arızası",
  PHYSICAL_SECURITY: "Fiziksel Güvenlik",
  HUMAN_ERROR: "İnsan Hatası",
  POLICY_VIOLATION: "Politika İhlali",
  SUPPLIER_RELATED: "Tedarikçi Kaynaklı",
}

const severityLabels: Record<string, string> = {
  CRITICAL: "Kritik",
  HIGH: "Yüksek",
  MEDIUM: "Orta",
  LOW: "Düşük",
}

const statusLabels: Record<string, string> = {
  OPEN: "Açık",
  INVESTIGATING: "İnceleniyor",
  RESOLVED: "Çözüldü",
  CLOSED: "Kapatıldı",
  ON_HOLD: "Beklemede",
}

const impactScopeLabels: Record<string, string> = {
  individual: "Bireysel",
  department: "Departman",
  company: "Şirket Geneli",
  external: "Dış Paydaş",
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

export function generateIncidentReportPDFBuffer(incident: IncidentForPDF): Buffer {
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
  const accentColor: [number, number, number] = [220, 53, 69] // Kırmızı - olay raporu için
  const lightGray: [number, number, number] = [245, 247, 250]
  const darkGray: [number, number, number] = [80, 80, 80]
  const mediumGray: [number, number, number] = [120, 120, 120]

  // Severity renkleri
  const severityColors: Record<string, [number, number, number]> = {
    CRITICAL: [220, 53, 69],
    HIGH: [255, 152, 0],
    MEDIUM: [255, 193, 7],
    LOW: [40, 167, 69],
  }

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
  function drawInfoRow(label: string, value: string, labelWidth: number = 50) {
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

  // Helper: Draw text block
  function drawTextBlock(text: string) {
    doc.setFont("Poppins", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...darkGray)
    const lines = doc.splitTextToSize(text, contentWidth - 5)
    lines.forEach((line: string) => {
      checkPageBreak(5)
      doc.text(line, margin + 2, yPos)
      yPos += 4
    })
    yPos += 3
  }

  // Helper: Draw digital signature box
  function drawDigitalSignatureBox(x: number, y: number, w: number, h: number, name: string, email: string, title: string, date: string) {
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
    doc.text(title, textX, y + 13.5)
    doc.text(email, textX, y + 17)
    doc.text(`Tarih: ${date}`, textX, y + 20.5)

    doc.setFontSize(5.5)
    doc.setTextColor(100, 140, 110)
    doc.text("ILERIHub BGYS", textX, y + 24)
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
  doc.setTextColor(...accentColor)
  doc.text("OLAY RAPORU", pageWidth - margin, yPos + 5, { align: "right" })

  doc.setFont("Poppins", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...mediumGray)
  doc.text(incident.incidentNumber, pageWidth - margin, yPos + 10, { align: "right" })

  yPos += 20

  // Separator line
  doc.setDrawColor(...accentColor)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 8

  // ========== SEVERITY BANNER ==========
  const sevColor = severityColors[incident.severity] || severityColors.MEDIUM
  doc.setFillColor(...sevColor)
  doc.roundedRect(margin, yPos, contentWidth, 10, 2, 2, "F")
  doc.setFont("Poppins", "bold")
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  const sevLabel = severityLabels[incident.severity] || incident.severity
  doc.text(`ŞİDDET SEVİYESİ: ${sevLabel.toUpperCase()}`, pageWidth / 2, yPos + 7, { align: "center" })
  yPos += 15

  // ========== OLAY BİLGİLERİ ==========
  drawSectionHeader("OLAY BİLGİLERİ")

  drawInfoRow("Olay Numarası", incident.incidentNumber)
  drawInfoRow("Olay Başlığı", incident.title)
  drawInfoRow("Kategori", categoryLabels[incident.category] || incident.category)
  drawInfoRow("Şiddet Seviyesi", severityLabels[incident.severity] || incident.severity)
  drawInfoRow("Durum", statusLabels[incident.status] || incident.status)
  drawInfoRow("Tespit Tarihi", format(toDate(incident.detectedAt), "d MMMM yyyy EEEE", { locale: tr }))
  drawInfoRow("Raporlama Tarihi", format(toDate(incident.reportedAt), "d MMMM yyyy HH:mm", { locale: tr }))
  if (incident.detectionMethod) {
    drawInfoRow("Tespit Yöntemi", incident.detectionMethod)
  }

  yPos += 3

  // ========== SORUMLULUK ==========
  drawSectionHeader("SORUMLULUK BİLGİLERİ")

  drawInfoRow("Raporlayan", `${incident.reportedByName} (${incident.reportedByEmail})`)
  if (incident.assignedToName) {
    drawInfoRow("Atanan Kişi", `${incident.assignedToName}${incident.assignedToEmail ? ` (${incident.assignedToEmail})` : ""}`)
  }

  yPos += 3

  // ========== AÇIKLAMA ==========
  drawSectionHeader("OLAY AÇIKLAMASI")
  drawTextBlock(incident.description)

  // ========== ETKİ ANALİZİ ==========
  if (incident.affectedSystems || incident.affectedAssets || incident.impactScope) {
    drawSectionHeader("ETKİ ANALİZİ")

    if (incident.affectedSystems) {
      drawInfoRow("Etkilenen Sistemler", incident.affectedSystems)
    }
    if (incident.affectedAssets) {
      drawInfoRow("Etkilenen Varlıklar", incident.affectedAssets)
    }
    if (incident.impactScope) {
      drawInfoRow("Etki Alanı", impactScopeLabels[incident.impactScope] || incident.impactScope)
    }

    yPos += 3
  }

  // ========== ACİL ÖNLEMLER ==========
  if (incident.immediateActions) {
    drawSectionHeader("ALINAN ACİL ÖNLEMLER")
    drawTextBlock(incident.immediateActions)
  }

  // ========== KONTROL ALTINA ALMA ==========
  if (incident.containmentAt) {
    drawSectionHeader("KONTROL ALTINA ALMA")
    drawInfoRow("Kontrol Altına Alınma Tarihi", format(toDate(incident.containmentAt), "d MMMM yyyy HH:mm", { locale: tr }))
    yPos += 3
  }

  // ========== KÖK NEDEN ANALİZİ ==========
  if (incident.rootCause) {
    drawSectionHeader("KÖK NEDEN ANALİZİ")
    drawTextBlock(incident.rootCause)
    if (incident.rootCauseAnalyzedAt) {
      drawInfoRow("Analiz Tarihi", format(toDate(incident.rootCauseAnalyzedAt), "d MMMM yyyy HH:mm", { locale: tr }))
    }
    yPos += 3
  }

  // ========== ÇÖZÜM ==========
  if (incident.resolution) {
    drawSectionHeader("ÇÖZÜM")
    drawTextBlock(incident.resolution)
    if (incident.resolvedAt) {
      drawInfoRow("Çözüm Tarihi", format(toDate(incident.resolvedAt), "d MMMM yyyy HH:mm", { locale: tr }))
    }
    yPos += 3
  }

  // ========== DÜZELTİCİ FAALİYET ==========
  if (incident.correctiveAction) {
    drawSectionHeader("DÜZELTİCİ FAALİYET")
    drawTextBlock(incident.correctiveAction)
  }

  // ========== ÖNLEYİCİ FAALİYET ==========
  if (incident.preventiveAction) {
    drawSectionHeader("ÖNLEYİCİ FAALİYET")
    drawTextBlock(incident.preventiveAction)
  }

  // ========== KAPATMA ==========
  if (incident.closureNotes) {
    drawSectionHeader("KAPATMA NOTLARI")
    drawTextBlock(incident.closureNotes)
    if (incident.closedAt) {
      drawInfoRow("Kapatma Tarihi", format(toDate(incident.closedAt), "d MMMM yyyy HH:mm", { locale: tr }))
    }
    yPos += 3
  }

  // ========== ÖĞRENİLEN DERSLER ==========
  if (incident.lessonsLearned) {
    drawSectionHeader("ÖĞRENİLEN DERSLER")
    drawTextBlock(incident.lessonsLearned)
  }

  // ========== İLİŞKİLİ KONTROLLER VE RİSKLER ==========
  if (incident.relatedControls || (incident.relatedRiskIds && incident.relatedRiskIds.length > 0)) {
    drawSectionHeader("İLİŞKİLİ KONTROLLER VE RİSKLER")
    if (incident.relatedControls) {
      drawInfoRow("Kontroller", incident.relatedControls)
    }
    if (incident.relatedRiskIds && incident.relatedRiskIds.length > 0) {
      drawInfoRow("İlişkili Riskler", incident.relatedRiskIds.join(", "))
    }
    yPos += 3
  }

  // ========== ZAMAN ÇİZELGESİ ==========
  if (incident.timeline.length > 0) {
    drawSectionHeader("ZAMAN ÇİZELGESİ")

    incident.timeline.forEach((entry) => {
      checkPageBreak(12)

      // Tarih
      doc.setFont("Poppins", "semibold")
      doc.setFontSize(8)
      doc.setTextColor(...accentColor)
      const dateStr = format(toDate(entry.performedAt), "dd.MM.yyyy HH:mm", { locale: tr })
      doc.text(dateStr, margin + 2, yPos)

      // Aksiyon
      doc.setFont("Poppins", "semibold")
      doc.setFontSize(8)
      doc.setTextColor(...primaryColor)
      doc.text(entry.action, margin + 40, yPos)

      yPos += 4

      // Açıklama
      if (entry.description) {
        doc.setFont("Poppins", "normal")
        doc.setFontSize(7.5)
        doc.setTextColor(...mediumGray)
        const descLines = doc.splitTextToSize(entry.description, contentWidth - 42)
        descLines.forEach((line: string) => {
          doc.text(line, margin + 40, yPos)
          yPos += 3.5
        })
      }

      // Kişi
      if (entry.performedByName) {
        doc.setFont("Poppins", "normal")
        doc.setFontSize(7)
        doc.setTextColor(...mediumGray)
        doc.text(`— ${entry.performedByName}`, margin + 40, yPos)
        yPos += 3.5
      }

      yPos += 2

      // Ayırıcı çizgi
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.1)
      doc.line(margin + 2, yPos, pageWidth - margin - 2, yPos)
      yPos += 3
    })
  }

  // ========== TARİH ÖZETİ ==========
  checkPageBreak(30)
  drawSectionHeader("TARİH ÖZETİ")

  const dateEntries: [string, string][] = [
    ["Tespit Tarihi", format(toDate(incident.detectedAt), "d MMMM yyyy HH:mm", { locale: tr })],
    ["Raporlama Tarihi", format(toDate(incident.reportedAt), "d MMMM yyyy HH:mm", { locale: tr })],
  ]
  if (incident.containmentAt) {
    dateEntries.push(["Kontrol Altına Alınma", format(toDate(incident.containmentAt), "d MMMM yyyy HH:mm", { locale: tr })])
  }
  if (incident.rootCauseAnalyzedAt) {
    dateEntries.push(["Kök Neden Analizi", format(toDate(incident.rootCauseAnalyzedAt), "d MMMM yyyy HH:mm", { locale: tr })])
  }
  if (incident.resolvedAt) {
    dateEntries.push(["Çözüm Tarihi", format(toDate(incident.resolvedAt), "d MMMM yyyy HH:mm", { locale: tr })])
  }
  if (incident.closedAt) {
    dateEntries.push(["Kapatma Tarihi", format(toDate(incident.closedAt), "d MMMM yyyy HH:mm", { locale: tr })])
  }

  dateEntries.forEach(([label, value]) => {
    drawInfoRow(label, value)
  })

  yPos += 5

  // ========== İMZA ==========
  checkPageBreak(45)
  drawSectionHeader("ONAY")

  doc.setFont("Poppins", "semibold")
  doc.setFontSize(9)
  doc.setTextColor(...darkGray)

  // Sol: Raporu Hazırlayan
  doc.text("Raporu Hazırlayan:", margin + 2, yPos)
  yPos += 3

  const sigBoxWidth = (contentWidth - 10) / 2

  drawDigitalSignatureBox(
    margin + 2, yPos,
    sigBoxWidth - 4, 27,
    incident.signerName,
    incident.signerEmail,
    incident.signerTitle,
    format(new Date(), "dd.MM.yyyy HH:mm")
  )

  // Sağ: BGYS Sorumlusu
  const rightX = margin + sigBoxWidth + 10
  doc.setFont("Poppins", "semibold")
  doc.setFontSize(9)
  doc.setTextColor(...darkGray)
  doc.text("BGYS Sorumlusu:", rightX, yPos - 3)

  drawDigitalSignatureBox(
    rightX, yPos,
    sigBoxWidth - 4, 27,
    incident.signerName,
    incident.signerEmail,
    incident.signerTitle,
    format(new Date(), "dd.MM.yyyy HH:mm")
  )

  yPos += 32

  // ========== FOOTER ==========
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont("Poppins", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...mediumGray)
    doc.text(`Sayfa ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" })
    doc.text(
      `Doküman No: ${incident.incidentNumber} | ISO 27001 BGYS Olay Raporu | ILERIHub`,
      margin,
      pageHeight - 10
    )
  }

  return Buffer.from(doc.output("arraybuffer"))
}
