import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { paletTasi } from '@/lib/ifs/tasima-birimi'
import { GUARD, hata, paletNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/tasima-birimi/{id}/tasi { hedefLok } → bütün paleti taşı. IFS'e YAZAR.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const id = paletNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz palet no' }, { status: 400 })
  const parsed = z.object({ hedefLok: z.string().trim().min(1) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Hedef lokasyon gerekli' }, { status: 400 })
  try {
    const { kaynakLok } = await paletTasi(id, parsed.data.hedefLok)
    await logDepoHareket({
      olay: 'HU_TASI',
      userId,
      kullaniciAd: session.user.name ?? 'Operatör',
      partNo: '-',
      kaynakLok,
      hedefLok: parsed.data.hedefLok,
      detay: { handlingUnitId: id },
    })
    return NextResponse.json({ ok: true, kaynakLok })
  } catch (e) {
    return hata(e)
  }
}
