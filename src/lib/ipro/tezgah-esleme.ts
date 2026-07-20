/**
 * IFS tezgah eşleştirmesi — SAF fonksiyonlar (server-only YOK).
 *
 * Hem cron/senkron katmanı (tezgah-sync.ts) hem elle koşulan script
 * (ifs-tezgah-hizala.ts) bu tek kaynağı kullanır. IFS'ten ve Prisma'dan
 * bağımsız olduğu için script (tsx CLI) de import edebilir.
 */

export type IfsResource = { rid: string; wc: string; desc: string }

/** Kod sonrası harf/rakam GELMEMELİ → PH08 ≠ PH081. */
export function startsWithKod(desc: string, kod: string): boolean {
  const d = desc.toUpperCase()
  const k = kod.toUpperCase()
  if (!d.startsWith(k)) return false
  const next = d.charAt(k.length)
  return next === '' || !/[A-Z0-9]/.test(next)
}

/** "PH011 - 150 TON PRES" → "PH011" */
export function kodCikar(desc: string): string | null {
  const m = desc.match(/^([A-Z]{1,3}[0-9]{1,4}(?:-[0-9]+)?)\s*[-–]/i)
  return m ? m[1].toUpperCase() : null
}

/**
 * Sıfır-dolgulu kodu sadeleştirir: PH011 → PH11, PE010 → PE10. MM04/PK09 gibi
 * 2-haneli gerçek kodlara DOKUNMAZ (null). Ayrım: harf öbeği + '0' + ardından
 * EN AZ İKİ hane. IFS'in 3-haneye pad deseni böyle; bizim kodlar 2-haneli.
 *   PH011 = PH·0·11 ✓   PE010 = PE·0·10 ✓   MM04 = MM·0·4 (tek hane) → null
 */
export function sifirsiz(kod: string): string | null {
  const m = kod.match(/^([A-Z]+)0([1-9][0-9]+)$/i) // 0 + EN AZ 2 hane
  if (!m) return null
  return `${m[1].toUpperCase()}${m[2]}`
}

/** Planlama WC'si veya fason kaydı mı? Makine değil → senkrona girmez. */
export function makineDegil(r: IfsResource): boolean {
  return /^(W[A-Z]{2}\d*|WYD|FSN)$/i.test(r.rid) || /^9000\d$/.test(r.rid)
}

/** IFS açıklamasından tezgah adını çıkar ("MM04 - MATKAP1" → "MATKAP1"). */
export function adCikar(desc: string): string {
  const k = kodCikar(desc)
  if (!k) return desc
  return desc.replace(/^[^-–]+[-–]\s*/, '').trim() || desc
}
