import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { resolveAllowedDepts } from '@/lib/overtime-performance'

export const dynamic = 'force-dynamic'

/**
 * GET: Mesai formu için Personnel (IV) tablosundan aktif personel listesi
 * Query params: search, bolum
 */
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-overtime: requireSession (read-only liste)
    const { userId, error } = await requireSession()
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

    // MADDE 1: yazma kapsamı — okuma (performans) ile AYNI kaynak (resolveAllowedDepts).
    // Personnel.bolum, DepartmentDefinition.name ile birebir eşleşir (doğrulandı 25/25).
    const allowed = await resolveAllowedDepts(userId)
    if (allowed === undefined) {
      // admin / İK / overtime.report.all → tümü (mevcut geniş yetki korunur)
      if (bolum) where.bolum = bolum
    } else if (allowed.length === 0) {
      // omurgada görev yok / bağsız → hiçbir personel eklenemez
      return NextResponse.json([])
    } else {
      // bölüm sorumlusu → yalnız kendi bölümü + alt ağacı; verilen bolum izinliyse ona daralt
      where.bolum = bolum && allowed.includes(bolum) ? bolum : { in: allowed }
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
