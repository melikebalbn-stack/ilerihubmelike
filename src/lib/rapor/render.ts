/**
 * Rapor render motoru — şablon (SablonIcerik) + satır dizisi → tek parça HTML.
 * Saf katman: DB/IFS yok. CSS gömülü, A4 dikey yazdırmaya uygun. Tüm değerler HTML-escape.
 */
import { bicimle, sayiMi, tarihMi, tarihSaatMetni } from './bicim'
import { ifadeCalistir, ifadeDerle, toplamHesapla, type DerlenmisIfade, type ToplamFn } from './ifade'
import type { GrupTanim, Kolon, SablonIcerik } from './tipler'

export class RenderHatasi extends Error {
  constructor(mesaj: string) { super(mesaj); this.name = 'RenderHatasi' }
}

export interface RenderBaglam {
  parametreler?: Record<string, unknown>
  calistiran?: string
  raporKodu?: string
}

export interface RenderSonuc { html: string; satirSayisi: number; sureMs: number }

type Satir = Record<string, unknown>
const MAX_GRUP = 3
const UYARI_SATIR = 10_000

// ── Yardımcılar ─────────────────────────────────────────────────────────

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function derle(kaynak: string, baglam: string): DerlenmisIfade {
  try { return ifadeDerle(kaynak) } catch (e) { throw new RenderHatasi(`${baglam}: ${e instanceof Error ? e.message : String(e)}`) }
}

function kiyasla(a: unknown, b: unknown): number {
  const an = a === null || a === undefined, bn = b === null || b === undefined
  if (an || bn) return an && bn ? 0 : an ? 1 : -1 // null sona
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  return String(a).localeCompare(String(b), 'tr-TR')
}

// ── Gruplama ────────────────────────────────────────────────────────────

interface Grup { seviye: number; deger: unknown; baslik: string; satirlar: Satir[]; altGruplar: Grup[] }

function grupla(satirlar: Satir[], tanimlar: GrupTanim[], basliklar: (DerlenmisIfade | null)[], seviye: number, parametreler?: Satir): Grup[] {
  if (seviye >= tanimlar.length) return []
  const t = tanimlar[seviye]
  const kovalar = new Map<string, Grup>()
  for (const s of satirlar) {
    const deger = s[t.alan] ?? null
    const anahtar = deger instanceof Date ? deger.toISOString() : `${typeof deger}:${String(deger)}`
    let g = kovalar.get(anahtar)
    if (!g) {
      const b = basliklar[seviye]
      const baslik = b ? bicimle(ifadeCalistir(b, { satir: s, parametreler })) : bicimle(deger)
      g = { seviye, deger, baslik, satirlar: [], altGruplar: [] }
      kovalar.set(anahtar, g)
    }
    g.satirlar.push(s)
  }
  const gruplar = [...kovalar.values()].sort((a, b) => kiyasla(a.deger, b.deger))
  for (const g of gruplar) g.altGruplar = grupla(g.satirlar, tanimlar, basliklar, seviye + 1, parametreler)
  return gruplar
}

// ── Kolon hazırlığı ─────────────────────────────────────────────────────

interface HazirKolon {
  k: Kolon
  hiza: 'sol' | 'sag' | 'orta'
  genislik: number
  kosullar: { d: DerlenmisIfade; renk?: string; kalin?: boolean }[]
}

function kolonlariHazirla(kolonlar: Kolon[], ornek: Satir | undefined, hesaplananBicim: Map<string, Kolon['bicim']>): HazirKolon[] {
  if (!kolonlar.length) throw new RenderHatasi('Şablonda kolon yok')
  const verilen = kolonlar.reduce((t, k) => t + (k.genislik ?? 0), 0)
  const eksik = kolonlar.filter((k) => k.genislik === undefined).length
  const kalanPay = eksik ? Math.max(0, 100 - verilen) / eksik : 0
  return kolonlar.map((k) => {
    const bicim = k.bicim ?? hesaplananBicim.get(k.alan)
    const orn = ornek?.[k.alan]
    const sayisal = bicim ? bicim.startsWith('#') || bicim.startsWith('%') || bicim.startsWith('gg') : sayiMi(orn) || tarihMi(orn)
    return {
      k: bicim && !k.bicim ? { ...k, bicim } : k,
      hiza: k.hiza ?? (sayisal ? 'sag' : 'sol'),
      genislik: k.genislik ?? kalanPay,
      kosullar: (k.kosulluBicim ?? []).map((kb) => ({ d: derle(kb.kosul, `kolon '${k.alan}' koşullu biçim`), renk: kb.renk, kalin: kb.kalin })),
    }
  })
}

