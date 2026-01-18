import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Kategori listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const categories = await prisma.ticketCategory.findMany({
      where: { isActive: true },
      include: {
        parent: {
          select: { id: true, name: true }
        },
        children: {
          where: { isActive: true },
          select: { id: true, name: true, color: true, icon: true }
        },
        defaultTeam: {
          select: { id: true, name: true }
        },
        _count: {
          select: { tickets: true }
        }
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Kategori listesi hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// POST - Yeni kategori oluştur (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      description,
      color,
      icon,
      parentId,
      defaultPriority,
      slaResponseMinutes,
      slaResolutionMinutes,
      defaultAssigneeEmail,
      defaultTeamId,
      sortOrder,
    } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Kategori adı zorunludur' }, { status: 400 })
    }

    const category = await prisma.ticketCategory.create({
      data: {
        name: name.trim(),
        description,
        color,
        icon,
        parentId,
        defaultPriority: defaultPriority || 'NORMAL',
        slaResponseMinutes,
        slaResolutionMinutes,
        defaultAssigneeEmail,
        defaultTeamId,
        sortOrder: sortOrder || 0,
      }
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Kategori oluşturma hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// DELETE - Kategori sil (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Kategori ID gerekli' }, { status: 400 })
    }

    // Kategoriye bağlı ticket var mı kontrol et
    const ticketsCount = await prisma.ticket.count({
      where: { categoryId: id }
    })

    if (ticketsCount > 0) {
      return NextResponse.json(
        { error: `Bu kategoride ${ticketsCount} ticket bulunuyor. Önce ticketları başka bir kategoriye taşıyın.` },
        { status: 400 }
      )
    }

    await prisma.ticketCategory.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Kategori silme hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
