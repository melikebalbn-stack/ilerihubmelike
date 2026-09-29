import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ondalikUygun } from '@/lib/depo/miktar'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { palettenCikar } from '@/lib/ifs/tasima-birimi'
import { GUARD, hata, paletNo, StokSchema } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/tasima-birimi/{id}/cikar { stok, miktar } → paletteki satırdan çıkar. IFS'e YAZAR.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const id = paletNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz palet no' }, { status: 400 })
  const parsed = z.object({ stok: StokSchema, miktar: z.number().positive().refine(ondalikUygun) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Geçersiz stok satırı / miktar' }, { status: 400 })
  const { stok, miktar } = parsed.data
  try {
    await palettenCikar(id, stok, miktar)
    await logDepoHareket({
      olay: 'HU_CIKAR',
      userId,
      kullaniciAd: session.user.name ?? 'Operatör',
      partNo: stok.partNo,
      lotBatchNo: stok.lotBatchNo || null,
      miktar,
      kaynakLok: stok.locationNo,
      detay: { handlingUnitId: id, stok },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return hata(e)
  }
}
