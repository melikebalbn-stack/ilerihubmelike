import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from '../_lib/access'

export const dynamic = 'force-dynamic'

/**
 * GET: Toplu Kart Okutamama formu için Personnel (İV) tablosundan
 * aktif personel arama — sicilNo/adSoyad/bolum dışında alan döndürülmez
 * (PII sızıntısını önlemek için /api/personnel yerine bu dar kapsamlı
 * endpoint kullanılıyor).
 *
 * GRI kullanıcı için sonuçlar KENDİ BÖLÜMÜYLE sınırlanır (elle bölüm
 * seçmesine gerek kalmaz, başka bölümden personel getirilmez) — FULL
 * erişimde (Beyaz Yaka/Admin) kısıtlama yok.
 * Query params: search, bolum (sadece FULL erişimde etkili)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const access = await getBulkCardScanAccess(user.id)
    if (access.level === 'NONE') {
      return NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 })
    }

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

    if (access.level === 'GRI') {
      // Güvenlik sınırı: GRI kullanıcı sadece kendi bölümünde arama yapabilir,
      // client'tan gelen bolum parametresi bu durumda göz ardı edilir.
      where.bolum = access.bolum
    } else if (bolum) {
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
