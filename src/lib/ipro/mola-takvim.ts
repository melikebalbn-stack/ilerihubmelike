// IPRO mola takvimi — planlı mola pencerelerinin çözümü. SAF ÇEKİRDEK (pencerelerCoz) DB'siz test edilir;
// DB sarmalayıcıları (molaPencereleri / aktifMolaPenceresi) tanımları yükleyip çekirdeği çağırır.
//
// Yerel "HH:mm" → UTC dönüşümü Europe/Istanbul IANA zone ile (zoneOffsetMs, sabit ofset YAZILMAZ).
// Gece vardiyası (ertesiGuneTasar): gece yarısını geçen pencereler başladığı VARDIYA gününe eşlenir.
import type { PrismaClient } from '@/generated/prisma'
import { gunDurumu, tarihAnahtari, gecerliTatilTip, type IproTatilTip } from '@/lib/ipro/takvim-util'
import { zoneOffsetMs } from '@/lib/mas/tarih'

export const IPRO_TZ = 'Europe/Istanbul'

/** Haftanın günü → bit maskesi. Pzt=1, Sal=2, Çar=4, Per=8, Cum=16, Cmt=32, Paz=64. */
export function gunBiti(jsGun: number): number {
  return jsGun === 0 ? 64 : 1 << (jsGun - 1)
}

function saatDk(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** "Duvar saati olarak yorumlanan" epoch'u gerçek UTC anına çevirir (masTarih ile aynı sabit-nokta). */
function duvarToUtc(wallEpochMs: number, tz: string): number {
  const off1 = zoneOffsetMs(new Date(wallEpochMs), tz)
  let aday = wallEpochMs - off1
  const off2 = zoneOffsetMs(new Date(aday), tz)
  if (off2 !== off1) aday = wallEpochMs - off2
  return aday
}

/** UTC an → ait olduğu YEREL günün UTC-gece-yarısı epoch'u (gün/tatil türetmesi için). */
function yerelGunEpoch(utcMs: number, tz: string): number {
  const y = new Date(utcMs + zoneOffsetMs(new Date(utcMs), tz))
  return Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate())
}

export interface MolaTanimCoz {
  bolum: string | null
  sebepId: string
  baslangic: string // "HH:mm" yerel
  sureDk: number
  gunMaskesi: number
  gecerliBaslangic: Date | null
  gecerliBitis: Date | null
  aktif: boolean
  // Ait olduğu vardiyanın saatleri (gece taşması + YARIM çalışma aralığı için):
  vardiyaBaslangic: string // "HH:mm"
  vardiyaBitis: string // "HH:mm"
  vardiyaErtesiGuneTasar: boolean
}

export interface MolaPencere {
  basla: Date
  bitis: Date
  sebepId: string
}

/**
 * SAF çekirdek: verilen tanımlardan [bas, bit] aralığıyla KESİŞEN mola pencerelerini üretir (UTC, KIRPILMAMIŞ).
 * - bolum override > null: aynı (baslangic, gunMaskesi, sebep, vardiya) için bölüm-özel tanım varsa null-bölüm tanımı elenir.
 * - gunMaskesi + gecerlilik aralığı + TATIL (pencere yok) + YARIM (yalnız çalışma aralığına düşen pencere) süzgeci.
 * - Gece vardiyasında pencere HH:mm vardiya başlangıcından küçükse ertesi güne (D+1) taşınır.
 * Dönen pencereler kırpılmamıştır; tüketici (planlı süre / çift-düşüm) aralıkla kesiştirir.
 */
