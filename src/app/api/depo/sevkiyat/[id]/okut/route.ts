import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { sevkiyatGetir } from '@/lib/ifs/sevkiyat'
import { bekleyenMiktarlar, okutmaEkle, okutmaSil } from '@/lib/depo/sevkiyat-okutma'
import { GUARD, hata, sevkiyatNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/sevkiyat/{id}/okut { keyref, barkodId?, miktar } → Hub okutma listesine ekle (IFS'e YAZMAZ).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const id = sevkiyatNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz sevkiyat no' }, { status: 400 })
  const parsed = z.object({ keyref: z.string().min(1), barkodId: z.number().int().positive().nullable().optional(), miktar: z.number().positive() })
    .safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Geçersiz okutma' }, { status: 400 })
  const { keyref, barkodId, miktar } = parsed.data
  try {
    const s = await sevkiyatGetir(id)
    if (!s) return NextResponse.json({ ok: false, error: `Sevkiyat bulunamadı: ${id}` }, { status: 404 })
    const rezerv = s.rezervler.find((r) => r.keyref === keyref && r.locationNo !== s.sevkLok)
    if (!rezerv) return NextResponse.json({ ok: false, error: 'Rezerv satırı bulunamadı — sevkiyatı yenileyin' }, { status: 409 })
    const kalan = rezerv.rezerve - rezerv.toplanan - ((await bekleyenMiktarlar(id)).get(keyref) ?? 0)
    if (miktar > kalan) return NextResponse.json({ ok: false, error: `Kalanı aşıyor: kalan ${kalan}` }, { status: 409 })
    const kullaniciAd = session.user.name ?? 'Operatör'
    const kayit = await okutmaEkle({ shipmentId: id, rezerv, barkodId: barkodId ?? null, miktar, userId, kullaniciAd })
    await logDepoHareket({
      olay: 'SEVKIYAT_OKUT', userId, kullaniciAd, partNo: rezerv.partNo, lotBatchNo: kayit.lotBatchNo, miktar,
      kaynakLok: rezerv.locationNo, orderNo: String(id), detay: { keyref, barkodId: barkodId ?? null, okutmaId: kayit.id },
    })
    return NextResponse.json({ ok: true, okutma: kayit })
  } catch (e) {
    return hata(e)
  }
}

// DELETE /api/depo/sevkiyat/{id}/okut { okutmaId } → raporlanmamış okutmayı sil (Hub).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const id = sevkiyatNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz sevkiyat no' }, { status: 400 })
  const parsed = z.object({ okutmaId: z.string().min(1) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Geçersiz okutma' }, { status: 400 })
  try {
    const k = await okutmaSil(id, parsed.data.okutmaId)
    await logDepoHareket({
      olay: 'SEVKIYAT_SIL', userId, kullaniciAd: session.user.name ?? 'Operatör', partNo: k.partNo, lotBatchNo: k.lotBatchNo,
      miktar: k.miktar, kaynakLok: k.lokasyon, orderNo: String(id), detay: { okutmaId: k.id },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return hata(e)
  }
}
