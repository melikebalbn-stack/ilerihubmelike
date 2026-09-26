import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { paletOlustur } from '@/lib/ifs/tasima-birimi'
import { GUARD, hata } from './_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/tasima-birimi { tur } → boş palet oluştur, { ok, id }. IFS'e YAZAR.
export async function POST(request: Request) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const parsed = z.object({ tur: z.string().trim().min(1) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Palet türü gerekli' }, { status: 400 })
  try {
    const id = await paletOlustur(parsed.data.tur)
    await logDepoHareket({
      olay: 'HU_OLUSTUR',
      userId,
      kullaniciAd: session.user.name ?? 'Operatör',
      partNo: '-',
      detay: { handlingUnitId: id, tur: parsed.data.tur },
    })
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return hata(e)
  }
}
