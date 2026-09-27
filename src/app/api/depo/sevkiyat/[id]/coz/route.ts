import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { sevkiyatGetir } from '@/lib/ifs/sevkiyat'
import { okutmaCoz } from '@/lib/depo/sevkiyat-okutma'
import { GUARD, hata, sevkiyatNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/sevkiyat/{id}/coz?okut=&kaynak=okutma|elle → okutulanı açık rezerv satırlarıyla eşleştir (parça + lot).
// { ok, partNo, lotBatchNo, barkodId, adaylar[{rezerv, kalan}] }. SADECE OKUMA.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  const id = sevkiyatNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz sevkiyat no' }, { status: 400 })
  const sp = new URL(request.url).searchParams
  const okut = sp.get('okut')?.trim()
  if (!okut) return NextResponse.json({ ok: false, error: 'Okutma değeri gerekli' }, { status: 400 })
  try {
    const s = await sevkiyatGetir(id)
    if (!s) return NextResponse.json({ ok: false, error: `Sevkiyat bulunamadı: ${id}` }, { status: 404 })
    const r = await okutmaCoz(s, okut, sp.get('kaynak') === 'elle' ? 'elle' : 'okutma')
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return hata(e)
  }
}
