// IT Ticket SLA — iş-dakikası hesap katmanı.
//
// SAF: prisma YOK, DB YOK, ortam değişkeni YOK. tatilMap ve ayar DIŞARIDAN gelir
// → test edilebilir, client+server paylaşır. DB okuması `src/lib/sla/index.ts`'te.
//
// Gün durumu `@/lib/ipro/takvim-util`'den GELİR (kopyalanmaz): Pazar otomatik
// tatil, IproTatil istisnaları (TATIL/YARIM/MESAI) onu ezer.
//
// SAAT DİLİMİ: tüm "çalışma saati" kavramı Europe/Istanbul DUVAR SAATİdir.
// UTC offset varsayılmaz — Intl ile o anki gerçek offset hesaplanır (DST güvenli).
// Türkiye 2016'dan beri kalıcı UTC+3 ama bunu koda GÖMMÜYORUZ.

import { gunDurumu, type IproTatilTip, type GunDurum } from '@/lib/ipro/takvim-util'

export const ZAMAN_DILIMI = 'Europe/Istanbul'

export interface SlaCalismaAyari {
  /** "08:00" */
  baslangicSaat: string
  /** "18:00" */
  bitisSaat: string
  /** Öğle arası — ikisi birlikte verilmezse ara yok sayılır. */
  ogleAraBaslangic?: string
  ogleAraBitis?: string
  /** Cumartesi: tam gün mü, yarım mı, tatil mi. */
  cumartesiDurumu: 'TAM' | 'YARIM' | 'TATIL'
  /** Cumartesi YARIM ise bitiş saati (yoksa yarimGunBitisSaat'e düşer). */
  cumartesiBitisSaat?: string
  /** IproTatil'den 'YARIM' gelen günlerin bitişi (yoksa cumartesiBitisSaat'e düşer). */
  yarimGunBitisSaat?: string
}

/** Güvenli varsayılan: 08:00-18:00, öğle arası yok, cumartesi tatil. */
export const VARSAYILAN_AYAR: SlaCalismaAyari = {
  baslangicSaat: '08:00',
  bitisSaat: '18:00',
  cumartesiDurumu: 'TATIL',
  yarimGunBitisSaat: '13:00',
}

/** Sonsuz döngü emniyeti: bu kadar günden uzun aralık hata verir (~10 yıl). */
const MAX_GUN = 3660

// ── Saat dilimi yardımcıları ────────────────────────────────────────────────

const BICIMLEYICI = new Intl.DateTimeFormat('en-US', {
  timeZone: ZAMAN_DILIMI,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
})

export interface DuvarSaati {
  yil: number
  ay: number // 1-12
  gun: number
  saat: number
  dakika: number
  saniye: number
}

/** Bir ANI Istanbul duvar saatine çevirir. */
export function duvarSaati(an: Date): DuvarSaati {
  const p: Record<string, string> = {}
  for (const { type, value } of BICIMLEYICI.formatToParts(an)) p[type] = value
  // 'hour' 24 saatlik biçimde bazı ortamlarda gece yarısını "24" verir.
  const saat = Number(p.hour) % 24
  return {
    yil: Number(p.year), ay: Number(p.month), gun: Number(p.day),
    saat, dakika: Number(p.minute), saniye: Number(p.second),
  }
}

/** O andaki gerçek UTC offset'i (dakika). DST'ye göre değişir. */
function offsetDakika(an: Date): number {
  const d = duvarSaati(an)
  const duvarUtc = Date.UTC(d.yil, d.ay - 1, d.gun, d.saat, d.dakika, d.saniye)
  return Math.round((duvarUtc - an.getTime()) / 60000)
}

/**
 * Istanbul duvar saatinden ANA (UTC) çevirir. İki adımlı düzeltme: ilk tahminin
 * offset'i DST sınırında yanlış olabilir, ikinci ölçümle düzeltilir.
 */
export function duvardanAn(yil: number, ay: number, gun: number, saat: number, dakika: number): Date {
  const tahminUtc = Date.UTC(yil, ay - 1, gun, saat, dakika, 0)
  const off1 = offsetDakika(new Date(tahminUtc))
  let ts = tahminUtc - off1 * 60000
  const off2 = offsetDakika(new Date(ts))
  if (off2 !== off1) ts = tahminUtc - off2 * 60000
  return new Date(ts)
}

/**
 * Takvim gününü temsil eden "UTC öğlen" çapası.
 * gunDurumu/pazarMi/tarihAnahtari UTC tabanlıdır; Istanbul gününü doğru anahtara
 * eşlemek için günün UTC 12:00'ını kullanırız (hiçbir offset bunu kaydıramaz).
 */
function gunCapasi(yil: number, ay: number, gun: number): Date {
  return new Date(Date.UTC(yil, ay - 1, gun, 12, 0, 0))
}

