import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import type { StokKimlik } from '@/lib/ifs/depo-stok'
import { dostaneIfsHata } from '@/lib/ifs/ifs-hata'
import {
  getFifoKirilim,
  getRezervKirilim,
  getSatirDurum,
  getSatirPartNo,
  getStokSatirlari,
  issueSatir,
  modifyManuelRezerv,
  normalizeIsEmriNo,
  reserveSatir,
  type SatirAnahtar,
} from '@/lib/ifs/tuketim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EPS = 1e-9

const StokKimlikSchema = z.object({
  contract: z.string(),
  partNo: z.string(),
  configurationId: z.string(),
  locationNo: z.string(),
  lotBatchNo: z.string(),
  serialNo: z.string(),
  engChgLevel: z.string(),
  waivDevRejNo: z.string(),
  activitySeq: z.number(),
  handlingUnitId: z.number(),
})

const BodySchema = z.object({
  releaseNo: z.string(),
  sequenceNo: z.string(),
  lineItemNo: z.number().int(),
  // Ondalık serbest; >0. Üst sınır (<=kalan) sunucuda taze durumla doğrulanır.
  miktar: z.number().positive(),
  // Sapma (FIFO dışı) yolu: seçilen stok satırı + zorunlu sebep.
  sapma: z.object({ stokKimlik: StokKimlikSchema, sebep: z.string().min(1) }).optional(),
})

