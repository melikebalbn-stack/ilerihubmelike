import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Tüm cihaz adlarını listele
export async function GET() {
  try {
    const deviceNames = await prisma.calibrationDeviceName.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(deviceNames)
  } catch (error) {
    console.error('Cihaz adları alınırken hata:', error)
    return NextResponse.json({ error: 'Cihaz adları alınırken bir hata oluştu' }, { status: 500 })
  }
}

// POST - Yeni cihaz adı ekle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, code } = body

    // En yüksek sortOrder değerini bul ve 1 ekle
    const maxSortOrder = await prisma.calibrationDeviceName.aggregate({
      _max: { sortOrder: true },
    })
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1

    const deviceName = await prisma.calibrationDeviceName.create({
      data: {
        name,
        code: code || null,
        isActive: true,
        sortOrder: nextSortOrder,
      },
    })

    return NextResponse.json(deviceName, { status: 201 })
  } catch (error: any) {
    console.error('Cihaz adı eklenirken hata:', error)
    return NextResponse.json({
      error: 'Cihaz adı eklenirken bir hata oluştu',
      details: error?.message || String(error),
      code: error?.code
    }, { status: 500 })
  }
}
