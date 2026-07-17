import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

export const dynamic = 'force-dynamic'

/**
 * GET: Toplu Kart Okutamama formu için Personnel (İV) tablosundan
 * aktif personel arama — sadece oturum gerekli, sicilNo/adSoyad/bolum
 * dışında alan döndürülmez (PII sızıntısını önlemek için /api/personnel
 * yerine bu dar kapsamlı endpoint kullanılıyor).
 * Query params: search, bolum
 */
export async function GET(request: NextRequest) {
  try {
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
      },
      orderBy: { adSoyad: 'asc' },
      take: 50,
    })

    return NextResponse.json(personnel)
  } catch (error) {
    console.error('Personel arama hatası (toplu-kart-okutamama):', error)
    return NextResponse.json(
      { error: 'Personel listesi alınamadı' },
      { status: 500 }
    )
  }
}
