import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Tüm kategorileri listele
export async function GET() {
  try {
    // PR-Y2.5-tasks: requireSession — sade auth
    const { error } = await requireSession()
    if (error) return error
    const categories = await prisma.taskCategory.findMany({
      where: { isActive: true },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Kategoriler alınırken hata:', error)
    return NextResponse.json(
      { error: 'Kategoriler alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni kategori ekle (ADMIN only)
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-tasks: requireUser → user.role
    const { user, error } = await requireUser()
    if (error) return error

    // Yetki kontrolü
    const userRole = user.role || 'EMPLOYEE'
    if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()

    const { name, description, color, icon } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Kategori adı zorunludur' },
        { status: 400 }
      )
    }

    // Aynı isimde kategori var mı kontrol et
    const existingCategory = await prisma.taskCategory.findUnique({
      where: { name },
    })

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Bu isimde bir kategori zaten mevcut' },
        { status: 400 }
      )
    }

    // En yüksek sortOrder'ı bul
    const maxSortOrder = await prisma.taskCategory.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    const category = await prisma.taskCategory.create({
      data: {
        name,
        description,
        color: color || '#3b82f6',
        icon,
        sortOrder: (maxSortOrder?.sortOrder || 0) + 1,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Kategori eklenirken hata:', error)
    return NextResponse.json(
      { error: 'Kategori eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Kategori güncelle (ADMIN only)
export async function PUT(request: NextRequest) {
  try {
    // PR-Y2.5-tasks: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const userRole = user.role || 'EMPLOYEE'
    if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()

    const { id, name, description, color, icon, sortOrder, isActive } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Kategori ID zorunludur' },
        { status: 400 }
      )
    }

    const category = await prisma.taskCategory.update({
      where: { id },
      data: {
        name,
        description,
        color,
        icon,
        sortOrder,
        isActive,
      },
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error('Kategori güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Kategori güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Kategori sil (soft delete) (ADMIN only)
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
        { error: 'Kategori ID zorunludur' },
        { status: 400 }
      )
    }

    const category = await prisma.taskCategory.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error('Kategori silinirken hata:', error)
    return NextResponse.json(
      { error: 'Kategori silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
