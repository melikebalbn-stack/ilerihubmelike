import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recalculateCosts } from '@/lib/cost-analysis/calculations'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Diğer maliyetleri listele
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    // PR-Y2.5-cost-analysis: requireSession (read-only liste)
    const { error } = await requireSession()
    if (error) return error

    const { analysisId } = await params

    const otherCosts = await prisma.costOtherItem.findMany({
      where: { costAnalysisId: analysisId },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(otherCosts)
  } catch (error) {
    console.error('Diğer maliyetler alınırken hata:', error)
    return NextResponse.json(
      { error: 'Diğer maliyetler alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni maliyet kalemi ekle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { session, user, error } = await requireUser()
    if (error) return error
    if (!(session.user.permissions?.includes('costanalysis.admin') ?? false)) {
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
        { error: 'Onaylı analizlere maliyet kalemi eklenemez' },
        { status: 400 }
      )
    }

    const {
      itemName,
      description,
      costType,
      unitPrice,
      quantity,
    } = body

    // Validasyonlar
    if (!itemName || itemName.trim() === '') {
      return NextResponse.json({ error: 'Kalem adı zorunludur' }, { status: 400 })
    }

    const price = parseFloat(unitPrice) || 0
    const qty = parseFloat(quantity) || 1
    const totalPrice = price * qty

    // Sıralama için son kayıt
    const lastItem = await prisma.costOtherItem.findFirst({
      where: { costAnalysisId: analysisId },
      orderBy: { sortOrder: 'desc' },
    })

    const item = await prisma.costOtherItem.create({
      data: {
        costAnalysisId: analysisId,
        name: itemName.trim(),
        description: description?.trim() || null,
        category: costType || 'OTHER',
        unitPrice: price,
        quantity: qty,
        totalPrice,
        sortOrder: (lastItem?.sortOrder || 0) + 1,
      },
    })

    await recalculateCosts(analysisId)

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Maliyet kalemi eklenirken hata:', error)
    return NextResponse.json(
      { error: 'Maliyet kalemi eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Maliyet kalemi güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { session, user, error } = await requireUser()
    if (error) return error
    if (!(session.user.permissions?.includes('costanalysis.admin') ?? false)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { analysisId } = await params
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Kalem ID zorunludur' }, { status: 400 })
    }

    // Mevcut kalemi kontrol et
    const existingItem = await prisma.costOtherItem.findUnique({
      where: { id },
    })

    if (!existingItem || existingItem.costAnalysisId !== analysisId) {
      return NextResponse.json({ error: 'Kalem bulunamadı' }, { status: 404 })
    }

    const price = parseFloat(updateData.unitPrice) || existingItem.unitPrice.toNumber()
    const qty = parseFloat(updateData.quantity) || existingItem.quantity.toNumber()
    const totalPrice = price * qty

    const item = await prisma.costOtherItem.update({
      where: { id },
      data: {
        name: updateData.itemName?.trim() || existingItem.name,
        description: updateData.description?.trim() ?? existingItem.description,
        category: updateData.costType || existingItem.category,
        unitPrice: price,
        quantity: qty,
        totalPrice,
        sortOrder: updateData.sortOrder ?? existingItem.sortOrder,
      },
    })

    await recalculateCosts(analysisId)

    return NextResponse.json(item)
  } catch (error) {
    console.error('Maliyet kalemi güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Maliyet kalemi güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Maliyet kalemi sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess
    const { session, user, error } = await requireUser()
    if (error) return error
    if (!(session.user.permissions?.includes('costanalysis.admin') ?? false)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { analysisId } = await params
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json({ error: 'Kalem ID zorunludur' }, { status: 400 })
    }

    const item = await prisma.costOtherItem.findUnique({
      where: { id: itemId },
    })

    if (!item || item.costAnalysisId !== analysisId) {
      return NextResponse.json({ error: 'Kalem bulunamadı' }, { status: 404 })
    }

    await prisma.costOtherItem.delete({
      where: { id: itemId },
    })

    await recalculateCosts(analysisId)

    return NextResponse.json({ message: 'Maliyet kalemi silindi' })
  } catch (error) {
    console.error('Maliyet kalemi silinirken hata:', error)
    return NextResponse.json(
      { error: 'Maliyet kalemi silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
