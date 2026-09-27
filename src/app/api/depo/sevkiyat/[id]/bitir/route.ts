import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { sevkiyatGetir, toplamaRaporla } from '@/lib/ifs/sevkiyat'
import { okutmalar, raporlandiIsaretle } from '@/lib/depo/sevkiyat-okutma'
import { GUARD, hata, sevkiyatNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/sevkiyat/{id}/bitir { sevkLok } → Hub'daki raporlanmamış okutmaları rezerv satırı başına topla,
// IFS'e toplama olarak raporla (PickSelected), başarılı satırların okutmalarını raporlandı işaretle. IFS'e YAZAR.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const id = sevkiyatNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz sevkiyat no' }, { status: 400 })
  const parsed = z.object({ sevkLok: z.string().trim().min(1) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Sevk lokasyonu gerekli' }, { status: 400 })
  try {
    const s = await sevkiyatGetir(id)
    if (!s) return NextResponse.json({ ok: false, error: `Sevkiyat bulunamadı: ${id}` }, { status: 404 })
    const liste = await okutmalar(id)
    if (!liste.length) return NextResponse.json({ ok: false, error: 'Raporlanacak okutma yok' }, { status: 409 })
    const grup = new Map<string, number>()
    for (const o of liste) grup.set(o.satirAnahtari, (grup.get(o.satirAnahtari) ?? 0) + o.miktar)
    const kalemler = [...grup].map(([keyref, miktar]) => {
      const rezerv = s.rezervler.find((r) => r.keyref === keyref)
      if (!rezerv) throw new Error('Okutulan rezerv satırı IFS\'te artık yok — okutmayı silip tekrar okutun')
      return { rezerv, miktar }
    })
    const sonuc = await toplamaRaporla(id, kalemler, parsed.data.sevkLok)
    const basarili = new Set(sonuc.sonuclar.filter((x) => x.ok).map((x) => x.keyref))
    await raporlandiIsaretle(liste.filter((o) => basarili.has(o.satirAnahtari)).map((o) => o.id))
    const kullaniciAd = session.user.name ?? 'Operatör'
    for (const k of kalemler.filter((x) => basarili.has(x.rezerv.keyref))) {
      await logDepoHareket({
        olay: 'SEVKIYAT_TOPLA', userId, kullaniciAd, partNo: k.rezerv.partNo, lotBatchNo: k.rezerv.lotBatchNo !== '*' ? k.rezerv.lotBatchNo : null,
        miktar: k.miktar, kaynakLok: k.rezerv.locationNo, hedefLok: parsed.data.sevkLok, orderNo: String(id),
        detay: { keyref: k.rezerv.keyref, yontem: sonuc.yontem },
      })
    }
    const son = await sevkiyatGetir(id)
    return NextResponse.json({ ok: true, ...sonuc, sevkiyat: son })
  } catch (e) {
    return hata(e)
  }
}
