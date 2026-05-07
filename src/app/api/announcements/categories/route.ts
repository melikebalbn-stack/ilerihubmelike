import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin as checkIsAdmin } from '@/lib/auth-utils'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Kategorileri listele
export async function GET() {
  try {
    // PR-Y2.5-announcements: requireSession — sade auth, DB hit yok
    const { error } = await requireSession()
    if (error) return error

    const categories = await prisma.announcementCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { announcements: true }
        }
      }
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Kategoriler yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yeni kategori oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-announcements: requireUser — admin check için DB user gerekli
    const { user, error } = await requireUser()
    if (error) return error

    const userEmail = user.email
    const userRole = user.role || 'EMPLOYEE'

    // FIX #4: Merkezi utility kullanıldı
    const isAdmin = checkIsAdmin(userEmail, userRole)

    if (!isAdmin) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, color, icon, sortOrder = 0 } = body

    if (!name) {
      return NextResponse.json({ error: 'Kategori adi zorunludur' }, { status: 400 })
    }

    // Aynı isimde kategori var mı kontrol et
    const existingCategory = await prisma.announcementCategory.findUnique({
      where: { name }
    })

    if (existingCategory) {
      return NextResponse.json({ error: 'Bu isimde bir kategori zaten mevcut' }, { status: 400 })
    }

    const category = await prisma.announcementCategory.create({
      data: {
        name,
        description,
        color,
        icon,
        sortOrder
      }
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Kategori olusturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Kategori güncelle
export async function PUT(request: NextRequest) {
  try {
    // PR-Y2.5-announcements: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const userEmail = user.email
    const userRole = user.role || 'EMPLOYEE'

    // FIX #4: Merkezi utility kullanıldı
    const isAdmin = checkIsAdmin(userEmail, userRole)

    if (!isAdmin) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, description, color, icon, sortOrder, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Kategori ID zorunludur' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (color !== undefined) updateData.color = color
    if (icon !== undefined) updateData.icon = icon
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder
    if (isActive !== undefined) updateData.isActive = isActive

    const category = await prisma.announcementCategory.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error('Kategori güncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Kategori sil
export async function DELETE(request: NextRequest) {
  try {
    // PR-Y2.5-announcements: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const userEmail = user.email
    const userRole = user.role || 'EMPLOYEE'

    // FIX #4: Merkezi utility kullanıldı
    const isAdmin = checkIsAdmin(userEmail, userRole)

    if (!isAdmin) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Kategori ID zorunludur' }, { status: 400 })
    }

    // Bu kategoride duyuru var mı kontrol et
    const announcementCount = await prisma.announcement.count({
      where: { categoryId: id }
    })

    if (announcementCount > 0) {
      // Soft delete
      await prisma.announcementCategory.update({
        where: { id },
        data: { isActive: false }
      })
      return NextResponse.json({ success: true, message: 'Kategori pasif yapildi (duyurular mevcut)' })
    }

    // Hard delete
    await prisma.announcementCategory.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Kategori silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