// ── Saat/segment yardımcıları ───────────────────────────────────────────────

/** "08:30" → 510 (gün başından dakika). Geçersizse null. */
export function saatiDakikaya(s: string | undefined): number | null {
  if (typeof s !== 'string') return null
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Kapalı-açık [baslangic, bitis) dakika aralığı. */
export interface Segment {
  bas: number
  bit: number
}

function yarimGunBitisi(ayar: SlaCalismaAyari): number | null {
  return saatiDakikaya(ayar.yarimGunBitisSaat) ?? saatiDakikaya(ayar.cumartesiBitisSaat)
}

function cumartesiBitisi(ayar: SlaCalismaAyari): number | null {
  return saatiDakikaya(ayar.cumartesiBitisSaat) ?? saatiDakikaya(ayar.yarimGunBitisSaat)
}

/** Öğle arasını segmentten düşer. */
function araDus(segmentler: Segment[], ayar: SlaCalismaAyari): Segment[] {
  const araBas = saatiDakikaya(ayar.ogleAraBaslangic)
  const araBit = saatiDakikaya(ayar.ogleAraBitis)
  if (araBas === null || araBit === null || araBit <= araBas) return segmentler

  const sonuc: Segment[] = []
  for (const s of segmentler) {
    if (araBit <= s.bas || araBas >= s.bit) { sonuc.push(s); continue }
    if (araBas > s.bas) sonuc.push({ bas: s.bas, bit: Math.min(araBas, s.bit) })
    if (araBit < s.bit) sonuc.push({ bas: Math.max(araBit, s.bas), bit: s.bit })
  }
  return sonuc.filter((s) => s.bit > s.bas)
}

/**
 * Bir takvim gününün çalışma segmentleri (Istanbul duvar dakikası).
 * Boş dizi = o gün hiç çalışılmıyor.
 */
export function gunSegmentleri(
  yil: number, ay: number, gun: number,
  tatilMap: Map<string, IproTatilTip>,
  ayar: SlaCalismaAyari,
): Segment[] {
  const capa = gunCapasi(yil, ay, gun)
  const durum: GunDurum = gunDurumu(capa, tatilMap)

  const bas = saatiDakikaya(ayar.baslangicSaat)
  const tamBit = saatiDakikaya(ayar.bitisSaat)
  if (bas === null || tamBit === null || tamBit <= bas) return []

  if (durum === 'TATIL') return []

  // YARIM istisnası: gün erken biter.
  if (durum === 'YARIM') {
    const yb = yarimGunBitisi(ayar)
    if (yb === null || yb <= bas) return []
    return araDus([{ bas, bit: Math.min(yb, tamBit) }], ayar)
  }

  // MESAI istisnası: Pazar/Cumartesi olsa bile TAM gün çalışılır (kayıt ezer).
  if (durum === 'MESAI') return araDus([{ bas, bit: tamBit }], ayar)

  // durum === 'CALISMA' → normal gün. Cumartesi ayrıca ayarla belirlenir
  // (gunDurumu Cumartesi'yi tatil saymaz, kural bizde).
  if (capa.getUTCDay() === 6) {
    if (ayar.cumartesiDurumu === 'TATIL') return []
    if (ayar.cumartesiDurumu === 'YARIM') {
      const cb = cumartesiBitisi(ayar)
      if (cb === null || cb <= bas) return []
      return araDus([{ bas, bit: Math.min(cb, tamBit) }], ayar)
    }
  }

  return araDus([{ bas, bit: tamBit }], ayar)
}

// ── Genel API ───────────────────────────────────────────────────────────────

/** O takvim gününde hiç çalışılıyor mu? */
export function isCalismaGunu(
  tarih: Date, tatilMap: Map<string, IproTatilTip>, ayar: SlaCalismaAyari,
): boolean {
  const d = duvarSaati(tarih)
  return gunSegmentleri(d.yil, d.ay, d.gun, tatilMap, ayar).length > 0
}

/** Verilen AN çalışma saati içinde mi? (gün + saat aralığı) */
export function isCalismaAninda(
  tarih: Date, tatilMap: Map<string, IproTatilTip>, ayar: SlaCalismaAyari,
): boolean {
  const d = duvarSaati(tarih)
  const dk = d.saat * 60 + d.dakika
  return gunSegmentleri(d.yil, d.ay, d.gun, tatilMap, ayar).some((s) => dk >= s.bas && dk < s.bit)
}

/** Bir sonraki güne geç (Istanbul takvim günü). */
function ertesiGun(d: DuvarSaati): DuvarSaati {
  const n = new Date(Date.UTC(d.yil, d.ay - 1, d.gun + 1, 12))
  return { yil: n.getUTCFullYear(), ay: n.getUTCMonth() + 1, gun: n.getUTCDate(), saat: 0, dakika: 0, saniye: 0 }
}

/**
 * İki an arasındaki İŞ dakikası. bitis <= baslangic ise 0.
 * Kısmi dakikalar aşağı yuvarlanmaz — saniye hassasiyeti korunur, sonuç yuvarlanır.
 */
export function businessMinutesBetween(
  baslangic: Date, bitis: Date,
  tatilMap: Map<string, IproTatilTip>, ayar: SlaCalismaAyari,
): number {
  if (!(baslangic instanceof Date) || !(bitis instanceof Date)) return 0
  if (bitis.getTime() <= baslangic.getTime()) return 0

  let toplamMs = 0
  let gun = duvarSaati(baslangic)
  const sonGun = duvarSaati(bitis)
  let sayac = 0

  for (;;) {
    if (++sayac > MAX_GUN) {
      throw new Error(`businessMinutesBetween: aralik ${MAX_GUN} gunu asti`)
    }

    for (const s of gunSegmentleri(gun.yil, gun.ay, gun.gun, tatilMap, ayar)) {
      const segBas = duvardanAn(gun.yil, gun.ay, gun.gun, Math.floor(s.bas / 60), s.bas % 60)
      const segBit = duvardanAn(gun.yil, gun.ay, gun.gun, Math.floor(s.bit / 60), s.bit % 60)
      const kesBas = Math.max(segBas.getTime(), baslangic.getTime())
      const kesBit = Math.min(segBit.getTime(), bitis.getTime())
      if (kesBit > kesBas) toplamMs += kesBit - kesBas
    }

    if (gun.yil === sonGun.yil && gun.ay === sonGun.ay && gun.gun === sonGun.gun) break
    gun = ertesiGun(gun)
  }

  return Math.round(toplamMs / 60000)
}

/** İlk çalışma anına ileri sar (zaten çalışma anındaysa aynısını döner). */
export function sonrakiCalismaAni(
  baslangic: Date, tatilMap: Map<string, IproTatilTip>, ayar: SlaCalismaAyari,
): Date {
  let gun = duvarSaati(baslangic)
  let sayac = 0

  for (;;) {
    if (++sayac > MAX_GUN) {
      throw new Error(`sonrakiCalismaAni: ${MAX_GUN} gun icinde calisma ani bulunamadi`)
    }
    const ilkGunMu = sayac === 1
    for (const s of gunSegmentleri(gun.yil, gun.ay, gun.gun, tatilMap, ayar)) {
      const segBas = duvardanAn(gun.yil, gun.ay, gun.gun, Math.floor(s.bas / 60), s.bas % 60)
      const segBit = duvardanAn(gun.yil, gun.ay, gun.gun, Math.floor(s.bit / 60), s.bit % 60)
      const imlec = ilkGunMu ? Math.max(segBas.getTime(), baslangic.getTime()) : segBas.getTime()
      if (imlec < segBit.getTime()) return new Date(imlec)
    }
    gun = ertesiGun(gun)
  }
}

/**
 * Başlangıca `dakika` kadar İŞ dakikası ekler.
 * dakika <= 0 ise: bir sonraki çalışma anına sarılır (SLA hedefi tatilde başlamaz).
 */
export function addBusinessMinutes(
  baslangic: Date, dakika: number,
  tatilMap: Map<string, IproTatilTip>, ayar: SlaCalismaAyari,
): Date {
  if (!Number.isFinite(dakika)) throw new Error('addBusinessMinutes: dakika sayi olmali')
  if (dakika <= 0) return sonrakiCalismaAni(baslangic, tatilMap, ayar)

  let kalanMs = dakika * 60000
  let gun = duvarSaati(baslangic)
  let sayac = 0

  for (;;) {
    if (++sayac > MAX_GUN) {
      throw new Error(`addBusinessMinutes: ${MAX_GUN} gun icinde tamamlanamadi`)
    }
    const ilkGunMu = sayac === 1
    for (const s of gunSegmentleri(gun.yil, gun.ay, gun.gun, tatilMap, ayar)) {
      const segBas = duvardanAn(gun.yil, gun.ay, gun.gun, Math.floor(s.bas / 60), s.bas % 60)
      const segBit = duvardanAn(gun.yil, gun.ay, gun.gun, Math.floor(s.bit / 60), s.bit % 60)
      const imlec = ilkGunMu ? Math.max(segBas.getTime(), baslangic.getTime()) : segBas.getTime()
      const musait = segBit.getTime() - imlec
      if (musait <= 0) continue
      if (kalanMs <= musait) return new Date(imlec + kalanMs)
      kalanMs -= musait
    }
    gun = ertesiGun(gun)
  }
}
