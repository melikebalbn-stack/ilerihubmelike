/**
 * Hikvision erişim kontrolü olay kodu (major/minor) → PDKS cihaz-olay sınıfı.
 *
 * Varsayılanlar Hikvision ISAPI "Access Control Event" tablosundandır (major 5 = olay).
 * GERÇEK DS-K2604T kodları Faz 0'da test okutmalarıyla doğrulanacak; kod DEPLOY'SUZ düzeltilebilir:
 *   SystemSetting `pdks_olay_esleme` = {"5:75":"KART_GECTI","1:1024":"YANGIN_ALARMI", ...}
 * Eşlemede olmayan kod → DIGER (ham major/minor saklanır; hiçbir olay atılmaz).
 *
 * Bu sınıf CİHAZIN ne dediğidir. Hub olay tipi (GECERLI_KART / TANIMSIZ_KART / PASIF_KART / ...)
 * olay-alim.ts'te bu sınıf + Hub'daki kart durumu ile belirlenir.
 */

export type CihazOlaySinifi = 'KART_GECTI' | 'KART_RED' | 'GECIS_SENSORU' | 'YANGIN_ALARMI' | 'DIGER'
export const CIHAZ_OLAY_SINIFLARI: readonly CihazOlaySinifi[] = ['KART_GECTI', 'KART_RED', 'GECIS_SENSORU', 'YANGIN_ALARMI', 'DIGER']
export const OLAY_ESLEME_ANAHTARI = 'pdks_olay_esleme'

/** Varsayılan eşleme — "major:minor". */
export const VARSAYILAN_OLAY_ESLEME: Readonly<Record<string, CihazOlaySinifi>> = {
  '5:1': 'KART_GECTI', // 0x01 geçerli kart ile geçiş
  '5:2': 'KART_GECTI', // 0x02 kart + şifre ile geçiş
  '5:6': 'KART_RED', // 0x06 kartın bu kapıya yetkisi yok
  '5:7': 'KART_RED', // 0x07 kart geçerlilik saati dışında
  '5:8': 'KART_RED', // 0x08 kartın süresi dolmuş
  '5:9': 'KART_RED', // 0x09 kart panelde tanımlı değil
  '5:21': 'GECIS_SENSORU', // 0x15 kapı/turnike sensörü açıldı ("geçti") — Faz 0'da doğrulanacak
  '1:1034': 'YANGIN_ALARMI', // alarm girişi (yangın) — Faz 0'da doğrulanacak
}

export type OlayEsleme = Record<string, CihazOlaySinifi>

/** Varsayılan + SystemSetting JSON üstüne yazar. Bozuk JSON / tanınmayan sınıf YOK SAYILIR (varsayılan kalır). */
export function olayEslemeBirlestir(ayarJson: string | null | undefined): { esleme: OlayEsleme; uyarilar: string[] } {
  const esleme: OlayEsleme = { ...VARSAYILAN_OLAY_ESLEME }
  const uyarilar: string[] = []
  if (!ayarJson) return { esleme, uyarilar }
  let ek: unknown
  try {
    ek = JSON.parse(ayarJson)
  } catch {
    return { esleme, uyarilar: [`${OLAY_ESLEME_ANAHTARI} geçerli JSON değil — varsayılan kullanılıyor`] }
  }
  if (!ek || typeof ek !== 'object' || Array.isArray(ek)) {
    return { esleme, uyarilar: [`${OLAY_ESLEME_ANAHTARI} bir nesne olmalı — varsayılan kullanılıyor`] }
  }
  for (const [k, v] of Object.entries(ek as Record<string, unknown>)) {
    if (!/^\d+:\d+$/.test(k)) {
      uyarilar.push(`anahtar "${k}" "major:minor" biçiminde değil — atlandı`)
      continue
    }
    if (typeof v !== 'string' || !(CIHAZ_OLAY_SINIFLARI as readonly string[]).includes(v)) {
      uyarilar.push(`"${k}" için sınıf "${String(v)}" tanınmıyor — atlandı`)
      continue
    }
    esleme[k] = v as CihazOlaySinifi
  }
  return { esleme, uyarilar }
}

export function cihazOlaySinifi(esleme: OlayEsleme, major: number, minor: number): CihazOlaySinifi {
  return esleme[`${major}:${minor}`] ?? 'DIGER'
}
