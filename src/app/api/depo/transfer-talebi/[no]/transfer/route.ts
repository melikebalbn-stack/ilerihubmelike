import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { talepGetir, transferEt } from '@/lib/ifs/transfer-talebi'
import { GUARD, hata, talepNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/transfer-talebi/{no}/transfer → Transfer. Kalanı 0 olmayan satır varsa 409 + eksikler
// (kısmi transfer yok). IFS'e YAZAR.
export async function POST(_request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const no = talepNo((await params).no)
  if (!no) return NextResponse.json({ ok: false, error: 'Geçersiz talep no' }, { status: 400 })
  try {
    const once = await talepGetir(no)
    const sonuc = await transferEt(no)
    if (!sonuc.ok) {
      return NextResponse.json({ ok: false, error: 'Tüm satırlar tamamlanmadan transfer edilemez', eksikler: sonuc.eksikler }, { status: 409 })
    }
    for (const s of once?.seciliStoklar ?? []) {
      await logDepoHareket({
        olay: 'TRANSFER_TALEBI_TRANSFER',
        userId,
        kullaniciAd: session.user.name ?? 'Operatör',
        partNo: s.partNo,
        lotBatchNo: s.lotBatchNo || null,
        miktar: s.miktar,
        kaynakLok: s.locationNo,
        hedefLok: once?.hedefLok ?? null,
        orderNo: String(no),
        detay: { taskId: s.taskId, lineNo: s.lineNo, isEmriNo: once?.isEmriNo ?? null },
      })
    }
    return NextResponse.json({ ok: true, durum: sonuc.durum })
  } catch (e) {
    return hata(e)
  }
}
