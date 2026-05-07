import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

export const dynamic = 'force-dynamic'

/**
 * GET: Mesai formu için Personnel (IV) tablosundan aktif personel listesi
 * Query params: search, bolum
 */
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-overtime: requireSession (read-only liste)
    const { error } = await requireSession()
    if (error) return error

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
