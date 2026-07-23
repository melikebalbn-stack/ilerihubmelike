import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings/calibration
 * Get all calibration dropdown settings
 */
export async function GET() {
  try {
    const [departments, locations, deviceTypes, deviceModels, productionSections] = await Promise.all([
      prisma.department.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      prisma.calibrationLocation.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      prisma.calibrationDeviceType.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      prisma.calibrationDeviceModel.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, manufacturer: true, code: true },
      }),
      prisma.calibrationProductionSection.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          code: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
        },
      }),
    ])

    return NextResponse.json({
      departments,
      locations,
      deviceTypes,
      deviceModels,
      productionSections,
    })
  } catch (error) {
    console.error('Ayarlar alınırken hata:', error)
    return NextResponse.json(
      { error: 'Ayarlar alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}