export function pencerelerCoz(
  tanimlar: MolaTanimCoz[],
  bolum: string | null,
  bas: Date,
  bit: Date,
  tatilMap: Map<string, IproTatilTip>,
  tz: string = IPRO_TZ,
): MolaPencere[] {
  const basMs = bas.getTime()
  const bitMs = bit.getTime()
  if (bitMs <= basMs || tanimlar.length === 0) return []

  // 1) Uygulanabilir tanımlar: bolum eşleşmesi + override. Anahtar: sebep|baslangic|gunMaskesi|vardiya.
  const anahtar = (t: MolaTanimCoz) => `${t.sebepId}|${t.baslangic}|${t.gunMaskesi}|${t.vardiyaBaslangic}|${t.vardiyaErtesiGuneTasar}`
  const bolumOzelAnahtarlar = new Set<string>()
  for (const t of tanimlar) if (t.aktif && t.bolum === bolum && bolum !== null) bolumOzelAnahtarlar.add(anahtar(t))
  const uygulanabilir = tanimlar.filter((t) => {
    if (!t.aktif) return false
    if (t.bolum === bolum) return true // tam bölüm eşleşmesi (bolum null ise null-null da buraya düşer)
    if (t.bolum === null) return !bolumOzelAnahtarlar.has(anahtar(t)) // null yalnız override yoksa
    return false
  })
  if (uygulanabilir.length === 0) return []

  const pencereler: MolaPencere[] = []
  // 2) Aday yerel günler: gece vardiyası önceki günden taşabilir → bir gün geriden başla.
  const ilkGun = yerelGunEpoch(basMs, tz) - 86400000
  const sonGun = yerelGunEpoch(bitMs, tz)
  for (let g = ilkGun; g <= sonGun; g += 86400000) {
    const gun = new Date(g)
    const durum = gunDurumu(gun, tatilMap)
    if (durum === 'TATIL') continue
    const gBit = gunBiti(gun.getUTCDay())
    for (const t of uygulanabilir) {
      if ((t.gunMaskesi & gBit) === 0) continue
      const vBasMin = saatDk(t.vardiyaBaslangic)
      const wMin = saatDk(t.baslangic)
      // Gece vardiyasında pencere vardiya başlangıcından küçükse ertesi güne taşınır.
      const wOfsMin = wMin + (t.vardiyaErtesiGuneTasar && wMin < vBasMin ? 1440 : 0)
      const wStart = duvarToUtc(g + wOfsMin * 60000, tz)
      const wEnd = wStart + t.sureDk * 60000
      // Geçerlilik aralığı (pencerenin BAŞLANGICINA göre).
      if (t.gecerliBaslangic && wStart < t.gecerliBaslangic.getTime()) continue
      if (t.gecerliBitis && wStart >= t.gecerliBitis.getTime()) continue
      // YARIM gün: yalnız çalışma aralığına (vardiyanın ilk yarısı) düşen pencereler.
      if (durum === 'YARIM') {
        const vBitMin = saatDk(t.vardiyaBitis) + (t.vardiyaErtesiGuneTasar ? 1440 : 0)
        const calismaBitiMin = vBasMin + Math.floor((vBitMin - vBasMin) / 2)
        const calismaBitiUtc = duvarToUtc(g + calismaBitiMin * 60000, tz)
        if (wStart >= calismaBitiUtc) continue
      }
      // [bas, bit] ile kesişmiyorsa atla (kırpma yok — sınır teması dahil değil).
      if (wStart >= bitMs || wEnd <= basMs) continue
      pencereler.push({ basla: new Date(wStart), bitis: new Date(wEnd), sebepId: t.sebepId })
    }
  }
  return pencereler
}

/** [a1,a2] ∩ [b1,b2] pozitif uzunluğu (ms); yoksa 0. */
function kesisimMs(a1: number, a2: number, b1: number, b2: number): number {
  const s = Math.max(a1, b1)
  const e = Math.min(a2, b2)
  return e > s ? e - s : 0
}

/**
 * Pencere kümesinin [bas,bit] ile kesişiminin BİRLEŞİK (union, örtüşme çift sayılmaz) uzunluğu — ms.
 * Planlı süre düşümü ve çift-düşüm engelinde ortak kullanılır.
 */
export function pencereBirlesimMs(pencereler: { basla: Date; bitis: Date }[], bas: number, bit: number): number {
  const dilimler: [number, number][] = []
  for (const p of pencereler) {
    const s = Math.max(p.basla.getTime(), bas)
    const e = Math.min(p.bitis.getTime(), bit)
    if (e > s) dilimler.push([s, e])
  }
  if (dilimler.length === 0) return 0
  dilimler.sort((a, b) => a[0] - b[0])
  let toplam = 0
  let [curS, curE] = dilimler[0]
  for (let i = 1; i < dilimler.length; i++) {
    const [s, e] = dilimler[i]
    if (s <= curE) curE = Math.max(curE, e)
    else {
      toplam += curE - curS
      ;[curS, curE] = [s, e]
    }
  }
  toplam += curE - curS
  return toplam
}

