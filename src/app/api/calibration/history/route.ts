import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CalibrationResult, CalibrationStatus } from '@/generated/prisma'

// POST - Yeni kalibrasyon kaydı ekle (ADMIN, Kalite departmanı veya QUALITY_MANAGER)
export async function POST(request: NextRequest) {
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

    const body = await request.json()

    const {
      deviceId,
      calibrationDate,
      certificateNumber,
      calibratedBy,
      cost,
      result,
      notes,
      certificatePath,
    } = body

    // Cihazın var olup olmadığını kontrol et
    const device = await prisma.calibrationDevice.findUnique({
      where: { id: deviceId },
    })

    if (!device) {
      return NextResponse.json(
        { error: 'Cihaz bulunamadı' },
        { status: 404 }
      )
    }

    const calDate = new Date(calibrationDate)
    const nextDueDate = new Date(calDate.getTime() + (device.calibrationInterval || 365) * 24 * 60 * 60 * 1000)

    // Kalibrasyon kaydı oluştur
    const history = await prisma.calibrationHistory.create({
      data: {
        deviceId,
        calibrationDate: calDate,
        nextDueDate,
        certificateNumber,
        calibratedBy,
        cost,
        result: result as CalibrationResult,
        notes,
        certificatePath,
      },
    })

    // Cihazın kalibrasyon tarihlerini güncelle
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    let status: CalibrationStatus = CalibrationStatus.VALID
    if (nextDueDate < now) {
      status = CalibrationStatus.EXPIRED
    } else if (nextDueDate <= thirtyDaysFromNow) {
      status = CalibrationStatus.EXPIRING
    }

    await prisma.calibrationDevice.update({
      where: { id: deviceId },
      data: {
        lastCalibrationDate: calDate,
        nextCalibrationDate: nextDueDate,
        certificateNumber,
        status,
        statusManualOverride: false, // Yeni kalibrasyon yapıldı, manuel override sıfırla
      },
    })

    return NextResponse.json(history, { status: 201 })
  } catch (error) {
    console.error('Kalibrasyon kaydı eklenirken hata:', error)
    return NextResponse.json(
      { error: 'Kalibrasyon kaydı eklenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
