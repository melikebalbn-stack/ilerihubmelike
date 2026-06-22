/**
 * Quality result computation (KALITE-2)
 *
 * Server-side authoritative — client'ın hesaplamasını override eder.
 */

export type CharResult = 'PENDING' | 'OK' | 'RED'

/**
 * Bir karakteristik için sonuç:
 *   - Hiç ölçüm yok → PENDING
 *   - hasNumericRange=false (görsel kontrol) → OK
 *   - Herhangi bir ölçüm range dışında → RED
 *   - Hepsi range içinde → OK
 *
 * measurements: 10 elementli array, her biri Decimal string veya null/empty.
 * maxValue/minValue: Decimal string veya null.
 */
export function computeCharResult(
  measurements: ReadonlyArray<string | null>,
  maxValue: string | null,
  minValue: string | null,
  hasNumericRange: boolean,
): CharResult {
  const filled = measurements.filter((m) => m !== null && m !== '') as string[]
  if (filled.length === 0) return 'PENDING'

  // Görsel kontrol — ölçüm yapılmış sayılırsa OK
  if (!hasNumericRange) return 'OK'

  // Range yoksa hesaplanamıyor — PENDING bırak (template incomplete)
  if (maxValue === null || minValue === null) return 'PENDING'

  const max = parseFloat(maxValue.replace(',', '.'))
  const min = parseFloat(minValue.replace(',', '.'))
  if (!Number.isFinite(max) || !Number.isFinite(min)) return 'PENDING'

  for (const raw of filled) {
    const v = parseFloat(raw.replace(',', '.'))
    if (!Number.isFinite(v)) continue
    if (v < min || v > max) return 'RED'
  }
  return 'OK'
}

/**
 * Rapor sonucu:
 *   - Herhangi bir karakteristik RED → RED
 *   - Herhangi biri PENDING → PENDING
 *   - Hepsi OK → OK
 */
export function computeReportResult(charResults: ReadonlyArray<CharResult>): CharResult {
  if (charResults.length === 0) return 'PENDING'
  if (charResults.includes('RED')) return 'RED'
  if (charResults.includes('PENDING')) return 'PENDING'
  return 'OK'
}
