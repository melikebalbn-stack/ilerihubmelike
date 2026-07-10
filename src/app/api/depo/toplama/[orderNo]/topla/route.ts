import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import type { StokKimlik } from '@/lib/ifs/depo-stok'
import {
  getFifoKirilim,
  getRezervKirilim,
  getSatirDurum,
  getSatirPartNo,
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
  const { userId, error } = await requirePermission('admin.system.manage')
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
    // Taze durum → miktar üst sınırını (kalan) doğrula.
    const durum0 = await getSatirDurum(satir)
    const kalan = durum0?.kalan ?? 0
    if (miktar > kalan + EPS) {
      return NextResponse.json(
        { ok: false, error: `İstenen miktar (${miktar}) kalandan (${kalan}) büyük` },
        { status: 400 },
      )
    }
    const tam = Math.abs(miktar - kalan) < EPS

    let yol: 'TAM' | 'KISMI' | 'SAPMA'
    let rezervKimlik: StokKimlik | null = null

    // 1) Rezervasyon — yola göre.
    if (sapma) {
      yol = 'SAPMA'
      rezervKimlik = sapma.stokKimlik

      // İzli sapma kaydı (yapılandırılmış). TODO (EL-6c+): kalıcı sapma tablosu kararı
      // ayrı alınacak (schema değişikliği) — schema.prisma'ya bu fazda DOKUNULMUYOR.
      const partNo = sapma.stokKimlik.partNo || (await getSatirPartNo(satir))
      const fifo = await getFifoKirilim(partNo, miktar)
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
          fifoOnerisi: fifo[0]?.locationNo ?? '—',
          secilen: sapma.stokKimlik.locationNo,
          sebep: sapma.sebep,
          miktar,
        }),
      )

      const rez = await modifyManuelRezerv(satir, rezervKimlik, miktar)
      if (!rez.ok) {
        return NextResponse.json({ ok: false, yol, error: rez.error ?? 'Sapma rezervasyonu başarısız' }, { status: 502 })
      }
    } else if (tam) {
      yol = 'TAM'
      const rez = await reserveSatir(satir)
      if (!rez.ok) {
        return NextResponse.json({ ok: false, yol, error: rez.error ?? 'Rezervasyon başarısız' }, { status: 502 })
      }
    } else {
      yol = 'KISMI'
      const partNo = await getSatirPartNo(satir)
      const fifo = await getFifoKirilim(partNo, miktar)
      if (!fifo.length) {
        return NextResponse.json({ ok: false, yol, error: 'FIFO kaynağı bulunamadı' }, { status: 502 })
      }
      rezervKimlik = fifo[0].kimlik
      const rez = await modifyManuelRezerv(satir, rezervKimlik, miktar)
      if (!rez.ok) {
        return NextResponse.json({ ok: false, yol, error: rez.error ?? 'Kısmi rezervasyon başarısız' }, { status: 502 })
      }
    }

    // 2) IFS'in seçtiği kırılımı oku.
    const kirilim = await getRezervKirilim(satir)

    // 3) Çıkış (unbound IssueMaterial, IssueOnlyReserved=1).
    const iss = await issueSatir(satir)
    if (!iss.ok) {
      // Telafi
      if (yol === 'TAM') {
        // Alloc-level unreserve ayrı bir action → şimdilik otomatikleştirilmedi.
        // TODO (EL-6c+): ShopMaterialAlloc unreserve action'ı bulunup telafi otomatikleştirilecek.
        return NextResponse.json(
          { ok: false, yol, error: `Çıkış başarısız — rezerv açık kalmış olabilir, yöneticiye bildirin: ${iss.error ?? ''}`, kirilim },
          { status: 502 },
        )
      }
      // KISMI/SAPMA → aynı kimlikle ModifySingle(0) ile otomatik geri al.
      const geri = rezervKimlik ? await modifyManuelRezerv(satir, rezervKimlik, 0) : { ok: false }
      const mesaj = geri.ok
        ? `Çıkış başarısız, rezerv geri alındı: ${iss.error ?? ''}`
        : `Çıkış başarısız, rezerv geri ALINAMADI — yöneticiye bildirin: ${iss.error ?? ''}`
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
