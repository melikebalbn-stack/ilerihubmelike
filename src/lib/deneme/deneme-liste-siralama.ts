// IV-FR-27 · Deneme listesi sıralaması (SAF — DOM/DB yok).
//
// Üç durumlu başlık: kapalı → artan → azalan → kapalı. "Kapalı" sunucunun
// sırasına döner (hedefTarih asc, id asc) — varsayılan DEĞİŞMEZ.
//
// Metin karşılaştırması tr-TR: "İ/ı/ş/ğ/ö/ç/ü" düz localeCompare'da yanlış
// yerleşir ("İSTANBUL" < "Izmir" gibi). Sayı/tarih alanlarında locale yok.
//
// BOŞ DEĞERLER DAİMA SONDA — yön ne olursa olsun. Puanı girilmemiş form, azalan
// sıralamada en başa çıkıp listeyi okunmaz hâle getirmesin (mesai/KPI
// tablolarındaki `nulls: 'last'` davranışının aynısı).

export const DENEME_SIRALAMA_ALANLARI = [
  'personel',
  'tur',
  'yaka',
  'bolum',
  'hedefTarih',
  'durum',
  'adimSahibi',
  'puan1',
  'puan2',
  'ortalama',
  'sonuc',
] as const

export type DenemeSiralamaAlani = (typeof DENEME_SIRALAMA_ALANLARI)[number]
export type SiralamaYonu = 'asc' | 'desc'
/** null = kapalı (sunucu sırası). */
export type DenemeSiralama = { alan: DenemeSiralamaAlani; yon: SiralamaYonu } | null

/** Sıralanabilmesi için satırdan okunan asgari alanlar. */
export type SiralanabilirSatir = {
  tur: string
  durum: string
  hedefTarih: string
  yakaRengi: string
  puan1: number | null
  puan2: number | null
  ortalama: number | null
  basarili: boolean | null
  adimSahibi: string | null
  personnel: { adSoyad: string; bolum: string }
}

/** Başlığa tıklama: kapalı → artan → azalan → kapalı. */
export function sonrakiSiralama(mevcut: DenemeSiralama, alan: DenemeSiralamaAlani): DenemeSiralama {
  if (!mevcut || mevcut.alan !== alan) return { alan, yon: 'asc' }
  if (mevcut.yon === 'asc') return { alan, yon: 'desc' }
  return null
}

/** Ekranda görünen etiketlerle sıralanır — kullanıcı gördüğü sırayı bekler. */
const TUR_ETIKET: Record<string, string> = { DENEME_2AY: '2 AY', ALTI_AY: '6 AY' }

type Anahtar = { metin?: string; sayi?: number; bos: boolean }

function anahtarCoz(
  s: SiralanabilirSatir,
  alan: DenemeSiralamaAlani,
  durumEtiket: Record<string, string>,
): Anahtar {
  const metinAnahtar = (v: string | null | undefined): Anahtar => {
    const t = (v ?? '').trim()
    return { metin: t, bos: t === '' }
  }
  const sayiAnahtar = (v: number | null | undefined): Anahtar =>
    v === null || v === undefined || Number.isNaN(v) ? { bos: true } : { sayi: v, bos: false }

  switch (alan) {
    case 'personel':
      return metinAnahtar(s.personnel.adSoyad)
    case 'tur':
      return metinAnahtar(TUR_ETIKET[s.tur] ?? s.tur)
    case 'yaka':
      return metinAnahtar(s.yakaRengi)
    case 'bolum':
      return metinAnahtar(s.personnel.bolum)
    case 'hedefTarih': {
      const t = new Date(s.hedefTarih).getTime()
      return Number.isNaN(t) ? { bos: true } : { sayi: t, bos: false }
    }
    case 'durum':
      return metinAnahtar(durumEtiket[s.durum] ?? s.durum)
    case 'adimSahibi':
      return metinAnahtar(s.adimSahibi)
    case 'puan1':
      return sayiAnahtar(s.puan1)
    case 'puan2':
      return sayiAnahtar(s.puan2)
    case 'ortalama':
      return sayiAnahtar(s.ortalama)
    case 'sonuc':
      // null = henüz sonuç yok → boş sayılır, sonda kalır.
      return s.basarili === null ? { bos: true } : metinAnahtar(s.basarili ? 'BAŞARILI' : 'BAŞARISIZ')
  }
}

/**
 * Sıralı kopya döner; girdi dizisi DEĞİŞTİRİLMEZ. `siralama` null ise dizi
 * AYNEN döner (sunucu sırası korunur).
 *
 * Kararlılık: eşitlikte özgün indeks tiebreaker'ı — aynı veri her zaman aynı
 * sırayı üretir (Array.prototype.sort motorlar arası kararlı olsa da, boş
 * değerleri sona alırken karşılaştırma zincirini açıkça kapatıyoruz).
 */
export function denemeSirala<T extends SiralanabilirSatir>(
  satirlar: T[],
  siralama: DenemeSiralama,
  durumEtiket: Record<string, string> = {},
): T[] {
  if (!siralama) return satirlar
  const yonCarpani = siralama.yon === 'asc' ? 1 : -1
  return satirlar
    .map((s, i) => ({ s, i, a: anahtarCoz(s, siralama.alan, durumEtiket) }))
    .sort((x, y) => {
      // BOŞ DAİMA SONDA — yönden bağımsız.
      if (x.a.bos !== y.a.bos) return x.a.bos ? 1 : -1
      if (x.a.bos && y.a.bos) return x.i - y.i
      let fark = 0
      if (x.a.sayi !== undefined && y.a.sayi !== undefined) {
        fark = x.a.sayi - y.a.sayi
      } else {
        fark = (x.a.metin ?? '').localeCompare(y.a.metin ?? '', 'tr', { sensitivity: 'base', numeric: true })
      }
      if (fark !== 0) return fark * yonCarpani
      return x.i - y.i // kararlılık
    })
    .map((x) => x.s)
}
