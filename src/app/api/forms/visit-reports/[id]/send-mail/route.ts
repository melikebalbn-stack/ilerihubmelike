import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendVisitReportEmail, VisitReportEmailData, EmailRecipient } from "@/lib/email"
import { VisitReportForPDF } from "@/lib/pdf/visit-report-pdf-server"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { requireUser } from "@/lib/auth/require-user"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-forms: requireUser — sentBy/sentByName audit log + email gönderimi
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const { recipients } = body

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: "En az bir alıcı gerekli" }, { status: 400 })
    }

    // Raporu getir
    const report = await prisma.visitReport.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        participants: { orderBy: { createdAt: 'asc' } },
        actionItems: { orderBy: { createdAt: 'asc' } }
      }
    })

    if (!report) {
      return NextResponse.json({ error: "Rapor bulunamadı" }, { status: 404 })
    }

    // Geçerli alıcıları filtrele
    const validRecipients: EmailRecipient[] = recipients
      .filter((r: { name?: string; email?: string }) => r.email && r.email.includes('@'))
      .map((r: { name?: string; email?: string }) => ({
        name: r.name || r.email!.split('@')[0],
        email: r.email!.toLowerCase() // PR-EMAIL-NORMALIZE
      }))

    if (validRecipients.length === 0) {
      return NextResponse.json({ error: "Geçerli alıcı bulunamadı" }, { status: 400 })
    }

    // Tarih formatla
    const formatDate = (date: Date) => {
      try {
        return format(date, 'd MMMM yyyy', { locale: tr })
      } catch {
        return date.toISOString().split('T')[0]
      }
    }

    // Katılımcıları ayır
    const ourPeople = report.participants
      .filter(p => p.company === 'ILERI_GROUP')
      .map(p => ({
        name: p.name,
        title: p.title || undefined,
        company: p.company as 'ILERI_GROUP' | 'VISITED_COMPANY'
      }))

    const theirPeople = report.participants
      .filter(p => p.company === 'VISITED_COMPANY')
      .map(p => ({
        name: p.name,
        title: p.title || undefined,
        company: p.company as 'ILERI_GROUP' | 'VISITED_COMPANY'
      }))

    const emailData: VisitReportEmailData = {
      reportNumber: report.reportNumber,
      visitDate: formatDate(report.visitDate),
      endDate: report.endDate ? formatDate(report.endDate) : undefined,
      visitTime: report.visitTime,
      companyName: report.companyName,
      visitType: report.visitType,
      location: report.location || undefined,
      project: report.project || undefined,
      meetingSummary: report.meetingSummary,
      additionalNotes: report.additionalNotes || undefined,
      nextSteps: report.nextSteps || undefined,
      ourPeople,
      theirPeople,
      actionItems: report.actionItems.map(a => ({
        description: a.description,
        responsible: a.responsible,
        dueDate: a.dueDate ? formatDate(a.dueDate) : undefined,
        status: a.status
      })),
      createdByName: user.name || user.email || 'Bilinmiyor'
    }

    // PDF için rapor verisi
    const reportForPDF: VisitReportForPDF = {
      reportNumber: report.reportNumber,
      visitDate: report.visitDate,
      endDate: report.endDate,
      visitTime: report.visitTime,
      companyName: report.companyName,
      visitType: report.visitType,
      location: report.location,
      project: report.project,
      meetingSummary: report.meetingSummary,
      additionalNotes: report.additionalNotes,
      nextSteps: report.nextSteps,
      status: report.status,
      createdBy: { name: report.createdBy.name, email: report.createdBy.email },
      participants: report.participants.map(p => ({
        name: p.name,
        title: p.title,
        company: p.company as 'ILERI_GROUP' | 'VISITED_COMPANY'
      })),
      actionItems: report.actionItems.map(a => ({
        description: a.description,
        responsible: a.responsible,
        dueDate: a.dueDate,
        status: a.status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
      })),
      createdAt: report.createdAt
    }

    // Mail gönder
    const result = await sendVisitReportEmail(emailData, validRecipients, reportForPDF)

    if (result.success) {
      // Gönderim logunu kaydet
      await prisma.visitReportEmailLog.create({
        data: {
          reportId: id,
          sentBy: user.email,
          sentByName: user.name || null,
          recipients: JSON.stringify(validRecipients),
        },
      })

      console.log(`✅ Ziyaret raporu e-postası gönderildi: ${report.reportNumber} -> ${validRecipients.map(r => r.email).join(', ')}`)
      return NextResponse.json({ message: "Mail başarıyla gönderildi" })
    } else {
      console.error(`❌ Ziyaret raporu e-postası gönderilemedi: ${report.reportNumber}`, result.error)
      return NextResponse.json({ error: result.error || "Mail gönderilemedi" }, { status: 500 })
    }
  } catch (error) {
    console.error("Mail gönderme hatası:", error)
    return NextResponse.json({ error: "Mail gönderilemedi" }, { status: 500 })
  }
}
