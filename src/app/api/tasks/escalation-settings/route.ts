import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Eskalasyon ayarlarını al
export async function GET() {
  try {
    // PR-Y2.5-tasks: requireSession
    const { error } = await requireSession()
    if (error) return error
    let settings = await prisma.taskEscalationSettings.findFirst({
      where: { isActive: true },
    })

    // Yoksa varsayılan oluştur
    if (!settings) {
      settings = await prisma.taskEscalationSettings.create({
        data: {
          managerEscalationDays: 1,
          executiveEscalationDays: 5,
          isActive: true,
        },
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Eskalasyon ayarları alınırken hata:', error)
    return NextResponse.json(
      { error: 'Eskalasyon ayarları alınamadı' },
      { status: 500 }
    )
  }
}

// PUT - Eskalasyon ayarlarını güncelle (ADMIN only)
export async function PUT(request: NextRequest) {
  try {
    // PR-Y2.5-tasks: requireUser → user.role
    const { user, error } = await requireUser()
    if (error) return error

    const userRole = user.role || 'EMPLOYEE'
    if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { managerEscalationDays, executiveEscalationDays } = body

    // Validasyon
    if (managerEscalationDays < 1 || managerEscalationDays > 30) {
      return NextResponse.json(
        { error: 'Yönetici eskalasyon süresi 1-30 gün arasında olmalıdır' },
        { status: 400 }
      )
    }

    if (executiveEscalationDays < 1 || executiveEscalationDays > 60) {
      return NextResponse.json(
        { error: 'Üst yönetim eskalasyon süresi 1-60 gün arasında olmalıdır' },
        { status: 400 }
      )
    }

    if (executiveEscalationDays <= managerEscalationDays) {
      return NextResponse.json(
        { error: 'Üst yönetim eskalasyon süresi, yönetici eskalasyon süresinden büyük olmalıdır' },
        { status: 400 }
      )
    }

    // Mevcut ayarı bul veya oluştur
    let settings = await prisma.taskEscalationSettings.findFirst({
      where: { isActive: true },
    })

    if (settings) {
      settings = await prisma.taskEscalationSettings.update({
        where: { id: settings.id },
        data: {
          managerEscalationDays,
          executiveEscalationDays,
        },
      })
    } else {
      settings = await prisma.taskEscalationSettings.create({
        data: {
          managerEscalationDays,
          executiveEscalationDays,
          isActive: true,
        },
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Eskalasyon ayarları güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Eskalasyon ayarları güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
