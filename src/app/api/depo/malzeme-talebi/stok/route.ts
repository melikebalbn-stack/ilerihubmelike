import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { getStokBilgisi, okutVeGetir } from '@/lib/ifs/stok-bilgisi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/malzeme-talebi/stok?lokasyon=X[&okut=Y&kaynak=okutma|elle]
//   okut yok → lokasyonun stok satırı sayısı (lokasyon doğrulama)
//   okut var → lokasyonda okutulan barkod / stok no'ya uyan TAM stok satırları (Stok Bilgisi çözücüsü).
// SADECE OKUMA.
export async function GET(request: Request) {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
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
    // Lokasyon filtresi zaten sabit; "lokasyon" çözümü okutulan değerin parça/barkod olmadığını gösterir.
    const satirlar = r.cozum && r.cozum.tip !== 'lokasyon' ? r.satirlar : []
    return NextResponse.json({ ok: true, lokasyon, toplam: satirlar.length, satirlar, cozum: r.cozum ?? null })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'IFS verisi alınamadı' }, { status: 502 })
  }
}
