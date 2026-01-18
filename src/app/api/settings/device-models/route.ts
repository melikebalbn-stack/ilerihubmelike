import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const models = await prisma.calibrationDeviceModel.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(models)
  } catch (error) {
    console.error('Cihaz modelleri alınırken hata:', error)
    return NextResponse.json({ error: 'Cihaz modelleri alınırken bir hata oluştu' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, manufacturer, code } = body

    // En yüksek sortOrder değerini bul ve 1 ekle
    const maxSortOrder = await prisma.calibrationDeviceModel.aggregate({
      _max: { sortOrder: true },
    })
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1

    const model = await prisma.calibrationDeviceModel.create({
      data: { name, manufacturer, code, isActive: true, sortOrder: nextSortOrder },
    })

    return NextResponse.json(model, { status: 201 })
  } catch (error) {
    console.error('Cihaz modeli eklenirken hata:', error)
    return NextResponse.json({ error: 'Cihaz modeli eklenirken bir hata oluştu' }, { status: 500 })
  }
}
