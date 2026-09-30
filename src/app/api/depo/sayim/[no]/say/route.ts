import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { sayilanYaz, sistemleAyni } from '@/lib/ifs/sayim'
import { GUARD, hata, raporNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Govde = z.union([
  z.object({ seq: z.number().int().positive(), miktar: z.number().nonnegative().finite() }),
  z.object({ seq: z.number().int().positive(), ayni: z.literal(true) }),
])

// POST /api/depo/sayim/{no}/say { seq, miktar } → sayılan miktar (YOL C, PATCH QtyCount1)
//                              { seq, ayni: true } → sistemdekiyle aynı (YOL A; yalnız dondurulmuş rapor)
// → { ok, sonuc{seq, sayilan, fark} }. Onay / iptal / dondurma YOK — stok değişmez.
export async function POST(request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const no = raporNo((await params).no)
  if (!no) return NextResponse.json({ ok: false, error: 'Geçersiz rapor no' }, { status: 400 })
  const parsed = Govde.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Geçersiz sayım' }, { status: 400 })
  const g = parsed.data
  try {
    const ayni = 'ayni' in g
    const s = ayni ? await sistemleAyni(no, g.seq) : await sayilanYaz(no, g.seq, g.miktar)
    await logDepoHareket({
      olay: ayni ? 'SAYIM_AYNI' : 'SAYIM_YAZ', userId, kullaniciAd: session.user.name ?? 'Operatör',
      partNo: s.partNo, lotBatchNo: s.lotBatchNo !== '*' ? s.lotBatchNo : null, miktar: s.sayilan,
      kaynakLok: s.locationNo, orderNo: no, lineItemNo: s.seq, detay: { fark: s.fark, onceki: s.onceki },
    })
    return NextResponse.json({ ok: true, sonuc: { seq: s.seq, sayilan: s.sayilan, fark: s.fark } })
  } catch (e) {
    return hata(e)
  }
}
