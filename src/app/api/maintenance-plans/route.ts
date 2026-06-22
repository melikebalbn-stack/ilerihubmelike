import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Bakim planlari listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const machineId = searchParams.get('machineId')
    const maintenanceType = searchParams.get('type')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {
      isActive: true,
    }

    if (machineId) {
      where.machineId = machineId
    }

    if (maintenanceType) {
      where.maintenanceType = maintenanceType
    }

    if (status) {
      where.status = status
    }

    const plans = await prisma.maintenancePlan.findMany({
      where,
      orderBy: [
        { nextDueAt: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        machine: {
          select: {
            id: true,
            machineCode: true,
            name: true,
            location: true,
            area: true,
          },
        },
        _count: {
          select: {
            workOrders: true,
          },
        },
      },
    })

    return NextResponse.json(plans)
  } catch (error) {
    console.error('Error fetching maintenance plans:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Yeni bakim plani olusturma
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sadece yetkili roller
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'QUALITY_MANAGER']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Yetkisiz islem' }, { status: 403 })
    }

    const body = await request.json()

    // Plan kodu olustur
    const year = new Date().getFullYear()
    const lastPlan = await prisma.maintenancePlan.findFirst({
      where: { planCode: { startsWith: `PM-${year}-` } },
      orderBy: { planCode: 'desc' },
    })

    let nextNumber = 1
    if (lastPlan) {
      const lastNumber = parseInt(lastPlan.planCode.split('-')[2])
      nextNumber = lastNumber + 1
    }
    const planCode = `PM-${year}-${nextNumber.toString().padStart(4, '0')}`

    // Sonraki bakim tarihini hesapla
    let nextDueAt = new Date()
    if (body.frequencyType === 'TIME_BASED') {
      const days = body.frequencyValue * (body.frequencyUnit === 'WEEKS' ? 7 : body.frequencyUnit === 'MONTHS' ? 30 : 1)
      nextDueAt.setDate(nextDueAt.getDate() + days)
    }

    const plan = await prisma.maintenancePlan.create({
      data: {
        planCode,
        machineId: body.machineId,
        name: body.name,
        description: body.description,
        maintenanceType: body.maintenanceType || 'PREVENTIVE',
        frequencyType: body.frequencyType || 'TIME_BASED',
        frequencyValue: body.frequencyValue || 30,
        frequencyUnit: body.frequencyUnit || 'DAYS',
        estimatedDurationMinutes: body.estimatedDurationMinutes || 60,
        nextDueAt,
        lastPerformedAt: null,
        assignedTeam: body.assignedTeam,
        assignedTo: body.assignedTo,
        assignedToName: body.assignedToName,
        checklistItems: body.checklistItems ? JSON.stringify(body.checklistItems) : null,
        requiredParts: body.requiredParts ? JSON.stringify(body.requiredParts) : null,
        instructions: body.instructions,
        safetyNotes: body.safetyNotes,
        status: 'ACTIVE',
        createdBy: session.user.email!,
        createdByName: session.user.name || session.user.email!,
      },
      include: {
        machine: {
          select: {
            machineCode: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('Error creating maintenance plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
