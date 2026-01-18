import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Tüm bildirim e-postalarını listele
export async function GET() {
  try {
    // Kimlik doğrulama kontrolü
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const emails = await prisma.calibrationNotificationEmail.findMany({
      where: { isActive: true },
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

// POST - Yeni bildirim e-postası ekle (ADMIN only)
export async function POST(request: NextRequest) {
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
    const { email, name } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Geçerli bir e-posta adresi giriniz' },
        { status: 400 }
      )
    }

    // E-posta zaten var mı kontrol et
    const existing = await prisma.calibrationNotificationEmail.findUnique({
      where: { email },
    })

    if (existing) {
      // Eğer pasif ise aktif et
      if (!existing.isActive) {
        const updated = await prisma.calibrationNotificationEmail.update({
          where: { email },
          data: { isActive: true, name },
        })
        return NextResponse.json(updated)
      }
      return NextResponse.json(
        { error: 'Bu e-posta adresi zaten ekli' },
        { status: 400 }
      )
    }

    const newEmail = await prisma.calibrationNotificationEmail.create({
      data: { email, name },
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
