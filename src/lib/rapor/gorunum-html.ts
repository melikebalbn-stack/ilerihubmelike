/**
 * Etkileşimli görünüm → A4 HTML (yazdır / PDF olarak kaydet). SAF: gorunumUygula sonucunu
 * render.ts'nin kabuğu, yazdırma CSS'i, meta şeridi ve XSS kaçışıyla belgeye çevirir.
 * Basılıda tüm gruplar AÇIK, ekranın 500 satır bütçesi YOK. Görünür kolon > 7 → A4 yatay.
 * Grafik seçiliyse üstte basit çubuk SVG (recharts değil).
 */
import { bicimle } from './bicim'
import { gorunumUygula, type GrupDugum, type Satir } from './gorunum'
import { belgeKabugu, esc, metaSatiri, type RenderBaglam } from './render'
import type { Gorunum, GorunumKolon, SablonParametre } from './tipler'

const TOPLAM_SIMGE: Record<string, string> = { topla: 'Σ', ortalama: 'x̄', say: '#', enkucuk: 'min', enbuyuk: 'max' }
/** Bu sayıdan çok görünür kolon → yatay sayfa. */
export const YATAY_ESIGI = 7

export interface GorunumHtmlBaglam extends RenderBaglam {
  parametreler?: Record<string, unknown>
  parametreTanimlari?: SablonParametre[]
  /** Kolon → başlık (ekrandaki etiketle aynı). */
  basliklar?: Record<string, string>
}

function kosulluSinif(k: GorunumKolon, v: unknown): string {
  if (!k.bicim?.startsWith('%') || v === null || v === undefined) return ''
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return ''
  return n < 90 ? ' r-kritik' : n >= 95 ? ' r-iyi' : ''
}

/** Basit çubuk grafik SVG — değer etiketli, ≤40 kırılım. */
export function cubukGrafikSvg(veri: { etiket: string; deger: number }[], bicim?: GorunumKolon['bicim']): string {
  const d = veri.slice(0, 40)
  if (!d.length) return ''
  const W = 720, H = 150, sol = 30
  const mx = Math.max(1, ...d.map((x) => x.deger))
  const gap = (W - sol - 10) / d.length, bw = Math.min(90, gap * 0.6)
  const cubuklar = d.map((x, i) => {
    const h = Math.max(0, x.deger / mx * (H - 24)), px = sol + i * gap + (gap - bw) / 2
    return `<rect x="${px.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${i % 2 ? '#2AA5C7' : '#1B4F72'}" rx="2"/>` +
      `<text x="${(px + bw / 2).toFixed(1)}" y="${(H - h - 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="#0f172a">${esc(bicimle(x.deger, bicim))}</text>` +
      `<text x="${(px + bw / 2).toFixed(1)}" y="${H + 12}" text-anchor="middle" font-size="9" fill="#475569">${esc(x.etiket.length > 14 ? x.etiket.slice(0, 13) + '…' : x.etiket)}</text>`
  }).join('')
  return `<svg viewBox="0 0 ${W} ${H + 20}" width="100%" height="${H + 20}" preserveAspectRatio="none" style="display:block;max-height:60mm">${cubuklar}<line x1="${sol - 6}" x2="${W - 6}" y1="${H}" y2="${H}" stroke="#cbd5e1"/></svg>`
}

