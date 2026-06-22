import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth/require-user"
import { VisitType, VisitReportStatus, ParticipantCompany, ActionItemStatus } from "@/generated/prisma"
import { sendVisitReportEmail, VisitReportEmailData, EmailRecipient } from "@/lib/email"
import { VisitReportForPDF } from "@/lib/pdf/visit-report-pdf-server"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

// PR-FORMS-RBAC: forms.admin permission'ı (eski MANAGEMENT_ROLES enum)

// GET - Tekil rapor getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-forms: requireUser — yönetici/owner kontrolü
    const { session, user: currentUser, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const report = await prisma.visitReport.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, department: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        participants: { orderBy: { createdAt: 'asc' } },
        actionItems: { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } }
      }
    })

    if (!report) {
      return NextResponse.json({ error: "Rapor bulunamadı" }, { status: 404 })
    }

    // Yetki kontrolü: forms.admin veya raporu oluşturan kişi görebilir
    const isManagement = session.user.permissions?.includes('forms.admin') ?? false
    const isOwner = report.createdById === currentUser.id

    if (!isManagement && !isOwner) {
      return NextResponse.json({ error: "Bu raporu görüntüleme yetkiniz yok" }, { status: 403 })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error("Rapor getirilemedi:", error)
    return NextResponse.json({ error: "Rapor getirilemedi" }, { status: 500 })
  }
}

