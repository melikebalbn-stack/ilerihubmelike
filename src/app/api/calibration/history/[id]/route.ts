import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CalibrationResult, CalibrationStatus } from '@/generated/prisma'
import { requireUser } from '@/lib/auth/require-user'

// PUT - Kalibrasyon kaydını düzenle (kalibrasyon.admin)
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

    const {
      calibrationDate,
      certificateNumber,
      calibratedBy,
      cost,
      result,
      notes,
      certificatePath,
    } = body

    // Kaydın var olup olmadığını ve cihazını al
    const existing = await prisma.calibrationHistory.findUnique({
      where: { id },
      include: { device: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Kalibrasyon kaydı bulunamadı' },
        { status: 404 }
      )
    }

    // calibrationDate değiştiyse nextDueDate'i yeniden hesapla
    const calDate = calibrationDate ? new Date(calibrationDate) : existing.calibrationDate
    const interval = existing.device.calibrationInterval || 365
    const nextDueDate = new Date(calDate.getTime() + interval * 24 * 60 * 60 * 1000)

    // Kaydı güncelle
    const updated = await prisma.calibrationHistory.update({
      where: { id },
      data: {
        calibrationDate: calDate,
        nextDueDate,
        certificateNumber: certificateNumber ?? null,
        calibratedBy: calibratedBy ?? existing.calibratedBy,
        cost: cost === undefined ? existing.cost : cost,
        result: (result as CalibrationResult) ?? existing.result,
        notes: notes ?? null,
        certificatePath: certificatePath ?? existing.certificatePath,
      },
    })

    // Cihazı en güncel kayda göre senkronla (tarih değişmiş olabilir)
    const latest = await prisma.calibrationHistory.findFirst({
      where: { deviceId: existing.deviceId },
      orderBy: { calibrationDate: 'desc' },
    })

    if (latest) {
      const now = new Date()
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      // Manuel override (IN_PROCESS / OUT_OF_ORDER) varsa otomatik statüyü ezme
      const deviceData: {
        lastCalibrationDate: Date
        nextCalibrationDate: Date
        status?: CalibrationStatus
      } = {
        lastCalibrationDate: latest.calibrationDate,
        nextCalibrationDate: latest.nextDueDate,
      }

      if (!existing.device.statusManualOverride) {
        if (latest.nextDueDate < now) {
          deviceData.status = CalibrationStatus.EXPIRED
        } else if (latest.nextDueDate <= thirtyDaysFromNow) {
          deviceData.status = CalibrationStatus.EXPIRING
        } else {
          deviceData.status = CalibrationStatus.VALID
        }
      }

      await prisma.calibrationDevice.update({
        where: { id: existing.deviceId },
        data: deviceData,
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Kalibrasyon kaydı güncellenirken hata:', error)
    return NextResponse.json(
      { error: 'Kalibrasyon kaydı güncellenirken bir hata oluştu' },
      { status: 500 }
    )
  }
}
