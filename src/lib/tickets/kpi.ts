/**
 * IT Ticket KPI — ortak sabitler ve ölçüm tipi (SAF: prisma yok).
 *
 * SÖZLEŞME: API ham gerçeği döner, yorumu İSTEMCİ yapar. Her metrik bir
 * `Olcum` — değer ve o değerin kaç kayıttan hesaplandığı. "Yeterli veri var mı"
 * kararı tek yerde (YETERLI_ORNEKLEM) ve yalnız ekranda uygulanır; API bir
 * metriği asla gizlemez, n=1 bile olsa doğru sayıyı verir.
 *
 * Neden böyle: ortalamalar veri yokken 0 dönüyordu ve bu "hepsi sıfır" ile
 * karışıyordu (özellikle memnuniyet: puan 1-5 aralığında, 0 mümkün değil).
 * Mevcut summary'deki respondedCount/ratedCount alanları aynı ihtiyacın nokta
 * çözümüydü; bu tip onu kuralsallaştırıyor.
 */

/** Altında sayının GİZLENDİĞİ örneklem eşiği (yalnız istemci uygular). */
export const YETERLI_ORNEKLEM = 5

/**
 * Onay/otomatik kapanış akışının canlıya çıktığı an.
 *
 * Bu tarihten ÖNCE kapanmış taleplerde `autoClosed` alanı yalnız kolon
 * varsayılanıdır (false) — "kullanıcı onayladı" ANLAMINA GELMEZ, o akış henüz
 * yoktu. Kapanış türü dağılımı bu yüzden yalnız bu andan sonraki kapanışları
 * sayar; aksi halde prod'daki 16 eski kapanış "onaylı" görünürdü.
 */
export const ONAY_AKISI_BASLANGICI = new Date('2026-09-04T13:36:00.000Z')

/** `resolvedByEmail` alanının doldurulmaya başladığı an (aynı sürüm). */
export const COZEN_KAYDI_BASLANGICI = ONAY_AKISI_BASLANGICI

/** Bir metrik ve örneklemi. value=null → hesaplanacak kayıt yok. */
export interface Olcum {
  value: number | null
  n: number
}

export function olcum(value: number | null, n: number): Olcum {
  return { value: n > 0 ? value : null, n }
}

/** Ortalama — boş dizide 0 DEĞİL null döner. */
export function ortalama(degerler: number[], basamak = 1): Olcum {
  if (degerler.length === 0) return { value: null, n: 0 }
  const t = degerler.reduce((a, b) => a + b, 0) / degerler.length
  const k = 10 ** basamak
  return { value: Math.round(t * k) / k, n: degerler.length }
}

/** Yüzde — payda 0 ise null (0% ile "veri yok" karışmasın). */
export function yuzde(pay: number, payda: number): Olcum {
  if (payda <= 0) return { value: null, n: 0 }
  return { value: Math.round((pay / payda) * 100), n: payda }
}

/** Dönem parametresi: '30' | '90' | 'all'. Geçersizse 30. */
export function donemGun(ham: string | null): number | null {
  if (ham === 'all') return null
  const n = parseInt(ham ?? '30', 10)
  if (!Number.isFinite(n) || n <= 0) return 30
  return Math.min(n, 3650)
}

/** Dönem başlangıcı; null = tüm zamanlar. */
export function donemBaslangici(gun: number | null): Date | null {
  if (gun === null) return null
  const d = new Date()
  d.setDate(d.getDate() - gun)
  return d
}
