import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { PoppinsRegular, PoppinsBold, PoppinsSemiBold } from "./fonts/poppins"
import { IleriGroupLogo } from "./fonts/logo"

interface Participant {
  id?: string
  name: string
  title: string | null
  company: "ILERI_GROUP" | "VISITED_COMPANY"
}

interface ActionItem {
  id?: string
  description: string
  responsible: string
  dueDate: Date | string | null
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
}

export interface VisitReportForPDF {
  id?: string
  reportNumber: string
  visitDate: Date | string
  endDate: Date | string | null
  visitTime: string
  companyName: string
  visitType: string
  location: string | null
  project: string | null
  meetingSummary: string
  additionalNotes: string | null
  nextSteps: string | null
  status: string
  createdBy: { id?: string; name: string | null; email: string; department?: string | null }
  participants: Participant[]
  actionItems: ActionItem[]
  createdAt: Date | string
}

const visitTypeLabels: Record<string, string> = {
  CUSTOMER: "Müşteri Ziyareti",
  SUPPLIER: "Tedarikçi Ziyareti",
  FAIR: "Fuar/Etkinlik",
  TECHNICAL: "Teknik Görüşme",
  AUDIT: "Denetim/Audit",
  TRAINING: "Eğitim",
  OTHER: "Diğer"
}

