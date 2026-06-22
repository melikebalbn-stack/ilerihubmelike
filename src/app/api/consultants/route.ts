// TODO: Alanlar netlesince genisletilecek
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Danisman listesi (pagination)
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
        { email: { contains: search, mode: 'insensitive' } },
        { uzmanlikAlani: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [consultants, total] = await Promise.all([
      prisma.consultant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.consultant.count({ where }),
    ])

    return NextResponse.json({ consultants, total, page, limit })
  } catch (error) {
    console.error('Error fetching consultants:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Yeni danisman olusturma
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

    if (!body.adSoyad) {
      return NextResponse.json({ error: 'Ad Soyad zorunludur' }, { status: 400 })
    }

    const consultant = await prisma.consultant.create({
      data: {
        adSoyad: body.adSoyad,
        telefon: body.telefon || null,
        email: body.email || null,
        bolum: body.bolum || null,
        uzmanlikAlani: body.uzmanlikAlani || null,
        sozlesmeBaslangic: body.sozlesmeBaslangic ? new Date(body.sozlesmeBaslangic) : null,
        sozlesmeBitis: body.sozlesmeBitis ? new Date(body.sozlesmeBitis) : null,
        aktif: body.aktif ?? true,
      },
    })

    return NextResponse.json(consultant, { status: 201 })
  } catch (error) {
    console.error('Error creating consultant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
