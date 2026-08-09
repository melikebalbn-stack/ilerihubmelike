import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Kategori listesi
export async function GET(_request: NextRequest) {
  try {
    // PR-Y2.5-tickets: requireSession — sade auth, DB hit yok
    const { error } = await requireSession()
    if (error) return error

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
    // PR-Y2.5-tickets: requireUser → user.role
    const { user, error } = await requireUser()
    if (error) return error

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
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

    // PR-Y2.5-tickets: input boundary normalization — DB email lowercase invariant
    const normalizedAssigneeEmail = typeof defaultAssigneeEmail === 'string' && defaultAssigneeEmail.trim() !== ''
      ? defaultAssigneeEmail.toLowerCase()
      : null

    // Var olmayan takım id'si FK hatasıyla 500'e düşmesin (PUT ile aynı kontrol)
    const normalizedTeamId =
      typeof defaultTeamId === 'string' && defaultTeamId.trim() !== '' ? defaultTeamId : null
    if (normalizedTeamId) {
      const team = await prisma.ticketTeam.findUnique({ where: { id: normalizedTeamId }, select: { id: true } })
      if (!team) {
        return NextResponse.json({ error: 'Seçilen takım bulunamadı' }, { status: 400 })
      }
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
        defaultAssigneeEmail: normalizedAssigneeEmail,
        defaultTeamId: normalizedTeamId,
        sortOrder: sortOrder || 0,
      }
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Kategori oluşturma hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// PUT - Kategori güncelle (Admin only). ?id= ile — aynı dosyadaki DELETE ile
// tutarlı olsun diye query param (RESTful /[id] alt route'u yerine).
//
// KISMİ güncelleme: yalnız gönderilen alanlar yazılır. defaultTeamId için
// `null` GEÇERLİ bir değerdir (takım bağını kaldır) → `undefined` ile ayrılır.
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Kategori ID gerekli' }, { status: 400 })
    }

    const existing = await prisma.ticketCategory.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Kategori bulunamadı' }, { status: 404 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.name !== undefined) {
      if (!body.name?.trim()) {
        return NextResponse.json({ error: 'Kategori adı boş olamaz' }, { status: 400 })
      }
      data.name = body.name.trim()
    }
    if (body.description !== undefined) data.description = body.description?.trim() || null
    if (body.color !== undefined) data.color = body.color || null
    if (body.icon !== undefined) data.icon = body.icon || null
    if (body.defaultPriority !== undefined) data.defaultPriority = body.defaultPriority
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0
    if (body.isActive !== undefined) data.isActive = body.isActive === true

    // DB email lowercase invariant (POST ile aynı normalizasyon)
    if (body.defaultAssigneeEmail !== undefined) {
      data.defaultAssigneeEmail =
        typeof body.defaultAssigneeEmail === 'string' && body.defaultAssigneeEmail.trim() !== ''
          ? body.defaultAssigneeEmail.toLowerCase()
          : null
    }

    if (body.defaultTeamId !== undefined) {
      const teamId =
        typeof body.defaultTeamId === 'string' && body.defaultTeamId.trim() !== ''
          ? body.defaultTeamId
          : null
      // Var olmayan takım id'si FK hatasıyla 500'e düşmesin → önce doğrula
      if (teamId) {
        const team = await prisma.ticketTeam.findUnique({ where: { id: teamId }, select: { id: true } })
        if (!team) {
          return NextResponse.json({ error: 'Seçilen takım bulunamadı' }, { status: 400 })
        }
      }
      data.defaultTeamId = teamId
    }

    const category = await prisma.ticketCategory.update({
      where: { id },
      data,
      include: { defaultTeam: { select: { id: true, name: true } } },
    })

    return NextResponse.json(category)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Bu adda bir kategori zaten var' }, { status: 400 })
    }
    console.error('Kategori güncelleme hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// DELETE - Kategori sil (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    // PR-Y2.5-tickets: requireUser → user.role
    const { user, error } = await requireUser()
    if (error) return error

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
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
