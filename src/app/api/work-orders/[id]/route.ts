import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Tek iş emri detayı
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

    const workOrder = await prisma.maintenanceWorkOrder.findUnique({
      where: { id },
      include: {
        machine: true,
        maintenancePlan: true,
        downtimeRecords: {
          orderBy: { startTime: 'desc' },
        },
        sparePartsUsed: {
          include: {
            sparePart: true,
          },
        },
        laborLogs: {
          orderBy: { startTime: 'desc' },
        },
        timeline: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!workOrder) {
      return NextResponse.json({ error: 'Is emri bulunamadi' }, { status: 404 })
    }

    return NextResponse.json(workOrder)
  } catch (error) {
    console.error('Error fetching work order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - İş emri güncelleme
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const existingWO = await prisma.maintenanceWorkOrder.findUnique({
      where: { id },
      include: { machine: true },
    })

    if (!existingWO) {
      return NextResponse.json({ error: 'Is emri bulunamadi' }, { status: 404 })
    }

    const oldStatus = existingWO.status
    const newStatus = body.status

    // Durum değişikliği işlemleri
    const updateData: Record<string, unknown> = {
      title: body.title,
      description: body.description,
      priority: body.priority,
      status: body.status,
      assignedTo: body.assignedTo,
      assignedToName: body.assignedToName,
      assignedTeam: body.assignedTeam,
      failureCode: body.failureCode,
      failureType: body.failureType,
      failureSymptom: body.failureSymptom,
      completionNotes: body.completionNotes,
      rootCause: body.rootCause,
      scheduledStartAt: body.scheduledStartAt ? new Date(body.scheduledStartAt) : null,
      scheduledEndAt: body.scheduledEndAt ? new Date(body.scheduledEndAt) : null,
    }

    // Atama yapılmışsa
    if (body.assignedTo && !existingWO.assignedTo) {
      updateData.assignedAt = new Date()
    }

    // İşe başlandıysa
    if (newStatus === 'IN_PROGRESS' && oldStatus !== 'IN_PROGRESS') {
      updateData.actualStartAt = new Date()
    }

    // Tamamlandıysa
    if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED') {
      updateData.actualEndAt = new Date()
      updateData.completedBy = session.user.email
      updateData.completedByName = session.user.name || session.user.email

      // Makine durumunu aktif yap
      await prisma.machine.update({
        where: { id: existingWO.machineId },
        data: { status: 'ACTIVE' },
      })

      // Duruş kaydını kapat
      const openDowntime = await prisma.downtimeRecord.findFirst({
        where: {
          workOrderId: id,
          endTime: null,
        },
      })

      if (openDowntime) {
        const endTime = new Date()
        const durationMinutes = Math.round(
          (endTime.getTime() - openDowntime.startTime.getTime()) / (1000 * 60)
        )

        await prisma.downtimeRecord.update({
          where: { id: openDowntime.id },
          data: {
            endTime,
            durationMinutes,
          },
        })
      }
    }

    const workOrder = await prisma.maintenanceWorkOrder.update({
      where: { id },
      data: updateData,
    })

    // Timeline kaydı
    if (oldStatus !== newStatus) {
      await prisma.maintenanceTimeline.create({
        data: {
          workOrderId: id,
          action: 'status_changed',
          description: `Durum degistirildi`,
          oldValue: oldStatus,
          newValue: newStatus,
          performedBy: session.user.email!,
          performedByName: session.user.name || session.user.email!,
        },
      })
    }

    return NextResponse.json(workOrder)
  } catch (error) {
    console.error('Error updating work order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
