import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - İş emri listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // FIX #15: Pagination parametreleri
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50')), 100)
    const skip = (page - 1) * limit
    const search = searchParams.get('search')

    // Filtre parametreleri
    const status = searchParams.get('status')
    const machineId = searchParams.get('machineId')
    const type = searchParams.get('type')
    const priority = searchParams.get('priority')
    const assignedTo = searchParams.get('assignedTo')

    const where: Record<string, unknown> = {
      isActive: true,
    }

    if (status) {
      where.status = status
    }

    if (machineId) {
      where.machineId = machineId
    }

    if (type) {
      where.workOrderType = type
    }

    if (priority) {
      where.priority = priority
    }

    if (assignedTo) {
      where.assignedTo = assignedTo
    }

    // Arama filtresi
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { workOrderNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // FIX #15: Paralel sorgu - data + count
    const [workOrders, total] = await Promise.all([
      prisma.maintenanceWorkOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { priority: 'asc' },
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
          maintenancePlan: {
            select: {
              id: true,
              planCode: true,
              name: true,
            },
          },
          _count: {
            select: {
              downtimeRecords: true,
              sparePartsUsed: true,
              laborLogs: true,
            },
          },
        },
      }),
      prisma.maintenanceWorkOrder.count({ where })
    ])

    return NextResponse.json({
      data: workOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    })
  } catch (error) {
    console.error('Error fetching work orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Yeni iş emri (arıza bildirimi)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // İş emri numarası oluştur
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

    const workOrder = await prisma.maintenanceWorkOrder.create({
      data: {
        workOrderNumber,
        machineId: body.machineId,
        maintenancePlanId: body.maintenancePlanId,
        title: body.title,
        description: body.description,
        workOrderType: body.workOrderType || 'BREAKDOWN',
        priority: body.priority || 'NORMAL',
        status: 'OPEN',
        reportedBy: session.user.email!,
        reportedByName: session.user.name || session.user.email!,
        failureCode: body.failureCode,
        failureType: body.failureType,
        failureSymptom: body.failureSymptom,
        assignedTo: body.assignedTo,
        assignedToName: body.assignedToName,
        assignedTeam: body.assignedTeam,
        assignedAt: body.assignedTo ? new Date() : null,
        scheduledStartAt: body.scheduledStartAt ? new Date(body.scheduledStartAt) : null,
        scheduledEndAt: body.scheduledEndAt ? new Date(body.scheduledEndAt) : null,
        attachments: body.attachments ? JSON.stringify(body.attachments) : null,
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

    // Makine durumunu arızalı yap (breakdown ise)
    if (body.workOrderType === 'BREAKDOWN') {
      await prisma.machine.update({
        where: { id: body.machineId },
        data: { status: 'BREAKDOWN' },
      })

      // Duruş kaydı oluştur
      await prisma.downtimeRecord.create({
        data: {
          machineId: body.machineId,
          workOrderId: workOrder.id,
          startTime: new Date(),
          downtimeType: 'BREAKDOWN',
          downtimeReason: body.title,
          recordedBy: session.user.email!,
          recordedByName: session.user.name || session.user.email!,
        },
      })
    }

    // Timeline kaydı
    await prisma.maintenanceTimeline.create({
      data: {
        workOrderId: workOrder.id,
        action: 'created',
        description: `Is emri olusturuldu: ${workOrderNumber}`,
        performedBy: session.user.email!,
        performedByName: session.user.name || session.user.email!,
      },
    })

    return NextResponse.json(workOrder, { status: 201 })
  } catch (error) {
    console.error('Error creating work order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
