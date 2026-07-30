/**
 * Kalite/Ayarlar erişim kontrolü — /settings ve /fire-safety layout guard'ları için.
 *
 * ⚠ Bu koşul middleware.ts:57-58'deki mevcut mantığın BİREBİR kopyasıdır (davranış taşıma).
 *   Substring `.includes('kalite'|'laboratuvar')` KASITLI korundu — normalize/önek'e
 *   ÇEVRİLMEDİ (davranış değişikliği bu turun kapsamı dışında). Kopya temizliği (middleware +
 *   settings/page.tsx inline'ları) ayrı bir adımda.
 */

export const KALITE_ROLLERI = ['ADMIN', 'SUPER_ADMIN', 'QUALITY_MANAGER'] as const

/** Rol, Kalite/Ayarlar rol setinde mi (dept istisnası YOK — /fire-safety bunu kullanır). */
export function isKaliteRol(role: string | null | undefined): boolean {
  return KALITE_ROLLERI.includes((role ?? '') as (typeof KALITE_ROLLERI)[number])
}

/**
 * /settings erişimi: Kalite rolü VEYA Kalite/Laboratuvar departmanı (department **veya** ou).
 * middleware.ts:42 (roller) + 57-58 (dept/ou substring) ile birebir.
 */
export function canAccessKalite(
  role: string | null | undefined,
  department: string | null | undefined,
  ou: string | null | undefined,
): boolean {
  if (isKaliteRol(role)) return true
  const dept = (department ?? '').toLowerCase()
  const o = (ou ?? '').toLowerCase()
  return (
    dept.includes('kalite') ||
    dept.includes('laboratuvar') ||
    o.includes('kalite') ||
    o.includes('laboratuvar')
  )
}
