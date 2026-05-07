import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasCostAnalysisAccess } from '@/lib/cost-analysis/access'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Tüm makineleri listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireSession (read-only liste)
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const where = activeOnly ? { isActive: true } : {}

    const machines = await prisma.costMachine.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { laborItems: true },
        },
      },
    })

    return NextResponse.json(machines)
  } catch (error) {
    console.error('Makineler alınırken hata:', error)
    return NextResponse.json(
      { error: 'Makineler alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni makine ekle
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasCostAnalysisAccess(user.role, user.email)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { name, code, type, hourlyRate, description } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Makine adı zorunludur' }, { status: 400 })
    }

    if (!code || code.trim() === '') {
      return NextResponse.json({ error: 'Makine kodu zorunludur' }, { status: 400 })
    }

    if (!hourlyRate || isNaN(parseFloat(hourlyRate)) || parseFloat(hourlyRate) <= 0) {
      return NextResponse.json({ error: 'Geçerli bir saat ücreti giriniz' }, { status: 400 })
    }

    const existingMachine = await prisma.costMachine.findUnique({
      where: { code: code.trim().toUpperCase() },
    })

    if (existingMachine) {
      return NextResponse.json({ error: 'Bu makine kodu zaten mevcut' }, { status: 400 })
    }

    const machine = await prisma.costMachine.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type: type?.trim() || null,
        hourlyRate: parseFloat(hourlyRate),
        description: description?.trim() || null,
      },
    })

    return NextResponse.json(machine, { status: 201 })
  } catch (error) {
    console.error('Makine eklenirken hata:', error)
    return NextResponse.json(
      { error: 'Makine eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Makine güncelle
export async function PUT(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasCostAnalysisAccess(user.role, user.email)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, code, type, hourlyRate, description, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Makine ID zorunludur' }, { status: 400 })
    }

    const existingMachine = await prisma.costMachine.findUnique({
      where: { id },
    })

    if (!existingMachine) {
      return NextResponse.json({ error: 'Makine bulunamadı' }, { status: 404 })
    }

    if (code && code.trim().toUpperCase() !== existingMachine.code) {
      const duplicateCode = await prisma.costMachine.findUnique({
        where: { code: code.trim().toUpperCase() },
      })
      if (duplicateCode) {
        return NextResponse.json({ error: 'Bu makine kodu zaten mevcut' }, { status: 400 })
      }
    }

    const machine = await prisma.costMachine.update({
      where: { id },
      data: {
        name: name?.trim() || existingMachine.name,
        code: code?.trim().toUpperCase() || existingMachine.code,
        type: type !== undefined ? (type?.trim() || null) : existingMachine.type,
        hourlyRate: hourlyRate !== undefined ? parseFloat(hourlyRate) : existingMachine.hourlyRate,
        description: description !== undefined ? (description?.trim() || null) : existingMachine.description,
        isActive: isActive !== undefined ? isActive : existingMachine.isActive,
      },
    })

    return NextResponse.json(machine)
  } catch (error) {
    console.error('Makine güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Makine güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Makine sil
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
      return NextResponse.json({ error: 'Makine ID zorunludur' }, { status: 400 })
    }

    const machine = await prisma.costMachine.findUnique({
      where: { id },
      include: {
        _count: {
          select: { laborItems: true },
        },
      },
    })

    if (!machine) {
      return NextResponse.json({ error: 'Makine bulunamadı' }, { status: 404 })
    }

    if (machine._count.laborItems > 0) {
      return NextResponse.json(
        { error: 'Bu makineye bağlı işçilik kayıtları var. Önce işçilikleri güncelleyin.' },
        { status: 400 }
      )
    }

    await prisma.costMachine.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Makine silindi' })
  } catch (error) {
    console.error('Makine silinirken hata:', error)
    return NextResponse.json(
      { error: 'Makine silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
