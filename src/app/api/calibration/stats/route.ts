import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CalibrationStatus } from '@/generated/prisma'

// GET - İstatistikleri getir
export async function GET() {
  try {
    // Kimlik doğrulama kontrolü
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const [total, valid, expiring, expired, noResponsible] = await Promise.all([
      prisma.calibrationDevice.count({
        where: { isActive: true },
      }),
      prisma.calibrationDevice.count({
        where: { isActive: true, status: CalibrationStatus.VALID },
      }),
      prisma.calibrationDevice.count({
        where: { isActive: true, status: CalibrationStatus.EXPIRING },
      }),
      prisma.calibrationDevice.count({
        where: { isActive: true, status: CalibrationStatus.EXPIRED },
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
    ])

    return NextResponse.json({
      total,
      valid,
      expiring,
      expired,
      noResponsible,
    })
  } catch (error) {
    console.error('İstatistikler alınırken hata:', error)
    return NextResponse.json(
      { error: 'İstatistikler alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}
