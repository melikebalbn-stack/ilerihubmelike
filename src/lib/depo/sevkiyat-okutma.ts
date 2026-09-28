import 'server-only'
import { prisma } from '@/lib/prisma'
import { cozBarkodId } from '@/lib/ifs/barkod'
import { parseEtiket, type EtiketKaynak } from '@/lib/depo/etiket-parse'
import type { RezervSatiri, Sevkiyat } from '@/lib/ifs/sevkiyat'


/**
 * Sevkiyat okutma listesi (Hub tarafı). Okutmalar IFS'e hemen yazılmaz; TOPLAMAYI BİTİR'de aynı rezerv
 * satırının okutmaları toplanıp tek PickSelected satır anahtarına çevrilir, sonra raporlandi=true olur.
 */

export interface OkutmaKaydi {
  id: string
  satirAnahtari: string
  pickListNo: string | null
  barkodId: number | null
  partNo: string
  lotBatchNo: string | null
  lokasyon: string
  miktar: number
  kullaniciAd: string
  raporlandi: boolean
  createdAt: string
}

export interface OkutmaAdayi {
  rezerv: RezervSatiri
  /** Rezerve − toplanan − Hub'da bekleyen (raporlanmamış) okutmalar. */
  kalan: number
}

const kayitOf = (r: {
  id: string; satirAnahtari: string; pickListNo: string | null; barkodId: number | null; partNo: string; lotBatchNo: string | null
  lokasyon: string; miktar: unknown; kullaniciAd: string; raporlandi: boolean; createdAt: Date
}): OkutmaKaydi => ({ ...r, miktar: Number(r.miktar), createdAt: r.createdAt.toISOString() })

/** Sevkiyatın okutmaları (varsayılan: yalnız raporlanmamışlar). */
export async function okutmalar(shipmentId: number, tumu = false): Promise<OkutmaKaydi[]> {
  const v = await prisma.sevkiyatOkutma.findMany({
    where: { shipmentId, ...(tumu ? {} : { raporlandi: false }) },
    orderBy: { createdAt: 'asc' },
  })
  return v.map(kayitOf)
}

/** Rezerv satırı başına Hub'da bekleyen (raporlanmamış) miktar. */
export async function bekleyenMiktarlar(shipmentId: number): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  for (const o of await okutmalar(shipmentId)) m.set(o.satirAnahtari, (m.get(o.satirAnahtari) ?? 0) + o.miktar)
  return m
}

/**
 * Okutulan değeri sevkiyatın açık rezerv satırlarıyla eşleştir. Barkod → parça + lot (IFS barkod LOV);
 * elle / stok no → yalnız parça. Sevk lokasyonundaki (toplanmış) satırlar aday değildir.
 */
export async function okutmaCoz(
  s: Sevkiyat,
  ham: string,
  kaynak: EtiketKaynak,
): Promise<{ partNo: string; lotBatchNo: string | null; barkodId: number | null; adaylar: OkutmaAdayi[] }> {
  const p = parseEtiket(ham, kaynak)
  let partNo = (p.stokKodu ?? ham).trim()
  let lot: string | null = p.lot ?? null
  let barkodId: number | null = null
  if (p.tip === 'barkodId' && p.barkodId != null) {
    const k = await cozBarkodId(p.barkodId)
    if (!k) throw new Error(`Barkod bulunamadı: ${p.barkodId}`)
    partNo = k.partNo
    lot = k.lotBatchNo && k.lotBatchNo !== '*' ? k.lotBatchNo : null
    barkodId = k.barcodeId
  }
  const bekleyen = await bekleyenMiktarlar(s.id)
  const adaylar = s.rezervler
    .filter((r) => r.locationNo !== s.sevkLok && r.partNo === partNo && (lot == null || r.lotBatchNo === lot))
    .map((r) => ({ rezerv: r, kalan: r.rezerve - r.toplanan - (bekleyen.get(r.keyref) ?? 0) }))
    .filter((a) => a.kalan > 0)
  return { partNo, lotBatchNo: lot, barkodId, adaylar }
}

export async function okutmaEkle(g: {
  shipmentId: number
  rezerv: RezervSatiri
  barkodId: number | null
  miktar: number
  userId: string
  kullaniciAd: string
}): Promise<OkutmaKaydi> {
  const r = await prisma.sevkiyatOkutma.create({
    data: {
      shipmentId: g.shipmentId,
      satirAnahtari: g.rezerv.keyref,
      pickListNo: g.rezerv.pickListNo || null,
      barkodId: g.barkodId,
      partNo: g.rezerv.partNo,
      lotBatchNo: g.rezerv.lotBatchNo !== '*' ? g.rezerv.lotBatchNo : null,
      lokasyon: g.rezerv.locationNo,
      miktar: g.miktar,
      userId: g.userId,
      kullaniciAd: g.kullaniciAd,
    },
  })
  return kayitOf(r)
}