export function gorunumHtml(baslik: string, altBaslik: string | undefined, satirlar: Satir[], gorunum: Gorunum, baglam: GorunumHtmlBaglam = {}): { html: string; yon: 'portrait' | 'landscape'; satirSayisi: number } {
  const sonuc = gorunumUygula(satirlar, gorunum)
  const grupSet = new Set((gorunum.gruplar ?? []).slice(0, 2))
  const kolonlar = gorunum.kolonlar.filter((k) => k.gorunur && !grupSet.has(k.alan))
  const ad = (alan: string) => baglam.basliklar?.[alan] ?? gorunum.kolonlar.find((k) => k.alan === alan)?.baslik ?? alan
  const tip = sonuc.kolonTipleri
  const hiza = (k: GorunumKolon) => (tip[k.alan] === 'sayi' ? 'h-sag' : 'h-sol')
  const yon: 'portrait' | 'landscape' = kolonlar.length > YATAY_ESIGI ? 'landscape' : 'portrait'
  const toplamVar = kolonlar.some((k) => k.toplam)

  // Meta: parametreler + uygulanan filtreler + gruplama + sıralama
  const filtreler = Object.entries(gorunum.filtreler ?? {}).filter(([, v]) => v?.trim()).map(([a, v]) => `${ad(a)} ${/^\s*[<>=!]/.test(v) ? v.trim() : `içerir "${v.trim()}"`}`)
  const ek: Array<[string, string]> = []
  if (filtreler.length) ek.push(['Filtre', filtreler.join(' · ')])
  if (grupSet.size) ek.push(['Gruplama', [...grupSet].map(ad).join(' › ')])
  if (gorunum.siralama?.alan) ek.push(['Sıralama', `${ad(gorunum.siralama.alan)} ${gorunum.siralama.yon === 1 ? '▲' : '▼'}`])
  const meta = metaSatiri(baglam.parametreTanimlari, baglam.parametreler, baglam, sonuc.satirlar.length, ek)

  const hucre = (k: GorunumKolon, v: unknown) => `<td class="${hiza(k)}${kosulluSinif(k, v)}">${esc(bicimle(v, k.bicim))}</td>`
  const detay = (rows: Satir[]) => rows.map((s) => `<tr>${kolonlar.map((k) => hucre(k, s[k.alan])).join('')}</tr>`).join('\n')
  const toplamSatiri = (etiket: string, t: Record<string, number | null>, sinif: string) =>
    `<tr class="${sinif}">${kolonlar.map((k, i) => { const v = k.toplam ? t[k.alan] : undefined; const m = v === undefined || v === null ? (i === 0 ? etiket : '') : k.toplam === 'say' ? String(v) : bicimle(v, k.bicim); return `<td class="${i === 0 && v == null ? 'h-sol' : hiza(k)}${k.toplam && k.toplam !== 'say' ? kosulluSinif(k, v) : ''}">${esc(m)}</td>` }).join('')}</tr>`
  const grup = (g: GrupDugum): string =>
    `<tr class="grup grup-${g.seviye}"><td colspan="${kolonlar.length}">${esc(ad(g.alan))}: ${esc(g.etiket)} <span style="font-weight:400;color:#64748b">· ${g.satirSayisi.toLocaleString('tr-TR')} satır</span></td></tr>\n` +
    (g.altGruplar.length ? g.altGruplar.map(grup).join('\n') : detay(g.satirlar)) +
    (toplamVar ? '\n' + toplamSatiri(`${g.etiket} toplamı`, g.toplamlar, `alt-toplam alt-toplam-${g.seviye}`) : '')

  const govde = sonuc.gruplar.length ? sonuc.gruplar.map(grup).join('\n') : detay(sonuc.satirlar)
  const genel = toplamVar && sonuc.satirlar.length ? '\n' + toplamSatiri('Genel toplam', sonuc.genelToplam, 'genel-toplam') : ''
  const thead = `<thead><tr>${kolonlar.map((k) => `<th class="${hiza(k)}">${esc(ad(k.alan))}${k.toplam ? ` <span style="font-weight:400;color:#64748b">${TOPLAM_SIMGE[k.toplam]}</span>` : ''}</th>`).join('')}</tr></thead>`
  const g = gorunum.grafik
  const grafik = g && sonuc.grafikVerisi.length
    ? `<div style="margin:0 0 8pt"><div style="font-size:9pt;color:#1B4F72;font-weight:600;margin-bottom:2pt">${esc(ad(g.deger))} — ${esc(ad(g.grupla))} bazında (${g.fn === 'topla' ? 'Σ' : 'x̄'})</div>${cubukGrafikSvg(sonuc.grafikVerisi, gorunum.kolonlar.find((k) => k.alan === g.deger)?.bicim)}</div>`
    : ''
  const tablo = sonuc.satirlar.length && kolonlar.length
    ? `<table>${thead}<tbody>\n${govde}${genel}\n</tbody></table>`
    : '<div class="bos">Kayıt bulunamadı</div>'
  return { html: belgeKabugu(baslik, altBaslik, meta, grafik + tablo, yon), yon, satirSayisi: sonuc.satirlar.length }
}
