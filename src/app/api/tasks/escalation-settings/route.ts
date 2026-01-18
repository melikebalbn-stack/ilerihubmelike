import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Eskalasyon ayarlarını al
export async function GET() {
  try {
    // Kimlik doğrulama kontrolü
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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
    // Kimlik doğrulama kontrolü
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Yetki kontrolü
    const userRole = session.user.role || 'EMPLOYEE'
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
