import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Tum katalog malzemelerini listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'
    const category = searchParams.get('category')

    const where: Record<string, unknown> = {}

    if (activeOnly) {
      where.isActive = true
    }

    if (category) {
      where.category = category
    }

    const materials = await prisma.costMaterialCatalog.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        supplier: true,
      },
    })

    return NextResponse.json(materials)
  } catch (error) {
    console.error('Katalog malzemeleri alinirken hata:', error)
    return NextResponse.json(
      { error: 'Katalog malzemeleri alinirken bir hata olustu' },
      { status: 500 }
    )
  }
}

// Kategori bazli prefix haritasi
const CATEGORY_PREFIX_MAP: Record<string, string> = {
  RAW_MATERIAL: 'HAM',
  SEMI_FINISHED: 'YM',
  PURCHASED_PART: 'SAP',
  STANDARD_PART: 'STD',
  CONSUMABLE: 'SRF',
}

// Otomatik kod uret
async function generateMaterialCode(category: string): Promise<string> {
  const prefix = CATEGORY_PREFIX_MAP[category] || 'HAM'

  // Son kodu bul
  const lastMaterial = await prisma.costMaterialCatalog.findFirst({
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
  if (lastMaterial) {
    const regex = new RegExp(`${prefix}-?(\\d+)`)
    const match = lastMaterial.code.match(regex)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }

  return `${prefix}-${nextNumber.toString().padStart(3, '0')}`
}

// POST - Yeni katalog malzemesi ekle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role || 'EMPLOYEE'
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { name, code, specification, category, unit, currency, unitPrice, supplierId } = body

    // Sadece nextCode istenmisse otomatik kod dondur
    if (body.getNextCode === true) {
      const nextCode = await generateMaterialCode(category || 'RAW_MATERIAL')
      return NextResponse.json({ nextCode })
    }

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Malzeme adi zorunludur' }, { status: 400 })
    }

    if (unitPrice === undefined || unitPrice === null) {
      return NextResponse.json({ error: 'Birim fiyat zorunludur' }, { status: 400 })
    }

    // Kod verilmemisse otomatik uret
    let materialCode = code?.trim().toUpperCase()
    if (!materialCode) {
      materialCode = await generateMaterialCode(category || 'RAW_MATERIAL')
    }

    const existingMaterial = await prisma.costMaterialCatalog.findUnique({
      where: { code: materialCode },
    })

    if (existingMaterial) {
      return NextResponse.json({ error: 'Bu malzeme kodu zaten mevcut' }, { status: 400 })
    }

    const material = await prisma.costMaterialCatalog.create({
      data: {
        name: name.trim(),
        code: materialCode,
        specification: specification?.trim() || null,
        category: category || 'RAW_MATERIAL',
        unit: unit?.trim() || 'kg',
        currency: currency || 'EUR',
        unitPrice: unitPrice,
        supplierId: supplierId || null,
      },
      include: {
        supplier: true,
      },
    })

    return NextResponse.json(material, { status: 201 })
  } catch (error) {
    console.error('Katalog malzemesi eklenirken hata:', error)
    return NextResponse.json(
      { error: 'Katalog malzemesi eklenirken bir hata olustu' },
      { status: 500 }
    )
  }
}

// PUT - Katalog malzemesi guncelle
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role || 'EMPLOYEE'
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, code, specification, category, unit, currency, unitPrice, supplierId, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Malzeme ID zorunludur' }, { status: 400 })
    }

    const existingMaterial = await prisma.costMaterialCatalog.findUnique({
      where: { id },
    })

    if (!existingMaterial) {
      return NextResponse.json({ error: 'Katalog malzemesi bulunamadi' }, { status: 404 })
    }

    if (code && code.trim().toUpperCase() !== existingMaterial.code) {
      const duplicateCode = await prisma.costMaterialCatalog.findUnique({
        where: { code: code.trim().toUpperCase() },
      })
      if (duplicateCode) {
        return NextResponse.json({ error: 'Bu malzeme kodu zaten mevcut' }, { status: 400 })
      }
    }

    const material = await prisma.costMaterialCatalog.update({
      where: { id },
      data: {
        name: name?.trim() || existingMaterial.name,
        code: code?.trim().toUpperCase() || existingMaterial.code,
        specification: specification !== undefined ? (specification?.trim() || null) : existingMaterial.specification,
        category: category || existingMaterial.category,
        unit: unit !== undefined ? (unit?.trim() || 'kg') : existingMaterial.unit,
        currency: currency || existingMaterial.currency,
        unitPrice: unitPrice !== undefined ? unitPrice : existingMaterial.unitPrice,
        supplierId: supplierId !== undefined ? (supplierId || null) : existingMaterial.supplierId,
        isActive: isActive !== undefined ? isActive : existingMaterial.isActive,
      },
      include: {
        supplier: true,
      },
    })

    return NextResponse.json(material)
  } catch (error) {
    console.error('Katalog malzemesi guncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Katalog malzemesi guncellenirken bir hata olustu' },
      { status: 500 }
    )
  }
}

// DELETE - Katalog malzemesi sil
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role || 'EMPLOYEE'
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Malzeme ID zorunludur' }, { status: 400 })
    }

    const material = await prisma.costMaterialCatalog.findUnique({
      where: { id },
    })

    if (!material) {
      return NextResponse.json({ error: 'Katalog malzemesi bulunamadi' }, { status: 404 })
    }

    await prisma.costMaterialCatalog.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Katalog malzemesi silindi' })
  } catch (error) {
    console.error('Katalog malzemesi silinirken hata:', error)
    return NextResponse.json(
      { error: 'Katalog malzemesi silinirken bir hata olustu' },
      { status: 500 }
    )
  }
}
