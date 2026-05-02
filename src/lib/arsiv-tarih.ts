/**
 * Arşiv tarih hesaplamaları.
 *
 * Alt koli imha tarihi = dönem sonu + saklama süresi yıl.
 * Ana koli imha tarihi = max(alt koli imha tarihleri).
 *
 * JavaScript setFullYear yıllık aritmetiği handle eder
 * (29 Şubat → 28 Şubat fallback otomatik).
 */

export function addYearsToDate(date: Date, years: number): Date {
  if (!Number.isInteger(years) || years < 0) {
    throw new Error(`Geçersiz yıl sayısı: ${years}`)
  }
  const result = new Date(date.getTime())
  result.setFullYear(result.getFullYear() + years)
  return result
}

/** Alt koli için imha tarihi hesabı. */
export function calculateAltKoliImhaTarihi(
  donemSonu: Date,
  saklamaSuresiYil: number
): Date {
  return addYearsToDate(donemSonu, saklamaSuresiYil)
}

/** Ana koli için imha tarihi (alt kolilerin en uzunundan). */
export function calculateAnaKoliImhaTarihiFromAlt(
  altKoliImhaTarihleri: Date[]
): Date | null {
  if (altKoliImhaTarihleri.length === 0) return null
  return new Date(Math.max(...altKoliImhaTarihleri.map((d) => d.getTime())))
}
