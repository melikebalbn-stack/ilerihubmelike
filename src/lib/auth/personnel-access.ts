/**
 * Personel (İnsan Varlıkları) erişim kontrolü — TEK kaynak.
 *
 * Önceki durum: 12+ dosyada kopya `isHRDepartment` substring heuristiği
 * (`dept.includes('ik')`) "Fabrika"/"Mühendislik" gibi departmanları YANLIŞ
 * pozitif yakalıyordu (fabr*ik*a / mühendisl*ik*) → yetkisiz PII erişimi.
 *
 * Bu helper substring eşleşmesini KALDIRIR: rol-bazlı + normalize edilmiş
 * TAM "İnsan Varlıkları" departman eşleşmesi (başlangıç). Edge-safe + client-safe
 * (saf string işlemi; node API'si yok) → API route, middleware, server layout
 * ve client component'ten import edilebilir.
 */

export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'] as const

/**
 * TR-normalize: diakritikleri fold + lowercase + boşluk collapse + trim.
 * İ/I/ı→i, ş→s, ğ→g, ç→c, ö→o, ü→u. (Substring değil; tam-önek karşılaştırma için.)
 */
export function normalizeDept(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/[İIı]/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Çç]/g, 'c')
    .replace(/[Öö]/g, 'o')
    .replace(/[Üü]/g, 'u')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Departman İnsan Varlıkları (İK) mı? Normalize sonrası "insan varliklari" ile
 * BAŞLAR mı. Kapsar: "İNSAN VARLIKLARI", "Insan Varliklari Departmanı",
 * "İnsan Varlıkları". KAPSAMAZ: "Fabrika …", "Mühendislik …". includes/substring YOK.
 */
export function isInsanVarliklari(department: string | null | undefined): boolean {
  return normalizeDept(department).startsWith('insan varliklari')
}

/**
 * Personel listesi/PII erişimi: admin rol VEYA İnsan Varlıkları departmanı.
 * (Eski sözleşmeyle aynı: role || İV-dept — ama deterministik.)
 */
export function canAccessPersonnel(
  role: string | null | undefined,
  department: string | null | undefined,
): boolean {
  return ADMIN_ROLES.includes((role ?? '') as (typeof ADMIN_ROLES)[number]) || isInsanVarliklari(department)
}
