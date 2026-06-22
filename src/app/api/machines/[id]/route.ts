import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Tek makine detayı
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

    const machine = await prisma.machine.findUnique({
      where: { id },
      include: {
        maintenancePlans: {
          where: { isActive: true },
          orderBy: { nextDueAt: 'asc' },
        },
        workOrders: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        downtimeRecords: {
          orderBy: { startTime: 'desc' },
          take: 10,
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        oeeRecords: {
          orderBy: { recordDate: 'desc' },
          take: 30,
        },
      },
    })

    if (!machine) {
      return NextResponse.json({ error: 'Makine bulunamadi' }, { status: 404 })
    }

    return NextResponse.json(machine)
  } catch (error) {
    console.error('Error fetching machine:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Makine güncelleme
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

    const machine = await prisma.machine.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        machineType: body.machineType,
        manufacturer: body.manufacturer,
        model: body.model,
        serialNumber: body.serialNumber,
        yearOfManufacture: body.yearOfManufacture ? parseInt(body.yearOfManufacture) : null,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
        warrantyEndDate: body.warrantyEndDate ? new Date(body.warrantyEndDate) : null,
        location: body.location,
        area: body.area,
        department: body.department,
        responsibleEmail: body.responsibleEmail,
        responsibleName: body.responsibleName,
        specifications: body.specifications ? JSON.stringify(body.specifications) : null,
        status: body.status,
        criticalityLevel: body.criticalityLevel,
        operatingHoursCounter: body.operatingHoursCounter,
        imageUrl: body.imageUrl,
        notes: body.notes,
      },
    })

    return NextResponse.json(machine)
  } catch (error) {
    console.error('Error updating machine:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Makine silme (soft delete)
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

    await prisma.machine.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting machine:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
