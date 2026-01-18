import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Tüm departmanları listele
export async function GET() {
  try {
    const departments = await prisma.calibrationDepartment.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(departments)
  } catch (error) {
    console.error('Departmanlar alınırken hata:', error)
    return NextResponse.json({ error: 'Departmanlar alınırken bir hata oluştu' }, { status: 500 })
  }
}

// POST - Yeni departman ekle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, code } = body

    // En yüksek sortOrder değerini bul ve 1 ekle
    const maxSortOrder = await prisma.calibrationDepartment.aggregate({
      _max: { sortOrder: true },
    })
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? 0) + 1

    const department = await prisma.calibrationDepartment.create({
      data: {
        name,
        code: code || null,
        isActive: true,
        sortOrder: nextSortOrder,
      },
    })

    return NextResponse.json(department, { status: 201 })
  } catch (error: any) {
    console.error('Departman eklenirken hata:', error)
    return NextResponse.json({
      error: 'Departman eklenirken bir hata oluştu',
      details: error?.message || String(error),
      code: error?.code
    }, { status: 500 })
  }
}
