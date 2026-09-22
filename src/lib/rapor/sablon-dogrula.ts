/**
 * Şablon içeriği (SablonIcerik) statik doğrulaması — kaydetme öncesi API ve tasarım ekranı ortak.
 * Kolon alanları veri seti çıktı alanlarında VEYA hesaplanan alanlarda olmalı; ifadeler ifadeDogrula'dan
 * geçmeli; grup ≤ 3; kod/ad/biçim değerleri makul.
 */
import { ifadeDogrula } from './ifade'
import { BANT_ADI, etkilesimliMi, TUVAL_GENISLIK, type Bicim, type EtkilesimliIcerik, type SablonIcerik, type SablonIcerikHer, type TuvalTasarim } from './tipler'

export const BICIMLER: Bicim[] = ['#.##0', '#.##0,00', '%0,0', '%0,00', 'gg.aa.yyyy', 'gg.aa.yyyy ss:dd', 'metin']
const AD_DESENI = /^[A-Za-z_][A-Za-z0-9_]*$/
const MAX_GRUP = 3

/** Etkileşimli görünüm: kolon/grup/sıralama/filtre/grafik alanları veri seti ∪ hesaplananlarda; grup ≤ 2; ifadeler geçerli. */
export function gorunumDogrula(icerik: EtkilesimliIcerik, veriSetiAlanlari: string[]): string[] {
  const h: string[] = []
  if (!icerik.baslik?.trim()) h.push('Rapor başlığı boş')
  const g = icerik.gorunum
  if (!g) return ['Görünüm tanımı yok']
  const gorunur = [...veriSetiAlanlari]
  const hesaplananAdlari = new Set<string>()
  for (const ha of g.hesaplananAlanlar ?? []) {
    if (!AD_DESENI.test(ha.ad ?? '')) h.push(`Hesaplanan alan adı geçersiz: '${ha.ad ?? ''}'`)
    else if (hesaplananAdlari.has(ha.ad) || veriSetiAlanlari.includes(ha.ad)) h.push(`Hesaplanan alan adı çakışıyor: '${ha.ad}'`)
    hesaplananAdlari.add(ha.ad)
    const d = ifadeDogrula(ha.ifade ?? '', gorunur)
    if (!d.gecerli || d.hata) h.push(`Hesaplanan '${ha.ad}': ${d.hata}`)
    gorunur.push(ha.ad)
  }
  const tum = new Set(gorunur)
  if (!g.kolonlar?.length) h.push('Görünümde kolon yok')
  const kolonAlanlari = new Set<string>()
  for (const k of g.kolonlar ?? []) {
    if (!k.alan || !tum.has(k.alan)) h.push(`Kolon '${k.alan}': veri setinde/hesaplananlarda yok`)
    if (kolonAlanlari.has(k.alan)) h.push(`Kolon '${k.alan}' iki kez tanımlı`)
    kolonAlanlari.add(k.alan)
    if (k.bicim && !BICIMLER.includes(k.bicim)) h.push(`Kolon '${k.alan}': bilinmeyen biçim '${k.bicim}'`)
  }
  if ((g.gruplar ?? []).length > 2) h.push(`En fazla 2 grup seviyesi (${g.gruplar.length} verildi)`)
  for (const ga of g.gruplar ?? []) if (!tum.has(ga)) h.push(`Grup alanı geçersiz: '${ga}'`)
  if (g.siralama?.alan && !tum.has(g.siralama.alan)) h.push(`Sıralama alanı geçersiz: '${g.siralama.alan}'`)
  for (const fa of Object.keys(g.filtreler ?? {})) if (!tum.has(fa)) h.push(`Filtre alanı geçersiz: '${fa}'`)
  if (g.grafik) {
    if (!tum.has(g.grafik.grupla)) h.push(`Grafik kırılım alanı geçersiz: '${g.grafik.grupla}'`)
    if (!tum.has(g.grafik.deger)) h.push(`Grafik değer alanı geçersiz: '${g.grafik.deger}'`)
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

/** Türe göre dağıtır: etkileşimli → gorunumDogrula, belge → belgeDogrula. */
export function sablonDogrula(icerik: SablonIcerikHer, veriSetiAlanlari: string[]): string[] {
  return etkilesimliMi(icerik) ? gorunumDogrula(icerik, veriSetiAlanlari) : belgeDogrula(icerik, veriSetiAlanlari)
}

/**
 * Tuval tasarımı: öğe alanları veri seti ∪ hesaplananlarda mı, ifadeler geçerli mi, tablo kolonları
 * ve grafik alanları doğru mu. Bandın dışına taşan öğe UYARI'dır (kayıt engellenmez, "Uyarı:" ile başlar).
 */
export function tuvalDogrula(t: TuvalTasarim | undefined, tumAlanlar: Set<string>): string[] {
  const h: string[] = []
  if (!t) return ['Tuval tasarımı yok']
  if (!t.bantlar?.length) h.push('Tuval: bant tanımı yok')
  for (const b of t.bantlar ?? []) {
    if (!(b.id in BANT_ADI)) h.push(`Tuval: bilinmeyen bant '${b.id}'`)
    if (!(b.yukseklik >= 0) || b.yukseklik > 2000) h.push(`Tuval: '${b.id}' bant yüksekliği geçersiz`)
  }
  const bantlar = new Map((t.bantlar ?? []).map((b) => [b.id, b]))
  if (t.grup?.alan && !tumAlanlar.has(t.grup.alan)) h.push(`Tuval grup alanı geçersiz: '${t.grup.alan}'`)
  const kimlikler = new Set<string>()
  for (const e of t.ogeler ?? []) {
    const ad = `Tuval öğesi ${e.id ?? '?'} (${BANT_ADI[e.bant] ?? e.bant})`
    if (!e.id) h.push('Tuval: kimliksiz öğe var')
    else if (kimlikler.has(e.id)) h.push(`Tuval: mükerrer öğe kimliği '${e.id}'`)
    kimlikler.add(e.id)
    if (!bantlar.has(e.bant)) { h.push(`${ad}: bilinmeyen bant`); continue }
    if (e.x < 0 || e.y < 0 || e.w <= 0 || e.h < 0) h.push(`${ad}: konum/boyut geçersiz`)
    if (e.x + e.w > TUVAL_GENISLIK + 1) h.push(`Uyarı: ${ad} sayfa genişliğini aşıyor (${e.x + e.w} > ${TUVAL_GENISLIK})`)
    const bant = bantlar.get(e.bant)!
    if (e.y + e.h > bant.yukseklik + 1) h.push(`Uyarı: ${ad} bandın dışına taşıyor (${e.y + e.h} > ${bant.yukseklik})`)
    switch (e.tip) {
      case 'alan':
        if (!tumAlanlar.has(e.alan)) h.push(`${ad}: '${e.alan}' veri setinde/hesaplananlarda yok`)
        if (e.bicim && !BICIMLER.includes(e.bicim)) h.push(`${ad}: bilinmeyen biçim '${e.bicim}'`)
        break
      case 'toplam':
        if (!tumAlanlar.has(e.alan)) h.push(`${ad}: '${e.alan}' veri setinde/hesaplananlarda yok`)
        if (e.fn === 'orani') {
          if (!e.oraniPay || !tumAlanlar.has(e.oraniPay)) h.push(`${ad}: oran payı geçersiz`)
          if (!e.oraniPayda || !tumAlanlar.has(e.oraniPayda)) h.push(`${ad}: oran paydası geçersiz`)
        }
        break
      case 'tablo':
        if (!e.kolonlar?.length) h.push(`${ad}: tablo kolonu yok`)
        for (const k of e.kolonlar ?? []) {
          if (!tumAlanlar.has(k.alan)) h.push(`${ad}: tablo kolonu '${k.alan}' veri setinde yok`)
          if (!(k.genislik > 0)) h.push(`${ad}: '${k.alan}' kolon genişliği geçersiz`)
        }
        break
      case 'grafik':
        if (!tumAlanlar.has(e.grupla)) h.push(`${ad}: grafik kırılım alanı '${e.grupla}' yok`)
        if (!tumAlanlar.has(e.deger)) h.push(`${ad}: grafik değer alanı '${e.deger}' yok`)
        break
      case 'metin':
        // {alan} yer tutucuları: özel adlar dışındakiler veri setinde olmalı.
        for (const m of (e.metin ?? '').matchAll(/\{([^}]+)\}/g)) {
          const ad2 = m[1].trim()
          if (/^(sayfa|toplamSayfa|bugun|calistiran|grup)$/.test(ad2) || ad2.startsWith('p.') || ad2.startsWith('rapor.')) continue
          if (!tumAlanlar.has(ad2)) h.push(`${ad}: metindeki '{${ad2}}' veri setinde yok`)
        }
        break
    }
    if (e.tip === 'alan' || e.tip === 'toplam') {
      for (const k of e.kosulluBicim ?? []) {
        const d = ifadeDogrula(k.kosul ?? '', [...tumAlanlar])
        if (!d.gecerli || d.hata) h.push(`${ad} koşulu '${k.kosul}': ${d.hata}`)
      }
    }
  }
  return h
}

export function belgeDogrula(icerik: SablonIcerik, veriSetiAlanlari: string[]): string[] {
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
  if (icerik.yerlesim === 'tuval') h.push(...tuvalDogrula(icerik.tuval, tumAlanlar))
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
