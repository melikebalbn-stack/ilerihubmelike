import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Tüm lokasyonları listele
export async function GET() {
  try {
    const locations = await prisma.calibrationLocation.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(locations)
  } catch (error) {
    console.error('Lokasyonlar alınırken hata:', error)
    return NextResponse.json({ error: 'Lokasyonlar alınırken bir hata oluştu' }, { status: 500 })
  }
}

// POST - Yeni lokasyon ekle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, code } = body

    // En yüksek sortOrder değerini bul ve 1 ekle
    const maxSortOrder = await prisma.calibrationLocation.aggregate({
      _max: { sortOrder: true },
    })
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1

    const location = await prisma.calibrationLocation.create({
      data: {
        name,
        code: code || null, // Boş string yerine null
        isActive: true,
        sortOrder: nextSortOrder,
      },
    })

    return NextResponse.json(location, { status: 201 })
  } catch (error: any) {
    console.error('Lokasyon eklenirken hata:', error)
    console.error('Hata detayı:', JSON.stringify(error, null, 2))
    return NextResponse.json({
      error: 'Lokasyon eklenirken bir hata oluştu',
      details: error?.message || String(error),
      code: error?.code
    }, { status: 500 })
  }
}
