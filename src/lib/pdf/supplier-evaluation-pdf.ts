import { jsPDF } from "jspdf"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { PoppinsRegular, PoppinsBold, PoppinsSemiBold } from "./fonts/poppins"
import { IleriGroupLogo } from "./fonts/logo"

export interface SupplierEvaluationForPDF {
  evaluationNo: string
  companyName: string
  serviceType: string
  evaluationDate: string
  period?: string
  criteriaScores: Array<{
    code: string
    name: string
    description?: string
    maxScore: number
    score: number
    notes?: string
  }>
  totalScore: number
  resultGroup: string // A_APPROVED, B_CANDIDATE, C_REJECTED
  isApproved: boolean
  evaluatorName: string
  evaluatorTitle?: string
  generalNotes?: string
  improvements?: string
}

const serviceTypeLabels: Record<string, string> = {
  IT_SERVICES: "BT Hizmetleri",
  CLOUD_SERVICES: "Bulut Hizmetleri",
  SECURITY_SERVICES: "Güvenlik Hizmetleri",
  MAINTENANCE: "Bakım Hizmetleri",
  TELECOM: "Telekomünikasyon",
  CONSULTING: "Danışmanlık",
  CLEANING: "Temizlik",
  SECURITY_PHYSICAL: "Fiziksel Güvenlik",
  TRANSPORTATION: "Taşımacılık / Lojistik",
  CATERING: "Yemek Hizmeti",
  TRAINING: "Eğitim Hizmeti",
  OTHER: "Diğer",
}

