import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const types = await prisma.calibrationDeviceType.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(types)
  } catch (error) {
    console.error('Cihaz tipleri alınırken hata:', error)
    return NextResponse.json({ error: 'Cihaz tipleri alınırken bir hata oluştu' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, code } = body

    // En yüksek sortOrder değerini bul ve 1 ekle
    const maxSortOrder = await prisma.calibrationDeviceType.aggregate({
      _max: { sortOrder: true },
    })
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1

    const type = await prisma.calibrationDeviceType.create({
      data: { name, code, isActive: true, sortOrder: nextSortOrder },
    })

    return NextResponse.json(type, { status: 201 })
  } catch (error) {
    console.error('Cihaz tipi eklenirken hata:', error)
    return NextResponse.json({ error: 'Cihaz tipi eklenirken bir hata oluştu' }, { status: 500 })
  }
}
