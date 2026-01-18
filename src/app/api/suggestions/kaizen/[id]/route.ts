import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PDCAStage, KaizenStatus } from '@/generated/prisma'

// GET - Kaizen proje detayı
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

    const project = await prisma.kaizenProject.findUnique({
      where: { id },
      include: {
        teamMembers: true,
        pdcaSteps: {
          orderBy: [{ stage: 'asc' }, { stepNumber: 'asc' }]
        },
        attachments: {
          orderBy: { createdAt: 'desc' }
        },
        timeline: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Kaizen projesi yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Kaizen projesini güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const existingProject = await prisma.kaizenProject.findUnique({
      where: { id }
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 })
    }

    const {
      title,
      description,
      projectType,
      problemWhat,
      problemWhy,
      problemWhere,
      problemWhen,
      problemWho,
      problemHow,
      currentState,
      currentMetrics,
      targetState,
      targetMetrics,
      rootCauseAnalysis,
      proposedSolution,
      actionPlan,
      pdcaStage,
      status,
      priority,
      startDate,
      targetEndDate,
      actualEndDate,
      resultSummary,
      actualSavings,
      qualityImprovement,
      efficiencyImprovement
    } = body

    // Aşama değişikliği varsa timeline'a ekle
    const oldStage = existingProject.pdcaStage
    const newStage = pdcaStage as PDCAStage | undefined

    const project = await prisma.kaizenProject.update({
      where: { id },
      data: {
        title,
        description,
        projectType,
        problemWhat,
        problemWhy,
        problemWhere,
        problemWhen,
        problemWho,
        problemHow,
        currentState,
        currentMetrics,
        targetState,
        targetMetrics,
        rootCauseAnalysis,
        proposedSolution,
        actionPlan,
        pdcaStage: newStage,
        status: status as KaizenStatus | undefined,
        priority,
        startDate: startDate ? new Date(startDate) : existingProject.startDate,
        targetEndDate: targetEndDate ? new Date(targetEndDate) : existingProject.targetEndDate,
        actualEndDate: actualEndDate ? new Date(actualEndDate) : existingProject.actualEndDate,
        resultSummary,
        actualSavings: actualSavings ? parseFloat(actualSavings) : existingProject.actualSavings,
        qualityImprovement: qualityImprovement ? parseFloat(qualityImprovement) : existingProject.qualityImprovement,
        efficiencyImprovement: efficiencyImprovement ? parseFloat(efficiencyImprovement) : existingProject.efficiencyImprovement
      },
      include: {
        teamMembers: true,
        pdcaSteps: true
      }
    })

    // PDCA aşama değişikliği timeline'ı
    if (newStage && oldStage !== newStage) {
      const stageLabels: Record<string, string> = {
        PLAN: 'Planla',
        DO: 'Uygula',
        CHECK: 'Kontrol Et',
        ACT: 'Önlem Al'
      }

      await prisma.kaizenTimeline.create({
        data: {
          projectId: id,
          action: 'STAGE_CHANGED',
          description: `PDCA aşaması değiştirildi: ${stageLabels[newStage]}`,
          performedBy: session.user.email,
          performedByName: session.user.name || 'Bilinmiyor',
          oldStage,
          newStage
        }
      })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Kaizen projesi güncellenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Kaizen projesini sil (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existingProject = await prisma.kaizenProject.findUnique({
      where: { id }
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 })
    }

    // Sadece oluşturan kişi veya takım lideri silebilir
    if (existingProject.createdBy !== session.user.email &&
        existingProject.teamLeaderEmail !== session.user.email) {
      return NextResponse.json({ error: 'Bu projeyi silme yetkiniz yok' }, { status: 403 })
    }

    await prisma.kaizenProject.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Kaizen projesi silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