function altToplamDegeri(k: Kolon, satirlar: Satir[]): unknown {
  const fn = k.altToplam ?? 'yok'
  if (fn === 'yok') return null
  if (fn === 'orani') {
    if (!k.oraniPay || !k.oraniPayda) return null
    const pay = toplamHesapla('topla', k.oraniPay, satirlar) ?? 0
    const payda = toplamHesapla('topla', k.oraniPayda, satirlar)
    return payda ? (pay / payda) * 100 : null
  }
  return toplamHesapla(fn as ToplamFn, k.alan, satirlar)
}

// ── HTML parçaları ──────────────────────────────────────────────────────

function hucreSinifi(hk: HazirKolon, satir: Satir, parametreler?: Satir): string {
  const s: string[] = [`h-${hk.hiza}`]
  for (const kb of hk.kosullar) {
    if (ifadeCalistir(kb.d, { satir, parametreler }) === true) {
      if (kb.renk) s.push(`r-${kb.renk}`)
      if (kb.kalin) s.push('kalin')
    }
  }
  return s.join(' ')
}

function detaySatiri(hk: HazirKolon[], s: Satir, parametreler?: Satir): string {
  return `<tr>${hk.map((h) => `<td class="${hucreSinifi(h, s, parametreler)}">${esc(bicimle(s[h.k.alan], h.k.bicim))}</td>`).join('')}</tr>`
}

function toplamSatiri(hk: HazirKolon[], satirlar: Satir[], etiket: string, sinif: string): string {
  const hucreler = hk.map((h, i) => {
    const v = altToplamDegeri(h.k, satirlar)
    const metin = v === null || v === undefined ? (i === 0 ? etiket : '') : bicimle(v, h.k.bicim)
    return `<td class="h-${i === 0 && v == null ? 'sol' : h.hiza}">${esc(metin)}</td>`
  })
  return `<tr class="${sinif}">${hucreler.join('')}</tr>`
}

function grupHtml(g: Grup, tanimlar: GrupTanim[], hk: HazirKolon[], parametreler: Satir | undefined, ilkMi: boolean): string {
  const t = tanimlar[g.seviye]
  const sinif = ['grup', `grup-${g.seviye}`, t.yeniSayfa && !ilkMi ? 'yeni-sayfa' : ''].filter(Boolean).join(' ')
  const parcalar: string[] = [`<tr class="${sinif}"><td colspan="${hk.length}">${esc(g.baslik)}</td></tr>`]
  if (g.altGruplar.length) {
    g.altGruplar.forEach((alt, i) => parcalar.push(grupHtml(alt, tanimlar, hk, parametreler, ilkMi && i === 0)))
  } else {
    for (const s of g.satirlar) parcalar.push(detaySatiri(hk, s, parametreler))
  }
  if (hk.some((h) => h.k.altToplam && h.k.altToplam !== 'yok')) {
    parcalar.push(toplamSatiri(hk, g.satirlar, `${g.baslik} toplamı`, `alt-toplam alt-toplam-${g.seviye}`))
  }
  return parcalar.join('\n')
}

