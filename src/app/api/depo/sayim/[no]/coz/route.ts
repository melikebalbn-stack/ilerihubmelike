import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { cozBarkodId } from '@/lib/ifs/barkod'
import { parseEtiket } from '@/lib/depo/etiket-parse'
import { GUARD, hata, raporNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/sayim/{no}/coz?okut=&kaynak=okutma|elle → { ok, partNo, lotBatchNo } (barkod → parça + lot;
// elle / stok no → yalnız parça). Satır eşleştirmesi istemcide, seçili lokasyonun satırlarında. SADECE OKUMA.
export async function GET(request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  if (!raporNo((await params).no)) return NextResponse.json({ ok: false, error: 'Geçersiz rapor no' }, { status: 400 })
  const sp = new URL(request.url).searchParams
  const okut = sp.get('okut')?.trim()
  if (!okut) return NextResponse.json({ ok: false, error: 'Okutma değeri gerekli' }, { status: 400 })
  try {
    const p = parseEtiket(okut, sp.get('kaynak') === 'elle' ? 'elle' : 'okutma')
    if (p.tip === 'barkodId' && p.barkodId != null) {
      const k = await cozBarkodId(p.barkodId)
      if (!k) return NextResponse.json({ ok: false, error: `Barkod bulunamadı: ${p.barkodId}` }, { status: 404 })
      return NextResponse.json({ ok: true, partNo: k.partNo, lotBatchNo: k.lotBatchNo && k.lotBatchNo !== '*' ? k.lotBatchNo : null })
    }
    return NextResponse.json({ ok: true, partNo: (p.stokKodu ?? okut).trim(), lotBatchNo: p.lot ?? null })
  } catch (e) {
    return hata(e)
  }
}
