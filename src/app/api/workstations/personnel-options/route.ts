import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { apiSuccess, apiError } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

const MAX_RESULTS = 200

/**
 * GET /api/workstations/personnel-options
 * Tezgah atama ekranı için HAFİF personel listesi — SADECE id, adSoyad, sicilNo, bolum.
 * PII (TC/maaş/adres vb.) DÖNMEZ. /api/personnel'e dokunmadan cross-gate çözümü:
 * gate = uretim.tezgah.manage (HR rolü gerektirmez).
 * Filtre: yalnız AKTİF personel (Personnel.aktif = true). Query: ?bolum= , ?q= (adSoyad/sicilNo).
 */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('uretim.tezgah.manage')
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const bolum = searchParams.get('bolum')?.trim()
    const q = searchParams.get('q')?.trim()

    const where: Record<string, unknown> = { aktif: true }
    if (bolum) where.bolum = bolum
    if (q) {
      where.OR = [
        { adSoyad: { contains: q, mode: 'insensitive' } },
        { sicilNo: { contains: q, mode: 'insensitive' } },
      ]
    }

    const personnel = await prisma.personnel.findMany({
      where,
      // Sadece atama için gerekli minimal alanlar — PII yok.
      select: { id: true, adSoyad: true, sicilNo: true, bolum: true },
      orderBy: { adSoyad: 'asc' },
      take: MAX_RESULTS,
    })

    return apiSuccess(personnel)
  } catch (err) {
    return apiError('Personel listesi alınırken bir hata oluştu', 500, {
      endpoint: 'GET /api/workstations/personnel-options',
      error: err,
    })
  }
}