/** A4 yazdırma CSS'i — belge ve etkileşimli çıktı (gorunum-html) ortak. */
export const yazdirmaCss = (yon: 'portrait' | 'landscape' = 'portrait') => `
:root{--cizgi:#cbd5e1;--zemin:#f1f5f9;--metin:#0f172a;--kritik:#dc2626;--kritik-z:#fee2e2;--iyi:#15803d;--iyi-z:#dcfce7;--uyari:#b45309;--uyari-z:#fef3c7}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:var(--metin);margin:0;padding:12mm;background:#fff}
.baslik h1{font-size:16pt;margin:0 0 2pt}
.baslik .alt{font-size:11pt;color:#475569;margin:0 0 6pt}
.meta{display:flex;flex-wrap:wrap;gap:4pt 16pt;font-size:8.5pt;color:#475569;border-top:1px solid var(--cizgi);border-bottom:1px solid var(--cizgi);padding:4pt 0;margin-bottom:8pt}
.meta b{color:var(--metin);font-weight:600}
table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{display:table-header-group}
th{background:var(--zemin);border-bottom:2px solid #94a3b8;padding:4pt 5pt;font-size:9pt;text-align:left}
td{border-bottom:1px solid var(--cizgi);padding:3pt 5pt;overflow-wrap:anywhere;vertical-align:top}
tr{break-inside:avoid;page-break-inside:avoid}
.h-sol{text-align:left}.h-sag{text-align:right;font-variant-numeric:tabular-nums}.h-orta{text-align:center}
.grup td{font-weight:700;background:var(--zemin);border-bottom:1px solid #94a3b8}
.grup{break-after:avoid;page-break-after:avoid}
.grup-0 td{font-size:10.5pt;padding-top:7pt}
.grup-1 td{padding-left:12pt}.grup-2 td{padding-left:20pt;font-weight:600}
.alt-toplam td{font-weight:600;background:#f8fafc;border-top:1px solid #94a3b8}
.genel-toplam td{font-weight:700;background:var(--zemin);border-top:2px solid #94a3b8;border-bottom:2px solid #94a3b8}
.r-kritik{color:var(--kritik);background:var(--kritik-z)}.r-iyi{color:var(--iyi);background:var(--iyi-z)}.r-uyari{color:var(--uyari);background:var(--uyari-z)}
.kalin{font-weight:700}
.uyari-satir{color:var(--uyari);background:var(--uyari-z);padding:4pt 6pt;margin:6pt 0;font-size:9pt;border:1px solid #f59e0b}
.bos{padding:16pt;text-align:center;color:#64748b}
.sayfa-alti{display:flex;justify-content:space-between;font-size:8pt;color:#64748b;margin-top:10pt;border-top:1px solid var(--cizgi);padding-top:4pt}
@page{size:A4 ${yon};margin:15mm}
@media print{
  body{padding:0}
  .yeni-sayfa{break-before:page;page-break-before:always}
  .r-kritik,.r-iyi,.r-uyari,.grup td,th,.alt-toplam td,.genel-toplam td{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`

/** Başlık altı meta şeridi: parametreler, tarih, çalıştıran, rapor kodu, satır (+ ek çiftler). */
export function metaSatiri(parametreler: SablonIcerik['parametreler'], degerler: Record<string, unknown> | undefined, baglam: RenderBaglam, satirSayisi: number, ek: Array<[string, string]> = []): string {
  const paramOzeti = (parametreler ?? [])
    .map((sp) => `<span><b>${esc(sp.etiket)}:</b> ${esc(bicimle(degerler?.[sp.ad], sp.tip === 'tarih' ? 'gg.aa.yyyy' : undefined))}</span>`)
    .join('')
  return [
    paramOzeti,
    ...ek.map(([b, v]) => `<span><b>${esc(b)}:</b> ${esc(v)}</span>`),
    `<span><b>Tarih:</b> ${esc(tarihSaatMetni(new Date()))}</span>`,
    baglam.calistiran ? `<span><b>Çalıştıran:</b> ${esc(baglam.calistiran)}</span>` : '',
    baglam.raporKodu ? `<span><b>Rapor:</b> ${esc(baglam.raporKodu)}</span>` : '',
    `<span><b>Satır:</b> ${satirSayisi.toLocaleString('tr-TR')}</span>`,
  ].filter(Boolean).join('')
}

