import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PDCAStage, KaizenStatus } from '@/generated/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Kaizen proje detayı
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-suggestions: requireSession — sade auth, DB hit yok
    const { error } = await requireSession()
    if (error) return error

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
    // PR-Y2.5-suggestions: requireUser
    const { user, error } = await requireUser()
    if (error) return error

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
          performedBy: user.email,
          performedByName: user.name ?? user.email,
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-suggestions: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const existingProject = await prisma.kaizenProject.findUnique({
      where: { id }
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 })
    }

    // Sadece oluşturan kişi veya takım lideri silebilir
    // PR-EMAIL-NORMALIZE sonrası DB casing lowercase, user.email lowercase → match güvenli
    if (existingProject.createdBy !== user.email &&
        existingProject.teamLeaderEmail !== user.email) {
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
