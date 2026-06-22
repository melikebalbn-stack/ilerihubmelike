/**
 * Çalışan rehberi gibi geniş erişimli endpoint'lerde kullanılır.
 * Sadece kurumsal (ilerigroup.com) email'leri açığa çıkarır.
 *
 *   - bluecollar placeholder     → null
 *   - kişisel email (gmail vs)   → null
 *   - kurumsal (ilerigroup.com)  → olduğu gibi
 *   - null / undefined           → null
 *
 * KVKK Madde 4 (veri minimizasyonu) — PR-DIRECTORY-KVKK-A.
 *
 * Not: Bu helper geniş erişimli PII filtresidir. İK/manager için kişisel
 * email gösterimi PR-DIRECTORY-KVKK-B'de RBAC permission ile yapılacak.
 */

export const BLUECOLLAR_PLACEHOLDER_DOMAIN = 'bluecollar.ilerigroup.com'
export const CORPORATE_DOMAIN = 'ilerigroup.com'

export function publicCorporateEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const normalized = email.toLowerCase().trim()
  if (normalized.endsWith(`@${BLUECOLLAR_PLACEHOLDER_DOMAIN}`)) return null
  if (normalized.endsWith(`@${CORPORATE_DOMAIN}`)) return email
  return null
}