// PUT - Rapor güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-forms: requireUser — yönetici/owner + email gönderimi user.name
    const { session, user: currentUser, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const body = await request.json()

    const existingReport = await prisma.visitReport.findUnique({
      where: { id }
    })

    if (!existingReport) {
      return NextResponse.json({ error: "Rapor bulunamadı" }, { status: 404 })
    }

    // Yetki kontrolü: forms.admin veya raporu oluşturan kişi düzenleyebilir
    const isManagement = session.user.permissions?.includes('forms.admin') ?? false
    const isOwner = existingReport.createdById === currentUser.id

    if (!isManagement && !isOwner) {
      return NextResponse.json({ error: "Bu raporu düzenleme yetkiniz yok" }, { status: 403 })
    }

    // Onaylanmış raporlar düzenlenemez
    if (existingReport.status === 'APPROVED') {
      return NextResponse.json({ error: "Onaylanmış raporlar düzenlenemez" }, { status: 400 })
    }

    const {
      visitDate,
      endDate,
      visitTime,
      companyName,
      visitType,
      location,
      project,
      meetingSummary,
      additionalNotes,
      nextSteps,
      participants,
      actionItems,
      recipients,
      status
    } = body

    // Transaction ile güncelle (currentUser zaten alındı)
    const report = await prisma.$transaction(async (tx) => {
      // Mevcut katılımcıları ve aksiyonları sil
      await tx.visitReportParticipant.deleteMany({ where: { reportId: id } })
      await tx.visitReportAction.deleteMany({ where: { reportId: id } })

      // Raporu güncelle
      return tx.visitReport.update({
        where: { id },
        data: {
          visitDate: visitDate ? new Date(visitDate) : undefined,
          endDate: endDate ? new Date(endDate) : null,
          visitTime,
          companyName,
          visitType: visitType as VisitType,
          location,
          project,
          meetingSummary,
          additionalNotes,
          nextSteps,
          status: status as VisitReportStatus,
          participants: {
            create: (participants || []).map((p: { name: string; title?: string; company: string }) => ({
              name: p.name,
              title: p.title,
              company: p.company as ParticipantCompany
            }))
          },
          actionItems: {
            create: (actionItems || []).map((a: { description: string; responsible: string; dueDate?: string; status?: string }) => ({
              description: a.description,
              responsible: a.responsible,
              dueDate: a.dueDate ? new Date(a.dueDate) : null,
              status: (a.status || 'PENDING') as ActionItemStatus
            }))
          }
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          participants: true,
          actionItems: true
        }
      })
    })

    // E-posta gönder (sadece SENT durumunda ve alıcılar varsa)
    if (status === 'SENT' && recipients && recipients.length > 0) {
      const validRecipients: EmailRecipient[] = recipients
        .filter((r: { name?: string; email?: string }) => r.email && r.email.includes('@'))
        .map((r: { name?: string; email?: string }) => ({
          name: r.name || r.email!.split('@')[0],
          email: r.email!.toLowerCase() // PR-EMAIL-NORMALIZE
        }))

      if (validRecipients.length > 0) {
        // Tarihleri formatla
        const formatDate = (dateStr: string) => {
          try {
            return format(new Date(dateStr), 'd MMMM yyyy', { locale: tr })
          } catch {
            return dateStr
          }
        }

        // Katılımcıları ayır
        const ourPeople = (participants || [])
          .filter((p: { company: string }) => p.company === 'ILERI_GROUP')
          .map((p: { name: string; title?: string; company: string }) => ({
            name: p.name,
            title: p.title,
            company: p.company as 'ILERI_GROUP' | 'VISITED_COMPANY'
          }))

        const theirPeople = (participants || [])
          .filter((p: { company: string }) => p.company === 'VISITED_COMPANY')
          .map((p: { name: string; title?: string; company: string }) => ({
            name: p.name,
            title: p.title,
            company: p.company as 'ILERI_GROUP' | 'VISITED_COMPANY'
          }))

        const emailData: VisitReportEmailData = {
          reportNumber: existingReport.reportNumber,
          visitDate: formatDate(visitDate),
          endDate: endDate ? formatDate(endDate) : undefined,
          visitTime,
          companyName,
          visitType,
          location: location || undefined,
          project: project || undefined,
          meetingSummary,
          additionalNotes: additionalNotes || undefined,
          nextSteps: nextSteps || undefined,
          ourPeople,
          theirPeople,
          actionItems: (actionItems || []).map((a: { description: string; responsible?: string; dueDate?: string; status?: string }) => ({
            description: a.description,
            responsible: a.responsible,
            dueDate: a.dueDate ? formatDate(a.dueDate) : undefined,
            status: a.status
          })),
          createdByName: currentUser.name || currentUser.email || 'Bilinmiyor'
        }

        // PDF için rapor verisi
        const reportForPDF: VisitReportForPDF = {
          reportNumber: existingReport.reportNumber,
          visitDate: new Date(visitDate),
          endDate: endDate ? new Date(endDate) : null,
          visitTime,
          companyName,
          visitType,
          location: location || null,
          project: project || null,
          meetingSummary,
          additionalNotes: additionalNotes || null,
          nextSteps: nextSteps || null,
          status: status as string,
          createdBy: { name: currentUser.name, email: currentUser.email },
          participants: (participants || []).map((p: { name: string; title?: string; company: string }) => ({
            name: p.name,
            title: p.title || null,
            company: p.company as 'ILERI_GROUP' | 'VISITED_COMPANY'
          })),
          actionItems: (actionItems || []).map((a: { description: string; responsible: string; dueDate?: string; status?: string }) => ({
            description: a.description,
            responsible: a.responsible,
            dueDate: a.dueDate ? new Date(a.dueDate) : null,
            status: (a.status || 'PENDING') as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
          })),
          createdAt: existingReport.createdAt
        }

        // E-posta gönder (async olarak)
        sendVisitReportEmail(emailData, validRecipients, reportForPDF)
          .then(result => {
            if (result.success) {
              console.log(`✅ Ziyaret raporu e-postası gönderildi: ${existingReport.reportNumber} -> ${validRecipients.map(r => r.email).join(', ')}`)
            } else {
              console.error(`❌ Ziyaret raporu e-postası gönderilemedi: ${existingReport.reportNumber}`, result.error)
            }
          })
          .catch(err => {
            console.error(`❌ Ziyaret raporu e-postası gönderme hatası: ${existingReport.reportNumber}`, err)
          })
      }
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error("Rapor güncellenemedi:", error)
    return NextResponse.json({ error: "Rapor güncellenemedi" }, { status: 500 })
  }
}

// DELETE - Rapor sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-forms: requireUser — yönetici/owner kontrolü
    const { session, user: currentUser, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const existingReport = await prisma.visitReport.findUnique({
      where: { id }
    })

    if (!existingReport) {
      return NextResponse.json({ error: "Rapor bulunamadı" }, { status: 404 })
    }

    // Yetki kontrolü: forms.admin veya raporu oluşturan kişi silebilir
    const isManagement = session.user.permissions?.includes('forms.admin') ?? false
    const isOwner = existingReport.createdById === currentUser.id

    if (!isManagement && !isOwner) {
      return NextResponse.json({ error: "Bu raporu silme yetkiniz yok" }, { status: 403 })
    }

    // Onaylanmış raporlar silinemez
    if (existingReport.status === 'APPROVED') {
      return NextResponse.json({ error: "Onaylanmış raporlar silinemez" }, { status: 400 })
    }

    await prisma.visitReport.delete({ where: { id } })

    return NextResponse.json({ message: "Rapor silindi" })
  } catch (error) {
    console.error("Rapor silinemedi:", error)
    return NextResponse.json({ error: "Rapor silinemedi" }, { status: 500 })
  }
}
