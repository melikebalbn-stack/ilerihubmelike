import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { paleteKoliEkle } from '@/lib/ifs/tasima-birimi'
import { GUARD, hata, paletNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/tasima-birimi/{paletId}/koli-ekle { koliId } → koliyi palete bağla (gerekirse önce paletin
// lokasyonuna taşır, ayrı HU_TASI kaydı). IFS'e YAZAR.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const id = paletNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz palet no' }, { status: 400 })
  const parsed = z.object({ koliId: z.number().int().positive() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Koli no gerekli' }, { status: 400 })
  const { koliId } = parsed.data
  try {
    const { tasindi } = await paleteKoliEkle(id, koliId)
    const kullaniciAd = session.user.name ?? 'Operatör'
    if (tasindi) {
      await logDepoHareket({ olay: 'HU_TASI', userId, kullaniciAd, partNo: '-', kaynakLok: tasindi.kaynakLok, hedefLok: tasindi.hedefLok, detay: { handlingUnitId: koliId, otomatik: 'palete koli ekleme' } })
    }
    await logDepoHareket({ olay: 'HU_KOLI_EKLE', userId, kullaniciAd, partNo: '-', detay: { handlingUnitId: id, koliId } })
    return NextResponse.json({ ok: true, tasindi })
  } catch (e) {
    return hata(e)
  }
}
