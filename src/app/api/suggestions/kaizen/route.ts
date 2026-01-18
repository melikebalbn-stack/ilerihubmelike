import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Kaizen proje numarası oluştur: KZN-2025-0001
async function generateProjectNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `KZN-${year}-`

  const lastProject = await prisma.kaizenProject.findFirst({
    where: { projectNumber: { startsWith: prefix } },
    orderBy: { projectNumber: 'desc' }
  })

  let nextNumber = 1
  if (lastProject) {
    const lastNumber = parseInt(lastProject.projectNumber.replace(prefix, ''))
    nextNumber = lastNumber + 1
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

// GET - Kaizen projelerini listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const viewMode = searchParams.get('viewMode') || 'all'
    const status = searchParams.get('status')
    const pdcaStage = searchParams.get('pdcaStage')
    const limit = parseInt(searchParams.get('limit') || '50')
    const userEmail = String(session.user.email).toLowerCase()

    const where: Record<string, unknown> = { isActive: true }

    // Kullanıcının rolünü belirle (kurul üyesi mi?)
    const boardMembers = await prisma.suggestionBoardMember.findMany({
      where: { isActive: true },
      select: { email: true },
    })
    const isBoardMember = boardMembers.some(m => m.email.toLowerCase() === userEmail)

    if (viewMode === 'my') {
      // Sadece kendi projelerini göster
      where.OR = [
        { createdBy: { equals: userEmail, mode: 'insensitive' } },
        { teamLeaderEmail: { equals: userEmail, mode: 'insensitive' } },
        { teamMembers: { some: { email: { equals: userEmail, mode: 'insensitive' } } } }
      ]
    } else if (viewMode === 'all') {
      // Görünürlük kısıtlaması: Kurul üyesi tümünü görsün, diğerleri sadece kendi projelerini
      if (!isBoardMember) {
        where.OR = [
          { createdBy: { equals: userEmail, mode: 'insensitive' } },
          { teamLeaderEmail: { equals: userEmail, mode: 'insensitive' } },
          { teamMembers: { some: { email: { equals: userEmail, mode: 'insensitive' } } } }
        ]
      }
    }

    if (status) {
      where.status = status
    }

    if (pdcaStage) {
      where.pdcaStage = pdcaStage
    }

    const projects = await prisma.kaizenProject.findMany({
      where,
      include: {
        teamMembers: true,
        _count: {
          select: {
            pdcaSteps: true,
            attachments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Kaizen projeleri yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Yeni Kaizen projesi oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      projectType,
      suggestionId,
      problemWhat,
      problemWhy,
      problemWhere,
      problemWhen,
      problemWho,
      problemHow,
      currentState,
      targetState,
      proposedSolution,
      department,
      priority,
      startDate,
      targetEndDate,
      teamMembers
    } = body

    if (!title || !description) {
      return NextResponse.json({ error: 'Başlık ve açıklama zorunludur' }, { status: 400 })
    }

    const projectNumber = await generateProjectNumber()

    // Projeyi oluştur
    const project = await prisma.kaizenProject.create({
      data: {
        projectNumber,
        title,
        description,
        projectType: projectType || 'INDIVIDUAL',
        suggestionId,
        problemWhat,
        problemWhy,
        problemWhere,
        problemWhen,
        problemWho,
        problemHow,
        currentState,
        targetState,
        proposedSolution,
        department,
        priority: priority || 'NORMAL',
        startDate: startDate ? new Date(startDate) : null,
        targetEndDate: targetEndDate ? new Date(targetEndDate) : null,
        teamLeaderEmail: session.user.email,
        teamLeaderName: session.user.name || 'Bilinmiyor',
        createdBy: session.user.email,
        createdByName: session.user.name || 'Bilinmiyor',
        status: 'DRAFT',
        pdcaStage: 'PLAN'
      },
      include: {
        teamMembers: true
      }
    })

    // Takım üyelerini ekle
    if (teamMembers && teamMembers.length > 0) {
      await prisma.kaizenTeamMember.createMany({
        data: teamMembers.map((member: { email: string; name: string; department?: string; role?: string }) => ({
          projectId: project.id,
          email: member.email,
          name: member.name,
          department: member.department,
          role: member.role || 'MEMBER'
        }))
      })
    }

    // Timeline'a ekle
    await prisma.kaizenTimeline.create({
      data: {
        projectId: project.id,
        action: 'CREATED',
        description: 'Kaizen projesi oluşturuldu',
        performedBy: session.user.email,
        performedByName: session.user.name || 'Bilinmiyor',
        newStage: 'PLAN'
      }
    })

    // Güncel projeyi getir
    const updatedProject = await prisma.kaizenProject.findUnique({
      where: { id: project.id },
      include: {
        teamMembers: true,
        pdcaSteps: true
      }
    })

    return NextResponse.json(updatedProject, { status: 201 })
  } catch (error) {
    console.error('Kaizen projesi oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
