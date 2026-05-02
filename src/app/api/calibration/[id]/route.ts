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

// PUT - Cihazı güncelle (ADMIN, Kalite departmanı veya QUALITY_MANAGER)
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
    const { canEditCalibration } = await import('@/lib/calibration-auth')
    if (!canEditCalibration(session.user.role, session.user.ou, session.user.department)) {
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
      plannedCalibrationDate,
      verificationInterval,
      lastVerificationDate,
      plannedVerificationDate,
      certificateNumber,
      notes,
      status,
      imageUrl,
      attachments,
      requiresResponsible,
      deviceCondition,
      calibrationSentDate,
      calibrationReturnDate,
      scrapDate,
      scrapDescription,
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
    } else if (lastCalibrationDate && existingDevice.calibrationInterval) {
      const lastCalDate = new Date(lastCalibrationDate)
      nextCalDate = new Date(lastCalDate.getTime() + existingDevice.calibrationInterval * 24 * 60 * 60 * 1000)
    } else if (calibrationInterval && existingDevice.lastCalibrationDate) {
      nextCalDate = new Date(existingDevice.lastCalibrationDate.getTime() + calibrationInterval * 24 * 60 * 60 * 1000)
    }

    // nextVerificationDate'i yeniden hesapla
    let nextVerDate = existingDevice.nextVerificationDate
    const verInt = verificationInterval ?? existingDevice.verificationInterval
    const lastVerDateVal = lastVerificationDate ? new Date(lastVerificationDate) : existingDevice.lastVerificationDate
    if (verInt && lastVerDateVal) {
      nextVerDate = new Date(lastVerDateVal.getTime() + verInt * 24 * 60 * 60 * 1000)
    }

    // Manuel durum override kontrolü
    let statusManualOverride = existingDevice.statusManualOverride
    if (status === 'IN_PROCESS' || status === 'OUT_OF_ORDER') {
      statusManualOverride = true
    } else if (status === 'VALID' || status === 'EXPIRING' || status === 'EXPIRED' || !status) {
      statusManualOverride = false
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
        plannedCalibrationDate: plannedCalibrationDate !== undefined
          ? (plannedCalibrationDate ? new Date(plannedCalibrationDate) : null)
          : undefined,
        verificationInterval: verificationInterval !== undefined ? (verificationInterval ? parseInt(verificationInterval) : null) : undefined,
        lastVerificationDate: lastVerificationDate !== undefined ? (lastVerificationDate ? new Date(lastVerificationDate) : null) : undefined,
        nextVerificationDate: nextVerDate,
        plannedVerificationDate: plannedVerificationDate !== undefined
          ? (plannedVerificationDate ? new Date(plannedVerificationDate) : null)
          : undefined,
        certificateNumber,
        notes,
        status: status as CalibrationStatus | undefined,
        statusManualOverride,
        imageUrl,
        attachments,
        requiresResponsible,
        deviceCondition: deviceCondition || null,
        calibrationSentDate: calibrationSentDate ? new Date(calibrationSentDate) : null,
        calibrationReturnDate: calibrationReturnDate ? new Date(calibrationReturnDate) : null,
        scrapDate: scrapDate ? new Date(scrapDate) : null,
        scrapDescription: scrapDescription || null,
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

// DELETE - Cihazı sil (soft delete) (ADMIN, Kalite departmanı veya QUALITY_MANAGER)
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
    const { canEditCalibration } = await import('@/lib/calibration-auth')
    if (!canEditCalibration(session.user.role, session.user.ou, session.user.department)) {
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