/** Yalnız raporlanmamış okutma silinir. */
export async function okutmaSil(shipmentId: number, id: string): Promise<OkutmaKaydi> {
  const r = await prisma.sevkiyatOkutma.findFirst({ where: { id, shipmentId } })
  if (!r) throw new Error('Okutma bulunamadı')
  if (r.raporlandi) throw new Error('Raporlanmış okutma silinemez')
  await prisma.sevkiyatOkutma.delete({ where: { id } })
  return kayitOf(r)
}

export async function raporlandiIsaretle(ids: string[]): Promise<void> {
  if (!ids.length) return
  await prisma.sevkiyatOkutma.updateMany({ where: { id: { in: ids }, raporlandi: false }, data: { raporlandi: true, raporlandiAt: new Date() } })
}

// ── Toplamayı geri al (Hub tarafı) ───────────────────────────────────────────

const lotEsit = (okutmaLot: string | null, rezervLot: string) => (okutmaLot ?? '*') === (rezervLot || '*')

export interface GeriAlmaHedefi {
  /** Rezerv lokasyonu (okutma anı) — geri almada dönüş yeri. */
  lokasyon: string
  miktar: number
}

export interface GeriAlinabilir {
  /** Sevk lokasyonundaki toplanmış rezerv satırı. */
  rezerv: RezervSatiri
  /** Raporlanmış okutmalardan çıkan dönüş yerleri (lokasyon başına miktar, toplananla sınırlı). Boşsa IFS'te toplanmış. */
  hedefler: GeriAlmaHedefi[]
}

/** Sevk lokasyonunda toplanmış satırlar + her biri için dönüş hedefleri (raporlanmış okutmalar: parça + lot eşleşmesi). */
export async function geriAlinabilirler(s: Sevkiyat): Promise<GeriAlinabilir[]> {
  const toplanmis = s.rezervler.filter((r) => r.locationNo === s.sevkLok && r.toplanan > 0)
  if (!toplanmis.length) return []
  const raporlu = (await okutmalar(s.id, true)).filter((o) => o.raporlandi)
  return toplanmis.map((r) => {
    const lok = new Map<string, number>()
    for (const o of raporlu) {
      if (o.partNo !== r.partNo || !lotEsit(o.lotBatchNo, r.lotBatchNo)) continue
      lok.set(o.lokasyon, (lok.get(o.lokasyon) ?? 0) + o.miktar)
    }
    let kalan = r.toplanan
    const hedefler: GeriAlmaHedefi[] = []
    for (const [lokasyon, miktar] of lok) {
      const m = Math.min(miktar, kalan)
      if (m > 0) { hedefler.push({ lokasyon, miktar: m }); kalan -= m }
    }
    return { rezerv: r, hedefler }
  })
}

/**
 * Geri alma IFS'te başarılı olduktan sonra: o parça + lot + lokasyonun raporlanmış okutmalarından `miktar` düşülür
 * (en yeni önce; sıfırlanan kayıt silinir) → Hub listesi sevk lokasyonundaki gerçek toplamayla uyumlu kalır.
 * Dönen liste denetim kaydı içindir.
 */
export async function geriAlindiDus(
  shipmentId: number, partNo: string, lotBatchNo: string, lokasyon: string, miktar: number,
): Promise<{ id: string; onceki: number; sonraki: number }[]> {
  return prisma.$transaction(async (tx) => {
    const kayitlar = await tx.sevkiyatOkutma.findMany({
      where: { shipmentId, raporlandi: true, partNo, lokasyon, lotBatchNo: lotBatchNo && lotBatchNo !== '*' ? lotBatchNo : null },
      orderBy: { createdAt: 'desc' },
    })
    let kalan = miktar
    const degisen: { id: string; onceki: number; sonraki: number }[] = []
    for (const k of kayitlar) {
      if (!(kalan > 0)) break
      const onceki = Number(k.miktar)
      const dus = Math.min(onceki, kalan)
      const sonraki = onceki - dus
      if (sonraki > 0) await tx.sevkiyatOkutma.update({ where: { id: k.id }, data: { miktar: sonraki } })
      else await tx.sevkiyatOkutma.delete({ where: { id: k.id } })
      degisen.push({ id: k.id, onceki, sonraki })
      kalan -= dus
    }
    return degisen
  })
}
