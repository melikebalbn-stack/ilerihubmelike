import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { stokBagla, talepGetir } from '@/lib/ifs/transfer-talebi'
import { GUARD, hata, SatirSchema, StokSchema, talepNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/transfer-talebi/{no}/bagla { satir, stok, miktar } → okutulan stoğu talep satırına bağla (rezerv). IFS'e YAZAR.
export async function POST(request: Request, { params }: { params: Promise<{ no: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const no = talepNo((await params).no)
  if (!no) return NextResponse.json({ ok: false, error: 'Geçersiz talep no' }, { status: 400 })
  const parsed = z.object({ satir: SatirSchema, stok: StokSchema, miktar: z.number().positive() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Geçersiz satır / stok / miktar' }, { status: 400 })
  const { satir, stok, miktar } = parsed.data
  try {
    await stokBagla(no, satir, stok, miktar)
    const t = await talepGetir(no)
    await logDepoHareket({
      olay: 'TRANSFER_TALEBI_BAGLA',
      userId,
      kullaniciAd: session.user.name ?? 'Operatör',
      partNo: stok.partNo,
      lotBatchNo: stok.lotBatchNo || null,
      miktar,
      kaynakLok: stok.locationNo,
      hedefLok: t?.hedefLok ?? null,
      orderNo: String(no),
      detay: { stok, isEmriNo: t?.isEmriNo ?? null },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return hata(e)
  }
}
