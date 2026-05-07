import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasCostAnalysisAccess } from '@/lib/cost-analysis/access'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Tüm kategorileri listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireSession (read-only liste)
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const where = activeOnly ? { isActive: true } : {}

    const categories = await prisma.costCategory.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { analyses: true },
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

// POST - Yeni kategori ekle
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasCostAnalysisAccess(user.role, user.email)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { name, code, color, description } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Kategori adı zorunludur' }, { status: 400 })
    }

    if (!code || code.trim() === '') {
      return NextResponse.json({ error: 'Kategori kodu zorunludur' }, { status: 400 })
    }

    // Kod benzersizlik kontrolü
    const existingCategory = await prisma.costCategory.findUnique({
      where: { code: code.trim().toUpperCase() },
    })

    if (existingCategory) {
      return NextResponse.json({ error: 'Bu kategori kodu zaten mevcut' }, { status: 400 })
    }

    const lastCategory = await prisma.costCategory.findFirst({
      orderBy: { sortOrder: 'desc' },
    })

    const category = await prisma.costCategory.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        color: color || '#6366f1',
        description: description?.trim() || null,
        sortOrder: (lastCategory?.sortOrder || 0) + 1,
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

// PUT - Kategori güncelle
export async function PUT(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasCostAnalysisAccess(user.role, user.email)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, code, color, description, isActive, sortOrder } = body

    if (!id) {
      return NextResponse.json({ error: 'Kategori ID zorunludur' }, { status: 400 })
    }

    const existingCategory = await prisma.costCategory.findUnique({
      where: { id },
    })

    if (!existingCategory) {
      return NextResponse.json({ error: 'Kategori bulunamadı' }, { status: 404 })
    }

    // Kod değiştiyse benzersizlik kontrolü
    if (code && code.trim().toUpperCase() !== existingCategory.code) {
      const duplicateCode = await prisma.costCategory.findUnique({
        where: { code: code.trim().toUpperCase() },
      })
      if (duplicateCode) {
        return NextResponse.json({ error: 'Bu kategori kodu zaten mevcut' }, { status: 400 })
      }
    }

    const category = await prisma.costCategory.update({
      where: { id },
      data: {
        name: name?.trim() || existingCategory.name,
        code: code?.trim().toUpperCase() || existingCategory.code,
        color: color || existingCategory.color,
        description: description !== undefined ? (description?.trim() || null) : existingCategory.description,
        isActive: isActive !== undefined ? isActive : existingCategory.isActive,
        sortOrder: sortOrder !== undefined ? sortOrder : existingCategory.sortOrder,
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

// DELETE - Kategori sil
export async function DELETE(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasCostAnalysisAccess(user.role, user.email)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Kategori ID zorunludur' }, { status: 400 })
    }

    const category = await prisma.costCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { analyses: true },
        },
      },
    })

    if (!category) {
      return NextResponse.json({ error: 'Kategori bulunamadı' }, { status: 404 })
    }

    if (category._count.analyses > 0) {
      return NextResponse.json(
        { error: 'Bu kategoriye bağlı analizler var. Önce analizleri başka kategoriye taşıyın.' },
        { status: 400 }
      )
    }

    await prisma.costCategory.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Kategori silindi' })
  } catch (error) {
    console.error('Kategori silinirken hata:', error)
    return NextResponse.json(
      { error: 'Kategori silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
