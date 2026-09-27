import 'server-only'
import { prisma } from '@/lib/prisma'
import { molaPencereleri, pencereBirlesimMs, type MolaPencere } from '@/lib/ipro/mola-takvim'

// IPRO Analiz — dönem OEE metrikleri, trend, duruş/hurda Pareto, tezgah tablosu. SALT OKUMA.
// KRİTİK: dönem metrikleri ORANLARIN ORTALAMASI DEĞİL, TOPLAMLARDAN hesaplanır (saf donemMetrik).

export type Gruplama = 'gun' | 'vardiya' | 'hafta'

export interface AnalizFiltre {
  bas: Date
  bit: Date
  gruplama: Gruplama
  vardiyaId?: string | null
  bolum?: string | null // IproTezgah.masGrupAdi
  tezgahKod?: string | null
}

// Bir OEE kaydının dönem toplamına giren ham alanları (SAF hesap için — DB'siz test edilir).
export interface OeeKayitGirdi {
  planliSaniye: number
  durusSaniye: number
  uretilenAdet: number
  iyiAdet: number
  idealSaniyeAdet: number | null
  cokluIs: boolean // hesapKaynagi === 'COKLU_IS' → P/Q'ya girmez, A'ya girer
}

export interface DonemMetrik {
  availability: number | null
  performance: number | null
  quality: number | null
  oee: number | null
}

/**
 * Dönem metrikleri TOPLAMLARDAN (oranların ortalaması DEĞİL):
 *   A = Σ(planlı−duruş)/Σplanlı        (TÜM kayıtlar)
 *   P = Σ(ideal×uretim)/Σ(planlı−duruş) (COKLU_IS HARİÇ; ideal null ise o kayıt P'ye girmez)
 *   Q = Σiyi/Σuretilen                  (COKLU_IS HARİÇ)
 *   OEE = A×P×Q
 * SAF — DB'siz test edilir. Boş/sıfır payda → null (yayılır).
 */
export function donemMetrik(kayitlar: OeeKayitGirdi[]): DonemMetrik {
  let sPlanli = 0, sDurus = 0 // A: tüm kayıtlar
  let sIdealUretim = 0, sCalismaPQ = 0 // P: COKLU_IS hariç, ideal dolu
  let sIyi = 0, sUretilen = 0 // Q: COKLU_IS hariç
  for (const k of kayitlar) {
    sPlanli += k.planliSaniye
    sDurus += k.durusSaniye
    if (k.cokluIs) continue
    if (k.idealSaniyeAdet != null) {
      sIdealUretim += k.idealSaniyeAdet * k.uretilenAdet
      sCalismaPQ += Math.max(0, k.planliSaniye - k.durusSaniye)
    }
    sIyi += k.iyiAdet
    sUretilen += k.uretilenAdet
  }
  const availability = sPlanli > 0 ? (sPlanli - sDurus) / sPlanli : null
  const performance = sCalismaPQ > 0 ? sIdealUretim / sCalismaPQ : null
  const quality = sUretilen > 0 ? sIyi / sUretilen : null
  const oee = availability != null && performance != null && quality != null ? availability * performance * quality : null
  return { availability, performance, quality, oee }
}

/** IPRO-001 "Çevrim Sapma" ile AYNI durum mantığı: planlı≤1→TANIMSIZ, ölçülen>planlı→YAVAŞ, diğer→HIZLI. */
export type CevrimDurum = 'TANIMSIZ' | 'YAVAŞ' | 'HIZLI' | null
export function cevrimDurum(planliMed: number | null, olculenMed: number | null): CevrimDurum {
  if (planliMed == null || olculenMed == null) return null
  if (planliMed <= 1) return 'TANIMSIZ'
  return olculenMed > planliMed ? 'YAVAŞ' : 'HIZLI'
}

