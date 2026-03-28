import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { PoppinsRegular, PoppinsBold, PoppinsSemiBold } from "./fonts/poppins"
import { IleriGroupLogo } from "./fonts/logo"

interface TrainingParticipant {
  id: string
  name: string
  title?: string | null
  department?: string | null
  email?: string | null
  attended: boolean
  signedAt?: string | null
}

interface TrainingAssignment {
  id: string
  userId: string
  status: string
  signedAt?: string | null
  completedAt?: string | null
  user: {
    id: string
    name: string | null
    email: string
    department: string | null
    jobTitle: string | null
  }
}

export interface TrainingForPDF {
  id: string
  trainingNumber: string
  title: string
  description?: string | null
  trainingType: string
  duration: number
  location?: string | null
  trainerName: string
  trainerTitle?: string | null
  trainerEmail?: string | null
  trainingDate: string
  controlId?: string | null
  status: string
  participants: TrainingParticipant[]
  assignments: TrainingAssignment[]
}

const trainingTypeLabels: Record<string, string> = {
  AWARENESS: "Farkındalık Eğitimi",
  TECHNICAL: "Teknik Eğitim",
  ORIENTATION: "Oryantasyon",
  REFRESHER: "Yenileme Eğitimi",
  SPECIALIZED: "Özel Eğitim",
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

export function generateTrainingFormPDFBuffer(training: TrainingForPDF): Buffer {
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
  function drawInfoRow(label: string, value: string, labelWidth: number = 40) {
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
  doc.text("BGYS EĞİTİM KATILIM FORMU", pageWidth - margin, yPos + 5, { align: "right" })

  doc.setFont("Poppins", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...mediumGray)
  doc.text(training.trainingNumber, pageWidth - margin, yPos + 10, { align: "right" })

  yPos += 20

  // Separator line
  doc.setDrawColor(...accentColor)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 8

  // ========== TRAINING INFO ==========
  drawSectionHeader("EĞİTİM BİLGİLERİ")

  drawInfoRow("Eğitim Konusu", training.title)
  drawInfoRow("Eğitim Türü", trainingTypeLabels[training.trainingType] || training.trainingType)
  drawInfoRow("Tarih", format(toDate(training.trainingDate), "d MMMM yyyy EEEE", { locale: tr }))
  drawInfoRow("Süre", `${training.duration} dakika`)

  if (training.location) {
    drawInfoRow("Lokasyon", training.location)
  }

  yPos += 3

  // ========== TRAINER INFO ==========
  drawSectionHeader("EĞİTİMCİ BİLGİLERİ")

  drawInfoRow("Eğitimci Adı", training.trainerName)
  if (training.trainerTitle) {
    drawInfoRow("Ünvanı", training.trainerTitle)
  }
  if (training.trainerEmail) {
    drawInfoRow("E-posta", training.trainerEmail)
  }

  yPos += 3

  // ========== RELATED CONTROL ==========
  if (training.controlId) {
    drawSectionHeader("İLGİLİ KONTROL")
    drawInfoRow("Kontrol No", training.controlId)
    yPos += 3
  }

  // ========== DESCRIPTION ==========
  if (training.description) {
    drawSectionHeader("EĞİTİM AÇIKLAMASI")
    doc.setFont("Poppins", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...darkGray)
    const descLines = doc.splitTextToSize(training.description, contentWidth - 5)
    descLines.forEach((line: string) => {
      checkPageBreak(5)
      doc.text(line, margin + 2, yPos)
      yPos += 4
    })
    yPos += 5
  }

  // Helper: Draw digital signature box
  function drawDigitalSignatureBox(x: number, y: number, w: number, h: number, name: string, date: string) {
    // Light green background
    doc.setFillColor(240, 253, 244)
    doc.setDrawColor(34, 197, 94)
    doc.setLineWidth(0.4)
    doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD")

    // Checkmark circle
    doc.setFillColor(34, 197, 94)
    doc.circle(x + 4, y + h / 2, 2.2, "F")
    doc.setFont("Poppins", "bold")
    doc.setFontSize(5)
    doc.setTextColor(255, 255, 255)
    doc.text("OK", x + 4, y + h / 2 + 0.7, { align: "center" })

    // Signature text
    doc.setFont("Poppins", "semibold")
    doc.setFontSize(5.5)
    doc.setTextColor(22, 101, 52)
    doc.text("Dijital İmza", x + 8, y + 3.5)

    doc.setFont("Poppins", "normal")
    doc.setFontSize(5)
    doc.setTextColor(34, 100, 50)
    doc.text(name, x + 8, y + 7)
    doc.text(date, x + 8, y + 10)
  }

  // ========== PARTICIPANTS TABLE ==========
  // Combine participants (face-to-face) and assignments (digital) into one table
  const allParticipants: { no: number; name: string; title: string; department: string; signDate: string; signedAt: string | null }[] = []

  // Face-to-face participants
  training.participants.forEach((p, i) => {
    allParticipants.push({
      no: i + 1,
      name: p.name,
      title: p.title || "-",
      department: p.department || "-",
      signDate: p.signedAt ? format(toDate(p.signedAt), "dd.MM.yyyy HH:mm") : "",
      signedAt: p.signedAt || null,
    })
  })

  // Digital assignments
  training.assignments.forEach((a) => {
    allParticipants.push({
      no: allParticipants.length + 1,
      name: a.user.name || a.user.email,
      title: a.user.jobTitle || "-",
      department: a.user.department || "-",
      signDate: a.signedAt ? format(toDate(a.signedAt), "dd.MM.yyyy HH:mm") : "",
      signedAt: a.signedAt || null,
    })
  })

  if (allParticipants.length > 0) {
    drawSectionHeader(`KATILIMCI LİSTESİ (${allParticipants.length} Kişi)`)

    const tableData = allParticipants.map((p) => [
      String(p.no),
      p.name,
      p.title,
      p.department,
      "", // İmza - drawCell ile çizilecek
      p.signDate,
    ])

    autoTable(doc, {
      startY: yPos,
      head: [["No", "Ad Soyad", "Ünvan", "Departman", "İmza", "Tarih"]],
      body: tableData,
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
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 30, minCellHeight: 12 },
        5: { cellWidth: 23 },
      },
      didDrawCell: (data) => {
        // İmza sütunu (index 4), body satırları
        if (data.column.index === 4 && data.section === "body") {
          const { x, y, width, height } = data.cell
          const participant = allParticipants[data.row.index]

          if (participant?.signedAt) {
            // Dijital imza kutusu
            drawDigitalSignatureBox(
              x + 1.5, y + 1,
              width - 3, height - 2,
              participant.name,
              participant.signDate
            )
          } else {
            // Boş imza kutusu (fiziksel imza için)
            doc.setDrawColor(180, 180, 180)
            doc.setLineWidth(0.3)
            doc.rect(x + 2, y + 1, width - 4, height - 2)
          }
        }
      },
    })

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  // ========== TRAINER SIGNATURE ==========
  checkPageBreak(40)
  yPos += 5

  doc.setFont("Poppins", "semibold")
  doc.setFontSize(9)
  doc.setTextColor(...darkGray)
  doc.text("Eğitimci:", margin + 2, yPos)
  doc.setFont("Poppins", "normal")
  doc.text(training.trainerName, margin + 30, yPos)
  yPos += 8

  doc.text("İmza:", margin + 2, yPos)
  // Eğitimci dijital imza kutusu (eğitim tamamlandıysa)
  if (training.status === "COMPLETED") {
    drawDigitalSignatureBox(
      margin + 30, yPos - 4,
      55, 15,
      training.trainerName,
      format(toDate(training.trainingDate), "dd.MM.yyyy")
    )
  } else {
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.rect(margin + 30, yPos - 4, 50, 15)
  }
  yPos += 15

  doc.text("Tarih:", margin + 2, yPos)
  doc.setFont("Poppins", "normal")
  doc.text(format(toDate(training.trainingDate), "dd.MM.yyyy"), margin + 30, yPos)

  // ========== FOOTER ==========
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont("Poppins", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...mediumGray)
    doc.text(`Sayfa ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" })
    doc.text(
      `Doküman No: ${training.trainingNumber} | ISO 27001 BGYS | ILERIHub`,
      margin,
      pageHeight - 10
    )
  }

  return Buffer.from(doc.output("arraybuffer"))
}
