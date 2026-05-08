import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEditCalibration } from '@/lib/calibration-auth'

export const dynamic = 'force-dynamic'

// GET - Tüm bildirim e-postalarını listele (category parametresi ile filtrelenebilir)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') // 'EXPIRING' | 'EXPIRED' | null (tümü)

    const where: any = { isActive: true }
    if (category) {
      where.category = category
    }

    const emails = await prisma.calibrationNotificationEmail.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(emails)
  } catch (error) {
    console.error('Bildirim e-postaları alınırken hata:', error)
    return NextResponse.json(
      { error: 'E-postalar alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni bildirim e-postası ekle (ADMIN veya Kalite departmanı)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    if (!canEditCalibration(user.role, user.ou, user.department, user.permissions)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name, category } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Geçerli bir e-posta adresi giriniz' },
        { status: 400 }
      )
    }

    const cat = category || 'EXPIRING'
    if (!['EXPIRING', 'EXPIRED'].includes(cat)) {
      return NextResponse.json(
        { error: 'Geçerli bir kategori seçiniz (EXPIRING veya EXPIRED)' },
        { status: 400 }
      )
    }

    // Aynı email+category kombinasyonu var mı?
    const existing = await prisma.calibrationNotificationEmail.findUnique({
      where: { email_category: { email, category: cat } },
    })

    if (existing) {
      if (!existing.isActive) {
        const updated = await prisma.calibrationNotificationEmail.update({
          where: { id: existing.id },
          data: { isActive: true, name },
        })
        return NextResponse.json(updated)
      }
      return NextResponse.json(
        { error: 'Bu e-posta adresi bu kategoride zaten ekli' },
        { status: 400 }
      )
    }

    const newEmail = await prisma.calibrationNotificationEmail.create({
      data: { email, name, category: cat },
    })

    return NextResponse.json(newEmail, { status: 201 })
  } catch (error) {
    console.error('Bildirim e-postası eklenirken hata:', error)
    return NextResponse.json(
      { error: 'E-posta eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
