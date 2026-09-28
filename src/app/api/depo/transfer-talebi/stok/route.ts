import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { getStokBilgisi, okutVeGetir } from '@/lib/ifs/stok-bilgisi'
import { GUARD, hata } from '../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/transfer-talebi/stok?lokasyon=X[&okut=Y&kaynak=okutma|elle&partNo=Z]
//   okut yok → lokasyon doğrulama + kullanılabilir satırlar (barkodsuz seçim); okut var → lokasyonda okutulana uyan, kullanılabilir > 0 satırlar.
//   partNo verilirse yalnız o parça (talep satırıyla eşleşme). SADECE OKUMA.
export async function GET(request: Request) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  const sp = new URL(request.url).searchParams
  const lokasyon = sp.get('lokasyon')?.trim()
  const okut = sp.get('okut')?.trim()
  const partNo = sp.get('partNo')?.trim()
  if (!lokasyon) return NextResponse.json({ ok: false, error: 'Lokasyon gerekli' }, { status: 400 })
  try {
    if (!okut) {
      // Lokasyon doğrulama + barkodsuz seçim listesi: toplam = lokasyonda (bu parçanın) stok satırı sayısı,
      // satirlar = kullanılabilir > 0 olanlar.
      const r = await getStokBilgisi({ locationNo: lokasyon, ...(partNo ? { partNoEq: partNo } : {}) })
      return NextResponse.json({ ok: true, lokasyon, toplam: r.toplam, satirlar: r.satirlar.filter((s) => s.kullanilabilir > 0) })
    }
    const kaynak = sp.get('kaynak') === 'elle' ? 'elle' : 'okutma'
    const r = await okutVeGetir(okut, kaynak, { locationNo: lokasyon })
    let satirlar = r.cozum && r.cozum.tip !== 'lokasyon' ? r.satirlar.filter((s) => s.kullanilabilir > 0) : []
    const tumu = satirlar.length
    if (partNo) satirlar = satirlar.filter((s) => s.partNo === partNo)
    return NextResponse.json({ ok: true, lokasyon, toplam: satirlar.length, satirlar, baskaParca: tumu > 0 && satirlar.length === 0 })
  } catch (e) {
    return hata(e)
  }
}
