/**
 * Etkileşimli rapor görünümü — SAF hesap katmanı.
 *
 * gorunumUygula(satirlar, gorunum): hesaplanan alanlar → filtre → sıralama → grup ağacı (≤2 seviye)
 * + alt toplamlar + genel toplam + grafik verisi + KPI kartları.
 *
 * Aynı fonksiyon tarayıcıda (tablo/KPI/grafik) ve sunucuda (Excel) çalışır; bu yüzden burada
 * DOM, Prisma, fetch, Date.now() YOK. Sonuçlar iki tarafta birebir aynıdır.
 *
 * ORAN ORTALAMASI KURALI: `verim = {tamamlanan} / {planlanan} * 100` gibi bir hesaplanan alanın
 * grup "ortalaması" satır ortalaması olarak alınırsa yanlıştır (küçük iş emirleri büyükleriyle eşit
 * ağırlık alır). Bu yüzden ifadesi `{a} / {b}` ya da `{a} / {b} * k` biçiminde (istenirse yuvarla(…)
 * sarmalı) olan alanlarda grup/genel ortalama = topla(a) / topla(b) * k olarak hesaplanır.
 * Diğer alanlarda basit ortalama (null'lar dışarıda).
 */
import { bicimle, sayiMi, tarihMi } from './bicim'
import { ifadeCalistir, ifadeDerle } from './ifade'
import type { Bicim, Gorunum, GorunumKolon, GorunumToplamFn, HesaplananAlan } from './tipler'

export type Satir = Record<string, unknown>
export type KolonTipi = 'sayi' | 'tarih' | 'metin'

export interface GrupDugum {
  /** Ağaçta tekil kimlik: "alan=deger|alan2=deger2" — aç/kapa durumu bununla tutulur. */
  anahtar: string
  seviye: number
  alan: string
  deger: unknown
  /** Ekranda gösterilecek metin (bicimle). */
  etiket: string
  satirSayisi: number
  /** Yaprak grupta detay satırları; ara grupta boş (altGruplar dolu). */
  satirlar: Satir[]
  altGruplar: GrupDugum[]
  /** Kolon alanı → toplam (yalnız `toplam` tanımlı kolonlar). */
  toplamlar: Record<string, number | null>
}

export interface KpiKart {
  alan: string
  etiket: string
  fn: GorunumToplamFn
  deger: number | null
  bicim?: Bicim
}

export interface GorunumSonuc {
  /** Filtre + sıralama uygulanmış düz satırlar (hesaplanan alanlar dahil). */
  satirlar: Satir[]
  /** Grup ağacı; gruplama yoksa boş dizi (satirlar düz kullanılır). */
  gruplar: GrupDugum[]
  genelToplam: Record<string, number | null>
  grafikVerisi: { etiket: string; deger: number }[]
  kpi: { satirSayisi: number; toplamSatir: number; kartlar: KpiKart[] }
  /** Her kolonun veri tipi (ilk dolu değerden). */
  kolonTipleri: Record<string, KolonTipi>
}

// ── Değer yardımcıları ───────────────────────────────────────────────────

export function sayiya(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') { const n = Number(v.trim().replace(',', '.')); return v.trim() && Number.isFinite(n) ? n : null }
  if (typeof v === 'object' && typeof (v as { toNumber?: unknown }).toNumber === 'function') {
    const n = (v as { toNumber: () => number }).toNumber(); return Number.isFinite(n) ? n : null
  }
  return null
}

function tarihe(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (typeof v === 'string' && v.trim()) { const d = new Date(v.trim()); return Number.isNaN(d.getTime()) ? null : d }
  return null
}

const bosMu = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

/** Kolon tipi: ilk 50 dolu değere bakar; sayı ağırlıklıysa 'sayi', tarihse 'tarih', yoksa 'metin'. */
export function kolonTipi(alan: string, satirlar: Satir[], bicim?: Bicim): KolonTipi {
  if (bicim) return bicim.startsWith('gg') ? 'tarih' : bicim === 'metin' ? 'metin' : 'sayi'
  let bakilan = 0, sayi = 0, tarih = 0
  for (const s of satirlar) {
    const v = s[alan]
    if (bosMu(v)) continue
    bakilan++
    if (sayiMi(v)) sayi++
    else if (tarihMi(v)) tarih++
    if (bakilan >= 50) break
  }
  if (!bakilan) return 'metin'
  if (sayi === bakilan) return 'sayi'
  if (tarih === bakilan) return 'tarih'
  return 'metin'
}

