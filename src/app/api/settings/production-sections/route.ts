import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Tüm üretim bölümlerini listele
export async function GET() {
  try {
    const sections = await prisma.calibrationProductionSection.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(sections)
  } catch (error) {
    console.error('Üretim bölümleri alınırken hata:', error)
    return NextResponse.json({ error: 'Üretim bölümleri alınırken bir hata oluştu' }, { status: 500 })
  }
}

// POST - Yeni üretim bölümü ekle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, code } = body

    const maxSortOrder = await prisma.calibrationProductionSection.aggregate({
      _max: { sortOrder: true },
    })
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1

    const section = await prisma.calibrationProductionSection.create({
      data: {
        name,
        code: code || null,
        isActive: true,
        sortOrder: nextSortOrder,
      },
    })

    return NextResponse.json(section, { status: 201 })
  } catch (error: any) {
    console.error('Üretim bölümü eklenirken hata:', error)
    return NextResponse.json({
      error: 'Üretim bölümü eklenirken bir hata oluştu',
      details: error?.message || String(error),
      code: error?.code
    }, { status: 500 })
  }
}
