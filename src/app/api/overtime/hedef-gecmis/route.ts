import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { apiError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { getHedefGecmisi, hedefUyarisi } from '@/lib/overtime-performance'

/**
 * GET /api/overtime/hedef-gecmis?parcaKodu=8005&hedef=1
 * Üretim satırı editörü için hedef uyarısı: aynı sayısal parça kodunun geçmiş hedef aralığı +
 * (hedef verildiyse) uyarı metni. ENGELLEMEZ — yalnız bilgi. Serbest metin kodda geçmiş
 * aranmaz (gecmis: null). Kapı = form oluşturma kapısı (overtime.report.all VEYA OvertimeAuthorizedUser).
 */
export async function GET(request: NextRequest) {
  const { session, user, error } = await requireUser()
  if (error) return error
  const isAdmin = session.user.permissions?.includes('overtime.report.all') ?? false
  if (!isAdmin) {
    const yetkili = await prisma.overtimeAuthorizedUser.findUnique({ where: { userId: user.id }, select: { userId: true } })
    if (!yetkili) return apiError('Mesai formu oluşturma yetkiniz yok', 403)
  }
  const { searchParams } = new URL(request.url)
  const parcaKodu = (searchParams.get('parcaKodu') ?? '').trim()
  if (!parcaKodu) return apiError('parcaKodu zorunlu', 400)
  const hedefRaw = searchParams.get('hedef')
  const hedef = hedefRaw != null && hedefRaw.trim() !== '' ? Number(hedefRaw) : null
  const gecmis = await getHedefGecmisi(parcaKodu)
  const uyari = hedef != null && Number.isFinite(hedef) ? hedefUyarisi(gecmis, hedef) : null
  return NextResponse.json({ gecmis, uyari })
}