export function kolonTipleriniBul(satirlar: Satir[], kolonlar: GorunumKolon[]): Record<string, KolonTipi> {
  const out: Record<string, KolonTipi> = {}
  for (const k of kolonlar) out[k.alan] = kolonTipi(k.alan, satirlar, k.bicim)
  return out
}

// ── Hesaplanan alanlar ───────────────────────────────────────────────────

/** İfadeler bir kez derlenir; sıralı uygulanır (sonraki öncekini görür). Derlenemeyen ifade → alan null. */
export function hesaplananlariEkle(satirlar: Satir[], hesaplananlar: HesaplananAlan[] | undefined): Satir[] {
  if (!hesaplananlar?.length) return satirlar
  const derli = hesaplananlar.map((h) => { try { return { ad: h.ad, d: ifadeDerle(h.ifade) } } catch { return { ad: h.ad, d: null } } })
  return satirlar.map((s) => {
    const y: Satir = { ...s }
    for (const h of derli) y[h.ad] = h.d ? ifadeCalistir(h.d, { satir: y }) : null
    return y
  })
}

/** `{a} / {b}` veya `{a} / {b} * k` (isteğe bağlı yuvarla(…, n) sarmalı) → oran bileşenleri; değilse null. */
export function oranBilesenleri(ifade: string): { pay: string; payda: string; carpan: number } | null {
  let s = ifade.trim()
  const sarmal = /^yuvarla\(\s*([\s\S]*?)\s*(?:,\s*\d+\s*)?\)$/i.exec(s)
  if (sarmal) s = sarmal[1].trim()
  const m = /^\{([A-Za-z_][A-Za-z0-9_]*)\}\s*\/\s*\{([A-Za-z_][A-Za-z0-9_]*)\}(?:\s*\*\s*([0-9]+(?:\.[0-9]+)?))?$/.exec(s)
  if (!m) return null
  return { pay: m[1], payda: m[2], carpan: m[3] ? Number(m[3]) : 1 }
}

function oranHaritasi(hesaplananlar: HesaplananAlan[] | undefined): Map<string, { pay: string; payda: string; carpan: number }> {
  const m = new Map<string, { pay: string; payda: string; carpan: number }>()
  for (const h of hesaplananlar ?? []) { const o = oranBilesenleri(h.ifade); if (o) m.set(h.ad, o) }
  return m
}

// ── Toplamlar ────────────────────────────────────────────────────────────

/**
 * say → satır sayısı (referans tasarımla aynı: boş değer de satırdır).
 * ortalama → oran alanında topla(pay)/topla(payda)*k; diğerlerinde null dışı basit ortalama.
 */
export function toplamHesapla(fn: GorunumToplamFn, alan: string, satirlar: Satir[], oranlar?: Map<string, { pay: string; payda: string; carpan: number }>): number | null {
  if (fn === 'say') return satirlar.length
  if (fn === 'ortalama') {
    const o = oranlar?.get(alan)
    if (o) {
      let pay = 0, payda = 0
      for (const s of satirlar) { pay += sayiya(s[o.pay]) ?? 0; payda += sayiya(s[o.payda]) ?? 0 }
      return payda ? (pay / payda) * o.carpan : null
    }
  }
  const sayilar: number[] = []
  for (const s of satirlar) { const n = sayiya(s[alan]); if (n !== null) sayilar.push(n) }
  if (!sayilar.length) return fn === 'topla' ? 0 : null
  switch (fn) {
    case 'topla': return sayilar.reduce((a, b) => a + b, 0)
    case 'ortalama': return sayilar.reduce((a, b) => a + b, 0) / sayilar.length
    case 'enkucuk': return Math.min(...sayilar)
    case 'enbuyuk': return Math.max(...sayilar)
  }
}

function toplamlariHesapla(kolonlar: GorunumKolon[], satirlar: Satir[], oranlar: Map<string, { pay: string; payda: string; carpan: number }>): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const k of kolonlar) if (k.toplam) out[k.alan] = toplamHesapla(k.toplam, k.alan, satirlar, oranlar)
  return out
}

// ── Filtre ───────────────────────────────────────────────────────────────

