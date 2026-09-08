import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { benimPersonnelId } from '@/lib/quality/rma-access'
import { buildRmaWhere } from '@/lib/quality/rma-query'
import { rmaFiltreAktif, rmaKpiHesapla } from '@/lib/quality/rma-kpi'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quality/rma/kpi — liste ekranı filtreleriyle KPI özeti.
 *
 * Auth: oturum (liste/export ucuyla AYNI yetki; RMA okuması herkese açık,
 * YENİ İZİN EKLENMEDİ). Yalnız GET — mutasyon yok.
 *
 * Filtre: buildRmaWhere (TEK KAYNAK) — tip, musteriId, durum, from/to, q,
 * sadeceBana. Sayfalama YOK: KPI tüm filtre kümesi üzerinden hesaplanır.
 * `sadeceBana` davranışı liste ucuyla birebir: personnelId burada çözülür,
 * bağlantı yoksa buildRmaWhere fail-closed davranır (boş sonuç).
 */
export async function GET(request: NextRequest) {
  const { userId, error } = await requireSession()
  if (error) return error

  const sp = request.nextUrl.searchParams
  const personnelId = sp.get('sadeceBana') === '1' ? await benimPersonnelId(userId) : null
  const where = buildRmaWhere(sp, personnelId)

  const kpi = await rmaKpiHesapla(where, rmaFiltreAktif(sp))
  return NextResponse.json(kpi)
}
