import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasCostAnalysisAccess } from '@/lib/cost-analysis/access'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Tüm müşterileri listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireSession (read-only liste)
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const where = activeOnly ? { isActive: true } : {}

    const customers = await prisma.costCustomer.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { analyses: true },
        },
      },
    })

    return NextResponse.json(customers)
  } catch (error) {
    console.error('Müşteriler alınırken hata:', error)
    return NextResponse.json(
      { error: 'Müşteriler alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// Otomatik kod üret
async function generateCustomerCode(): Promise<string> {
  const prefix = 'MUS'

  // Son kodu bul
  const lastCustomer = await prisma.costCustomer.findFirst({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    orderBy: {
      code: 'desc',
    },
  })

  let nextNumber = 1
  if (lastCustomer) {
    const match = lastCustomer.code.match(/MUS-?(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }

  return `${prefix}-${nextNumber.toString().padStart(3, '0')}`
}

// POST - Yeni müşteri ekle
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasCostAnalysisAccess(user.role, user.email)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { name, code, country, contact, email, phone, contactPerson } = body

    // Sadece nextCode istenmişse otomatik kod döndür
    if (body.getNextCode === true) {
      const nextCode = await generateCustomerCode()
      return NextResponse.json({ nextCode })
    }

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Müşteri adı zorunludur' }, { status: 400 })
    }

    // Kod verilmemişse otomatik üret
    let customerCode = code?.trim().toUpperCase()
    if (!customerCode) {
      customerCode = await generateCustomerCode()
    }

    const existingCustomer = await prisma.costCustomer.findUnique({
      where: { code: customerCode },
    })

    if (existingCustomer) {
      return NextResponse.json({ error: 'Bu müşteri kodu zaten mevcut' }, { status: 400 })
    }

    const customer = await prisma.costCustomer.create({
      data: {
        name: name.trim(),
        code: customerCode,
        country: country?.trim() || null,
        contact: contact?.trim() || contactPerson?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
      },
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error('Müşteri eklenirken hata:', error)
    return NextResponse.json(
      { error: 'Müşteri eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Müşteri güncelle
export async function PUT(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { user, error } = await requireUser()
    if (error) return error
    if (!hasCostAnalysisAccess(user.role, user.email)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, code, country, contact, email, phone, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Müşteri ID zorunludur' }, { status: 400 })
    }

    const existingCustomer = await prisma.costCustomer.findUnique({
      where: { id },
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
    }

    if (code && code.trim().toUpperCase() !== existingCustomer.code) {
      const duplicateCode = await prisma.costCustomer.findUnique({
        where: { code: code.trim().toUpperCase() },
      })
      if (duplicateCode) {
        return NextResponse.json({ error: 'Bu müşteri kodu zaten mevcut' }, { status: 400 })
      }
    }

    const customer = await prisma.costCustomer.update({
      where: { id },
      data: {
        name: name?.trim() || existingCustomer.name,
        code: code?.trim().toUpperCase() || existingCustomer.code,
        country: country !== undefined ? (country?.trim() || null) : existingCustomer.country,
        contact: contact !== undefined ? (contact?.trim() || null) : existingCustomer.contact,
        email: email !== undefined ? (email?.trim() || null) : existingCustomer.email,
        phone: phone !== undefined ? (phone?.trim() || null) : existingCustomer.phone,
        isActive: isActive !== undefined ? isActive : existingCustomer.isActive,
      },
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Müşteri güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Müşteri güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Müşteri sil
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
      return NextResponse.json({ error: 'Müşteri ID zorunludur' }, { status: 400 })
    }

    const customer = await prisma.costCustomer.findUnique({
      where: { id },
      include: {
        _count: {
          select: { analyses: true },
        },
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
    }

    if (customer._count.analyses > 0) {
      return NextResponse.json(
        { error: 'Bu müşteriye bağlı analizler var. Önce analizleri başka müşteriye taşıyın.' },
        { status: 400 }
      )
    }

    await prisma.costCustomer.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Müşteri silindi' })
  } catch (error) {
    console.error('Müşteri silinirken hata:', error)
    return NextResponse.json(
      { error: 'Müşteri silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
