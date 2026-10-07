/**
 * Rapor kategorileri — TEK KAYNAK.
 *
 * 07.10.2026'ya kadar kategori serbest metindi (`icerik.kategori`, zod `max(60)`):
 * her tasarımcı kendi yazıyordu ve listede hem "Satın Alma" hem "Satınalma" çipi
 * çıkıyordu — aynı kategori iki ayrı grup. Bu dosya kategoriyi sabit bir listeye
 * bağlar; eski serbest metinler okuma anında bu listeye eşlenir, MIGRATION GEREKMEZ.
 *
 * Yeni kategori eklemek: KATEGORILER'e bir satır, gerekiyorsa EK_ADLAR'a yazım
 * varyantları. Başka yeri değiştirmek gerekmez.
 */

/** Yayınlanan kategori listesi — sıra ekranda da bu sırayla görünür. */
export const KATEGORILER = [
  'Üretim',
  'Depo',
  'Satınalma',
  'Kalite',
  'Bakım',
  'İnsan Varlıkları',
  'Finans',
  'Satış',
  'IPRO',
  'IT',
  'Yönetim',
] as const

export type RaporKategori = (typeof KATEGORILER)[number]

/** Kategorisi olmayan ya da listeye eşlenemeyen raporların düştüğü grup. */
export const KATEGORISIZ = 'Diğer'

/**
 * Serbest metin yazımları → kanonik kategori. Anahtarlar normalize edilmiş
 * hâlleriyle (küçük harf, boşluksuz, Türkçe karakterler sadeleşmiş) karşılaştırılır.
 */
const EK_ADLAR: Record<string, RaporKategori> = {
  satinalma: 'Satınalma',
  satinalmamudurlugu: 'Satınalma',
  purchasing: 'Satınalma',
  uretim: 'Üretim',
  uretimplanlama: 'Üretim',
  production: 'Üretim',
  depo: 'Depo',
  ambar: 'Depo',
  stok: 'Depo',
  warehouse: 'Depo',
  kalite: 'Kalite',
  kalitemudurlugu: 'Kalite',
  quality: 'Kalite',
  bakim: 'Bakım',
  bakimhane: 'Bakım',
  insanvarliklari: 'İnsan Varlıkları',
  insanvarliklarimudurlugu: 'İnsan Varlıkları',
  ik: 'İnsan Varlıkları',
  hr: 'İnsan Varlıkları',
  finans: 'Finans',
  muhasebe: 'Finans',
  satis: 'Satış',
  sales: 'Satış',
  ipro: 'IPRO',
  it: 'IT',
  bt: 'IT',
  sistemgelistirme: 'IT',
  yonetim: 'Yönetim',
}

/**
 * Türkçe duyarlı sadeleştirme: "İDARİ İŞLER" ile "idari isler" aynı anahtara iner.
 * Düz toLowerCase() Türkçe "İ"yi i+birleşen noktaya çevirip eşleşmeyi düşürüyor.
 */
function anahtarla(metin: string): string {
  return metin
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/ş/g, 's')
    .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const KANONIK = new Map<string, RaporKategori>()
for (const k of KATEGORILER) KANONIK.set(anahtarla(k), k)
for (const [ad, k] of Object.entries(EK_ADLAR)) KANONIK.set(anahtarla(ad), k)

/**
 * Serbest metni kanonik kategoriye çevirir. Eşleşme yoksa null —
 * çağıran taraf KATEGORISIZ'e düşürür.
 */
export function kategoriCoz(metin: string | null | undefined): RaporKategori | null {
  if (!metin) return null
  const a = anahtarla(metin)
  if (!a) return null
  return KANONIK.get(a) ?? null
}

/** Listede/gruplamada kullanılacak etiket — eşleşmeyen her şey "Diğer". */
export function kategoriEtiketi(metin: string | null | undefined): string {
  return kategoriCoz(metin) ?? KATEGORISIZ
}
