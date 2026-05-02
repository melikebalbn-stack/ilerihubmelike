import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET: Mesai formu için Personnel (IV) tablosundan aktif personel listesi
 * Query params: search, bolum
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const bolum = searchParams.get('bolum')

    const where: Record<string, unknown> = { aktif: true }

    if (search) {
      where.OR = [
        { adSoyad: { contains: search, mode: 'insensitive' } },
        { sicilNo: { contains: search, mode: 'insensitive' } },
        { gorev: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (bolum) {
      where.bolum = bolum
    }

    const personnel = await prisma.personnel.findMany({
      where,
      select: {
        id: true,
        sicilNo: true,
        adSoyad: true,
        bolum: true,
        gorev: true,
        serviceRoute: true,
        telefon: true,
      },
      orderBy: { adSoyad: 'asc' },
    })

    return NextResponse.json(personnel)
  } catch (error) {
    console.error('Personel listesi alınırken hata:', error)
    return NextResponse.json(
      { error: 'Personel listesi alınamadı' },
      { status: 500 }
    )
  }
}
