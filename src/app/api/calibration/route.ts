import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CalibrationStatus } from '@/generated/prisma'

// GET - Tüm cihazları listele
export async function GET(request: NextRequest) {
  try {
    // Kimlik doğrulama kontrolü
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')

    const where: any = {
      isActive: true,
    }

    if (search) {
      where.OR = [
        { deviceId: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status && status !== 'all') {
      where.status = status as CalibrationStatus
    }

    const devices = await prisma.calibrationDevice.findMany({
      where,
      include: {
        calibrationHistory: {
          orderBy: {
            calibrationDate: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Durum güncellemelerini kontrol et (batch olarak)
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const devicesToUpdate: { id: string; status: CalibrationStatus }[] = []

    for (const device of devices) {
      // Manuel override edilen cihazları atla (IN_PROCESS, OUT_OF_ORDER)
      if (device.statusManualOverride) continue

      let newStatus = device.status

      // Doğrulama tipinde doğrulama tarihine göre, diğerlerinde kalibrasyon tarihine göre durum belirle
      const refDate = device.calibrationType === 'Doğrulama' && device.nextVerificationDate
        ? device.nextVerificationDate
        : device.nextCalibrationDate

      if (!refDate) continue

      if (refDate < now && device.status !== CalibrationStatus.EXPIRED) {
        newStatus = CalibrationStatus.EXPIRED
      } else if (
        refDate > now &&
        refDate <= thirtyDaysFromNow &&
        device.status === CalibrationStatus.VALID
      ) {
        newStatus = CalibrationStatus.EXPIRING
      }

      if (newStatus !== device.status) {
        devicesToUpdate.push({ id: device.id, status: newStatus })
        device.status = newStatus
      }
    }

    // Batch update - tek transaction'da tüm güncellemeleri yap
    if (devicesToUpdate.length > 0) {
      await prisma.$transaction(
        devicesToUpdate.map((update) =>
          prisma.calibrationDevice.update({
            where: { id: update.id },
            data: { status: update.status },
          })
        )
      )
    }

    return NextResponse.json(devices)
  } catch (error) {
    console.error('Kalibrasyon cihazları alınırken hata:', error)
    return NextResponse.json(
      { error: 'Cihazlar alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Yeni cihaz ekle
export async function POST(request: NextRequest) {
  try {
    // Kimlik doğrulama kontrolü
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Yetki kontrolü - ADMIN, QUALITY_MANAGER veya Kalite departmanı
    const { canEditCalibration } = await import('@/lib/calibration-auth')
    if (!canEditCalibration(session.user.role, session.user.ou, session.user.department)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()

    let {
      deviceId,
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
      imageUrl,
      attachments,
      requiresResponsible,
    } = body

    // Default değerler
    if (!name || name.trim() === '') {
      name = 'Bilinmeyen Cihaz'
    }

    if (!type || type.trim() === '') {
      type = 'Diğer'
    }

    // Tip bazlı tarih validasyonu
    const isKalibrasyon = !calibrationType || calibrationType === 'Kalibrasyon' || calibrationType === 'Kal/Doğ'
    const isDogrulama = calibrationType === 'Doğrulama' || calibrationType === 'Kal/Doğ'

    if (isKalibrasyon) {
      if (!lastCalibrationDate) {
        lastCalibrationDate = new Date().toISOString().split('T')[0]
      }
      if (!calibrationInterval || isNaN(parseInt(calibrationInterval))) {
        calibrationInterval = 365
      } else {
        calibrationInterval = parseInt(calibrationInterval)
      }
    } else {
      // Sadece Doğrulama tipinde kalibrasyon alanları null
      lastCalibrationDate = null
      calibrationInterval = null
      plannedCalibrationDate = null
    }

    if (!isDogrulama) {
      // Sadece Kalibrasyon tipinde doğrulama alanları null
      lastVerificationDate = null
      verificationInterval = null
      plannedVerificationDate = null
    }

    // deviceId yoksa otomatik oluştur
    if (!deviceId || deviceId.trim() === '') {
      const lastDevice = await prisma.calibrationDevice.findFirst({
        orderBy: {
          deviceId: 'desc',
        },
      })

      if (lastDevice) {
        const lastIdNumber = parseInt(lastDevice.deviceId.replace('CAL', ''))
        const newIdNumber = lastIdNumber + 1
        deviceId = `CAL${newIdNumber.toString().padStart(3, '0')}`
      } else {
        deviceId = 'CAL001'
      }
    }

    // deviceId benzersizlik kontrolü (sadece aktif cihazlar)
    const existingDevice = await prisma.calibrationDevice.findUnique({
      where: { deviceId },
    })

    if (existingDevice && existingDevice.isActive) {
      return NextResponse.json(
        { error: 'Bu cihaz ID zaten mevcut' },
        { status: 400 }
      )
    }

    // Silinmiş (soft delete) aynı ID varsa, eski kaydı kalıcı olarak sil
    if (existingDevice && !existingDevice.isActive) {
      await prisma.calibrationDevice.delete({
        where: { id: existingDevice.id },
      })
    }

    // nextCalibrationDate hesapla (sadece kalibrasyon tipi varsa)
    let lastCalDate: Date | null = null
    let nextCalDate: Date | null = null
    if (isKalibrasyon && lastCalibrationDate) {
      lastCalDate = new Date(lastCalibrationDate)
      nextCalDate = new Date(lastCalDate.getTime() + (calibrationInterval || 365) * 24 * 60 * 60 * 1000)
    }

    // Durumu belirle
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    let status: CalibrationStatus = CalibrationStatus.VALID

    // Kalibrasyon tipinde kalibrasyon tarihine göre, Doğrulama tipinde doğrulama tarihine göre durum belirle
    const referenceDate = nextCalDate || (lastVerificationDate ? (() => {
      const verInt = verificationInterval ? parseInt(verificationInterval) : 365
      return new Date(new Date(lastVerificationDate).getTime() + verInt * 24 * 60 * 60 * 1000)
    })() : null)

    if (referenceDate) {
      if (referenceDate < now) {
        status = CalibrationStatus.EXPIRED
      } else if (referenceDate <= thirtyDaysFromNow) {
        status = CalibrationStatus.EXPIRING
      }
    }

    // Doğrulama tarihlerini hesapla
    const verIntParsed = verificationInterval ? parseInt(verificationInterval) : null
    const lastVerDate = lastVerificationDate ? new Date(lastVerificationDate) : null
    const nextVerDate = (lastVerDate && verIntParsed)
      ? new Date(lastVerDate.getTime() + verIntParsed * 24 * 60 * 60 * 1000)
      : null

    const device = await prisma.calibrationDevice.create({
      data: {
        deviceId,
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
        calibrationInterval: calibrationInterval || null,
        lastCalibrationDate: lastCalDate,
        nextCalibrationDate: nextCalDate,
        plannedCalibrationDate: plannedCalibrationDate ? new Date(plannedCalibrationDate) : null,
        verificationInterval: verIntParsed,
        lastVerificationDate: lastVerDate,
        nextVerificationDate: nextVerDate,
        plannedVerificationDate: plannedVerificationDate ? new Date(plannedVerificationDate) : null,
        certificateNumber,
        status,
        notes,
        imageUrl,
        attachments,
        requiresResponsible: requiresResponsible || false,
      },
    })

    return NextResponse.json(device, { status: 201 })
  } catch (error) {
    console.error('Cihaz eklenirken hata:', error)

    // Daha detaylı hata mesajı
    let errorMessage = 'Cihaz eklenirken bir hata oluştu'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
