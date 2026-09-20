/**
 * Şablon içeriği (SablonIcerik) statik doğrulaması — kaydetme öncesi API ve tasarım ekranı ortak.
 * Kolon alanları veri seti çıktı alanlarında VEYA hesaplanan alanlarda olmalı; ifadeler ifadeDogrula'dan
 * geçmeli; grup ≤ 3; kod/ad/biçim değerleri makul.
 */
import { ifadeDogrula } from './ifade'
import type { Bicim, SablonIcerik } from './tipler'

export const BICIMLER: Bicim[] = ['#.##0', '#.##0,00', '%0,0', '%0,00', 'gg.aa.yyyy', 'gg.aa.yyyy ss:dd', 'metin']
const AD_DESENI = /^[A-Za-z_][A-Za-z0-9_]*$/
const MAX_GRUP = 3

export function sablonDogrula(icerik: SablonIcerik, veriSetiAlanlari: string[]): string[] {
  const h: string[] = []
  if (!icerik.baslik?.trim()) h.push('Rapor başlığı boş')
  const hesaplanan = icerik.hesaplananAlanlar ?? []
  const hesaplananAdlari = new Set<string>()
  for (const ha of hesaplanan) {
    if (!AD_DESENI.test(ha.ad ?? '')) h.push(`Hesaplanan alan adı geçersiz: '${ha.ad ?? ''}'`)
    else if (hesaplananAdlari.has(ha.ad) || veriSetiAlanlari.includes(ha.ad)) h.push(`Hesaplanan alan adı çakışıyor: '${ha.ad}'`)
    hesaplananAdlari.add(ha.ad)
    if (ha.bicim && !BICIMLER.includes(ha.bicim)) h.push(`${ha.ad}: bilinmeyen biçim '${ha.bicim}'`)
  }
  // Hesaplananlar sıralı: sonraki öncekini görebilir.
  const gorunur = [...veriSetiAlanlari]
  for (const ha of hesaplanan) {
    const d = ifadeDogrula(ha.ifade ?? '', gorunur)
    if (!d.gecerli) h.push(`Hesaplanan '${ha.ad}': ${d.hata}`)
    else if (d.hata) h.push(`Hesaplanan '${ha.ad}': ${d.hata}`)
    gorunur.push(ha.ad)
  }
  const tumAlanlar = new Set(gorunur)

  if (!icerik.kolonlar?.length) h.push('En az bir kolon olmalı')
  for (const k of icerik.kolonlar ?? []) {
    if (!k.alan) { h.push('Alanı boş kolon var'); continue }
    if (!tumAlanlar.has(k.alan)) h.push(`Kolon '${k.baslik || k.alan}': '${k.alan}' veri setinde/hesaplananlarda yok`)
    if (!k.baslik?.trim()) h.push(`Kolon '${k.alan}': başlık boş`)
    if (k.bicim && !BICIMLER.includes(k.bicim)) h.push(`Kolon '${k.alan}': bilinmeyen biçim '${k.bicim}'`)
    if (k.genislik !== undefined && (k.genislik <= 0 || k.genislik > 100)) h.push(`Kolon '${k.alan}': genişlik 1-100 arası olmalı`)
    if (k.altToplam === 'orani') {
      if (!k.oraniPay || !tumAlanlar.has(k.oraniPay)) h.push(`Kolon '${k.alan}': oran payı geçersiz`)
      if (!k.oraniPayda || !tumAlanlar.has(k.oraniPayda)) h.push(`Kolon '${k.alan}': oran paydası geçersiz`)
    }
    for (const kb of k.kosulluBicim ?? []) {
      const d = ifadeDogrula(kb.kosul ?? '', gorunur)
      if (!d.gecerli || d.hata) h.push(`Kolon '${k.alan}' koşul '${kb.kosul}': ${d.hata}`)
    }
  }
  const gruplar = icerik.gruplar ?? []
  if (gruplar.length > MAX_GRUP) h.push(`En fazla ${MAX_GRUP} grup seviyesi (${gruplar.length} verildi)`)
  for (const g of gruplar) {
    if (!g.alan || !tumAlanlar.has(g.alan)) h.push(`Grup alanı geçersiz: '${g.alan ?? ''}'`)
    if (g.baslik) { const d = ifadeDogrula(g.baslik, gorunur); if (!d.gecerli || d.hata) h.push(`Grup '${g.alan}' başlığı: ${d.hata}`) }
  }
  const pAdlari = new Set<string>()
  for (const p of icerik.parametreler ?? []) {
    if (!AD_DESENI.test(p.ad ?? '')) h.push(`Parametre adı geçersiz: '${p.ad ?? ''}'`)
    else if (pAdlari.has(p.ad)) h.push(`Parametre adı mükerrer: '${p.ad}'`)
    pAdlari.add(p.ad)
    if (!p.etiket?.trim()) h.push(`Parametre '${p.ad}': etiket boş`)
  }
  return h
}

/** Veri seti tanımındaki {p.x} yer tutucuları + postgres parametre adları. */
export function veriSetiParametreleri(tanim: { kaynaklar?: Array<{ tip: string; filtre?: string; parametreler?: string[]; tasarim?: { where?: string } }> } | null | undefined): string[] {
  const s = new Set<string>()
  for (const k of tanim?.kaynaklar ?? []) {
    const metin = k.tip === 'ifs-odata' ? (k.filtre ?? '') : (k.tasarim?.where ?? '')
    for (const m of metin.matchAll(/\{p\.([A-Za-z_][A-Za-z0-9_]*)\}/g)) s.add(m[1])
    for (const p of k.parametreler ?? []) s.add(p)
  }
  return [...s]
}
