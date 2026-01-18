import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Makine listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const machineType = searchParams.get('type')
    const department = searchParams.get('department')
    const criticality = searchParams.get('criticality')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {
      isActive: true,
    }

    if (status) {
      where.status = status
    }

    if (machineType) {
      where.machineType = machineType
    }

    if (department) {
      where.department = department
    }

    if (criticality) {
      where.criticalityLevel = criticality
    }

    if (search) {
      where.OR = [
        { machineCode: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ]
    }

    const machines = await prisma.machine.findMany({
      where,
      orderBy: { machineCode: 'asc' },
      include: {
        _count: {
          select: {
            workOrders: true,
            maintenancePlans: true,
          },
        },
      },
    })

    return NextResponse.json(machines)
  } catch (error) {
    console.error('Error fetching machines:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Yeni makine ekleme
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

    // Makine kodu oluştur
    const lastMachine = await prisma.machine.findFirst({
      where: { machineCode: { startsWith: 'TZG-' } },
      orderBy: { machineCode: 'desc' },
    })

    let nextNumber = 1
    if (lastMachine) {
      const lastNumber = parseInt(lastMachine.machineCode.split('-')[1])
      nextNumber = lastNumber + 1
    }
    const machineCode = `TZG-${nextNumber.toString().padStart(3, '0')}`

    const machine = await prisma.machine.create({
      data: {
        machineCode,
        name: body.name,
        description: body.description,
        machineType: body.machineType || 'OTHER',
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
        status: body.status || 'ACTIVE',
        criticalityLevel: body.criticalityLevel || 'B',
        imageUrl: body.imageUrl,
        notes: body.notes,
      },
    })

    return NextResponse.json(machine, { status: 201 })
  } catch (error) {
    console.error('Error creating machine:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