// POST /api/depo/toplama/{orderNo}/topla → satırı rezerve et + çıkışını yap (EL-6b/6c).
// Guard: admin.system.manage.
//
// Üç yol (response.yol):
//  - TAM   : miktar === kalan → mevcut kanıtlı FIFO yolu (ShopMaterialAlloc_Reserve → Issue).
//  - KISMI : miktar < kalan   → FIFO ilk kaynağına kısmi manuel rezerv (ModifySingle) → Issue.
//  - SAPMA : body.sapma var   → seçilen stok satırına manuel rezerv (ModifySingle) → Issue + izli log.
//
// Telafi: Issue başarısızsa KISMI/SAPMA yolunda ModifySingle(0) ile otomatik geri alınır;
// TAM (FIFO) yolunda alloc-level unreserve ayrı action olduğundan şimdilik manuel uyarı verilir.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  const { userId, error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return error

  const { orderNo: ham } = await params
  const orderNo = normalizeIsEmriNo(decodeURIComponent(ham))

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

  const satir: SatirAnahtar = {
    orderNo,
    releaseNo: parsed.data.releaseNo,
    sequenceNo: parsed.data.sequenceNo,
    lineItemNo: parsed.data.lineItemNo,
  }
  const miktar = parsed.data.miktar
  const sapma = parsed.data.sapma

  try {
    // Taze durum → miktar üst sınırını doğrula.
    // REZERV kaleminde (QtyAssigned>0) 'tam' = rezerv miktarı (min(atanan, kalan)), kalan değil.
    const durum0 = await getSatirDurum(satir)
    const kalan = durum0?.kalan ?? 0
    const atanan = durum0?.atanan ?? 0
    const rezervli = atanan > 0
    const ustSinir = rezervli ? Math.min(atanan, kalan) : kalan
    if (miktar > ustSinir + EPS) {
      return NextResponse.json(
        {
          ok: false,
          error: rezervli
            ? `Rezerv miktarı ${ustSinir} — fazlası için önce rezerv artırılmalı`
            : `İstenen miktar (${miktar}) kalandan (${kalan}) büyük`,
        },
        { status: rezervli ? 409 : 400 },
      )
    }
    const tam = Math.abs(miktar - ustSinir) < EPS

    let yol: 'TAM' | 'KISMI' | 'SAPMA'
    let rezervKimlik: StokKimlik | null = null

    // 1) Rezervasyon — yola göre.
    if (sapma) {
      yol = 'SAPMA'
      rezervKimlik = sapma.stokKimlik

      const partNo = sapma.stokKimlik.partNo || (await getSatirPartNo(satir))

      // Raf-mevcut sınırı: seçilen kaynağın güncel AvailableQtyToMove'unu doğrula
      // (IFS'e HİÇ yazma yapmadan). Aşımda 409 + dostane mesaj.
      const tumStok = await getStokSatirlari(partNo)
      const lot = sapma.stokKimlik.lotBatchNo || '*'
      const kaynak =
        tumStok.find((k) => k.locationNo === sapma.stokKimlik.locationNo && (k.lotBatchNo ?? '*') === lot) ??
        tumStok.find((k) => k.locationNo === sapma.stokKimlik.locationNo)
      const mevcut = kaynak?.mevcutMiktar ?? 0
      if (miktar > mevcut + EPS) {
        return NextResponse.json(
          { ok: false, yol, error: `Bu rafta yalnız ${mevcut} var — miktarı düşür ya da başka raf seç` },
          { status: 409 },
        )
      }

      // İzli sapma kaydı (yapılandırılmış). TODO (EL-6c+): kalıcı sapma tablosu kararı
      // ayrı alınacak (schema değişikliği) — schema.prisma'ya bu fazda DOKUNULMUYOR.
      console.log(
        JSON.stringify({
          olay: 'depo.toplama.sapma',
          tarih: new Date().toISOString(),
          kullanici: userId,
          orderNo,
          releaseNo: satir.releaseNo,
          sequenceNo: satir.sequenceNo,
          lineItemNo: satir.lineItemNo,
          partNo,
          fifoOnerisi: tumStok[0]?.locationNo ?? '—',
          secilen: sapma.stokKimlik.locationNo,
          sebep: sapma.sebep,
          miktar,
        }),
      )

      const rez = await modifyManuelRezerv(satir, rezervKimlik, miktar)
      if (!rez.ok) {
        return NextResponse.json({ ok: false, yol, error: dostaneIfsHata(rez.error ?? '', 'Sapma rezervasyonu başarısız') }, { status: 502 })
      }
    } else if (tam) {
      yol = 'TAM'
      // Planlama rezervi varsa (rezervli) rezervasyonu ATLA — IssueOnlyReserved doğrudan
      // mevcut rezervden düşer (miktar === min(atanan,kalan) burada). Yoksa FIFO reserve→issue.
      if (!rezervli) {
        const rez = await reserveSatir(satir)
        if (!rez.ok) {
          return NextResponse.json({ ok: false, yol, error: dostaneIfsHata(rez.error ?? '', 'Rezervasyon başarısız') }, { status: 502 })
        }
      }
    } else {
      yol = 'KISMI'
      // Rezervli kalemde GERÇEK kısmi (miktar < rezerv) mevcut rezervi bozabilir → kilitli.
      // TODO (EL-7+): rezervli kalemde kısmi çıkış (rezervi kısmi tüketen) desteği.
      if (rezervli) {
        return NextResponse.json(
          { ok: false, yol, error: 'Rezervli kalemde kısmi toplama yakında' },
          { status: 409 },
        )
      }
      const partNo = await getSatirPartNo(satir)
      const fifo = await getFifoKirilim(partNo, miktar)
      if (!fifo.length) {
        return NextResponse.json({ ok: false, yol, error: 'FIFO kaynağı bulunamadı' }, { status: 502 })
      }
      // Çok lot: istenen miktar tek stok satırına sığmıyor. ÖNCEDEN kod sessizce
      // fifo[0]'a daraltıp tüm miktarı tek lota rezerve etmeye çalışıyordu; ilk lot
      // yetmediğinde IFS reddediyor ve kullanıcı sebebini anlamıyordu.
      // Artık rezerv DENENMEZ — kırılım kullanıcıya döner, lotu o seçer (sapma yolu).
      if (fifo.length > 1) {
        return NextResponse.json(
          {
            ok: false,
            yol,
            hata: 'COK_LOT',
            fifo,
            error: `Bu miktar ${fifo.length} lota yayılıyor — hangi lottan toplanacağını seçin`,
          },
          { status: 409 },
        )
      }
      rezervKimlik = fifo[0].kimlik
      const rez = await modifyManuelRezerv(satir, rezervKimlik, miktar)
      if (!rez.ok) {
        return NextResponse.json({ ok: false, yol, error: dostaneIfsHata(rez.error ?? '', 'Kısmi rezervasyon başarısız') }, { status: 502 })
      }
    }

    // 2) IFS'in seçtiği kırılımı oku.
    const kirilim = await getRezervKirilim(satir)

    // 3) Çıkış (unbound IssueMaterial, IssueOnlyReserved=1).
    const iss = await issueSatir(satir)
    if (!iss.ok) {
      // Telafi
      const cikisHata = dostaneIfsHata(iss.error ?? '', 'Çıkış başarısız')
      if (yol === 'TAM') {
        // Alloc-level unreserve ayrı bir action → şimdilik otomatikleştirilmedi.
        // TODO (EL-6c+): ShopMaterialAlloc unreserve action'ı bulunup telafi otomatikleştirilecek.
        return NextResponse.json(
          { ok: false, yol, error: `Çıkış başarısız (${cikisHata}) — rezerv açık kalmış olabilir, yöneticiye bildirin`, kirilim },
          { status: 502 },
        )
      }
      // KISMI/SAPMA → aynı kimlikle ModifySingle(0) ile otomatik geri al.
      const geri = rezervKimlik ? await modifyManuelRezerv(satir, rezervKimlik, 0) : { ok: false }
      const mesaj = geri.ok
        ? `Çıkış başarısız (${cikisHata}), rezerv geri alındı`
        : `Çıkış başarısız (${cikisHata}), rezerv geri ALINAMADI — yöneticiye bildirin`
      return NextResponse.json({ ok: false, yol, error: mesaj, kirilim }, { status: 502 })
    }

    // 4) Taze satır durumu.
    const durum = await getSatirDurum(satir)
    return NextResponse.json({
      ok: true,
      yol,
      kirilim,
      satir: durum,
      sapma: sapma ? { locationNo: sapma.stokKimlik.locationNo, sebep: sapma.sebep } : undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