const actionStatusLabels: Record<string, string> = {
  PENDING: "Bekliyor",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal"
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

export function generateVisitReportPDFBuffer(report: VisitReportForPDF): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
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

  // Helper: Page break check
  function checkPageBreak(requiredSpace: number) {
    if (yPos + requiredSpace > pageHeight - 25) {
      doc.addPage()
      yPos = margin + 5
      return true
    }
    return false
  }

  // Helper: Section title
  function addSectionTitle(title: string) {
    checkPageBreak(18)

    doc.setFillColor(...primaryColor)
    doc.roundedRect(margin, yPos, contentWidth, 9, 1, 1, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont("Poppins", "semibold")
    doc.text(title, margin + 5, yPos + 6.2)

    yPos += 14
    doc.setTextColor(0, 0, 0)
  }

  // Helper: Info row
  function addInfoRow(label: string, value: string) {
    checkPageBreak(8)

    doc.setFontSize(9)
    doc.setFont("Poppins", "semibold")
    doc.setTextColor(...mediumGray)
    doc.text(label, margin + 3, yPos)

    doc.setFont("Poppins", "normal")
    doc.setTextColor(...darkGray)
    const labelWidth = 35
    const valueLines = doc.splitTextToSize(value, contentWidth - labelWidth - 10)
    doc.text(valueLines, margin + labelWidth, yPos)

    yPos += valueLines.length * 5 + 2
  }

  // Helper: Content with left accent border
  function addContentWithAccent(text: string, accentColorRGB: [number, number, number]) {
    doc.setFontSize(9)
    doc.setFont("Poppins", "normal")
    doc.setTextColor(...darkGray)

    const lines = doc.splitTextToSize(text, contentWidth - 12)

    lines.forEach((line: string) => {
      checkPageBreak(6)
      doc.setFillColor(...accentColorRGB)
      doc.rect(margin, yPos - 3.5, 2, 5, "F")
      doc.text(line, margin + 8, yPos)
      yPos += 5
    })
  }

  // =====================================================
  // HEADER - White background with logo
  // =====================================================

  // White header background
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, pageWidth, 28, "F")

  // Blue accent stripe at bottom of header
  doc.setFillColor(...primaryColor)
  doc.rect(0, 28, pageWidth, 3, "F")

  // Logo
  try {
    const logoWidth = 35
    const logoHeight = logoWidth / 3.41
    doc.addImage(IleriGroupLogo, "PNG", margin, 6, logoWidth, logoHeight)
  } catch {
    doc.setTextColor(...primaryColor)
    doc.setFontSize(16)
    doc.setFont("Poppins", "bold")
    doc.text("İLERİ GROUP", margin, 16)
  }

  // Report info on right side (smaller)
  doc.setTextColor(...primaryColor)
  doc.setFontSize(10)
  doc.setFont("Poppins", "bold")
  doc.text(report.reportNumber, pageWidth - margin, 12, { align: "right" })

  doc.setFontSize(7)
  doc.setFont("Poppins", "normal")
  doc.setTextColor(...mediumGray)
  doc.text("Ziyaret Raporu", pageWidth - margin, 18, { align: "right" })

  // Creation date
  doc.setFontSize(6)
  doc.text(`${format(toDate(report.createdAt), "dd.MM.yyyy HH:mm")}`, pageWidth - margin, 24, { align: "right" })

  yPos = 38

  // =====================================================
  // TEMEL BİLGİLER
  // =====================================================
  addSectionTitle("TEMEL BİLGİLER")

  let infoRows = 3
  if (report.endDate) infoRows++
  if (report.location) infoRows++
  if (report.project) infoRows++
  const infoCardHeight = (infoRows + 1) * 7 + 4

  doc.setFillColor(...lightGray)
  doc.roundedRect(margin, yPos - 2, contentWidth, infoCardHeight, 2, 2, "F")
  yPos += 3

  const visitDateStr = format(toDate(report.visitDate), "d MMMM yyyy, EEEE", { locale: tr })
  addInfoRow("Ziyaret Tarihi", visitDateStr)

  if (report.endDate) {
    const endDateStr = format(toDate(report.endDate), "d MMMM yyyy", { locale: tr })
    addInfoRow("Bitiş Tarihi", endDateStr)
  }

  addInfoRow("Saat", report.visitTime)
  addInfoRow("Firma", report.companyName)
  addInfoRow("Ziyaret Türü", visitTypeLabels[report.visitType] || report.visitType)

  if (report.location) {
    addInfoRow("Konum", report.location)
  }

  if (report.project) {
    addInfoRow("Proje/Konu", report.project)
  }

  yPos += 6

  // =====================================================
  // KATILIMCILAR
  // =====================================================
  addSectionTitle("KATILIMCILAR")

  const ourPeople = report.participants.filter(p => p.company === "ILERI_GROUP")
  const theirPeople = report.participants.filter(p => p.company === "VISITED_COMPANY")

  const colWidth = (contentWidth - 10) / 2
  const startY = yPos

  if (ourPeople.length > 0) {
    const colHeight = ourPeople.length * 5 + 12
    doc.setFillColor(...lightGray)
    doc.roundedRect(margin, yPos - 2, colWidth, colHeight, 2, 2, "F")

    doc.setFontSize(9)
    doc.setFont("Poppins", "semibold")
    doc.setTextColor(...primaryColor)
    doc.text("İleri Group", margin + 4, yPos + 4)

    let tempY = yPos + 10
    doc.setFont("Poppins", "normal")
    doc.setTextColor(...darkGray)
    doc.setFontSize(8)

    ourPeople.forEach(p => {
      const text = p.title ? `• ${p.name} - ${p.title}` : `• ${p.name}`
      doc.text(text, margin + 5, tempY)
      tempY += 5
    })
  }

  if (theirPeople.length > 0) {
    const colX = margin + colWidth + 10
    const colHeight = theirPeople.length * 5 + 12
    doc.setFillColor(235, 245, 255)
    doc.roundedRect(colX, yPos - 2, colWidth, colHeight, 2, 2, "F")

    doc.setFontSize(9)
    doc.setFont("Poppins", "semibold")
    doc.setTextColor(...accentColor)
    doc.text(report.companyName, colX + 4, yPos + 4)

    let tempY = yPos + 10
    doc.setFont("Poppins", "normal")
    doc.setTextColor(...darkGray)
    doc.setFontSize(8)

    theirPeople.forEach(p => {
      const text = p.title ? `• ${p.name} - ${p.title}` : `• ${p.name}`
      doc.text(text, colX + 5, tempY)
      tempY += 5
    })
  }

  const ourHeight = ourPeople.length > 0 ? ourPeople.length * 5 + 12 : 0
  const theirHeight = theirPeople.length > 0 ? theirPeople.length * 5 + 12 : 0
  yPos = startY + Math.max(ourHeight, theirHeight) + 6

  // =====================================================
  // GÖRÜŞME ÖZETİ
  // =====================================================
  addSectionTitle("GÖRÜŞME ÖZETİ")
  addContentWithAccent(report.meetingSummary, [41, 128, 185])
  yPos += 6

  // =====================================================
  // AKSİYON MADDELERİ
  // =====================================================
  if (report.actionItems && report.actionItems.length > 0) {
    addSectionTitle("AKSİYON MADDELERİ")

    const tableData = report.actionItems.map((item, index) => [
      (index + 1).toString(),
      item.description,
      item.responsible,
      item.dueDate ? format(toDate(item.dueDate), "dd.MM.yyyy") : "-",
      actionStatusLabels[item.status] || item.status
    ])

    autoTable(doc, {
      startY: yPos,
      head: [["#", "Aksiyon", "Sorumlu", "Termin", "Durum"]],
      body: tableData,
      theme: "grid",
      styles: {
        font: "Poppins",
        fontSize: 8,
        cellPadding: 3
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
        halign: "center"
      },
      bodyStyles: {
        fontSize: 8,
        textColor: darkGray
      },
      alternateRowStyles: {
        fillColor: lightGray
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 32 },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 24, halign: "center" }
      },
      margin: { left: margin, right: margin }
    })

    const docWithTable = doc as unknown as { lastAutoTable?: { finalY: number } }
    if (docWithTable.lastAutoTable) {
      yPos = docWithTable.lastAutoTable.finalY + 8
    }
  }

  // =====================================================
  // EK NOTLAR
  // =====================================================
  if (report.additionalNotes) {
    addSectionTitle("EK NOTLAR")
    addContentWithAccent(report.additionalNotes, [230, 126, 34])
    yPos += 6
  }

  // =====================================================
  // SONRAKI ADIMLAR
  // =====================================================
  if (report.nextSteps) {
    addSectionTitle("SONRAKI ADIMLAR")
    addContentWithAccent(report.nextSteps, [39, 174, 96])
    yPos += 6
  }

  // =====================================================
  // FOOTER
  // =====================================================
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    doc.setFillColor(...primaryColor)
    doc.rect(0, pageHeight - 12, pageWidth, 12, "F")

    doc.setFont("Poppins", "normal")
    doc.setFontSize(7)
    doc.setTextColor(255, 255, 255)

    doc.text(`Doküman No: ${report.reportNumber}`, margin, pageHeight - 5)
    doc.text(`Oluşturan: ${report.createdBy.name || report.createdBy.email}`, pageWidth / 2, pageHeight - 5, { align: "center" })
    doc.text(`Sayfa ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: "right" })
  }

  const arrayBuffer = doc.output("arraybuffer")
  return Buffer.from(arrayBuffer)
}