function medyan(arr: number[]): number | null {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ─────────────────────────── DB katmanı ───────────────────────────

interface HamKayit {
  tezgahKod: string
  bolum: string | null
  vardiyaId: string | null
  bitirildiAt: Date
  planliSaniye: number
  durusSaniye: number
  uretilenAdet: number
  iyiAdet: number
  idealSaniyeAdet: number | null
  cokluIs: boolean
}

/**
 * Dönem OEE kayıtlarını (log.bitirildiAt penceresinde, filtreli) yükler.
 * IproOeeKaydi'de productionLog İLİŞKİSİ yok (yalnız productionLogId) → önce ilgili logları çek,
 * sonra OeeKaydi'lerini productionLogId ile eşle (JS join). Kayıt hacmi küçük (yüzler mertebesi).
 */
async function oeeKayitlariYukle(f: { bas: Date; bit: Date; vardiyaId?: string | null; bolum?: string | null; tezgahKod?: string | null }): Promise<HamKayit[]> {
  const loglar = await prisma.iproProductionLog.findMany({
    where: {
      durum: 'KAPALI',
      bitirildiAt: { gte: f.bas, lt: f.bit },
      ...(f.tezgahKod ? { tezgah: { kod: f.tezgahKod } } : {}),
      ...(f.bolum ? { tezgah: { masGrupAdi: f.bolum } } : {}),
    },
    select: { id: true, bitirildiAt: true, tezgah: { select: { kod: true, masGrupAdi: true } } },
  })
  if (loglar.length === 0) return []
  const logById = new Map(loglar.map((l) => [l.id, l]))
  const oeeler = await prisma.iproOeeKaydi.findMany({
    where: {
      productionLogId: { in: loglar.map((l) => l.id) },
      ...(f.vardiyaId ? { vardiyaId: f.vardiyaId } : {}),
    },
    select: {
      productionLogId: true, tezgahKod: true, vardiyaId: true, planliSaniye: true, durusSaniye: true,
      uretilenAdet: true, iyiAdet: true, idealSaniyeAdet: true, hesapKaynagi: true,
    },
  })
  return oeeler.map((r) => {
    const log = logById.get(r.productionLogId)!
    return {
      tezgahKod: r.tezgahKod,
      bolum: log.tezgah?.masGrupAdi ?? null,
      vardiyaId: r.vardiyaId,
      bitirildiAt: log.bitirildiAt!,
      planliSaniye: r.planliSaniye,
      durusSaniye: r.durusSaniye,
      uretilenAdet: r.uretilenAdet,
      iyiAdet: r.iyiAdet,
      idealSaniyeAdet: r.idealSaniyeAdet,
      cokluIs: r.hesapKaynagi === 'COKLU_IS',
    }
  })
}

const girdi = (r: HamKayit): OeeKayitGirdi => ({
  planliSaniye: r.planliSaniye, durusSaniye: r.durusSaniye, uretilenAdet: r.uretilenAdet,
  iyiAdet: r.iyiAdet, idealSaniyeAdet: r.idealSaniyeAdet, cokluIs: r.cokluIs,
})

/** ISO hafta anahtarı (yıl-Www) — hafta gruplaması. */
function haftaAnahtari(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const gun = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - gun + 3)
  const ilk = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  const hafta = 1 + Math.round(((t.getTime() - ilk.getTime()) / 86400000 - 3 + ((ilk.getUTCDay() + 6) % 7)) / 7)
  return `${t.getUTCFullYear()}-W${String(hafta).padStart(2, '0')}`
}

export type TrendNoktasi = { etiket: string } & DonemMetrik

export interface ParetoSatiri { ad: string; deger: number; kumulatifYuzde: number; tezgahDagilim?: { kod: string; deger: number }[] }
export interface TezgahSatiri {
  kod: string; bolum: string | null
  availability: number | null; performance: number | null; quality: number | null; oee: number | null
  adet: number; hurda: number; durusDk: number
  cevrimDurum: CevrimDurum
}

export interface AnalizVerisi {
  donem: DonemMetrik & { oncekiFark: DonemMetrik }
  trend: TrendNoktasi[]
  durusPareto: { plansiz: ParetoSatiri[]; planli: ParetoSatiri[] }
  hurdaPareto: { kayit: ParetoSatiri[]; adet: ParetoSatiri[] }
  tezgahlar: TezgahSatiri[]
}

function paretoKur(m: Map<string, number>): ParetoSatiri[] {
  const arr = [...m.entries()].map(([ad, deger]) => ({ ad, deger })).sort((a, b) => b.deger - a.deger)
  const toplam = arr.reduce((s, r) => s + r.deger, 0)
  let kum = 0
  return arr.map((r) => { kum += r.deger; return { ad: r.ad, deger: r.deger, kumulatifYuzde: toplam > 0 ? Math.round((kum / toplam) * 100) : 0 } })
}

/**
 * Duruş süresi (sn), çift-düşüm guard'lı: planlı sebepli duruşun mola penceresiyle kesişen kısmı
 * kayba sayılmaz (oee-hesap guard'ıyla aynı). SAF — mola pencereleri önceden (bölüm başına BİR kez)
 * çözülüp geçirilir (per-duruş DB çağrısı YOK; performans).
 */
function durusSaniyeGuardli(pencereler: MolaPencere[], bas: Date, bit: Date, dPlanli: boolean, dBas: Date, dBit: Date): number {
  const kesBas = Math.max(dBas.getTime(), bas.getTime())
  const kesBit = Math.min(dBit.getTime(), bit.getTime())
  if (kesBit <= kesBas) return 0
  let sure = kesBit - kesBas
  if (dPlanli && pencereler.length) sure -= pencereBirlesimMs(pencereler, kesBas, kesBit)
  return Math.max(0, sure / 1000)
}

