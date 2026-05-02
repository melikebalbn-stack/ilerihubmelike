import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recalculateCosts } from '@/lib/cost-analysis/calculations'
import { hasCostAnalysisAccess } from '@/lib/cost-analysis/access'

// GET - Analiz işçiliklerini listele
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

    const laborItems = await prisma.costLabor.findMany({
      where: { costAnalysisId: analysisId },
      include: {
        machine: true,
      },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(laborItems)
  } catch (error) {
    console.error('İşçilikler alınırken hata:', error)
    return NextResponse.json(
      { error: 'İşçilikler alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni işçilik ekle
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
        { error: 'Onaylı analizlere işçilik eklenemez' },
        { status: 400 }
      )
    }

    const {
      operationCode,
      operationName,
      workCenter,
      laborType,
      setupTime,
      processTime,
      hourlyRate,
      machineId,
    } = body

    if (!operationName || operationName.trim() === '') {
      return NextResponse.json({ error: 'Operasyon adı zorunludur' }, { status: 400 })
    }

    const setup = parseFloat(setupTime) || 0
    const process = parseFloat(processTime) || 0
    const rate = parseFloat(hourlyRate) || 0

    const totalTime = setup + process
    const totalCost = totalTime * rate

    const lastLabor = await prisma.costLabor.findFirst({
      where: { costAnalysisId: analysisId },
      orderBy: { sortOrder: 'desc' },
    })

    const labor = await prisma.costLabor.create({
      data: {
        costAnalysisId: analysisId,
        operationCode: operationCode?.trim() || null,
        operationName: operationName.trim(),
        workCenter: workCenter?.trim() || null,
        laborType: laborType || 'INTERNAL',
        setupTime: setup,
        processTime: process,
        totalTime,
        hourlyRate: rate,
        totalCost,
        machineId: machineId || null,
        sortOrder: (lastLabor?.sortOrder || 0) + 1,
      },
      include: {
        machine: true,
      },
    })

    await recalculateCosts(analysisId)

    return NextResponse.json(labor, { status: 201 })
  } catch (error) {
    console.error('İşçilik eklenirken hata:', error)
    return NextResponse.json(
      { error: 'İşçilik eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - İşçilik güncelle
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
      return NextResponse.json({ error: 'İşçilik ID zorunludur' }, { status: 400 })
    }

    const existingLabor = await prisma.costLabor.findUnique({
      where: { id },
    })

    if (!existingLabor || existingLabor.costAnalysisId !== analysisId) {
      return NextResponse.json({ error: 'İşçilik bulunamadı' }, { status: 404 })
    }

    const setup = parseFloat(updateData.setupTime) ?? existingLabor.setupTime.toNumber()
    const process = parseFloat(updateData.processTime) ?? existingLabor.processTime.toNumber()
    const rate = parseFloat(updateData.hourlyRate) ?? existingLabor.hourlyRate.toNumber()

    const totalTime = setup + process
    const totalCost = totalTime * rate

    const labor = await prisma.costLabor.update({
      where: { id },
      data: {
        operationCode: updateData.operationCode?.trim() ?? existingLabor.operationCode,
        operationName: updateData.operationName?.trim() || existingLabor.operationName,
        workCenter: updateData.workCenter?.trim() ?? existingLabor.workCenter,
        laborType: updateData.laborType || existingLabor.laborType,
        setupTime: setup,
        processTime: process,
        totalTime,
        hourlyRate: rate,
        totalCost,
        machineId: updateData.machineId !== undefined ? (updateData.machineId || null) : existingLabor.machineId,
        sortOrder: updateData.sortOrder ?? existingLabor.sortOrder,
      },
      include: {
        machine: true,
      },
    })

    await recalculateCosts(analysisId)

    return NextResponse.json(labor)
  } catch (error) {
    console.error('İşçilik güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'İşçilik güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - İşçilik sil
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
    const laborId = searchParams.get('id')

    if (!laborId) {
      return NextResponse.json({ error: 'İşçilik ID zorunludur' }, { status: 400 })
    }

    const labor = await prisma.costLabor.findUnique({
      where: { id: laborId },
    })

    if (!labor || labor.costAnalysisId !== analysisId) {
      return NextResponse.json({ error: 'İşçilik bulunamadı' }, { status: 404 })
    }

    await prisma.costLabor.delete({
      where: { id: laborId },
    })

    await recalculateCosts(analysisId)

    return NextResponse.json({ message: 'İşçilik silindi' })
  } catch (error) {
    console.error('İşçilik silinirken hata:', error)
    return NextResponse.json(
      { error: 'İşçilik silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
