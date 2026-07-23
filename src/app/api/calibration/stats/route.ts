import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CalibrationStatus } from '@/generated/prisma'
import { requireSession } from '@/lib/auth/require-session'

// GET - İstatistikleri getir
export async function GET() {
  try {
    // PR-Y2.5-calibration: requireSession — sade auth (DB hit yok)
    const { error } = await requireSession()
    if (error) return error
    const [total, valid, expiring, expired, inProcess, outOfOrder, noResponsible, atCompany, atCalibration, scrap, totalCostAgg] = await Promise.all([
      prisma.calibrationDevice.count({
        where: { isActive: true },
      }),
      prisma.calibrationDevice.count({
        where: { isActive: true, status: CalibrationStatus.VALID, deviceCondition: { notIn: ['Hurda', 'Kalibrasyonda'] } },
      }),
      prisma.calibrationDevice.count({
        where: { isActive: true, status: CalibrationStatus.EXPIRING, deviceCondition: { notIn: ['Hurda', 'Kalibrasyonda'] } },
      }),
      prisma.calibrationDevice.count({
        where: { isActive: true, status: CalibrationStatus.EXPIRED, deviceCondition: { notIn: ['Hurda', 'Kalibrasyonda'] } },
      }),
      prisma.calibrationDevice.count({
        where: { isActive: true, status: CalibrationStatus.IN_PROCESS },
      }),
      prisma.calibrationDevice.count({
        where: { isActive: true, status: CalibrationStatus.OUT_OF_ORDER },
      }),
      prisma.calibrationDevice.count({
        where: {
          isActive: true,
          requiresResponsible: true,
          OR: [
            { responsiblePerson: null },
            { responsiblePerson: '' },
          ]
        },
      }),
      // Şirkette: deviceCondition null/boş/Şirkette/Kalibrasyon Planlanıyor olanlar
      prisma.calibrationDevice.count({
        where: {
          isActive: true,
          OR: [
            { deviceCondition: null },
            { deviceCondition: '' },
            { deviceCondition: 'Şirkette' },
            { deviceCondition: 'Kalibrasyon Planlanıyor' },
          ],
        },
      }),
      // Kalibrasyonda
      prisma.calibrationDevice.count({
        where: { isActive: true, deviceCondition: 'Kalibrasyonda' },
      }),
      // Hurda
      prisma.calibrationDevice.count({
        where: { isActive: true, deviceCondition: 'Hurda' },
      }),
      prisma.calibrationHistory.aggregate({
        _sum: { cost: true },
      }),
    ])

    return NextResponse.json({
      total,
      valid,
      expiring,
      expired,
      inProcess,
      outOfOrder,
      noResponsible,
      atCompany,
      atCalibration,
      scrap,
      totalCost: totalCostAgg._sum.cost || 0,
    })
  } catch (error) {
    console.error('İstatistikler alınırken hata:', error)
    return NextResponse.json(
      { error: 'İstatistikler alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}