const SAYI_FILTRE = /^\s*(<=|>=|<>|!=|<|>|=)?\s*(-?\d+(?:[.,]\d+)?)\s*$/

/** Sayı kolonu: "< 90", ">= 10", "= 5", "90" (eşit). Metin/tarih: biçimlenmiş değerde içerir (tr-TR, büyük/küçük duyarsız). */
export function filtreEslesir(v: unknown, filtre: string, tip: KolonTipi, bicim?: Bicim): boolean {
  const f = filtre.trim()
  if (!f) return true
  if (tip === 'sayi') {
    const m = SAYI_FILTRE.exec(f)
    if (!m) return true // anlaşılmayan süzgeç: satırı düşürme
    const hedef = Number(m[2].replace(',', '.'))
    const x = sayiya(v)
    if (x === null) return false
    switch (m[1] ?? '=') {
      case '<': return x < hedef
      case '<=': return x <= hedef
      case '>': return x > hedef
      case '>=': return x >= hedef
      case '<>': case '!=': return x !== hedef
      default: return x === hedef
    }
  }
  const metin = bicimle(v, bicim).toLocaleLowerCase('tr-TR')
  return metin.includes(f.toLocaleLowerCase('tr-TR'))
}

// ── Sıralama ─────────────────────────────────────────────────────────────

/** null/boş her yönde sona; sayı ↔ sayı, tarih ↔ tarih, aksi tr-TR metin. */
export function kiyasla(a: unknown, b: unknown, tip: KolonTipi): number {
  const an = bosMu(a), bn = bosMu(b)
  if (an || bn) return an && bn ? 0 : an ? 1 : -1
  if (tip === 'sayi') { const x = sayiya(a), y = sayiya(b); if (x !== null && y !== null) return x - y }
  if (tip === 'tarih') { const x = tarihe(a), y = tarihe(b); if (x && y) return x.getTime() - y.getTime() }
  return String(a).localeCompare(String(b), 'tr-TR')
}

// ── Gruplama ─────────────────────────────────────────────────────────────

function grupla(satirlar: Satir[], alanlar: string[], seviye: number, ustAnahtar: string, kolonlar: GorunumKolon[], tipler: Record<string, KolonTipi>, oranlar: Map<string, { pay: string; payda: string; carpan: number }>, bicimler: Record<string, Bicim | undefined>): GrupDugum[] {
  if (seviye >= alanlar.length) return []
  const alan = alanlar[seviye]
  const kovalar = new Map<string, { deger: unknown; satirlar: Satir[] }>()
  for (const s of satirlar) {
    const deger = s[alan] ?? null
    const k = deger instanceof Date ? deger.toISOString() : `${typeof deger}:${String(deger)}`
    const kova = kovalar.get(k) ?? { deger, satirlar: [] }
    kova.satirlar.push(s); kovalar.set(k, kova)
  }
  const tip = tipler[alan] ?? 'metin'
  const gruplar = [...kovalar.values()].sort((a, b) => kiyasla(a.deger, b.deger, tip))
  return gruplar.map((g) => {
    const anahtar = `${ustAnahtar}${ustAnahtar ? '|' : ''}${alan}=${g.deger instanceof Date ? g.deger.toISOString() : String(g.deger ?? '')}`
    const alt = grupla(g.satirlar, alanlar, seviye + 1, anahtar, kolonlar, tipler, oranlar, bicimler)
    return {
      anahtar, seviye, alan, deger: g.deger,
      etiket: bosMu(g.deger) ? '(boş)' : bicimle(g.deger, bicimler[alan]),
      satirSayisi: g.satirlar.length,
      satirlar: alt.length ? [] : g.satirlar,
      altGruplar: alt,
      toplamlar: toplamlariHesapla(kolonlar, g.satirlar, oranlar),
    }
  })
}

// ── Giriş noktası ────────────────────────────────────────────────────────

export const MAX_GRUP = 2

