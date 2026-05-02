import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasCostAnalysisAccess } from '@/lib/cost-analysis/access'

// POST - Yeni revizyon oluştur
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params
    const body = await request.json()
    const { revisionNote } = body

    // Mevcut kullanıcıyı al
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // Kaynak analizi tüm alt kayıtlarıyla yükle
    const source = await prisma.costAnalysis.findUnique({
      where: { id },
      include: {
        materials: true,
        laborItems: true,
        externalServices: true,
        otherCosts: true,
      },
    })

    if (!source) {
      return NextResponse.json({ error: 'Maliyet analizi bulunamadı' }, { status: 404 })
    }

    // Sonraki revizyon numarasını bul
    const maxRevision = await prisma.costAnalysis.aggregate({
      where: { code: source.code },
      _max: { revisionNumber: true },
    })

    const nextRevisionNumber = (maxRevision._max.revisionNumber || 0) + 1
    const revisionLabel = `Rev.${String(nextRevisionNumber).padStart(2, '0')}`

    // Transaction ile revizyon oluştur
    const newAnalysis = await prisma.$transaction(async (tx) => {
      // Eski analiz(ler)de isLatest = false yap
      await tx.costAnalysis.updateMany({
        where: { code: source.code, isLatest: true },
        data: { isLatest: false },
      })

      // Yeni analiz oluştur
      const created = await tx.costAnalysis.create({
        data: {
          code: source.code,
          name: source.name,
          description: source.description,
          revision: revisionLabel,
          revisionNumber: nextRevisionNumber,
          revisionNote: revisionNote?.trim() || null,
          revisionDate: new Date(),
          parentId: source.id,
          isLatest: true,
          finishedWeight: source.finishedWeight,
          currency: source.currency,
          categoryId: source.categoryId,
          customerId: source.customerId,
          materialCost: source.materialCost,
          laborCost: source.laborCost,
          externalCost: source.externalCost,
          otherCost: source.otherCost,
          subtotal: source.subtotal,
          overheadRate: source.overheadRate,
          overheadAmount: source.overheadAmount,
          totalCost: source.totalCost,
          profitRate: source.profitRate,
          profitAmount: source.profitAmount,
          salesPrice: source.salesPrice,
          pricePerKg: source.pricePerKg,
          status: 'DRAFT',
          createdById: user.id,
        },
      })

      // Malzemeleri kopyala
      if (source.materials.length > 0) {
        await tx.costMaterial.createMany({
          data: source.materials.map((m) => ({
            costAnalysisId: created.id,
            materialCode: m.materialCode,
            name: m.name,
            specification: m.specification,
            category: m.category,
            unit: m.unit,
            currency: m.currency,
            grossQuantity: m.grossQuantity,
            wasteRate: m.wasteRate,
            netQuantity: m.netQuantity,
            unitPrice: m.unitPrice,
            totalPrice: m.totalPrice,
            supplierId: m.supplierId,
            sortOrder: m.sortOrder,
          })),
        })
      }

      // İşçilik kalemlerini kopyala
      if (source.laborItems.length > 0) {
        await tx.costLabor.createMany({
          data: source.laborItems.map((l) => ({
            costAnalysisId: created.id,
            operationCode: l.operationCode,
            operationName: l.operationName,
            workCenter: l.workCenter,
            laborType: l.laborType,
            setupTime: l.setupTime,
            processTime: l.processTime,
            totalTime: l.totalTime,
            hourlyRate: l.hourlyRate,
            totalCost: l.totalCost,
            machineId: l.machineId,
            sortOrder: l.sortOrder,
          })),
        })
      }

      // Dış hizmetleri kopyala
      if (source.externalServices.length > 0) {
        await tx.costExternalService.createMany({
          data: source.externalServices.map((s) => ({
            costAnalysisId: created.id,
            serviceCode: s.serviceCode,
            serviceName: s.serviceName,
            description: s.description,
            serviceType: s.serviceType,
            quantity: s.quantity,
            unit: s.unit,
            unitPrice: s.unitPrice,
            totalPrice: s.totalPrice,
            supplierId: s.supplierId,
            sortOrder: s.sortOrder,
          })),
        })
      }

      // Diğer maliyetleri kopyala
      if (source.otherCosts.length > 0) {
        await tx.costOtherItem.createMany({
          data: source.otherCosts.map((o) => ({
            costAnalysisId: created.id,
            name: o.name,
            description: o.description,
            category: o.category,
            quantity: o.quantity,
            unit: o.unit,
            unitPrice: o.unitPrice,
            totalPrice: o.totalPrice,
            sortOrder: o.sortOrder,
          })),
        })
      }

      return created
    })

    return NextResponse.json({
      id: newAnalysis.id,
      code: newAnalysis.code,
      revision: newAnalysis.revision,
      revisionNumber: newAnalysis.revisionNumber,
      message: `${revisionLabel} oluşturuldu`,
    }, { status: 201 })
  } catch (error) {
    console.error('Revizyon oluşturulurken hata:', error)
    return NextResponse.json(
      { error: 'Revizyon oluşturulurken bir hata oluştu' },
      { status: 500 }
    )
  }
}
