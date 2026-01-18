import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CalibrationStatus } from '@/generated/prisma'

// GET - Tek bir cihazı getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Kimlik doğrulama kontrolü
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const device = await prisma.calibrationDevice.findUnique({
      where: { id },
      include: {
        calibrationHistory: {
          orderBy: {
            calibrationDate: 'desc',
          },
        },
      },
    })

    if (!device) {
      return NextResponse.json(
        { error: 'Cihaz bulunamadı' },
        { status: 404 }
      )
    }

    return NextResponse.json(device)
  } catch (error) {
    console.error('Cihaz alınırken hata:', error)
    return NextResponse.json(
      { error: 'Cihaz alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PUT - Cihazı güncelle (QUALITY_MANAGER, ADMIN, SUPER_ADMIN)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Kimlik doğrulama kontrolü
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Yetki kontrolü
    const userRole = session.user.role || 'EMPLOYEE'
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const {
      name,
      type,
      calibrationType,
      manufacturer,
      model,
      serialNumber,
      location,
      department,
      responsiblePerson,
      responsiblePersonEmail,
      calibrationInterval,
      lastCalibrationDate,
      certificateNumber,
      notes,
      status,
      imageUrl,
      attachments,
      requiresResponsible,
    } = body

    // Cihazın var olup olmadığını kontrol et
    const existingDevice = await prisma.calibrationDevice.findUnique({
      where: { id },
    })

    if (!existingDevice) {
      return NextResponse.json(
        { error: 'Cihaz bulunamadı' },
        { status: 404 }
      )
    }

    // nextCalibrationDate'i yeniden hesapla (eğer gerekli alanlar değiştiyse)
    let nextCalDate = existingDevice.nextCalibrationDate
    if (lastCalibrationDate && calibrationInterval) {
      const lastCalDate = new Date(lastCalibrationDate)
      nextCalDate = new Date(lastCalDate.getTime() + calibrationInterval * 24 * 60 * 60 * 1000)
    } else if (lastCalibrationDate) {
      const lastCalDate = new Date(lastCalibrationDate)
      nextCalDate = new Date(lastCalDate.getTime() + existingDevice.calibrationInterval * 24 * 60 * 60 * 1000)
    } else if (calibrationInterval) {
      nextCalDate = new Date(existingDevice.lastCalibrationDate.getTime() + calibrationInterval * 24 * 60 * 60 * 1000)
    }

    const device = await prisma.calibrationDevice.update({
      where: { id },
      data: {
        name,
        type,
        calibrationType,
        manufacturer,
        model,
        serialNumber,
        location,
        department,
        responsiblePerson,
        responsiblePersonEmail,
        calibrationInterval,
        lastCalibrationDate: lastCalibrationDate ? new Date(lastCalibrationDate) : undefined,
        nextCalibrationDate: nextCalDate,
        certificateNumber,
        notes,
        status: status as CalibrationStatus | undefined,
        imageUrl,
        attachments,
        requiresResponsible,
      },
    })

    return NextResponse.json(device)
  } catch (error) {
    console.error('Cihaz güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Cihaz güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Cihazı sil (soft delete) (QUALITY_MANAGER, ADMIN, SUPER_ADMIN)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Kimlik doğrulama kontrolü
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Yetki kontrolü
    const userRole = session.user.role || 'EMPLOYEE'
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params

    const device = await prisma.calibrationDevice.update({
      where: { id },
      data: {
        isActive: false,
      },
    })

    return NextResponse.json(device)
  } catch (error) {
    console.error('Cihaz silinirken hata:', error)
    return NextResponse.json(
      { error: 'Cihaz silinirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
