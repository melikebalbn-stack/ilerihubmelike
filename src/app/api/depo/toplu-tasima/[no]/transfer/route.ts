import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { fisGetir, transferEt } from '@/lib/ifs/toplu-tasima'
import { GUARD, fisNo, hata } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/toplu-tasima/{no}/transfer → TransferEt. Önce güncel kullanılabilir kontrolü;
// yetersizse 409 + eksikler (IFS'e gidilmez). IFS'e YAZAR.
export async function POST(_request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const no = fisNo((await params).no)
  if (!no) return NextResponse.json({ ok: false, error: 'Geçersiz fiş no' }, { status: 400 })
  try {
    const once = await fisGetir(no)
    const sonuc = await transferEt(no)
    if (!sonuc.ok) {
      return NextResponse.json({ ok: false, error: 'Kullanılabilir stok yetersiz', eksikler: sonuc.eksikler }, { status: 409 })
    }
    for (const s of once?.satirlar ?? []) {
      await logDepoHareket({
        olay: 'TOPLU_TASIMA_TRANSFER',
        userId,
        kullaniciAd: session.user.name ?? 'Operatör',
        partNo: s.partNo,
        lotBatchNo: s.lotBatchNo || null,
        miktar: s.miktar,
        kaynakLok: s.locationNo,
        hedefLok: once?.varisLok ?? null,
        orderNo: String(no),
      })
    }
    return NextResponse.json({ ok: true, durum: sonuc.durum })
  } catch (e) {
    return hata(e)
  }
}
