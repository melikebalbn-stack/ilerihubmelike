/**
 * Tuval (serbest yerleşim) belge → A4 HTML. SAF fonksiyon: DOM/Prisma/fetch yok.
 *
 * render.ts'in altyapısını kullanır: esc (XSS), yazdirmaCss (@page + renk koruma), belgeKabugu yerine
 * kendi gövdesi (tuval sayfaları başlık bloğu istemez), bicimle (tr-TR), ifade motoru (koşullu biçim),
 * gorunum.ts toplamHesapla (oran ortalaması kuralı dahil), gorunum-html cubukGrafikSvg.
 *
 * ÖLÇEK: tuval 640px = sayfa İÇİ genişlik. Tüm konum/boyutlar mm'ye çevrilir (CSS transform YOK) —
 * yazdırmada ekrandaki yerleşim birebir korunur.
 *
 * SAYFALAMA: bant yükseklikleri bilindiği için sayfalar BURADA bölünür (thead/tfoot ile tarayıcıya
 * bırakılmaz). Nedeni: {sayfa}/{toplamSayfa} yer tutucuları ve sayfaSayisi ancak böyle kesin olur;
 * sb her sayfanın başına, sa her sayfanın altına gerçek kopya olarak yazılır.
 */
import { bicimle } from './bicim'
import { ifadeCalistir, ifadeDerle, type DerlenmisIfade } from './ifade'
import { hesaplananlariEkle, toplamHesapla, type Satir } from './gorunum'
import { cubukGrafikSvg } from './gorunum-html'
import { esc, yazdirmaCss, type RenderBaglam } from './render'
import { TUVAL_GENISLIK, type AltToplamFn, type Bicim, type HesaplananAlan, type KosulluBicim, type SablonParametre, type TuvalBant, type TuvalBantId, type TuvalOge, type TuvalTasarim } from './tipler'

/** A4 kâğıt ölçüleri (mm). */
const A4 = { g: 210, y: 297 }

export interface TuvalRenderBaglam extends RenderBaglam {
  parametreler?: Record<string, unknown>
  parametreTanimlari?: SablonParametre[]
  /** Belge içeriğindeki hesaplanan alanlar (satırlara uygulanır). */
  hesaplananAlanlar?: HesaplananAlan[]
  /** alan → (ham değer → Türkçe gösterim); yalnız gösterimde. */
  degerEtiketleri?: Record<string, Record<string, string>>
  raporAdi?: string
  /** Logo öğesi için veri/URL; yoksa çerçeveli "LOGO" yazısı çizilir. */
  logoUrl?: string
}

export interface TuvalRenderSonuc { html: string; sayfaSayisi: number; satirSayisi: number }

const HIZA_CSS: Record<string, string> = { sol: 'left', orta: 'center', sag: 'right' }

/** Oran alanlarını (a/b*k) toplamHesapla'ya taşımak için — gorunum.ts ile aynı kural. */
function oranHaritasi(hesaplananlar: HesaplananAlan[] | undefined): Map<string, { pay: string; payda: string; carpan: number }> {
  const m = new Map<string, { pay: string; payda: string; carpan: number }>()
  for (const h of hesaplananlar ?? []) {
    const s = h.ifade.trim().replace(/^yuvarla\(\s*([\s\S]*?)\s*(?:,\s*\d+\s*)?\)$/i, '$1').trim()
    const x = /^\{([A-Za-z_][A-Za-z0-9_]*)\}\s*\/\s*\{([A-Za-z_][A-Za-z0-9_]*)\}(?:\s*\*\s*([0-9]+(?:\.[0-9]+)?))?$/.exec(s)
    if (x) m.set(h.ad, { pay: x[1], payda: x[2], carpan: x[3] ? Number(x[3]) : 1 })
  }
  return m
}

