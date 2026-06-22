// TODO: Alanlar netlesince genisletilecek
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Stajyer listesi (pagination)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const bolum = searchParams.get('bolum') || ''
    const aktif = searchParams.get('aktif')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (aktif !== null && aktif !== '') {
      where.aktif = aktif === 'true'
    }

    if (bolum) {
      where.bolum = bolum
    }

    if (search) {
      where.OR = [
        { adSoyad: { contains: search, mode: 'insensitive' } },
        { okul: { contains: search, mode: 'insensitive' } },
        { stajSorumlusu: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [interns, total] = await Promise.all([
      prisma.intern.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.intern.count({ where }),
    ])

    return NextResponse.json({ interns, total, page, limit })
  } catch (error) {
    console.error('Error fetching interns:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Yeni stajyer olusturma
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Yetkisiz islem' }, { status: 403 })
    }

    const body = await request.json()

    if (!body.adSoyad || !body.bolum) {
      return NextResponse.json({ error: 'Ad Soyad ve Bolum zorunludur' }, { status: 400 })
    }

    const intern = await prisma.intern.create({
      data: {
        adSoyad: body.adSoyad,
        telefon: body.telefon || null,
        bolum: body.bolum,
        stajSorumlusu: body.stajSorumlusu || null,
        baslangicTarihi: body.baslangicTarihi ? new Date(body.baslangicTarihi) : null,
        bitisTarihi: body.bitisTarihi ? new Date(body.bitisTarihi) : null,
        okul: body.okul || null,
        aktif: body.aktif ?? true,
      },
    })

    return NextResponse.json(intern, { status: 201 })
  } catch (error) {
    console.error('Error creating intern:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
