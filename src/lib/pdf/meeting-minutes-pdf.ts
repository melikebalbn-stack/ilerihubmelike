import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { PoppinsRegular, PoppinsBold, PoppinsSemiBold } from "./fonts/poppins"
import { IleriGroupLogo } from "./fonts/logo"

interface MeetingAttendee {
  id: string
  userId: string | null
  externalName: string | null
  externalEmail: string | null
  externalCompany: string | null
  externalTitle: string | null
  role: string
  attendanceStatus: string
  user: {
    id: string
    name: string
    email: string
    department: string | null
    jobTitle: string | null
  } | null
}

interface MeetingAgendaItem {
  id: string
  orderNo: number
  title: string
  description: string | null
  presenterName: string | null
  plannedDuration: number | null
  discussionNotes: string | null
  outcome: string | null
  outcomeNotes: string | null
  presenter: {
    id: string
    name: string
  } | null
}

interface MeetingDecision {
  id: string
  decisionNumber: string
  title: string
  description: string | null
  responsibleId: string | null
  dueDate: string | null
  priority: string
  status: string
  responsible: {
    id: string
    name: string
  } | null
}

export interface MeetingForPDF {
  id: string
  meetingNumber: string
  title: string
  description: string | null
  meetingType: string
  scheduledDate: string
  startTime: string | null
  endTime: string | null
  location: string | null
  isOnline: boolean
  onlineLink: string | null
  status: string
  department: string | null
  openingRemarks: string | null
  closingRemarks: string | null
  generalNotes: string | null
  minutesApproved: boolean
  minutesApprovedAt: string | null
  organizer: {
    id: string
    name: string
    department: string | null
  }
  chairman: {
    id: string
    name: string
    department: string | null
  } | null
  rapporteur: {
    id: string
    name: string
    department: string | null
  } | null
  minutesApprovedBy: {
    id: string
    name: string
  } | null
  attendees: MeetingAttendee[]
  agendaItems: MeetingAgendaItem[]
  decisions: MeetingDecision[]
}

const meetingTypeLabels: Record<string, string> = {
  BOARD: "Yönetim Kurulu Toplantısı",
  DEPARTMENT: "Departman Toplantısı",
  PROJECT: "Proje Toplantısı",
  TRAINING: "Eğitim Toplantısı",
  REVIEW: "Gözden Geçirme Toplantısı",
  AUDIT: "Denetim Toplantısı",
  CUSTOMER: "Müşteri Toplantısı",
  SUPPLIER: "Tedarikçi Toplantısı",
  SAFETY: "Güvenlik Komitesi Toplantısı",
  QUALITY: "Kalite Toplantısı",
  OTHER: "Diğer",
}

const attendanceStatusLabels: Record<string, string> = {
  UNKNOWN: "-",
  PRESENT: "Katıldı",
  ABSENT: "Katılmadı",
  LATE: "Geç Geldi",
  LEFT_EARLY: "Erken Ayrıldı",
}

const roleLabels: Record<string, string> = {
  CHAIRMAN: "Başkan",
  RAPPORTEUR: "Raportör",
  PRESENTER: "Sunucu",
  PARTICIPANT: "Katılımcı",
  OBSERVER: "Gözlemci",
}

const outcomeLabels: Record<string, string> = {
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
  POSTPONED: "Ertelendi",
  NEEDS_REVIEW: "İnceleme Gerekiyor",
  NOTED: "Not Alındı",
}

const priorityLabels: Record<string, string> = {
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  URGENT: "Acil",
}

const decisionStatusLabels: Record<string, string> = {
  PENDING: "Bekliyor",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal Edildi",
  OVERDUE: "Gecikti",
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

// Extract time (HH:mm) from datetime - converts to Turkey time (UTC+3)
function extractTime(dateString: string | null): string {
  if (!dateString) return "-"
  try {
    const date = new Date(dateString)
    // Convert UTC to Turkey time (UTC+3)
    const turkeyOffset = 3 * 60 // 3 hours in minutes
    const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000)
    const turkeyTime = new Date(utcTime + (turkeyOffset * 60000))
    const hours = turkeyTime.getHours().toString().padStart(2, '0')
    const minutes = turkeyTime.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  } catch {
    return "-"
  }
}