/** 'orani' → topla(pay)/topla(payda)*100; diğerleri gorunum.ts toplamHesapla. */
function ogeToplami(oge: Extract<TuvalOge, { tip: 'toplam' }>, satirlar: Satir[], oranlar: Map<string, { pay: string; payda: string; carpan: number }>): number | null {
  if (oge.fn === 'yok') return null
  if (oge.fn === 'orani') {
    if (!oge.oraniPay || !oge.oraniPayda) return null
    const pay = toplamHesapla('topla', oge.oraniPay, satirlar) ?? 0
    const payda = toplamHesapla('topla', oge.oraniPayda, satirlar)
    return payda ? (pay / payda) * 100 : null
  }
  return toplamHesapla(oge.fn as Exclude<AltToplamFn, 'orani' | 'yok'>, oge.alan, satirlar, oranlar)
}

/** Koşullu biçim: ilk eşleşen kuralın sınıfı (render.ts ile aynı r-* sınıfları). */
function kosulSinifi(kurallar: KosulluBicim[] | undefined, derli: Map<string, DerlenmisIfade>, satir: Satir, parametreler?: Record<string, unknown>): string {
  for (const k of kurallar ?? []) {
    const d = derli.get(k.kosul)
    if (d && ifadeCalistir(d, { satir, parametreler }) === true) return `${k.renk ? ` r-${k.renk}` : ''}${k.kalin ? ' kalin' : ''}`
  }
  return ''
}