export async function analizVerisi(f: AnalizFiltre): Promise<AnalizVerisi> {
  const uzunlukMs = f.bit.getTime() - f.bas.getTime()
  const oncekiBas = new Date(f.bas.getTime() - uzunlukMs)
  const oncekiBit = new Date(f.bas.getTime())

  const [kayitlar, oncekiKayitlar] = await Promise.all([
    oeeKayitlariYukle({ bas: f.bas, bit: f.bit, vardiyaId: f.vardiyaId, bolum: f.bolum, tezgahKod: f.tezgahKod }),
    oeeKayitlariYukle({ bas: oncekiBas, bit: oncekiBit, vardiyaId: f.vardiyaId, bolum: f.bolum, tezgahKod: f.tezgahKod }),
  ])

  const donem = donemMetrik(kayitlar.map(girdi))
  const onceki = donemMetrik(oncekiKayitlar.map(girdi))
  const oncekiFark: DonemMetrik = {
    availability: donem.availability != null && onceki.availability != null ? donem.availability - onceki.availability : null,
    performance: donem.performance != null && onceki.performance != null ? donem.performance - onceki.performance : null,
    quality: donem.quality != null && onceki.quality != null ? donem.quality - onceki.quality : null,
    oee: donem.oee != null && onceki.oee != null ? donem.oee - onceki.oee : null,
  }

  // Trend — gruplama kovaları
  const kovaAdi = (r: HamKayit): string => {
    if (f.gruplama === 'hafta') return haftaAnahtari(r.bitirildiAt)
    if (f.gruplama === 'vardiya') return r.vardiyaId ?? '—'
    return r.bitirildiAt.toISOString().slice(0, 10)
  }
  const kovalar = new Map<string, HamKayit[]>()
  for (const r of kayitlar) { const k = kovaAdi(r); if (!kovalar.has(k)) kovalar.set(k, []); kovalar.get(k)!.push(r) }
  let vardiyaAd = new Map<string, string>()
  if (f.gruplama === 'vardiya') {
    const vs = await prisma.iproVardiya.findMany({ select: { id: true, kod: true } })
    vardiyaAd = new Map(vs.map((v) => [v.id, v.kod]))
  }
  const trend: TrendNoktasi[] = [...kovalar.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, rs]) => ({ etiket: f.gruplama === 'vardiya' ? (vardiyaAd.get(k) ?? k) : k, ...donemMetrik(rs.map(girdi)) }))

  // Duruş Pareto (IproMachineDowntime, guard'lı) — plansız/planlı ayrı
  const duruslar = await prisma.iproMachineDowntime.findMany({
    where: {
      baslangic: { lt: f.bit }, OR: [{ bitis: null }, { bitis: { gt: f.bas } }],
      ...(f.tezgahKod ? { tezgah: { kod: f.tezgahKod } } : {}),
      ...(f.bolum ? { tezgah: { masGrupAdi: f.bolum } } : {}),
    },
    select: { tezgahId: true, baslangic: true, bitis: true, durusSebebi: { select: { ad: true, planli: true } }, tezgah: { select: { masGrupAdi: true } } },
  })
  const tezgahKodById = new Map<string, string>()
  {
    const tzs = await prisma.iproTezgah.findMany({ select: { id: true, kod: true } })
    for (const t of tzs) tezgahKodById.set(t.id, t.kod)
  }
  const plansizM = new Map<string, number>()
  const planliM = new Map<string, number>()
  const dagilim = new Map<string, Map<string, number>>() // sebepAd → (tezgahKod → dk)
  const durusDkByKod = new Map<string, number>() // tezgah bazında guard'lı duruş dk (aynı geçişte)
  // Mola pencerelerini BÖLÜM başına BİR kez çöz (per-duruş DB çağrısı yerine) — performans.
  const bolumler = [...new Set(duruslar.map((d) => d.tezgah?.masGrupAdi ?? null))]
  const molaCache = new Map<string | null, MolaPencere[]>()
  await Promise.all(bolumler.map(async (b) => { molaCache.set(b, await molaPencereleri(prisma, b, f.bas, f.bit)) }))
  for (const d of duruslar) {
    const planli = d.durusSebebi?.planli ?? false
    const ad = d.durusSebebi?.ad ?? '(sebepsiz)'
    const pencereler = molaCache.get(d.tezgah?.masGrupAdi ?? null) ?? []
    const sn = durusSaniyeGuardli(pencereler, f.bas, f.bit, planli, d.baslangic, d.bitis ?? f.bit)
    if (sn <= 0) continue
    const dk = sn / 60
    ;(planli ? planliM : plansizM).set(ad, ((planli ? planliM : plansizM).get(ad) ?? 0) + dk)
    if (!dagilim.has(ad)) dagilim.set(ad, new Map())
    const kod = tezgahKodById.get(d.tezgahId) ?? d.tezgahId
    dagilim.get(ad)!.set(kod, (dagilim.get(ad)!.get(kod) ?? 0) + dk)
    durusDkByKod.set(kod, (durusDkByKod.get(kod) ?? 0) + dk)
  }
  const yuvarla = (m: Map<string, number>) => new Map([...m.entries()].map(([k, v]) => [k, Math.round(v)]))
  const dagilimEkle = (satirlar: ParetoSatiri[]): ParetoSatiri[] =>
    satirlar.map((s) => ({
      ...s,
      tezgahDagilim: [...(dagilim.get(s.ad) ?? new Map<string, number>()).entries()]
        .map(([kod, v]) => ({ kod, deger: Math.round(v) }))
        .sort((a, b) => b.deger - a.deger),
    }))

  // Hurda Pareto (IproHurdaKaydi, rework hariç) — kayıt + adet
  const hurdalar = await prisma.iproHurdaKaydi.findMany({
    where: {
      isRework: false, zaman: { gte: f.bas, lt: f.bit },
      productionLog: {
        ...(f.tezgahKod ? { tezgah: { kod: f.tezgahKod } } : {}),
        ...(f.bolum ? { tezgah: { masGrupAdi: f.bolum } } : {}),
      },
    },
    select: { sebepAd: true, sebepKod: true, adet: true },
  })
  const hurdaKayitM = new Map<string, number>()
  const hurdaAdetM = new Map<string, number>()
  for (const h of hurdalar) {
    const ad = h.sebepAd ?? h.sebepKod ?? '(sebepsiz)'
    hurdaKayitM.set(ad, (hurdaKayitM.get(ad) ?? 0) + 1)
    hurdaAdetM.set(ad, (hurdaAdetM.get(ad) ?? 0) + h.adet)
  }

  // Tezgah tablosu
  const tezgahMap = new Map<string, HamKayit[]>()
  for (const r of kayitlar) { if (!tezgahMap.has(r.tezgahKod)) tezgahMap.set(r.tezgahKod, []); tezgahMap.get(r.tezgahKod)!.push(r) }
  // tezgah başına hurda + duruş dk
  const hurdaByTezgah = new Map<string, number>()
  const hurdaTezgah = await prisma.iproHurdaKaydi.findMany({
    where: { isRework: false, zaman: { gte: f.bas, lt: f.bit }, productionLog: { ...(f.bolum ? { tezgah: { masGrupAdi: f.bolum } } : {}) } },
    select: { adet: true, productionLog: { select: { tezgah: { select: { kod: true } } } } },
  })
  for (const h of hurdaTezgah) { const k = h.productionLog?.tezgah?.kod; if (k) hurdaByTezgah.set(k, (hurdaByTezgah.get(k) ?? 0) + h.adet) }

  const tezgahlar: TezgahSatiri[] = [...tezgahMap.entries()].map(([kod, rs]) => {
    const m = donemMetrik(rs.map(girdi))
    const idealler = rs.filter((r) => r.idealSaniyeAdet != null && !r.cokluIs).map((r) => r.idealSaniyeAdet!)
    const olculenler = rs.filter((r) => !r.cokluIs && r.uretilenAdet > 0).map((r) => (r.planliSaniye - r.durusSaniye) / r.uretilenAdet)
    return {
      kod, bolum: rs[0]?.bolum ?? null,
      availability: m.availability, performance: m.performance, quality: m.quality, oee: m.oee,
      adet: rs.reduce((s, r) => s + r.uretilenAdet, 0),
      hurda: hurdaByTezgah.get(kod) ?? 0,
      durusDk: Math.round(durusDkByKod.get(kod) ?? 0),
      cevrimDurum: cevrimDurum(medyan(idealler), medyan(olculenler)),
    }
  }).sort((a, b) => (b.oee ?? -1) - (a.oee ?? -1))

  return {
    donem: { ...donem, oncekiFark },
    trend,
    durusPareto: { plansiz: dagilimEkle(paretoKur(yuvarla(plansizM))), planli: dagilimEkle(paretoKur(yuvarla(planliM))) },
    hurdaPareto: { kayit: paretoKur(hurdaKayitM), adet: paretoKur(hurdaAdetM) },
    tezgahlar,
  }
}
