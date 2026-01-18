import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Tek bakim plani detayi
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const plan = await prisma.maintenancePlan.findUnique({
      where: { id },
      include: {
        machine: true,
        workOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Bakim plani bulunamadi' }, { status: 404 })
    }

    return NextResponse.json(plan)
  } catch (error) {
    console.error('Error fetching maintenance plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Bakim plani guncelleme
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'QUALITY_MANAGER']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Yetkisiz islem' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const plan = await prisma.maintenancePlan.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        maintenanceType: body.maintenanceType,
        frequencyType: body.frequencyType,
        frequencyValue: body.frequencyValue,
        frequencyUnit: body.frequencyUnit,
        estimatedDurationMinutes: body.estimatedDurationMinutes,
        nextDueAt: body.nextDueAt ? new Date(body.nextDueAt) : undefined,
        assignedTeam: body.assignedTeam,
        assignedTo: body.assignedTo,
        assignedToName: body.assignedToName,
        checklistItems: body.checklistItems ? JSON.stringify(body.checklistItems) : undefined,
        requiredParts: body.requiredParts ? JSON.stringify(body.requiredParts) : undefined,
        instructions: body.instructions,
        safetyNotes: body.safetyNotes,
        status: body.status,
      },
    })

    return NextResponse.json(plan)
  } catch (error) {
    console.error('Error updating maintenance plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Bakim plani silme (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Yetkisiz islem' }, { status: 403 })
    }

    const { id } = await params

    await prisma.maintenancePlan.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting maintenance plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Bakim planini calistir (is emri olustur)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const plan = await prisma.maintenancePlan.findUnique({
      where: { id },
      include: { machine: true },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Bakim plani bulunamadi' }, { status: 404 })
    }

    // Is emri numarasi olustur
    const year = new Date().getFullYear()
    const lastWO = await prisma.maintenanceWorkOrder.findFirst({
      where: { workOrderNumber: { startsWith: `WO-${year}-` } },
      orderBy: { workOrderNumber: 'desc' },
    })

    let nextNumber = 1
    if (lastWO) {
      const lastNumber = parseInt(lastWO.workOrderNumber.split('-')[2])
      nextNumber = lastNumber + 1
    }
    const workOrderNumber = `WO-${year}-${nextNumber.toString().padStart(4, '0')}`

    // Is emri olustur
    const workOrder = await prisma.maintenanceWorkOrder.create({
      data: {
        workOrderNumber,
        machineId: plan.machineId,
        maintenancePlanId: plan.id,
        title: `Planli Bakim: ${plan.name}`,
        description: plan.description || `${plan.machine.machineCode} - ${plan.machine.name} icin planli bakim`,
        workOrderType: 'PREVENTIVE',
        priority: 'NORMAL',
        status: 'OPEN',
        reportedBy: session.user.email!,
        reportedByName: session.user.name || session.user.email!,
        assignedTo: plan.assignedTo,
        assignedToName: plan.assignedToName,
        assignedTeam: plan.assignedTeam,
        assignedAt: plan.assignedTo ? new Date() : null,
        scheduledStartAt: new Date(),
        scheduledEndAt: new Date(Date.now() + (plan.estimatedDurationMinutes || 60) * 60 * 1000),
      },
    })

    // Sonraki bakim tarihini guncelle
    let nextDueAt = new Date()
    if (plan.frequencyType === 'TIME_BASED') {
      const days = plan.frequencyValue * (plan.frequencyUnit === 'WEEKS' ? 7 : plan.frequencyUnit === 'MONTHS' ? 30 : 1)
      nextDueAt.setDate(nextDueAt.getDate() + days)
    }

    await prisma.maintenancePlan.update({
      where: { id },
      data: {
        lastPerformedAt: new Date(),
        nextDueAt,
        executionCount: { increment: 1 },
      },
    })

    // Timeline kaydi
    await prisma.maintenanceTimeline.create({
      data: {
        workOrderId: workOrder.id,
        action: 'created',
        description: `Planli bakim is emri olusturuldu: ${workOrderNumber}`,
        performedBy: session.user.email!,
        performedByName: session.user.name || session.user.email!,
      },
    })

    return NextResponse.json(workOrder, { status: 201 })
  } catch (error) {
    console.error('Error executing maintenance plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
