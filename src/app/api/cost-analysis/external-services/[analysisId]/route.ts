import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recalculateCosts } from '@/lib/cost-analysis/calculations'

// GET - Dış hizmetleri listele
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

    const services = await prisma.costExternalService.findMany({
      where: { costAnalysisId: analysisId },
      include: {
        supplier: true,
      },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(services)
  } catch (error) {
    console.error('Dış hizmetler alınırken hata:', error)
    return NextResponse.json(
      { error: 'Dış hizmetler alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni dış hizmet ekle
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
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
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
        { error: 'Onaylı analizlere dış hizmet eklenemez' },
        { status: 400 }
      )
    }

    const {
      serviceName,
      description,
      serviceType,
      unitPrice,
      quantity,
      supplierId,
    } = body

    // Validasyonlar
    if (!serviceName || serviceName.trim() === '') {
      return NextResponse.json({ error: 'Hizmet adı zorunludur' }, { status: 400 })
    }

    const price = parseFloat(unitPrice) || 0
    const qty = parseFloat(quantity) || 1
    const totalPrice = price * qty

    // Sıralama için son kayıt
    const lastService = await prisma.costExternalService.findFirst({
      where: { costAnalysisId: analysisId },
      orderBy: { sortOrder: 'desc' },
    })

    const service = await prisma.costExternalService.create({
      data: {
        costAnalysisId: analysisId,
        serviceName: serviceName.trim(),
        description: description?.trim() || null,
        serviceType: serviceType || 'OTHER',
        unitPrice: price,
        quantity: qty,
        totalPrice,
        supplierId: supplierId || null,
        sortOrder: (lastService?.sortOrder || 0) + 1,
      },
      include: {
        supplier: true,
      },
    })

    // Toplam maliyetleri yeniden hesapla
    await recalculateCosts(analysisId)

    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    console.error('Dış hizmet eklenirken hata:', error)
    return NextResponse.json(
      { error: 'Dış hizmet eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Dış hizmet güncelle
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
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { analysisId } = await params
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Hizmet ID zorunludur' }, { status: 400 })
    }

    // Mevcut hizmeti kontrol et
    const existingService = await prisma.costExternalService.findUnique({
      where: { id },
    })

    if (!existingService || existingService.costAnalysisId !== analysisId) {
      return NextResponse.json({ error: 'Hizmet bulunamadı' }, { status: 404 })
    }

    const price = parseFloat(updateData.unitPrice) || existingService.unitPrice.toNumber()
    const qty = parseFloat(updateData.quantity) || existingService.quantity.toNumber()
    const totalPrice = price * qty

    const service = await prisma.costExternalService.update({
      where: { id },
      data: {
        serviceName: updateData.serviceName?.trim() || existingService.serviceName,
        description: updateData.description?.trim() ?? existingService.description,
        serviceType: updateData.serviceType || existingService.serviceType,
        unitPrice: price,
        quantity: qty,
        totalPrice,
        supplierId: updateData.supplierId !== undefined ? (updateData.supplierId || null) : existingService.supplierId,
        sortOrder: updateData.sortOrder ?? existingService.sortOrder,
      },
      include: {
        supplier: true,
      },
    })

    // Toplam maliyetleri yeniden hesapla
    await recalculateCosts(analysisId)

    return NextResponse.json(service)
  } catch (error) {
    console.error('Dış hizmet güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Dış hizmet güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Dış hizmet sil
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
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { analysisId } = await params
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json({ error: 'Hizmet ID zorunludur' }, { status: 400 })
    }

    const service = await prisma.costExternalService.findUnique({
      where: { id: itemId },
    })

    if (!service || service.costAnalysisId !== analysisId) {
      return NextResponse.json({ error: 'Hizmet bulunamadı' }, { status: 404 })
    }

    await prisma.costExternalService.delete({
      where: { id: itemId },
    })

    // Toplam maliyetleri yeniden hesapla
    await recalculateCosts(analysisId)

    return NextResponse.json({ message: 'Dış hizmet silindi' })
  } catch (error) {
    console.error('Dış hizmet silinirken hata:', error)
    return NextResponse.json(
      { error: 'Dış hizmet silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
