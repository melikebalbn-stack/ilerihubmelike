import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recalculateCosts } from '@/lib/cost-analysis/calculations'
import { hasCostAnalysisAccess } from '@/lib/cost-analysis/access'

// GET - Analiz malzemelerini listele
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { analysisId } = await params

    const materials = await prisma.costMaterial.findMany({
      where: { costAnalysisId: analysisId },
      include: {
        supplier: true,
      },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(materials)
  } catch (error) {
    console.error('Malzemeler alınırken hata:', error)
    return NextResponse.json(
      { error: 'Malzemeler alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni malzeme ekle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role || 'EMPLOYEE'
    if (!hasCostAnalysisAccess(userRole, session.user.email)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { analysisId } = await params
    const body = await request.json()

    // Analiz kontrolü
    const analysis = await prisma.costAnalysis.findUnique({
      where: { id: analysisId },
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Maliyet analizi bulunamadı' }, { status: 404 })
    }

    if (analysis.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Onaylı analizlere malzeme eklenemez' },
        { status: 400 }
      )
    }

    const {
      materialCode,
      name,
      specification,
      category,
      unit,
      currency,
      grossQuantity,
      wasteRate,
      unitPrice,
      supplierId,
    } = body

    // Validasyonlar
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Malzeme adı zorunludur' }, { status: 400 })
    }

    const grossQty = parseFloat(grossQuantity) || 0
    const waste = parseFloat(wasteRate) || 0
    const price = parseFloat(unitPrice) || 0

    // Hesaplamalar
    const netQuantity = grossQty * (1 + waste / 100)
    const totalPrice = netQuantity * price

    // Sıralama için son kayıt
    const lastMaterial = await prisma.costMaterial.findFirst({
      where: { costAnalysisId: analysisId },
      orderBy: { sortOrder: 'desc' },
    })

    const material = await prisma.costMaterial.create({
      data: {
        costAnalysisId: analysisId,
        materialCode: materialCode?.trim() || null,
        name: name.trim(),
        specification: specification?.trim() || null,
        category: category || 'RAW_MATERIAL',
        unit: unit || 'kg',
        currency: currency || 'EUR',
        grossQuantity: grossQty,
        wasteRate: waste,
        netQuantity,
        unitPrice: price,
        totalPrice,
        supplierId: supplierId || null,
        sortOrder: (lastMaterial?.sortOrder || 0) + 1,
      },
      include: {
        supplier: true,
      },
    })

    // Toplam maliyetleri yeniden hesapla
    await recalculateCosts(analysisId)

    return NextResponse.json(material, { status: 201 })
  } catch (error) {
    console.error('Malzeme eklenirken hata:', error)
    return NextResponse.json(
      { error: 'Malzeme eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Malzeme güncelle (bulk update için)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role || 'EMPLOYEE'
    if (!hasCostAnalysisAccess(userRole, session.user.email)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { analysisId } = await params
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Malzeme ID zorunludur' }, { status: 400 })
    }

    // Mevcut malzemeyi kontrol et
    const existingMaterial = await prisma.costMaterial.findUnique({
      where: { id },
    })

    if (!existingMaterial || existingMaterial.costAnalysisId !== analysisId) {
      return NextResponse.json({ error: 'Malzeme bulunamadı' }, { status: 404 })
    }

    const grossQty = parseFloat(updateData.grossQuantity) || existingMaterial.grossQuantity.toNumber()
    const waste = parseFloat(updateData.wasteRate) || existingMaterial.wasteRate.toNumber()
    const price = parseFloat(updateData.unitPrice) || existingMaterial.unitPrice.toNumber()

    const netQuantity = grossQty * (1 + waste / 100)
    const totalPrice = netQuantity * price

    const material = await prisma.costMaterial.update({
      where: { id },
      data: {
        materialCode: updateData.materialCode?.trim() ?? existingMaterial.materialCode,
        name: updateData.name?.trim() || existingMaterial.name,
        specification: updateData.specification?.trim() ?? existingMaterial.specification,
        category: updateData.category || existingMaterial.category,
        unit: updateData.unit || existingMaterial.unit,
        currency: updateData.currency || existingMaterial.currency,
        grossQuantity: grossQty,
        wasteRate: waste,
        netQuantity,
        unitPrice: price,
        totalPrice,
        supplierId: updateData.supplierId !== undefined ? (updateData.supplierId || null) : existingMaterial.supplierId,
        sortOrder: updateData.sortOrder ?? existingMaterial.sortOrder,
      },
      include: {
        supplier: true,
      },
    })

    // Toplam maliyetleri yeniden hesapla
    await recalculateCosts(analysisId)

    return NextResponse.json(material)
  } catch (error) {
    console.error('Malzeme güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Malzeme güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Malzeme sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role || 'EMPLOYEE'
    if (!hasCostAnalysisAccess(userRole, session.user.email)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { analysisId } = await params
    const { searchParams } = new URL(request.url)
    const materialId = searchParams.get('id')

    if (!materialId) {
      return NextResponse.json({ error: 'Malzeme ID zorunludur' }, { status: 400 })
    }

    const material = await prisma.costMaterial.findUnique({
      where: { id: materialId },
    })

    if (!material || material.costAnalysisId !== analysisId) {
      return NextResponse.json({ error: 'Malzeme bulunamadı' }, { status: 404 })
    }

    await prisma.costMaterial.delete({
      where: { id: materialId },
    })

    // Toplam maliyetleri yeniden hesapla
    await recalculateCosts(analysisId)

    return NextResponse.json({ message: 'Malzeme silindi' })
  } catch (error) {
    console.error('Malzeme silinirken hata:', error)
    return NextResponse.json(
      { error: 'Malzeme silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
