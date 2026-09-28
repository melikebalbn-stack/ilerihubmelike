import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { sevkiyatGetir, toplamaGeriAl } from '@/lib/ifs/sevkiyat'
import { geriAlindiDus } from '@/lib/depo/sevkiyat-okutma'
import { GUARD, hata, sevkiyatNo } from '../../_ortak'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/sevkiyat/{id}/geri-al { keyref, miktar, hedefLok } → toplanmış miktarı sevkiyat ambarından hedef
// lokasyona geri al (IFS ReturnFromShipInv; rezerv de düşer). IFS'e YAZAR. Ardından o lokasyonun raporlanmış
// Hub okutmalarından miktar düşülür (IFS başarılıysa; Hub hatası geri almayı bozmaz, loga düşer).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requirePermission(GUARD)
  if (error) return error
  const id = sevkiyatNo((await params).id)
  if (!id) return NextResponse.json({ ok: false, error: 'Geçersiz sevkiyat no' }, { status: 400 })
  const parsed = z.object({ keyref: z.string().min(1), miktar: z.number().positive(), hedefLok: z.string().trim().min(1) })
    .safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Geçersiz satır / miktar / hedef' }, { status: 400 })
  try {
    const s = await sevkiyatGetir(id)
    const rezerv = s?.rezervler.find((r) => r.keyref === parsed.data.keyref)
    if (!s || !rezerv) return NextResponse.json({ ok: false, error: 'Toplanmış satır bulunamadı' }, { status: 404 })
    await toplamaGeriAl(id, rezerv, parsed.data.miktar, parsed.data.hedefLok)
    const hub = await geriAlindiDus(id, rezerv.partNo, rezerv.lotBatchNo, parsed.data.hedefLok, parsed.data.miktar).catch((e) => {
      console.error('[sevkiyat/geri-al] Hub okutma güncellemesi başarısız', e)
      return null
    })
    await logDepoHareket({
      olay: 'SEVKIYAT_GERIAL', userId, kullaniciAd: session.user.name ?? 'Operatör', partNo: rezerv.partNo,
      lotBatchNo: rezerv.lotBatchNo !== '*' ? rezerv.lotBatchNo : null, miktar: parsed.data.miktar,
      kaynakLok: rezerv.locationNo, hedefLok: parsed.data.hedefLok, orderNo: String(id), detay: { keyref: rezerv.keyref, hubOkutma: hub },
    })
    return NextResponse.json({ ok: true, hubGuncellendi: hub !== null })
  } catch (e) {
    return hata(e)
  }
}
