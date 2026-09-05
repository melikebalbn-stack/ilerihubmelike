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
