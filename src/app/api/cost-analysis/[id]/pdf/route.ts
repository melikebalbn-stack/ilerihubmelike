import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateCostAnalysisPDFBuffer, CostAnalysisForPDF } from '@/lib/pdf/cost-analysis-pdf'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const analysis = await prisma.costAnalysis.findUnique({
      where: { id },
      include: {
        category: true,
        customer: true,
        materials: {
          include: { supplier: true },
          orderBy: { sortOrder: 'asc' },
        },
        laborItems: {
          include: { machine: true },
          orderBy: { sortOrder: 'asc' },
        },
        externalServices: {
          include: { supplier: true },
          orderBy: { sortOrder: 'asc' },
        },
        otherCosts: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Maliyet analizi bulunamadı' }, { status: 404 })
    }

    // Yetki kontrolü
    const userRole = session.user.role || 'EMPLOYEE'
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'QUALITY_MANAGER'].includes(userRole)

    if (!isPrivileged) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
      if (!user || analysis.createdById !== user.id) {
        return NextResponse.json({ error: 'Bu analize erişim yetkiniz yok' }, { status: 403 })
      }
    }

    // Oluşturan kullanıcı
    const createdBy = await prisma.user.findUnique({
      where: { id: analysis.createdById },
      select: { name: true, email: true },
    })

    const pdfData: CostAnalysisForPDF = {
      id: analysis.id,
      code: analysis.code,
      name: analysis.name,
      description: analysis.description,
      revision: analysis.revision,
      finishedWeight: Number(analysis.finishedWeight),
      currency: analysis.currency,
      status: analysis.status,
      materialCost: Number(analysis.materialCost),
      laborCost: Number(analysis.laborCost),
      externalCost: Number(analysis.externalCost),
      otherCost: Number(analysis.otherCost),
      subtotal: Number(analysis.subtotal),
      overheadRate: Number(analysis.overheadRate),
      overheadAmount: Number(analysis.overheadAmount),
      totalCost: Number(analysis.totalCost),
      profitRate: Number(analysis.profitRate),
      profitAmount: Number(analysis.profitAmount),
      salesPrice: Number(analysis.salesPrice),
      pricePerKg: Number(analysis.pricePerKg),
      createdAt: analysis.createdAt.toISOString(),
      updatedAt: analysis.updatedAt.toISOString(),
      categoryName: analysis.category?.name || null,
      customerName: analysis.customer?.name || null,
      createdByName: createdBy?.name || createdBy?.email || null,
      materials: analysis.materials.map(m => ({
        name: m.name,
        materialCode: m.materialCode,
        specification: m.specification,
        category: m.category,
        unit: m.unit,
        grossQuantity: Number(m.grossQuantity),
        wasteRate: Number(m.wasteRate),
        netQuantity: Number(m.netQuantity),
        unitPrice: Number(m.unitPrice),
        totalPrice: Number(m.totalPrice),
        supplierName: m.supplier?.name || null,
      })),
      laborItems: analysis.laborItems.map(l => ({
        operationName: l.operationName,
        operationCode: l.operationCode,
        workCenter: l.workCenter,
        laborType: l.laborType,
        setupTime: Number(l.setupTime),
        processTime: Number(l.processTime),
        totalTime: Number(l.totalTime),
        hourlyRate: Number(l.hourlyRate),
        totalCost: Number(l.totalCost),
        machineName: l.machine?.name || null,
      })),
      externalServices: analysis.externalServices.map(s => ({
        serviceName: s.serviceName,
        serviceCode: s.serviceCode,
        description: s.description,
        serviceType: s.serviceType,
        quantity: Number(s.quantity),
        unit: s.unit,
        unitPrice: Number(s.unitPrice),
        totalPrice: Number(s.totalPrice),
        supplierName: s.supplier?.name || null,
      })),
      otherCosts: analysis.otherCosts.map(o => ({
        name: o.name,
        description: o.description,
        category: o.category,
        quantity: Number(o.quantity),
        unitPrice: Number(o.unitPrice),
        totalPrice: Number(o.totalPrice),
      })),
    }

    const pdfBuffer = generateCostAnalysisPDFBuffer(pdfData)

    const fileName = `Maliyet_Analizi_${analysis.code}_${analysis.revision}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Maliyet analizi PDF oluşturulurken hata:', error)
    return NextResponse.json({ error: 'PDF oluşturulamadı' }, { status: 500 })
  }
}
