import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { gecisEkrani } from '@/lib/pdks/gecis-sorgu'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/pdks/gecisler?tarih=YYYY-MM-DD&kapiId=&tip=&q= — Geçiş Kayıtları ekranı (pdks.view).
// Ekran 15 sn'de bir çağırır (SSE yok). Tablo en fazla 500 satır; toplamSatir ayrıca döner.
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(['pdks.view', 'pdks.manage'])
  if (error) return error
  try {
    const p = req.nextUrl.searchParams
    return NextResponse.json({ ok: true, ...(await gecisEkrani({ tarih: p.get('tarih'), kapiId: p.get('kapiId'), tip: p.get('tip'), q: p.get('q') })) })
  } catch (e) {
    return pdksHata(e, 'Geçiş kayıtları alınamadı')
  }
}
