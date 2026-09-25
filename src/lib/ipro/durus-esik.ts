/**
 * Otomatik duruş eşiği — SAF fonksiyonlar (DB'siz test). Sinyalli tezgahta sayaç bu süreden uzun
 * durursa OTO duruş açılır. Eşik ÇEVRİME BAĞLI (relatif): tezgah çevrimleri 15sn→220sn arası
 * (>14× fark) olduğundan sabit eşik yanlış-pozitif üretir. clamp(K×çevrim, taban, tavan).
 *
 * DB tarafı (çevrim medyanı + IFS fallback) oto-durus.ts'te; burada yalnız matematik.
 */
export const K = 3.5
export const ESIK_TABAN_SN = 180 // mikro-duruş sınırı: altındaki boşluk normal çevrim salınımı (HAREKET_PENCERESI ile hizalı)
export const ESIK_TAVAN_SN = 900 // 15 dk; ötesi zaten net duruş, geciktirme gerekmez

/** Sıralı olması gerekmez; kopya alıp sıralar. Boş → null. */
export function medyan(xs: number[]): number | null {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q)
  if (a.length === 0) return null
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

/**
 * Çevrim saniyesinden eşik: clamp(K × çevrim, taban, tavan). Çevrim yok/≤0 → taban (180).
 * Örn çevrim 15 → 3.5×15=52 → taban 180; çevrim 220 → 770; çevrim 400 → 1400 → tavan 900.
 */
export function esikSaniye(cevrimSn: number | null | undefined): number {
  if (cevrimSn == null || !(cevrimSn > 0)) return ESIK_TABAN_SN
  return Math.round(Math.min(ESIK_TAVAN_SN, Math.max(ESIK_TABAN_SN, K * cevrimSn)))
}

/**
 * Ardışık sayaç okuma zamanlarından (artan) üretim çevrim medyanı. Uzun duruş boşlukları medyanı
 * bozmasın diye üst-sınırlı gap'ler (<= tavan) alınır; hiç kalmazsa tüm gap'lerin medyanı.
 */
export function cevrimMedyaniGaplerden(gapSn: number[]): number | null {
  const uretim = gapSn.filter((g) => g > 0 && g <= ESIK_TAVAN_SN)
  return medyan(uretim.length ? uretim : gapSn.filter((g) => g > 0))
}