export function generateMeetingMinutesPDFBuffer(meeting: MeetingForPDF): Buffer {
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

    // Handle multi-line text properly (split by newlines first, then by width)
    const textValue = value || "-"
    const paragraphs = textValue.split(/\r?\n/)
    let allLines: string[] = []

    paragraphs.forEach((para) => {
      if (para.trim()) {
        const wrappedLines = doc.splitTextToSize(para, contentWidth - labelWidth - 5)
        allLines = allLines.concat(wrappedLines)
      } else {
        // Empty line - add a spacer
        allLines.push("")
      }
    })

    // Draw first line next to label
    if (allLines.length > 0) {
      doc.text(allLines[0], margin + labelWidth, yPos)
      yPos += 4

      // Draw remaining lines
      for (let i = 1; i < allLines.length; i++) {
        if (allLines[i]) {
          doc.text(allLines[i], margin + labelWidth, yPos)
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
  doc.setFontSize(14)
  doc.setTextColor(...primaryColor)
  doc.text("TOPLANTI TUTANAĞI", pageWidth - margin, yPos + 5, { align: "right" })

  doc.setFont("Poppins", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...mediumGray)
  doc.text(meeting.meetingNumber, pageWidth - margin, yPos + 10, { align: "right" })

  yPos += 20

  // Separator line
  doc.setDrawColor(...accentColor)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 8

  // ========== MEETING INFO ==========
  drawSectionHeader("TOPLANTI BİLGİLERİ")

  drawInfoRow("Toplantı Adı", meeting.title)
  drawInfoRow("Toplantı Türü", meetingTypeLabels[meeting.meetingType] || meeting.meetingType)
  drawInfoRow("Tarih", format(toDate(meeting.scheduledDate), "d MMMM yyyy EEEE", { locale: tr }))

  if (meeting.startTime || meeting.endTime) {
    const timeStr = `${extractTime(meeting.startTime)} - ${extractTime(meeting.endTime)}`
    drawInfoRow("Saat", timeStr)
  }

  if (meeting.isOnline) {
    drawInfoRow("Konum", "Online Toplantı")
  } else if (meeting.location) {
    drawInfoRow("Konum", meeting.location)
  }

  if (meeting.department) {
    drawInfoRow("Departman", meeting.department)
  }

  if (meeting.description) {
    drawInfoRow("Açıklama", meeting.description, 40)
  }

  yPos += 3

  // ========== MANAGERS ==========
  drawSectionHeader("YÖNETİCİLER")

  drawInfoRow("Organizatör", `${meeting.organizer.name}${meeting.organizer.department ? ` (${meeting.organizer.department})` : ""}`)

  if (meeting.chairman) {
    drawInfoRow("Toplantı Başkanı", `${meeting.chairman.name}${meeting.chairman.department ? ` (${meeting.chairman.department})` : ""}`)
  }

  if (meeting.rapporteur) {
    drawInfoRow("Raportör", `${meeting.rapporteur.name}${meeting.rapporteur.department ? ` (${meeting.rapporteur.department})` : ""}`)
  }

  yPos += 3

  // ========== ATTENDEES ==========
  if (meeting.attendees.length > 0) {
    drawSectionHeader("KATILIMCILAR")

    const attendeeData = meeting.attendees.map((att) => [
      att.user?.name || att.externalName || "-",
      att.user?.department || att.externalCompany || (att.externalName ? "Misafir" : "-"),
      att.user?.jobTitle || att.externalTitle || "-",
      roleLabels[att.role] || att.role,
      attendanceStatusLabels[att.attendanceStatus] || att.attendanceStatus,
    ])

    autoTable(doc, {
      startY: yPos,
      head: [["Ad Soyad", "Departman/Şirket", "Ünvan", "Rol", "Durum"]],
      body: attendeeData,
      margin: { left: margin, right: margin },
      styles: {
        font: "Poppins",
        fontSize: 8,
        cellPadding: 2,
        textColor: darkGray,
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
        0: { cellWidth: 40 },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
      },
    })

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // ========== AGENDA ITEMS ==========
  if (meeting.agendaItems.length > 0) {
    checkPageBreak(30)
    drawSectionHeader("GÜNDEM MADDELERİ")

    meeting.agendaItems.forEach((item, index) => {
      checkPageBreak(25)

      // Item header
      doc.setFillColor(...lightGray)
      doc.roundedRect(margin, yPos, contentWidth, 7, 1, 1, "F")
      doc.setFont("Poppins", "bold")
      doc.setFontSize(9)
      doc.setTextColor(...primaryColor)
      doc.text(`${item.orderNo}. ${item.title}`, margin + 3, yPos + 5)

      if (item.outcome) {
        const outcomeText = outcomeLabels[item.outcome] || item.outcome
        doc.setFont("Poppins", "semibold")
        doc.setFontSize(7)
        doc.setTextColor(...accentColor)
        doc.text(`[${outcomeText}]`, pageWidth - margin - 3, yPos + 5, { align: "right" })
      }

      yPos += 10

      // Presenter and duration
      if (item.presenter || item.plannedDuration) {
        doc.setFont("Poppins", "normal")
        doc.setFontSize(8)
        doc.setTextColor(...mediumGray)
        let infoText = ""
        if (item.presenter) infoText += `Sunucu: ${item.presenter.name}`
        if (item.plannedDuration) infoText += `${infoText ? " | " : ""}Süre: ${item.plannedDuration} dk`
        doc.text(infoText, margin + 3, yPos)
        yPos += 5
      }

      // Description
      if (item.description) {
        doc.setFont("Poppins", "normal")
        doc.setFontSize(8)
        doc.setTextColor(...darkGray)
        const descLines = doc.splitTextToSize(item.description, contentWidth - 10)
        descLines.forEach((line: string) => {
          checkPageBreak(5)
          doc.text(line, margin + 3, yPos)
          yPos += 4
        })
      }

      // Discussion notes
      if (item.discussionNotes) {
        yPos += 2
        doc.setFont("Poppins", "semibold")
        doc.setFontSize(8)
        doc.setTextColor(...accentColor)
        doc.text("Tartışma Notları:", margin + 3, yPos)
        yPos += 4
        doc.setFont("Poppins", "normal")
        doc.setTextColor(...darkGray)
        const noteLines = doc.splitTextToSize(item.discussionNotes, contentWidth - 10)
        noteLines.forEach((line: string) => {
          checkPageBreak(5)
          doc.text(line, margin + 3, yPos)
          yPos += 4
        })
      }

      // Outcome notes
      if (item.outcomeNotes) {
        doc.setFont("Poppins", "semibold")
        doc.setFontSize(8)
        doc.setTextColor(...accentColor)
        doc.text("Sonuç Notu:", margin + 3, yPos)
        yPos += 4
        doc.setFont("Poppins", "normal")
        doc.setTextColor(...darkGray)
        const outcomeLines = doc.splitTextToSize(item.outcomeNotes, contentWidth - 10)
        outcomeLines.forEach((line: string) => {
          checkPageBreak(5)
          doc.text(line, margin + 3, yPos)
          yPos += 4
        })
      }

      yPos += 5
    })
  }

  // ========== DECISIONS ==========
  if (meeting.decisions.length > 0) {
    checkPageBreak(30)
    drawSectionHeader("ALINAN KARARLAR")

    const decisionData = meeting.decisions.map((dec) => [
      dec.decisionNumber,
      dec.title,
      dec.responsible?.name || "-",
      dec.dueDate ? format(toDate(dec.dueDate), "dd.MM.yyyy") : "-",
      priorityLabels[dec.priority] || dec.priority,
      decisionStatusLabels[dec.status] || dec.status,
    ])

    autoTable(doc, {
      startY: yPos,
      head: [["No", "Karar", "Sorumlu", "Son Tarih", "Öncelik", "Durum"]],
      body: decisionData,
      margin: { left: margin, right: margin },
      styles: {
        font: "Poppins",
        fontSize: 8,
        cellPadding: 2,
        textColor: darkGray,
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
        0: { cellWidth: 18 },
        1: { cellWidth: 55 },
        2: { cellWidth: 30 },
        3: { cellWidth: 22 },
        4: { cellWidth: 18 },
        5: { cellWidth: 22 },
      },
    })

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }

  // ========== MEETING NOTES ==========
  if (meeting.openingRemarks || meeting.generalNotes || meeting.closingRemarks) {
    checkPageBreak(30)
    drawSectionHeader("TOPLANTI NOTLARI")

    if (meeting.openingRemarks) {
      doc.setFont("Poppins", "semibold")
      doc.setFontSize(9)
      doc.setTextColor(...accentColor)
      doc.text("Açılış Konuşması:", margin + 2, yPos)
      yPos += 5
      doc.setFont("Poppins", "normal")
      doc.setFontSize(8)
      doc.setTextColor(...darkGray)
      const openingLines = doc.splitTextToSize(meeting.openingRemarks, contentWidth - 5)
      openingLines.forEach((line: string) => {
        checkPageBreak(5)
        doc.text(line, margin + 2, yPos)
        yPos += 4
      })
      yPos += 3
    }

    if (meeting.generalNotes) {
      checkPageBreak(15)
      doc.setFont("Poppins", "semibold")
      doc.setFontSize(9)
      doc.setTextColor(...accentColor)
      doc.text("Genel Notlar:", margin + 2, yPos)
      yPos += 5
      doc.setFont("Poppins", "normal")
      doc.setFontSize(8)
      doc.setTextColor(...darkGray)
      const notesLines = doc.splitTextToSize(meeting.generalNotes, contentWidth - 5)
      notesLines.forEach((line: string) => {
        checkPageBreak(5)
        doc.text(line, margin + 2, yPos)
        yPos += 4
      })
      yPos += 3
    }

    if (meeting.closingRemarks) {
      checkPageBreak(15)
      doc.setFont("Poppins", "semibold")
      doc.setFontSize(9)
      doc.setTextColor(...accentColor)
      doc.text("Kapanış Konuşması:", margin + 2, yPos)
      yPos += 5
      doc.setFont("Poppins", "normal")
      doc.setFontSize(8)
      doc.setTextColor(...darkGray)
      const closingLines = doc.splitTextToSize(meeting.closingRemarks, contentWidth - 5)
      closingLines.forEach((line: string) => {
        checkPageBreak(5)
        doc.text(line, margin + 2, yPos)
        yPos += 4
      })
    }
  }

  // ========== APPROVAL ==========
  if (meeting.minutesApproved && meeting.minutesApprovedBy) {
    checkPageBreak(25)
    yPos += 10

    doc.setFillColor(230, 255, 230)
    doc.roundedRect(margin, yPos, contentWidth, 15, 2, 2, "F")
    doc.setDrawColor(34, 197, 94)
    doc.roundedRect(margin, yPos, contentWidth, 15, 2, 2, "S")

    doc.setFont("Poppins", "bold")
    doc.setFontSize(9)
    doc.setTextColor(22, 163, 74)
    doc.text("✓ TUTANAK ONAYLANDI", margin + contentWidth / 2, yPos + 6, { align: "center" })

    doc.setFont("Poppins", "normal")
    doc.setFontSize(8)
    doc.text(
      `Onaylayan: ${meeting.minutesApprovedBy.name} | Tarih: ${meeting.minutesApprovedAt ? format(toDate(meeting.minutesApprovedAt), "dd.MM.yyyy HH:mm") : "-"}`,
      margin + contentWidth / 2,
      yPos + 11,
      { align: "center" }
    )
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
      `Oluşturulma: ${format(new Date(), "dd.MM.yyyy HH:mm")} | ILERIHub`,
      margin,
      pageHeight - 10
    )
  }

  return Buffer.from(doc.output("arraybuffer"))
}
