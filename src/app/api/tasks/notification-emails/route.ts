import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Tüm bildirim e-postalarını listele
export async function GET() {
  try {
    // PR-Y2.5-tasks: requireSession
    const { error } = await requireSession()
    if (error) return error
    const emails = await prisma.taskNotificationEmail.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(emails)
  } catch (error) {
    console.error('Bildirim e-postaları alınırken hata:', error)
    return NextResponse.json(
      { error: 'Bildirim e-postaları alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni bildirim e-postası ekle (ADMIN only)
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-tasks: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const userRole = user.role || 'EMPLOYEE'
    if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { name } = body
    // PR-Y2.5: input boundary normalization — DB email lowercase invariant
    const email = typeof body.email === 'string' ? body.email.toLowerCase() : null

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Geçerli bir e-posta adresi giriniz' },
        { status: 400 }
      )
    }

    // E-posta zaten var mı kontrol et
    const existing = await prisma.taskNotificationEmail.findUnique({
      where: { email },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Bu e-posta adresi zaten kayıtlı' },
        { status: 400 }
      )
    }

    const notificationEmail = await prisma.taskNotificationEmail.create({
      data: {
        email,
        name: name || null,
      },
    })

    return NextResponse.json(notificationEmail, { status: 201 })
  } catch (error) {
    console.error('Bildirim e-postası eklenirken hata:', error)
    return NextResponse.json(
      { error: 'Bildirim e-postası eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Bildirim e-postasını sil (ADMIN only)
export async function DELETE(request: NextRequest) {
  try {
    // PR-Y2.5-tasks: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const userRole = user.role || 'EMPLOYEE'
    if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID gerekli' },
        { status: 400 }
      )
    }

    await prisma.taskNotificationEmail.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bildirim e-postası silinirken hata:', error)
    return NextResponse.json(
      { error: 'Bildirim e-postası silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