/** Tam HTML belgesi kabuğu (charset, başlık bloğu, gömülü CSS). */
export function belgeKabugu(baslik: string, altBaslik: string | undefined, meta: string, govde: string, yon: 'portrait' | 'landscape' = 'portrait'): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(baslik)}</title>
<style>${yazdirmaCss(yon)}</style>
</head>
<body>
<div class="baslik"><h1>${esc(baslik)}</h1>${altBaslik ? `<p class="alt">${esc(altBaslik)}</p>` : ''}</div>
<div class="meta">${meta}</div>
${govde}
</body>
</html>`
}

// ── Giriş noktası ───────────────────────────────────────────────────────

export function raporRender(icerik: SablonIcerik, satirlar: Satir[], baglam: RenderBaglam = {}): RenderSonuc {
  const t0 = Date.now()
  const gruplar = icerik.gruplar ?? []
  if (gruplar.length > MAX_GRUP) throw new RenderHatasi(`En fazla ${MAX_GRUP} grup seviyesi desteklenir (${gruplar.length} verildi)`)
  const p = baglam.parametreler

  // a) Hesaplanan alanlar — bir kez derle, her satıra uygula.
  const hesaplananlar = (icerik.hesaplananAlanlar ?? []).map((h) => ({ ad: h.ad, d: derle(h.ifade, `hesaplanan alan '${h.ad}'`), bicim: h.bicim }))
  const hesaplananBicim = new Map(hesaplananlar.filter((h) => h.bicim).map((h) => [h.ad, h.bicim]))
  const veri: Satir[] = hesaplananlar.length
    ? satirlar.map((s) => {
        const y: Satir = { ...s }
        for (const h of hesaplananlar) y[h.ad] = ifadeCalistir(h.d, { satir: y, parametreler: p }) // sıralı: sonraki öncekini görebilir
        return y
      })
    : satirlar

  const hk = kolonlariHazirla(icerik.kolonlar, veri[0], hesaplananBicim)
  const grupBasliklari = gruplar.map((g) => (g.baslik ? derle(g.baslik, `grup '${g.alan}' başlığı`) : null))

  // b) Grupla (çok seviyeli) — gruplama sıralı, gruplar içinde girdi sırası korunur.
  const agac = grupla(veri, gruplar, grupBasliklari, 0, p)

  // c) HTML
  const govde: string[] = []
  if (agac.length) {
    agac.forEach((g, i) => govde.push(grupHtml(g, gruplar, hk, p, i === 0)))
  } else {
    for (const s of veri) govde.push(detaySatiri(hk, s, p))
  }
  if ((icerik.genelToplam ?? true) && veri.length && hk.some((h) => h.k.altToplam && h.k.altToplam !== 'yok')) {
    govde.push(toplamSatiri(hk, veri, 'Genel toplam', 'genel-toplam'))
  }

  const meta = metaSatiri(icerik.parametreler, p, baglam, veri.length)

  const colgroup = `<colgroup>${hk.map((h) => `<col style="width:${h.genislik.toFixed(2)}%">`).join('')}</colgroup>`
  const thead = `<thead><tr>${hk.map((h) => `<th class="h-${h.hiza}">${esc(h.k.baslik)}</th>`).join('')}</tr></thead>`
  const uyari = veri.length > UYARI_SATIR ? `<div class="uyari-satir">Uyarı: rapor ${veri.length.toLocaleString('tr-TR')} satır içeriyor (${UYARI_SATIR.toLocaleString('tr-TR')} üzeri); yazdırma/görüntüleme yavaş olabilir, filtre daraltmayı düşünün.</div>` : ''
  const sa = icerik.sayfaAlti
  const sayfaAlti = sa && (sa.sol || sa.sag) ? `<div class="sayfa-alti"><span>${esc(sa.sol ?? '')}</span><span>${esc(sa.sag ?? '')}</span></div>` : ''

  const html = belgeKabugu(icerik.baslik, icerik.altBaslik, meta, `${uyari}
${veri.length ? `<table>${colgroup}${thead}<tbody>\n${govde.join('\n')}\n</tbody></table>` : '<div class="bos">Kayıt bulunamadı</div>'}
${sayfaAlti}`)

  return { html, satirSayisi: veri.length, sureMs: Date.now() - t0 }
}
