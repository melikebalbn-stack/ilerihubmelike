import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { getStokBilgisi, okutVeGetir } from '@/lib/ifs/stok-bilgisi'
import { GUARD, hata } from '../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/tasima-birimi/stok?lokasyon=X[&okut=Y&kaynak=okutma|elle]
//   okut yok → lokasyon doğrulama (birimsiz stok satırı sayısı)
//   okut var → lokasyondaki BİRİMSİZ (HandlingUnitId 0) ve kullanılabilir > 0 stok satırları. SADECE OKUMA.
export async function GET(request: Request) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  const sp = new URL(request.url).searchParams
  const lokasyon = sp.get('lokasyon')?.trim()
  const okut = sp.get('okut')?.trim()
  if (!lokasyon) return NextResponse.json({ ok: false, error: 'Lokasyon gerekli' }, { status: 400 })
  try {
    if (!okut) {
      const r = await getStokBilgisi({ locationNo: lokasyon, handlingUnitId: 0 })
      return NextResponse.json({ ok: true, lokasyon, toplam: r.toplam, satirlar: [] })
    }
    const kaynak = sp.get('kaynak') === 'elle' ? 'elle' : 'okutma'
    const r = await okutVeGetir(okut, kaynak, { locationNo: lokasyon, handlingUnitId: 0 })
    if (r.cozum?.tip === 'palet') return NextResponse.json({ ok: false, error: 'Bu bir palet etiketi — palete eklenecek malzemeyi okutun' }, { status: 400 })
    const satirlar = r.cozum && r.cozum.tip !== 'lokasyon' ? r.satirlar.filter((s) => s.kullanilabilir > 0) : []
    return NextResponse.json({ ok: true, lokasyon, toplam: satirlar.length, satirlar })
  } catch (e) {
    return hata(e)
  }
}
