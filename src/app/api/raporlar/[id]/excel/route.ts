import { NextResponse } from 'next/server'
import { hataYaniti } from '../../_hata'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { veriSetiCalistir } from '@/lib/rapor/veri-seti'
import { gorunumXlsx } from '@/lib/rapor/gorunum-xlsx'
import { etkilesimliMi, type Gorunum } from '@/lib/rapor/tipler'
import { calistirmaHatasiKaydet, calistirmaKaydet, raporBaglami } from '@/lib/rapor/sunucu-calistirma'
import { GorunumSchema } from '../../sablonlar/_ortak'
import { bicimle } from '@/lib/rapor/bicim'
import { veriSetiAlanlari } from '@/lib/rapor/veri-seti-alanlar'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const Govde = z.object({
  parametreler: z.record(z.string(), z.unknown()).default({}),
  /** Ekrandaki (kaydedilmemiş) görünüm; verilmezse şablonun kayıtlı görünümü. */
  gorunum: GorunumSchema.optional(),
})

/** POST /api/raporlar/[id]/excel — etkileşimli görünümün aynısı XLSX (gorunumUygula ile aynı hesap). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requirePermission(PERMISSION_KEYS.RAPOR_VIEW)
  if (error) return error
  const { id } = await params
  const govde = Govde.safeParse(await req.json().catch(() => ({})))
  if (!govde.success) return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })

  const b = await raporBaglami(id, userId, govde.data.parametreler, 'XLSX')
  if (b.hata) return b.hata
  const { sablon, icerik, tanim, degerler, kayit } = b.baglam
  if (!etkilesimliMi(icerik)) return NextResponse.json({ error: 'Hazır Rapor için /calistir (cikti: XLSX) kullanın' }, { status: 400 })
  const gorunum = (govde.data.gorunum as Gorunum | undefined) ?? icerik.gorunum

  const t0 = Date.now()
  try {
    const veri = await veriSetiCalistir(tanim, degerler)
    const parametreOzeti = (icerik.parametreler ?? []).map((p) => `${p.etiket}: ${bicimle(degerler[p.ad], p.tip === 'tarih' ? 'gg.aa.yyyy' : undefined)}`).join('  ·  ')
    const degerEtiketleri = Object.fromEntries((await veriSetiAlanlari(tanim)).filter((a) => a.degerEtiketleri).map((a) => [a.ad, a.degerEtiketleri!]))
    const buffer = await gorunumXlsx(icerik.baslik || sablon.ad, veri.satirlar, gorunum, { altBaslik: icerik.altBaslik, parametreOzeti, degerEtiketleri })
    await calistirmaKaydet(kayit, veri.satirlar.length, Date.now() - t0)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${sablon.kod}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    // Ham metin rapor_calistirma.hata'ya ve loga yazılır; istemciye çevrilmiş yapı gider.
    await calistirmaHatasiKaydet(kayit, sablon.kod, Date.now() - t0, e)
    return hataYaniti(e, {}, 500, `rapor:${sablon.kod}`)
  }
}
