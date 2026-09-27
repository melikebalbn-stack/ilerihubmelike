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

/** Eşik parametreleri — IproAyar'dan gelir (genel) + IproTezgahAyar (tezgah istisnası) ile ezilir. */
export interface EsikAyar {
  carpan?: number | null
  taban?: number | null
  tavan?: number | null
}

/**
 * Çevrim saniyesinden eşik: clamp(çarpan × çevrim, taban, tavan). Çevrim yok/≤0 → taban.
 * ayar verilmezse mevcut sabitler (K=3.5, taban=180, tavan=900). Örn çevrim 220 → 770; 400 → tavan.
 * Tezgah istisnası ayar.taban/tavan'ı ezerek geçilir (çağıran birleştirir).
 */
export function esikSaniye(cevrimSn: number | null | undefined, ayar?: EsikAyar): number {
  const carpan = ayar?.carpan != null && ayar.carpan > 0 ? ayar.carpan : K
  const taban = ayar?.taban != null && ayar.taban > 0 ? ayar.taban : ESIK_TABAN_SN
  const tavan = ayar?.tavan != null && ayar.tavan > 0 ? ayar.tavan : ESIK_TAVAN_SN
  if (cevrimSn == null || !(cevrimSn > 0)) return Math.round(taban)
  return Math.round(Math.min(tavan, Math.max(taban, carpan * cevrimSn)))
}

/**
 * Ardışık sayaç okuma zamanlarından (artan) üretim çevrim medyanı. Uzun duruş boşlukları medyanı
 * bozmasın diye üst-sınırlı gap'ler (<= tavan) alınır; hiç kalmazsa tüm gap'lerin medyanı.
 */
export function cevrimMedyaniGaplerden(gapSn: number[]): number | null {
  const uretim = gapSn.filter((g) => g > 0 && g <= ESIK_TAVAN_SN)
  return medyan(uretim.length ? uretim : gapSn.filter((g) => g > 0))
}