export function tuvalRender(tasarim: TuvalTasarim, hamSatirlar: Satir[], baglam: TuvalRenderBaglam = {}): TuvalRenderSonuc {
  const satirlar = hesaplananlariEkle(hamSatirlar, baglam.hesaplananAlanlar)
  const oranlar = oranHaritasi(baglam.hesaplananAlanlar)
  const yatay = tasarim.sayfa.yon === 'yatay'
  const [ust, sag, alt, sol] = tasarim.sayfa.kenar
  const sayfaG = yatay ? A4.y : A4.g
  const sayfaY = yatay ? A4.g : A4.y
  const icerikG = sayfaG - sol - sag
  const icerikY = sayfaY - ust - alt
  /** px → mm ölçeği: 640px tuval = sayfa içi genişlik. */
  const o = icerikG / TUVAL_GENISLIK
  const mm = (px: number) => `${(px * o).toFixed(2)}mm`
  const pt = (px: number) => `${(px * o * 2.8346).toFixed(2)}pt`
  const icerikYPx = icerikY / o

  const bant = (id: TuvalBantId): TuvalBant => tasarim.bantlar.find((b) => b.id === id) ?? { id, yukseklik: 0 }
  const ogeler = (id: TuvalBantId) => tasarim.ogeler.filter((e) => e.bant === id)
  const sbY = bant('sb').yukseklik
  const saY = bant('sa').yukseklik

  // Koşullu biçim ifadeleri bir kez derlenir.
  const derli = new Map<string, DerlenmisIfade>()
  for (const e of tasarim.ogeler) {
    if (e.tip !== 'alan' && e.tip !== 'toplam') continue
    for (const k of e.kosulluBicim ?? []) {
      if (derli.has(k.kosul)) continue
      try { derli.set(k.kosul, ifadeDerle(k.kosul)) } catch { /* geçersiz ifade → kural yok sayılır */ }
    }
  }

  // ── Gruplama ──────────────────────────────────────────────────────────
  interface Grup { etiket: string; deger: unknown; satirlar: Satir[] }
  const gruplar: Grup[] = []
  if (tasarim.grup?.alan) {
    const alan = tasarim.grup.alan
    const kovalar = new Map<string, Grup>()
    for (const s of satirlar) {
      const deger = s[alan] ?? null
      const anahtar = deger instanceof Date ? deger.toISOString() : `${typeof deger}:${String(deger)}`
      const g = kovalar.get(anahtar) ?? { etiket: '', deger, satirlar: [] }
      g.satirlar.push(s); kovalar.set(anahtar, g)
    }
    for (const g of [...kovalar.values()].sort((a, b) => String(a.deger ?? '').localeCompare(String(b.deger ?? ''), 'tr-TR'))) {
      g.etiket = g.deger === null || g.deger === undefined || g.deger === '' ? '(boş)' : (baglam.degerEtiketleri?.[alan]?.[String(g.deger)] ?? bicimle(g.deger))
      gruplar.push(g)
    }
  }

  // ── Akış: bant örnekleri ──────────────────────────────────────────────
  interface BantOrnegi { id: TuvalBantId; satir?: Satir; kapsam: Satir[]; grupEtiketi?: string }
  const akis: BantOrnegi[] = []
  if (bant('rb').yukseklik) akis.push({ id: 'rb', kapsam: satirlar })
  const detaylari = (rows: Satir[]) => { for (const s of rows) if (bant('dt').yukseklik) akis.push({ id: 'dt', satir: s, kapsam: rows }) }
  if (gruplar.length) {
    for (const g of gruplar) {
      if (bant('gb').yukseklik) akis.push({ id: 'gb', kapsam: g.satirlar, grupEtiketi: g.etiket, satir: g.satirlar[0] })
      detaylari(g.satirlar)
      if (bant('gs').yukseklik) akis.push({ id: 'gs', kapsam: g.satirlar, grupEtiketi: g.etiket, satir: g.satirlar[0] })
    }
  } else {
    detaylari(satirlar)
  }
  if (bant('rs').yukseklik) akis.push({ id: 'rs', kapsam: satirlar })

  // ── Sayfalama ─────────────────────────────────────────────────────────
  const govdeButcesi = Math.max(1, icerikYPx - sbY - saY)
  const sayfalar: BantOrnegi[][] = []
  let sayfa: BantOrnegi[] = []
  let dolu = 0
  for (const b of akis) {
    const y = bant(b.id).yukseklik
    const yeniSayfaIster = bant(b.id).yeniSayfa && sayfa.length > 0
    if (yeniSayfaIster || (dolu + y > govdeButcesi && sayfa.length > 0)) { sayfalar.push(sayfa); sayfa = []; dolu = 0 }
    sayfa.push(b); dolu += y
  }
  if (sayfa.length || !sayfalar.length) sayfalar.push(sayfa)
  const sayfaSayisi = sayfalar.length

  // ── Öğe çizimi ────────────────────────────────────────────────────────
  const yerTutucu = (metin: string, b: BantOrnegi, sayfaNo: number): string =>
    metin.replace(/\{([^}]+)\}/g, (tam, ad: string) => {
      const anahtar = ad.trim()
      if (anahtar === 'sayfa') return String(sayfaNo)
      if (anahtar === 'toplamSayfa') return String(sayfaSayisi)
      if (anahtar === 'bugun') return bicimle(new Date(), 'gg.aa.yyyy')
      if (anahtar === 'calistiran') return baglam.calistiran ?? ''
      if (anahtar === 'rapor.ad') return baglam.raporAdi ?? ''
      if (anahtar === 'rapor.kod') return baglam.raporKodu ?? ''
      if (anahtar === 'grup') return b.grupEtiketi ?? ''
      if (anahtar.startsWith('p.')) {
        const p = anahtar.slice(2)
        const tanim = baglam.parametreTanimlari?.find((x) => x.ad === p)
        return bicimle(baglam.parametreler?.[p], tanim?.tip === 'tarih' ? 'gg.aa.yyyy' : undefined)
      }
      const v = b.satir?.[anahtar]
      return v === undefined ? tam : (baglam.degerEtiketleri?.[anahtar]?.[String(v)] ?? bicimle(v))
    })

  const ogeCiz = (e: TuvalOge, b: BantOrnegi, sayfaNo: number): string => {
    const temel = `left:${mm(e.x)};top:${mm(e.y)};width:${mm(e.w)};height:${mm(e.h)}`
    const yaziStili = `font-size:${pt(e.size ?? 11)};${e.kalin ? 'font-weight:700;' : ''}text-align:${HIZA_CSS[e.hiza ?? 'sol']};${e.renk ? `color:${e.renk};` : ''}`
    switch (e.tip) {
      case 'metin':
        return `<div class="o" style="${temel};${yaziStili}">${esc(yerTutucu(e.metin, b, sayfaNo))}</div>`
      case 'alan': {
        const v = b.satir?.[e.alan]
        const gosterim = baglam.degerEtiketleri?.[e.alan]?.[String(v)] ?? bicimle(v, e.bicim)
        const sinif = b.satir ? kosulSinifi(e.kosulluBicim, derli, b.satir, baglam.parametreler) : ''
        return `<div class="o${sinif}" style="${temel};${yaziStili}">${esc(gosterim)}</div>`
      }
      case 'toplam': {
        const deger = ogeToplami(e, b.kapsam, oranlar)
        const metin = deger === null ? '' : e.fn === 'say' ? String(deger) : bicimle(deger, e.bicim)
        const sinif = kosulSinifi(e.kosulluBicim, derli, { ...(b.satir ?? {}), [e.alan]: deger }, baglam.parametreler)
        return `<div class="o${sinif}" style="${temel};${yaziStili}">${esc(metin)}</div>`
      }
      case 'gorsel':
        return baglam.logoUrl
          ? `<img class="o" src="${esc(baglam.logoUrl)}" alt="logo" style="${temel};object-fit:contain">`
          : `<div class="o logo" style="${temel};font-size:${pt((e.size ?? 11))}">LOGO</div>`
      case 'cizgi':
        return `<div class="o" style="left:${mm(e.x)};top:${mm(e.y)};width:${mm(e.w)};height:0;border-top:${Math.max(0.2, (e.kalinlik ?? 1.5) * o).toFixed(2)}mm solid ${e.renk ?? '#1B4F72'}"></div>`
      case 'kutu':
        return `<div class="o" style="${temel};border:${Math.max(0.2, (e.kalinlik ?? 1.5) * o).toFixed(2)}mm solid ${e.renk ?? '#1B4F72'}"></div>`
      case 'tablo': {
        const kolonlar = e.kolonlar ?? []
        const toplamG = kolonlar.reduce((t, k) => t + (k.genislik || 1), 0) || 1
        const bas = `<tr>${kolonlar.map((k) => `<th style="width:${((k.genislik || 1) / toplamG * 100).toFixed(2)}%">${esc(k.baslik || k.alan)}</th>`).join('')}</tr>`
        const govde = b.kapsam.map((s) => `<tr>${kolonlar.map((k) => `<td>${esc(baglam.degerEtiketleri?.[k.alan]?.[String(s[k.alan])] ?? bicimle(s[k.alan]))}</td>`).join('')}</tr>`).join('')
        return `<div class="o" style="${temel};overflow:hidden"><table class="ic" style="font-size:${pt((e.size ?? 9))}">${bas}${govde}</table></div>`
      }
      case 'grafik': {
        const kovalar = new Map<string, Satir[]>()
        for (const s of b.kapsam) { const k = String(s[e.grupla] ?? ''); kovalar.set(k, [...(kovalar.get(k) ?? []), s]) }
        const veri = [...kovalar.entries()].map(([ham, rows]) => ({
          etiket: ham === '' ? '(boş)' : (baglam.degerEtiketleri?.[e.grupla]?.[ham] ?? ham),
          deger: toplamHesapla(e.fn, e.deger, rows, oranlar) ?? 0,
        }))
        return `<div class="o" style="${temel};overflow:hidden">${cubukGrafikSvg(veri)}</div>`
      }
    }
  }

  const bantCiz = (b: BantOrnegi, sayfaNo: number): string => {
    const y = bant(b.id).yukseklik
    return `<div class="b" style="height:${mm(y)}">${ogeler(b.id).map((e) => ogeCiz(e, b, sayfaNo)).join('')}</div>`
  }

  const sayfaHtml = sayfalar.map((bantlar, i) => {
    const no = i + 1
    const sbOrnegi: BantOrnegi = { id: 'sb', kapsam: satirlar }
    const saOrnegi: BantOrnegi = { id: 'sa', kapsam: satirlar }
    // Crystal sırası: Rapor Başlığı (yalnız 1. sayfa) SAYFA BAŞLIĞININ ÜSTÜNDE; sayfa başlığı her sayfada.
    const raporBasligi = bantlar.filter((b) => b.id === 'rb')
    const govde = bantlar.filter((b) => b.id !== 'rb')
    return `<section class="sayfa${i === sayfalar.length - 1 ? ' son' : ''}">
<div class="ust">${raporBasligi.map((b) => bantCiz(b, no)).join('')}${sbY ? bantCiz(sbOrnegi, no) : ''}</div>
<div class="govde">${govde.map((b) => bantCiz(b, no)).join('')}</div>
<div class="alt">${saY ? bantCiz(saOrnegi, no) : ''}</div>
</section>`
  }).join('\n')

  const css = `${yazdirmaCss(yatay ? 'landscape' : 'portrait')}
@page{margin:${ust}mm ${sag}mm ${alt}mm ${sol}mm}
body{padding:0;background:#fff}
.sayfa{width:${icerikG}mm;height:${icerikY}mm;position:relative;overflow:hidden;display:flex;flex-direction:column;break-after:page;page-break-after:always;margin:0 auto}
.sayfa.son{break-after:auto;page-break-after:auto}
.govde{flex:1;overflow:hidden}
.b{position:relative;width:100%;overflow:hidden}
.o{position:absolute;overflow:hidden;white-space:nowrap;line-height:1.25}
.o.logo{border:0.4mm solid #1B4F72;color:#1B4F72;display:flex;align-items:center;justify-content:center;font-weight:700;letter-spacing:.05em}
table.ic{border-collapse:collapse;width:100%;table-layout:fixed}
table.ic th{background:#1B4F72;color:#fff;font-weight:500;text-align:left;padding:0.4mm 0.8mm;font-size:inherit;border:none}
table.ic td{border-bottom:0.2mm solid #cbd5e1;padding:0.4mm 0.8mm;overflow:hidden;white-space:nowrap}
@media screen{body{background:#E9EDF1;padding:6mm 0}.sayfa{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.18);margin-bottom:6mm}}`

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(baglam.raporAdi ?? 'Rapor')}</title>
<style>${css}</style>
</head>
<body>
${sayfaHtml}
</body>
</html>`

  return { html, sayfaSayisi, satirSayisi: satirlar.length }
}

/** Liste (kolon tabanlı) belge içeriğinden tuval tasarımı üretir — tek yönlü dönüşüm. */
export function listedenTuval(icerik: { kolonlar: { alan: string; baslik: string; genislik?: number; hiza?: 'sol' | 'sag' | 'orta'; bicim?: Bicim; altToplam?: AltToplamFn; oraniPay?: string; oraniPayda?: string; kosulluBicim?: KosulluBicim[] }[]; gruplar?: { alan: string; baslik?: string }[]; baslik?: string; genelToplam?: boolean }): TuvalTasarim {
  let sayac = 0
  const yeniId = () => `o${++sayac}`
  const kolonlar = icerik.kolonlar ?? []
  const verilen = kolonlar.reduce((t, k) => t + (k.genislik ?? 0), 0)
  const eksik = kolonlar.filter((k) => k.genislik === undefined).length
  const kalanPay = eksik ? Math.max(0, 100 - verilen) / eksik : 0
  const grupAlani = icerik.gruplar?.[0]?.alan
  const toplamVar = kolonlar.some((k) => k.altToplam && k.altToplam !== 'yok')

  // Kolon genişlikleri yüzde → px (640 tuval genişliği).
  let x = 0
  const yerler = kolonlar.map((k) => {
    const yuzde = k.genislik ?? kalanPay
    const w = Math.max(40, Math.round((yuzde / 100) * TUVAL_GENISLIK))
    const yer = { alan: k.alan, x, w, hiza: k.hiza ?? (k.bicim && k.bicim !== 'metin' && !k.bicim.startsWith('gg') ? ('sag' as const) : ('sol' as const)) }
    x += w
    return yer
  })

  const ogeler: TuvalOge[] = [
    { id: yeniId(), bant: 'rb', tip: 'metin', metin: icerik.baslik ?? '{rapor.ad}', x: 0, y: 8, w: 420, h: 24, size: 17, kalin: true },
    { id: yeniId(), bant: 'rb', tip: 'metin', metin: '{bugun}', x: 470, y: 12, w: 170, h: 16, size: 10, hiza: 'sag' },
    // Başlık satırı + altı çizgi
    ...kolonlar.map((k, i): TuvalOge => ({ id: yeniId(), bant: 'sb', tip: 'metin', metin: k.baslik, x: yerler[i].x, y: 5, w: yerler[i].w, h: 16, kalin: true, hiza: yerler[i].hiza })),
    { id: yeniId(), bant: 'sb', tip: 'cizgi', x: 0, y: 24, w: TUVAL_GENISLIK, h: 2, kalinlik: 1.5 },
    // Detay
    ...kolonlar.map((k, i): TuvalOge => ({ id: yeniId(), bant: 'dt', tip: 'alan', alan: k.alan, bicim: k.bicim, kosulluBicim: k.kosulluBicim, x: yerler[i].x, y: 3, w: yerler[i].w, h: 16, hiza: yerler[i].hiza })),
    // Sayfa altı
    { id: yeniId(), bant: 'sa', tip: 'metin', metin: '{rapor.ad} · {calistiran}', x: 0, y: 4, w: 320, h: 14, size: 9 },
    { id: yeniId(), bant: 'sa', tip: 'metin', metin: 'Sayfa {sayfa} / {toplamSayfa}', x: 420, y: 4, w: 220, h: 14, size: 9, hiza: 'sag' },
  ]
  if (grupAlani) {
    ogeler.push({ id: yeniId(), bant: 'gb', tip: 'alan', alan: grupAlani, x: 0, y: 5, w: 300, h: 17, kalin: true, size: 11.5 })
    if (toplamVar) ogeler.push({ id: yeniId(), bant: 'gs', tip: 'metin', metin: 'Grup toplamı', x: 0, y: 4, w: 150, h: 16, kalin: true })
  }
  if (toplamVar && (icerik.genelToplam ?? true)) {
    ogeler.push({ id: yeniId(), bant: 'rs', tip: 'metin', metin: 'Genel toplam', x: 0, y: 6, w: 150, h: 16, kalin: true })
  }
  // Alt toplam öğeleri: kolonun altToplam'ı neyse gs ve rs bantlarına aynı x'te.
  for (const [i, k] of kolonlar.entries()) {
    if (!k.altToplam || k.altToplam === 'yok') continue
    for (const bantId of [...(grupAlani ? (['gs'] as const) : []), ...((icerik.genelToplam ?? true) ? (['rs'] as const) : [])]) {
      ogeler.push({
        id: yeniId(), bant: bantId, tip: 'toplam', fn: k.altToplam, alan: k.alan, oraniPay: k.oraniPay, oraniPayda: k.oraniPayda,
        bicim: k.bicim, x: yerler[i].x, y: bantId === 'rs' ? 6 : 4, w: yerler[i].w, h: 16, hiza: 'sag', kalin: true,
      })
    }
  }

  return {
    sayfa: { boyut: 'A4', yon: kolonlar.length > 7 ? 'yatay' : 'dikey', kenar: [15, 15, 15, 15] },
    bantlar: [
      { id: 'rb', yukseklik: 44 },
      { id: 'sb', yukseklik: 28 },
      { id: 'gb', yukseklik: grupAlani ? 26 : 0 },
      { id: 'dt', yukseklik: 22 },
      { id: 'gs', yukseklik: grupAlani && toplamVar ? 24 : 0 },
      { id: 'rs', yukseklik: toplamVar && (icerik.genelToplam ?? true) ? 28 : 0 },
      { id: 'sa', yukseklik: 22 },
    ],
    ogeler,
    ...(grupAlani ? { grup: { alan: grupAlani, baslik: icerik.gruplar?.[0]?.baslik } } : {}),
  }
}
