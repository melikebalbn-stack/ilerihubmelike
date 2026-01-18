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
      let newStatus = device.status

      if (device.nextCalibrationDate < now && device.status !== CalibrationStatus.EXPIRED) {
        newStatus = CalibrationStatus.EXPIRED
      } else if (
        device.nextCalibrationDate > now &&
        device.nextCalibrationDate <= thirtyDaysFromNow &&
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

    // Yetki kontrolü - sadece QUALITY_MANAGER, ADMIN veya SUPER_ADMIN
    const userRole = session.user.role || 'EMPLOYEE'
    const allowedRoles = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
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

    // Tarih validasyonu
    if (!lastCalibrationDate) {
      lastCalibrationDate = new Date().toISOString().split('T')[0]
    }

    // calibrationInterval validasyonu
    if (!calibrationInterval || isNaN(parseInt(calibrationInterval))) {
      calibrationInterval = 365
    } else {
      calibrationInterval = parseInt(calibrationInterval)
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

    // deviceId benzersizlik kontrolü
    const existingDevice = await prisma.calibrationDevice.findUnique({
      where: { deviceId },
    })

    if (existingDevice) {
      return NextResponse.json(
        { error: 'Bu cihaz ID zaten mevcut' },
        { status: 400 }
      )
    }

    // nextCalibrationDate'i hesapla
    const lastCalDate = new Date(lastCalibrationDate)
    const nextCalDate = new Date(lastCalDate.getTime() + calibrationInterval * 24 * 60 * 60 * 1000)

    // Durumu belirle
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    let status: CalibrationStatus = CalibrationStatus.VALID
    if (nextCalDate < now) {
      status = CalibrationStatus.EXPIRED
    } else if (nextCalDate <= thirtyDaysFromNow) {
      status = CalibrationStatus.EXPIRING
    }

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
        calibrationInterval,
        lastCalibrationDate: lastCalDate,
        nextCalibrationDate: nextCalDate,
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
