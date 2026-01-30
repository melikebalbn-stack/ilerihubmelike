import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { VisitType, VisitReportStatus, ParticipantCompany, ActionItemStatus } from "@/generated/prisma"
import { sendVisitReportEmail, VisitReportEmailData, EmailRecipient } from "@/lib/email"
import { VisitReportForPDF } from "@/lib/pdf/visit-report-pdf-server"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

// Rapor numarası oluştur: ZR-2025-001
async function generateReportNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ZR-${year}-`

  const lastReport = await prisma.visitReport.findFirst({
    where: {
      reportNumber: { startsWith: prefix }
    },
    orderBy: { reportNumber: 'desc' }
  })

  let nextNumber = 1
  if (lastReport) {
    const lastNumber = parseInt(lastReport.reportNumber.split('-')[2])
    nextNumber = lastNumber + 1
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`
}

// Üst yönetim rolleri - tüm raporları görebilir
const MANAGEMENT_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'DEPT_HEAD',
  'SUPERVISOR',
  'HR_MANAGER',
  'QUALITY_MANAGER',
  'IT_MANAGER'
]

// GET - Ziyaret raporlarını listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    // Kullanıcı bilgilerini al (rol kontrolü için)
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const companyName = searchParams.get('company')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    // Rol bazlı filtreleme:
    // - Üst yönetim: tüm raporları görebilir
    // - EMPLOYEE: sadece kendi raporlarını görebilir
    const isManagement = currentUser.role && MANAGEMENT_ROLES.includes(currentUser.role)
    if (!isManagement) {
      where.createdById = currentUser.id
    }

    if (status) {
      where.status = status as VisitReportStatus
    }

    if (companyName) {
      where.companyName = { contains: companyName, mode: 'insensitive' }
    }

    const [reports, total] = await Promise.all([
      prisma.visitReport.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
          participants: true,
          actionItems: true,
          _count: { select: { attachments: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.visitReport.count({ where })
    ])

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Ziyaret raporları alınamadı:", error)
    return NextResponse.json({ error: "Raporlar alınamadı" }, { status: 500 })
  }
}

// POST - Yeni ziyaret raporu oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 })
    }

    const body = await request.json()
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
      status = 'DRAFT'
    } = body

    // Validasyon
    if (!visitDate || !visitTime || !companyName || !visitType || !meetingSummary) {
      return NextResponse.json({
        error: "Zorunlu alanlar eksik: visitDate, visitTime, companyName, visitType, meetingSummary"
      }, { status: 400 })
    }

    const reportNumber = await generateReportNumber()

    const report = await prisma.visitReport.create({
      data: {
        reportNumber,
        visitDate: new Date(visitDate),
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
        createdById: user.id,
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

    // E-posta gönder (sadece SENT durumunda ve alıcılar varsa)
    if (status === 'SENT' && recipients && recipients.length > 0) {
      const validRecipients: EmailRecipient[] = recipients
        .filter((r: { name?: string; email?: string }) => r.email && r.email.includes('@'))
        .map((r: { name?: string; email?: string }) => ({
          name: r.name || r.email!.split('@')[0],
          email: r.email!
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
          reportNumber,
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
          createdByName: user.name || user.email || 'Bilinmiyor'
        }

        // PDF için rapor verisi
        const reportForPDF: VisitReportForPDF = {
          reportNumber,
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
          createdBy: { name: user.name, email: user.email },
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
          createdAt: new Date()
        }

        // E-posta gönder (async olarak, hata olsa bile rapor kaydedilmiş olacak)
        sendVisitReportEmail(emailData, validRecipients, reportForPDF)
          .then(result => {
            if (result.success) {
              console.log(`✅ Ziyaret raporu e-postası gönderildi: ${reportNumber} -> ${validRecipients.map(r => r.email).join(', ')}`)
            } else {
              console.error(`❌ Ziyaret raporu e-postası gönderilemedi: ${reportNumber}`, result.error)
            }
          })
          .catch(err => {
            console.error(`❌ Ziyaret raporu e-postası gönderme hatası: ${reportNumber}`, err)
          })
      }
    }

    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error("Ziyaret raporu oluşturulamadı:", error)
    return NextResponse.json({ error: "Rapor oluşturulamadı" }, { status: 500 })
  }
}
