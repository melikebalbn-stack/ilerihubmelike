import { NextResponse } from 'next/server'
import { PALET_UYARISI } from '@/lib/depo/etiket-parse'
import { requirePermission } from '@/lib/auth/require-permission'
import { getStokBilgisi, okutVeGetir } from '@/lib/ifs/stok-bilgisi'
import { GUARD, hata } from '../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/toplu-tasima/stok?lokasyon=X[&okut=Y&kaynak=okutma|elle]
//   okut yok → lokasyon doğrulama (stok satırı sayısı); okut var → lokasyonda okutulana uyan, kullanılabilir > 0 satırlar.
export async function GET(request: Request) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  const sp = new URL(request.url).searchParams
  const lokasyon = sp.get('lokasyon')?.trim()
  const okut = sp.get('okut')?.trim()
  if (!lokasyon) return NextResponse.json({ ok: false, error: 'Lokasyon gerekli' }, { status: 400 })
  try {
    if (!okut) {
      // Lokasyon doğrulama + barkodsuz seçim listesi (kullanılabilir > 0 satırlar).
      const r = await getStokBilgisi({ locationNo: lokasyon })
      return NextResponse.json({ ok: true, lokasyon, toplam: r.toplam, satirlar: r.satirlar.filter((s) => s.kullanilabilir > 0) })
    }
    const kaynak = sp.get('kaynak') === 'elle' ? 'elle' : 'okutma'
    const r = await okutVeGetir(okut, kaynak, { locationNo: lokasyon })
    if (r.cozum?.tip === 'palet') return NextResponse.json({ ok: false, error: PALET_UYARISI }, { status: 400 })
    const satirlar = r.cozum && r.cozum.tip !== 'lokasyon' ? r.satirlar.filter((s) => s.kullanilabilir > 0) : []
    return NextResponse.json({ ok: true, lokasyon, toplam: satirlar.length, satirlar })
  } catch (e) {
    return hata(e)
  }
}