// ─────────────────────────── DB katmanı ───────────────────────────

/** Belirli bölüm için [bas,bit] aralığındaki mola tanımlarını yükler (bolum + null; aktif; geçerlilik örtüşen). */
async function tanimlariYukle(prisma: PrismaClient, bolum: string | null, bas: Date, bit: Date): Promise<MolaTanimCoz[]> {
  const rows = await prisma.iproMolaTanim.findMany({
    where: {
      aktif: true,
      OR: [{ bolum }, { bolum: null }],
      AND: [
        { OR: [{ gecerliBaslangic: null }, { gecerliBaslangic: { lt: bit } }] },
        { OR: [{ gecerliBitis: null }, { gecerliBitis: { gt: bas } }] },
      ],
    },
    select: {
      bolum: true,
      sebepId: true,
      baslangic: true,
      sureDk: true,
      gunMaskesi: true,
      gecerliBaslangic: true,
      gecerliBitis: true,
      aktif: true,
      vardiya: { select: { baslangicSaat: true, bitisSaat: true, ertesiGuneTasar: true, aktif: true } },
    },
  })
  return rows
    .filter((r) => r.vardiya.aktif)
    .map((r) => ({
      bolum: r.bolum,
      sebepId: r.sebepId,
      baslangic: r.baslangic,
      sureDk: r.sureDk,
      gunMaskesi: r.gunMaskesi,
      gecerliBaslangic: r.gecerliBaslangic,
      gecerliBitis: r.gecerliBitis,
      aktif: r.aktif,
      vardiyaBaslangic: r.vardiya.baslangicSaat,
      vardiyaBitis: r.vardiya.bitisSaat,
      vardiyaErtesiGuneTasar: r.vardiya.ertesiGuneTasar,
    }))
}

async function tatilMapYukle(prisma: PrismaClient, bas: Date, bit: Date): Promise<Map<string, IproTatilTip>> {
  const alt = new Date(bas.getTime() - 86400000)
  const tatiller = await prisma.iproTatil.findMany({
    where: { tarih: { gte: alt, lte: bit } },
    select: { tarih: true, tip: true },
  })
  const m = new Map<string, IproTatilTip>()
  for (const t of tatiller) if (gecerliTatilTip(t.tip)) m.set(tarihAnahtari(t.tarih), t.tip)
  return m
}

/** [bas,bit] aralığındaki mola pencereleri (UTC, kırpılmamış) — bölüm bazlı, override + tatil süzgeçli. */
export async function molaPencereleri(prisma: PrismaClient, bolum: string | null, bas: Date, bit: Date): Promise<MolaPencere[]> {
  const [tanimlar, tatilMap] = await Promise.all([tanimlariYukle(prisma, bolum, bas, bit), tatilMapYukle(prisma, bas, bit)])
  return pencerelerCoz(tanimlar, bolum, bas, bit, tatilMap)
}

/** `an` anını KAPSAYAN aktif mola penceresi (varsa) — TAKVIM duruşu aç/kapat için. Kırpılmamış döner. */
export async function aktifMolaPenceresi(prisma: PrismaClient, bolum: string | null, an: Date): Promise<MolaPencere | null> {
  const alt = new Date(an.getTime() - 2 * 3600_000)
  const ust = new Date(an.getTime() + 2 * 3600_000)
  const pencereler = await molaPencereleri(prisma, bolum, alt, ust)
  const anMs = an.getTime()
  let secili: MolaPencere | null = null
  for (const p of pencereler) {
    if (p.basla.getTime() <= anMs && p.bitis.getTime() > anMs) {
      if (!secili || p.bitis.getTime() > secili.bitis.getTime()) secili = p // en geç biten (kapatma için)
    }
  }
  return secili
}