const groupLabels: Record<string, { label: string; description: string }> = {
  A_APPROVED: { label: "A Grubu", description: "Firma tedarikçi olarak yeterlidir – Onaylı Tedarikçi Listesine Girebilir" },
  B_CANDIDATE: { label: "B Grubu", description: "Eksiklikleri var ama çalışılabilir – Aday Tedarikçi Listesine Girebilir" },
  C_REJECTED: { label: "C Grubu", description: "Firma tedarikçi olarak şu an için yetersizdir – Listeye Giremez" },
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

export async function generateSupplierEvaluationPDFBuffer(evaluation: SupplierEvaluationForPDF): Promise<Buffer> {
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
  const accentColor: [number, number, number] = [37, 99, 235] // Mavi - tedarikçi değerlendirme için
  const lightGray: [number, number, number] = [245, 247, 250]
  const darkGray: [number, number, number] = [80, 80, 80]
  const mediumGray: [number, number, number] = [120, 120, 120]
  const greenColor: [number, number, number] = [34, 197, 94]
  const redColor: [number, number, number] = [220, 53, 69]
  const orangeColor: [number, number, number] = [255, 152, 0]

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
  doc.setFontSize(12)
  doc.setTextColor(...accentColor)
  doc.text("TEDARİKÇİ DEĞERLENDİRME FORMU", pageWidth - margin, yPos + 4, { align: "right" })

  doc.setFont("Poppins", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...mediumGray)
  doc.text("FR_SA_01 | HİZMET ALIMLARINDA KULLANILACAKTIR", pageWidth - margin, yPos + 9, { align: "right" })

  yPos += 20

  // Separator line
  doc.setDrawColor(...accentColor)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 8

  // ========== FİRMA BİLGİLERİ ==========
  drawSectionHeader("FİRMA VE DEĞERLENDİRME BİLGİLERİ")

  drawInfoRow("Firma Adı", evaluation.companyName)
  drawInfoRow("Değerlendirme No", evaluation.evaluationNo)
  drawInfoRow("Tarih", format(toDate(evaluation.evaluationDate), "d MMMM yyyy", { locale: tr }))
  if (evaluation.period) {
    drawInfoRow("Dönem", evaluation.period)
  }
  drawInfoRow("Hizmet Türü", serviceTypeLabels[evaluation.serviceType] || evaluation.serviceType)

  yPos += 3

  // ========== KRİTER TABLOSU ==========
  drawSectionHeader("DEĞERLENDİRME KRİTERLERİ")

  // Table configuration
  const colNo = 12
  const colName = 70
  const colMax = 22
  const colScore = 22
  const colNotes = contentWidth - colNo - colName - colMax - colScore
  const tableX = margin
  const headerHeight = 8
  const rowHeight = 8

  // Calculate total rows needed for page break check
  const totalTableHeight = headerHeight + (evaluation.criteriaScores.length + 1) * rowHeight + 2
  checkPageBreak(totalTableHeight)

  // Table header
  doc.setFillColor(...primaryColor)
  doc.rect(tableX, yPos, contentWidth, headerHeight, "F")

  doc.setFont("Poppins", "bold")
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)

  let colX = tableX
  doc.text("No", colX + 3, yPos + 5.5)
  colX += colNo
  doc.text("Değerlendirme Konuları", colX + 3, yPos + 5.5)
  colX += colName
  doc.text("Max Puan", colX + 2, yPos + 5.5)
  colX += colMax
  doc.text("Puan", colX + 4, yPos + 5.5)
  colX += colScore
  doc.text("Açıklama", colX + 3, yPos + 5.5)

  yPos += headerHeight

  // Table rows
  let maxScoreSum = 0
  evaluation.criteriaScores.forEach((criterion, index) => {
    const isEvenRow = index % 2 === 0
    if (isEvenRow) {
      doc.setFillColor(...lightGray)
      doc.rect(tableX, yPos, contentWidth, rowHeight, "F")
    }

    // Draw cell borders
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.2)
    doc.rect(tableX, yPos, contentWidth, rowHeight, "S")

    // Vertical lines
    let vx = tableX + colNo
    doc.line(vx, yPos, vx, yPos + rowHeight)
    vx += colName
    doc.line(vx, yPos, vx, yPos + rowHeight)
    vx += colMax
    doc.line(vx, yPos, vx, yPos + rowHeight)
    vx += colScore
    doc.line(vx, yPos, vx, yPos + rowHeight)

    // Cell content
    doc.setFont("Poppins", "semibold")
    doc.setFontSize(8)
    doc.setTextColor(...primaryColor)

    colX = tableX
    doc.text(criterion.code, colX + 3, yPos + 5.5)

    colX += colNo
    doc.setFont("Poppins", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...darkGray)
    const nameLines = doc.splitTextToSize(criterion.name, colName - 6)
    doc.text(nameLines[0] || "", colX + 3, yPos + 5.5)

    colX += colName
    doc.setFont("Poppins", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...mediumGray)
    doc.text(String(criterion.maxScore), colX + 8, yPos + 5.5, { align: "center" })

    colX += colMax
    // Color score based on percentage
    const scorePercent = criterion.maxScore > 0 ? criterion.score / criterion.maxScore : 0
    if (scorePercent >= 0.7) {
      doc.setTextColor(...greenColor)
    } else if (scorePercent >= 0.5) {
      doc.setTextColor(...orangeColor)
    } else {
      doc.setTextColor(...redColor)
    }
    doc.setFont("Poppins", "bold")
    doc.text(String(criterion.score), colX + 8, yPos + 5.5, { align: "center" })

    colX += colScore
    doc.setFont("Poppins", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...mediumGray)
    const notesText = criterion.notes || "-"
    const notesLines = doc.splitTextToSize(notesText, colNotes - 6)
    doc.text(notesLines[0] || "", colX + 3, yPos + 5.5)

    maxScoreSum += criterion.maxScore
    yPos += rowHeight
  })

  // Total row
  doc.setFillColor(230, 236, 245)
  doc.rect(tableX, yPos, contentWidth, rowHeight + 1, "F")
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.2)
  doc.rect(tableX, yPos, contentWidth, rowHeight + 1, "S")

  // Vertical lines for total row
  let tvx = tableX + colNo
  doc.line(tvx, yPos, tvx, yPos + rowHeight + 1)
  tvx += colName
  doc.line(tvx, yPos, tvx, yPos + rowHeight + 1)
  tvx += colMax
  doc.line(tvx, yPos, tvx, yPos + rowHeight + 1)
  tvx += colScore
  doc.line(tvx, yPos, tvx, yPos + rowHeight + 1)

  doc.setFont("Poppins", "bold")
  doc.setFontSize(9)
  doc.setTextColor(...primaryColor)
  doc.text("TOPLAM", tableX + colNo + 3, yPos + 6)
  doc.text(String(maxScoreSum), tableX + colNo + colName + 8, yPos + 6, { align: "center" })
  doc.text(String(evaluation.totalScore), tableX + colNo + colName + colMax + 8, yPos + 6, { align: "center" })

  yPos += rowHeight + 5

  // ========== SONUÇ ==========
  checkPageBreak(40)
  drawSectionHeader("DEĞERLENDİRME SONUCU")

  // Toplam Puan
  drawInfoRow("Toplam Puan", `${evaluation.totalScore} / ${maxScoreSum}`)

  // Grup
  const group = groupLabels[evaluation.resultGroup]
  if (group) {
    drawInfoRow("Grup", `${group.label} – ${group.description}`)
  } else {
    drawInfoRow("Grup", evaluation.resultGroup)
  }

  // Sonuç banner
  yPos += 2
  const isApproved = evaluation.isApproved
  const resultColor: [number, number, number] = isApproved ? greenColor : redColor
  const resultText = isApproved ? "UYGUN" : "UYGUN DEĞİL"

  doc.setFillColor(...resultColor)
  doc.roundedRect(margin, yPos, contentWidth, 10, 2, 2, "F")
  doc.setFont("Poppins", "bold")
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`SONUÇ: ${resultText}`, pageWidth / 2, yPos + 7, { align: "center" })
  yPos += 15

  // ========== DEĞERLENDİREN ==========
  checkPageBreak(30)
  drawSectionHeader("DEĞERLENDİREN BİLGİLERİ")

  drawInfoRow("Değerlendiren", evaluation.evaluatorName)
  if (evaluation.evaluatorTitle) {
    drawInfoRow("Görevi", evaluation.evaluatorTitle)
  }

  yPos += 3

  // ========== GENEL NOTLAR ==========
  if (evaluation.generalNotes) {
    checkPageBreak(20)
    drawSectionHeader("GENEL NOTLAR")
    drawTextBlock(evaluation.generalNotes)
  }

  // ========== İYİLEŞTİRME ÖNERİLERİ ==========
  if (evaluation.improvements) {
    checkPageBreak(20)
    drawSectionHeader("İYİLEŞTİRME ÖNERİLERİ")
    drawTextBlock(evaluation.improvements)
  }

  // ========== FOOTER ==========
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont("Poppins", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...mediumGray)
    doc.text(`Sayfa ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" })
    doc.text(
      `Doküman No: ${evaluation.evaluationNo} | FR_SA_01 Tedarikçi Değerlendirme Formu | ILERIHub`,
      margin,
      pageHeight - 10
    )
  }

  return Buffer.from(doc.output("arraybuffer"))
}
