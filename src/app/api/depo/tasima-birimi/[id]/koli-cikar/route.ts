import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { palettenKoliCikar } from '@/lib/ifs/tasima-birimi'
import { GUARD, hata, paletNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/tasima-birimi/{paletId}/koli-cikar { koliId } → koliyi paletten ayır (aynı lokasyonda kalır). IFS'e YAZAR.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const id = paletNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz palet no' }, { status: 400 })
  const parsed = z.object({ koliId: z.number().int().positive() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Koli no gerekli' }, { status: 400 })
  const { koliId } = parsed.data
  try {
    await palettenKoliCikar(id, koliId)
    await logDepoHareket({ olay: 'HU_KOLI_CIKAR', userId, kullaniciAd: session.user.name ?? 'Operatör', partNo: '-', detay: { handlingUnitId: id, koliId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return hata(e)
  }
}
