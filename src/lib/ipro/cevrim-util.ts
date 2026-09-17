// IFS çevrim (RunTime) → saniye/adet dönüşümü. TEK KAYNAK: OEE motoru (oee-hesap),
// terminal route (/api/terminal/uretim/tezgah/[id]) ve terminal modal (_tezgah-detay)
// aynı mantığı paylaşır. SAF fonksiyon — client & server'da güvenli (bağımlılık yok).

/**
 * IFS çevrim faktörü + RunTimeCode → saniye/adet.
 * UnitsHour (adet/saat) → 3600/faktör; HoursUnit (saat/adet) → faktör*3600.
 * Faktör yok/0 veya bilinmeyen kod → null.
 */
export function cevrimSaniye(faktor: number | null | undefined, kod: string | null | undefined): number | null {
  if (!faktor || faktor <= 0) return null
  if (kod === 'UnitsHour') return 3600 / faktor
  if (kod === 'HoursUnit') return faktor * 3600
  return null
}

/**
 * TERS dönüşüm: saniye/adet → IFS çevrim faktörü + RunTimeCode.
 * HoursUnit (saat/adet) yönünde: faktör = saniye/3600. cevrimSaniye ile TAM round-trip yapar
 * (cevrimSaniye(saniye/3600, 'HoursUnit') === saniye). Saniye yok/0 → null.
 * MAS CycleTime (saniye/adet) → ifsMachRunFactor/ifsRunTimeCode yazımı için.
 */
export function saniyeToCevrim(saniye: number | null | undefined): { faktor: number; kod: 'HoursUnit' } | null {
  if (!saniye || saniye <= 0) return null
  return { faktor: saniye / 3600, kod: 'HoursUnit' }
}

/**
 * Ekranda gösterim için çevrim metni: ham faktör+kod DEĞİL, saniyeye çevrilmiş + adet/saat.
 * cevrimSaniye ile tek kaynak (ikinci hesap yok). Örn (0.019444, 'HoursUnit') → "70 sn · 51,4 adet/saat".
 * Çevrilemezse null (çağıran "—" gösterir).
 */
export function cevrimMetni(faktor: number | null | undefined, kod: string | null | undefined): string | null {
  const sn = cevrimSaniye(faktor, kod)
  if (sn == null) return null
  const snStr = sn.toLocaleString('tr-TR', { maximumFractionDigits: sn < 10 ? 1 : 0 })
  const adetSaat = (3600 / sn).toLocaleString('tr-TR', { maximumFractionDigits: 1 })
  return `${snStr} sn · ${adetSaat} adet/saat`
}
