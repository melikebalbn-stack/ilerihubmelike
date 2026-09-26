import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { acikFisler, fisOlustur } from '@/lib/ifs/toplu-tasima'
import { GUARD, hata } from './_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/toplu-tasima → { ok, fisler } (Yeni durumdaki fişler). SADECE OKUMA.
export async function GET() {
  const { error } = await requirePermission(GUARD)
  if (error) return error
  try {
    return NextResponse.json({ ok: true, fisler: await acikFisler() })
  } catch (e) {
    return hata(e)
  }
}

// POST /api/depo/toplu-tasima { varisLok, not? } → { ok, no }. IFS'e YAZAR.
export async function POST(request: Request) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const parsed = z.object({ varisLok: z.string().trim().min(1), not: z.string().trim().max(2000).optional() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Hedef lokasyon gerekli' }, { status: 400 })
  try {
    const no = await fisOlustur(parsed.data.varisLok, parsed.data.not)
    await logDepoHareket({
      olay: 'TOPLU_TASIMA_OLUSTUR',
      userId,
      kullaniciAd: session.user.name ?? 'Operatör',
      partNo: '-',
      hedefLok: parsed.data.varisLok,
      orderNo: String(no),
      detay: { not: parsed.data.not ?? null },
    })
    return NextResponse.json({ ok: true, no })
  } catch (e) {
    return hata(e)
  }
}
