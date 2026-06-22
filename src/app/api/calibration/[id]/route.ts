import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CalibrationStatus } from '@/generated/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

// GET - Tek bir cihazı getir
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-calibration: requireSession — sade auth (DB hit yok)
    const { error } = await requireSession()
    if (error) return error

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
    // PR-Y2.5-calibration: requireUser → user.role/department + session.user.ou
    const { session, user, error } = await requireUser()
    if (error) return error

    // Yetki kontrolü
    if (!session.user.permissions?.includes("kalibrasyon.admin")) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    let {
      responsiblePersonEmail,
    } = body
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
      calibrationInterval,
      lastCalibrationDate,
      plannedCalibrationDate,
      verificationInterval,
      lastVerificationDate,
      plannedVerificationDate,
      purchaseDate,
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

    // PR-Y2.5-calibration: input boundary normalization — DB email lowercase invariant
    if (typeof responsiblePersonEmail === 'string' && responsiblePersonEmail.trim() !== '') {
      responsiblePersonEmail = responsiblePersonEmail.toLowerCase()
    }

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
        purchaseDate: purchaseDate !== undefined
          ? (purchaseDate ? new Date(purchaseDate) : null)
          : undefined,
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-calibration: requireUser → user.role/department + session.user.ou
    const { session, user, error } = await requireUser()
    if (error) return error

    // Yetki kontrolü
    if (!session.user.permissions?.includes("kalibrasyon.admin")) {
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
