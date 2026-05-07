import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push-notifications'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Denetimin aksiyon planını ve bulgularını getir
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-suggestions: requireSession — sade auth
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const audit = await prisma.fiveSAudit.findUnique({
      where: { id },
      include: {
        area: true,
        findings: {
          include: {
            plannedTask: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!audit) {
      return NextResponse.json({ error: 'Denetim bulunamadı' }, { status: 404 })
    }

    return NextResponse.json(audit)
  } catch (error) {
    console.error('Aksiyon planı yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Aksiyon planı oluştur (uygunsuzluklardan bulgular oluştur)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-suggestions: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const { findings } = body // [{sCategory, description, findingType, priority}]

    // Denetimi kontrol et
    const audit = await prisma.fiveSAudit.findUnique({
      where: { id },
      include: { area: true }
    })

    if (!audit) {
      return NextResponse.json({ error: 'Denetim bulunamadı' }, { status: 404 })
    }

    // Mevcut bulguları sil (varsa)
    await prisma.fiveSFinding.deleteMany({
      where: { auditId: id }
    })

    // Yeni bulguları oluştur
    const createdFindings = []
    for (const finding of findings) {
      const created = await prisma.fiveSFinding.create({
        data: {
          auditId: id,
          sCategory: finding.sCategory,
          findingType: finding.findingType || 'NON_CONFORMITY',
          description: finding.description,
          location: finding.location,
          priority: finding.priority || 'NORMAL',
          status: 'PENDING'
        }
      })
      createdFindings.push(created)
    }

    // Denetim aksiyon planı durumunu güncelle
    await prisma.fiveSAudit.update({
      where: { id },
      data: {
        actionPlanStatus: 'CREATED',
        actionPlanCreatedAt: new Date(),
        actionPlanCreatedBy: user.email
      }
    })

    return NextResponse.json({
      message: 'Aksiyon planı oluşturuldu',
      findings: createdFindings
    }, { status: 201 })
  } catch (error) {
    console.error('Aksiyon planı oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Bulguya aksiyon ata (sorumlu ve tarih belirle, PlannedTask oluştur)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-suggestions: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const body = await request.json()
    let { assignedTo } = body
    const { findingId, assignedToName, dueDate, correctiveAction } = body
    // PR-Y2.5: input boundary normalization (sorumlu kişi email)
    if (typeof assignedTo === 'string') assignedTo = assignedTo.toLowerCase()

    if (!findingId || !assignedTo || !dueDate) {
      return NextResponse.json({ error: 'Sorumlu ve tarih zorunludur' }, { status: 400 })
    }

    // Bulguyu kontrol et
    const finding = await prisma.fiveSFinding.findUnique({
      where: { id: findingId },
      include: { audit: { include: { area: true } } }
    })

    if (!finding) {
      return NextResponse.json({ error: 'Bulgu bulunamadı' }, { status: 404 })
    }

    if (finding.auditId !== id) {
      return NextResponse.json({ error: 'Bulgu bu denetime ait değil' }, { status: 400 })
    }

    // 5S Kategori isimleri
    const categoryNames: Record<string, string> = {
      SEIRI: '1S Ayıkla',
      SEITON: '2S Düzenle',
      SEISO: '3S Temizle',
      SEIKETSU: '4S Standartlaştır',
      SHITSUKE: '5S Sürdür'
    }

    // PlannedTask oluştur
    const task = await prisma.plannedTask.create({
      data: {
        title: `5S Aksiyon: ${categoryNames[finding.sCategory]} - ${finding.audit.area.name}`,
        description: `**Uygunsuzluk:** ${finding.description}\n\n**Düzeltici Aksiyon:** ${correctiveAction || 'Belirtilmedi'}\n\n**Denetim:** ${finding.audit.auditNumber}\n**Alan:** ${finding.audit.area.name}`,
        dueDate: new Date(dueDate),
        responsiblePerson: assignedToName,
        responsiblePersonEmail: assignedTo,
        status: 'PENDING',
        priority: finding.priority === 'CRITICAL' ? 'CRITICAL' : finding.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
        reminderDays: [7, 3, 1],
        createdBy: user.email,
        isActive: true
      }
    })

    // Bulguyu güncelle
    const updatedFinding = await prisma.fiveSFinding.update({
      where: { id: findingId },
      data: {
        assignedTo,
        assignedToName,
        dueDate: new Date(dueDate),
        correctiveAction,
        status: 'IN_PROGRESS',
        plannedTaskId: task.id
      },
      include: {
        plannedTask: true
      }
    })

    // Denetimin aksiyon planı durumunu güncelle
    await prisma.fiveSAudit.update({
      where: { id },
      data: {
        actionPlanStatus: 'IN_PROGRESS'
      }
    })

    // Sorumlu kişiye bildirim gönder
    const responsibleUser = await prisma.user.findUnique({
      where: { email: assignedTo }
    })

    if (responsibleUser) {
      const notifMsg = `Size yeni bir 5S aksiyon görevi atandı: ${categoryNames[finding.sCategory]} - ${finding.audit.area.name}. Hedef tarih: ${new Date(dueDate).toLocaleDateString('tr-TR')}`
      await prisma.notification.create({
        data: {
          userId: responsibleUser.id,
          title: '5S Aksiyon Görevi Atandı',
          message: notifMsg,
          type: 'INFO',
          link: '/tasks'
        }
      })
      sendPushToUser(prisma, responsibleUser.id, {
        title: '5S Aksiyon Görevi Atandı',
        body: notifMsg,
        url: '/tasks',
      }).catch(() => {})
    }

    return NextResponse.json({
      message: 'Aksiyon atandı ve planlı görev oluşturuldu',
      finding: updatedFinding,
      task
    })
  } catch (error) {
    console.error('Aksiyon atanırken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
