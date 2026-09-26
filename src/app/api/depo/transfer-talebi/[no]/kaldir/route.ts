import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { stokKaldir } from '@/lib/ifs/transfer-talebi'
import { GUARD, hata, talepNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/transfer-talebi/{no}/kaldir { taskId, lineNo } → bağlanan stoğu kaldır (RemoveTask). IFS'e YAZAR.
export async function POST(request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const no = talepNo((await params).no)
  if (!no) return NextResponse.json({ ok: false, error: 'Geçersiz talep no' }, { status: 400 })
  const parsed = z.object({ taskId: z.number().int().positive(), lineNo: z.number().int().positive() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Geçersiz görev satırı' }, { status: 400 })
  try {
    const s = await stokKaldir(no, parsed.data.taskId, parsed.data.lineNo)
    await logDepoHareket({
      olay: 'TRANSFER_TALEBI_KALDIR',
      userId,
      kullaniciAd: session.user.name ?? 'Operatör',
      partNo: s.partNo,
      lotBatchNo: s.lotBatchNo || null,
      miktar: s.miktar,
      kaynakLok: s.locationNo,
      orderNo: String(no),
      detay: { taskId: s.taskId, lineNo: s.lineNo },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return hata(e)
  }
}