export function gorunumUygula(hamSatirlar: Satir[], gorunum: Gorunum): GorunumSonuc {
  const hesapli = hesaplananlariEkle(hamSatirlar, gorunum.hesaplananAlanlar)
  const kolonlar = gorunum.kolonlar
  const tipler = kolonTipleriniBul(hesapli, kolonlar)
  const bicimler: Record<string, Bicim | undefined> = {}
  for (const k of kolonlar) bicimler[k.alan] = k.bicim
  const oranlar = oranHaritasi(gorunum.hesaplananAlanlar)

  // Filtre
  const aktifFiltreler = Object.entries(gorunum.filtreler ?? {}).filter(([, f]) => f && f.trim())
  let satirlar = aktifFiltreler.length
    ? hesapli.filter((s) => aktifFiltreler.every(([alan, f]) => filtreEslesir(s[alan], f, tipler[alan] ?? kolonTipi(alan, hesapli), bicimler[alan])))
    : hesapli

  // Sıralama (kararlı)
  if (gorunum.siralama?.alan) {
    const { alan, yon } = gorunum.siralama
    const tip = tipler[alan] ?? kolonTipi(alan, hesapli)
    // null/boş her iki yönde de SONA: yön çarpanı yalnız dolu değerlere uygulanır.
    satirlar = satirlar.map((s, i) => ({ s, i })).sort((a, b) => {
      const x = a.s[alan], y = b.s[alan]
      const xn = bosMu(x), yn = bosMu(y)
      if (xn || yn) return xn && yn ? a.i - b.i : xn ? 1 : -1
      return kiyasla(x, y, tip) * yon || a.i - b.i
    }).map((x) => x.s)
  }

  // Gruplar (≤ MAX_GRUP)
  const grupAlanlari = (gorunum.gruplar ?? []).slice(0, MAX_GRUP).filter(Boolean)
  const gruplar = grupAlanlari.length ? grupla(satirlar, grupAlanlari, 0, '', kolonlar, tipler, oranlar, bicimler) : []

  // Genel toplam
  const genelToplam = toplamlariHesapla(kolonlar, satirlar, oranlar)

  // Grafik
  const grafikVerisi: { etiket: string; deger: number }[] = []
  const g = gorunum.grafik
  if (g?.grupla && g.deger) {
    const kovalar = new Map<string, Satir[]>()
    for (const s of satirlar) { const e = bosMu(s[g.grupla]) ? '(boş)' : bicimle(s[g.grupla], bicimler[g.grupla]); kovalar.set(e, [...(kovalar.get(e) ?? []), s]) }
    const tip = tipler[g.grupla] ?? 'metin'
    for (const [etiket, rows] of [...kovalar.entries()].sort((a, b) => kiyasla(a[1][0]?.[g.grupla], b[1][0]?.[g.grupla], tip))) {
      grafikVerisi.push({ etiket, deger: toplamHesapla(g.fn, g.deger, rows, oranlar) ?? 0 })
    }
  }

  // KPI: satır sayısı + toplam tanımlı görünür kolonlar (en fazla 4 kart)
  const kartlar: KpiKart[] = kolonlar
    .filter((k) => k.toplam && k.gorunur)
    .slice(0, 4)
    .map((k) => ({ alan: k.alan, etiket: k.baslik ?? k.alan, fn: k.toplam!, deger: genelToplam[k.alan] ?? null, bicim: k.bicim }))

  return { satirlar, gruplar, genelToplam, grafikVerisi, kpi: { satirSayisi: satirlar.length, toplamSatir: hamSatirlar.length, kartlar }, kolonTipleri: tipler }
}

/** Grup ağacındaki tüm düğüm anahtarları (aç/kapa "tümünü" işlemleri için). */
export function grupAnahtarlari(gruplar: GrupDugum[]): string[] {
  const out: string[] = []
  const gez = (l: GrupDugum[]) => { for (const g of l) { out.push(g.anahtar); gez(g.altGruplar) } }
  gez(gruplar)
  return out
}

/** Veri setinin tüm alanları görünür, sayı alanlarında toplam=topla olan varsayılan görünüm. */
export function varsayilanGorunum(alanlar: { ad: string; veriTipi?: string; etiket?: string | null }[]): Gorunum {
  return {
    kolonlar: alanlar.map((a) => ({
      alan: a.ad,
      baslik: a.etiket ?? undefined,
      gorunur: true,
      ...(a.veriTipi === 'sayi' ? { toplam: 'topla' as const, bicim: '#.##0' as const } : a.veriTipi === 'tarih' ? { bicim: 'gg.aa.yyyy' as const } : {}),
    })),
    gruplar: [],
    siralama: null,
    filtreler: {},
    grafik: null,
    hesaplananAlanlar: [],
  }
}
