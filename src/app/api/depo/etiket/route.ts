import { NextResponse } from 'next/server'
import { z } from 'zod'
import { PDFDocument } from 'pdf-lib'
import { requirePermission } from '@/lib/auth/require-permission'
import { getPartAdi } from '@/lib/ifs/depo-stok'
import { uretBarkod } from '@/lib/ifs/barkod'
import { generateMalzemeEtiketi, genEtiketNo } from '@/lib/depo/etiket-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// etiketNo sunucuda üretilir; basanKullanici session'dan → body'de yok.
// adet: kaç etiket → her biri için AYRI IFS barkodu (ayrı sayfa).
const BodySchema = z.object({
  stokKodu: z.string().min(1),
  stokAdi: z.string(),
  miktar: z.number(),
  birim: z.string(),
  lot: z.string().optional(),
  girisTarihi: z.string().optional(),
  kaynakBilgi: z.string(),
  lokasyon: z.string(),
  kaynakModul: z.string(),
  adet: z.number().int().positive().max(50).default(1),
})

// POST /api/depo/etiket → N sayfalı malzeme tanıtım kartı PDF (inline). Guard: admin.system.manage.
//
// Her etiket için AYRI uretBarkod() → benzersiz IFS BarcodeId → ayrı sayfa. Barkodlar IFS'te
// KALICI (silinemez) → "hepsi ya da hiçbiri": tek barkod bile üretilemezse PDF BASILMAZ,
// anlamlı hata döner (kaç barkod üretildiği + kalıcı oldukları bildirilir, ID'ler log'a yazılır).
// originPackSize v1'de sabit 1 (mevcut stok 1'lik).
export async function POST(request: Request) {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) return error

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Geçersiz JSON' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(payload)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
    return NextResponse.json({ ok: false, error: `Geçersiz istek: ${msg}` }, { status: 400 })
  }

  const { adet, ...d } = parsed.data
  const basanKullanici = session.user.name ?? 'Operatör'

  // Stok adı boş/'-' ise IFS'ten tamamla (bloklamaz — null ise '-' kalır).
  let stokAdi = d.stokAdi
  if (!stokAdi || stokAdi.trim() === '' || stokAdi.trim() === '-') {
    try {
      stokAdi = (await getPartAdi(d.stokKodu)) ?? d.stokAdi
    } catch {
      /* ad tamamlanamadı → mevcut değerle devam */
    }
  }

  const uretilen: number[] = []
  const sayfaPdfleri: Uint8Array[] = []
  try {
    for (let i = 0; i < adet; i++) {
      // 1) IFS'te benzersiz barkod (KALICI). Hata → hepsi-ya-da-hiçbiri: bas-ma, bilgilendir.
      let barkodId: number
      try {
        barkodId = await uretBarkod({ partNo: d.stokKodu, lotBatchNo: d.lot, originPackSize: 1 })
      } catch (e) {
        const sebep = e instanceof Error ? e.message : 'Barkod üretilemedi'
        console.error('[etiket] barkod üretim hatası', { stokKodu: d.stokKodu, istenen: adet, uretilenAdet: uretilen.length, hataSirasi: i + 1, uretilenIdler: uretilen })
        return NextResponse.json(
          {
            ok: false,
            error:
              `${adet} etiket istendi, ${uretilen.length} barkod üretildi, ${i + 1}.'de hata: ${sebep} ` +
              `Basım iptal edildi. Üretilen barkodlar IFS'te kalıcıdır` +
              `${uretilen.length ? ` (${uretilen.join(', ')})` : ''}.`,
          },
          { status: 502 },
        )
      }
      uretilen.push(barkodId)

      // 2) Bu barkodla tek sayfa
      const etiketNo = genEtiketNo()
      const pdf = await generateMalzemeEtiketi({ ...d, stokAdi, etiketNo, barkodId, basanKullanici })
      sayfaPdfleri.push(pdf)
    }

    // 3) N tek-sayfa PDF → tek çok-sayfa PDF
    const birlesik = await PDFDocument.create()
    for (const bytes of sayfaPdfleri) {
      const src = await PDFDocument.load(bytes)
      const [sayfa] = await birlesik.copyPages(src, [0])
      birlesik.addPage(sayfa)
    }
    const out = await birlesik.save()

    return new Response(out as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="etiket-${uretilen[0]}${adet > 1 ? `-${adet}ad` : ''}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    // PDF/birleştirme hatası — barkodlar üretilmiş olabilir (kalıcı).
    const message = e instanceof Error ? e.message : 'Etiket üretilemedi'
    console.error('[etiket] PDF hatası', { stokKodu: d.stokKodu, uretilenIdler: uretilen })
    return NextResponse.json(
      {
        ok: false,
        error:
          `Etiket PDF'i üretilemedi: ${message}` +
          `${uretilen.length ? ` Üretilen barkodlar IFS'te kalıcıdır (${uretilen.join(', ')}).` : ''}`,
      },
      { status: 500 },
    )
  }
}
