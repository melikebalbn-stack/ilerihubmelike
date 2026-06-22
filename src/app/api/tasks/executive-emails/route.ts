import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Üst yönetim e-posta listesi
export async function GET() {
  try {
    // PR-Y2.5-tasks: requireSession
    const { error } = await requireSession()
    if (error) return error
    const emails = await prisma.taskExecutiveEmail.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(emails)
  } catch (error) {
    console.error('Üst yönetim e-postaları alınırken hata:', error)
    return NextResponse.json(
      { error: 'Üst yönetim e-postaları alınamadı' },
      { status: 500 }
    )
  }
}

// POST - Yeni üst yönetim e-postası ekle (ADMIN only)
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

    if (!email) {
      return NextResponse.json(
        { error: 'E-posta adresi zorunludur' },
        { status: 400 }
      )
    }

    // E-posta formatını kontrol et
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Geçersiz e-posta formatı' },
        { status: 400 }
      )
    }

    // Zaten var mı kontrol et
    const existing = await prisma.taskExecutiveEmail.findUnique({
      where: { email },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Bu e-posta adresi zaten kayıtlı' },
        { status: 400 }
      )
    }

    const newEmail = await prisma.taskExecutiveEmail.create({
      data: {
        email,
        name,
      },
    })

    return NextResponse.json(newEmail, { status: 201 })
  } catch (error) {
    console.error('Üst yönetim e-postası eklenirken hata:', error)
    return NextResponse.json(
      { error: 'E-posta eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Üst yönetim e-postası sil (ADMIN only)
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
        { error: 'ID zorunludur' },
        { status: 400 }
      )
    }

    await prisma.taskExecutiveEmail.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Üst yönetim e-postası silinirken hata:', error)
    return NextResponse.json(
      { error: 'E-posta silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
