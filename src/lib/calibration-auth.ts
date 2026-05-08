// Kalibrasyon modülü yetkilendirme helper'ları

/**
 * Türkçe karakterleri normalize et (karşılaştırma için)
 */
function normalizeTurkish(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/İ/gi, 'i')
    .trim()
}

/**
 * Verilen departman/ou değeri Kalite departmanına ait mi?
 * "kalite" kelimesini içeriyorsa veya Laboratuvar ise true döner.
 */
function isKaliteDepartment(value: string | null | undefined): boolean {
  if (!value) return false
  const normalized = normalizeTurkish(value)
  // "kalite" kelimesini içeren herhangi bir departman
  if (normalized.includes('kalite')) return true
  // Laboratuvar da Kalite'ye bağlı
  if (normalized.includes('laboratuvar')) return true
  return false
}

/**
 * Kullanıcının kalibrasyon verilerini düzenleyip düzenleyemeyeceğini kontrol eder.
 *
 * PR-Y6a: Dual-check tampon. RBAC permission önceliklidir; eski enum +
 * departman mantığı geriye dönük uyum için fallback olarak korundu.
 *
 * Öncelik sırası:
 * 1. permissions array'inde 'kalibrasyon.admin' var → ✅ (Y3c matrisi yönetir)
 * 2. ADMIN / SUPER_ADMIN / QUALITY_MANAGER enum → ✅ (legacy)
 * 3. ou veya department contains 'kalite'/'laboratuvar' → ✅ (legacy, departman-bazlı)
 *
 * permissions parametresi opsiyonel — verilmezse sadece legacy mantık çalışır
 * (cross-module çağrılar veya geçici eski kod). Yeni çağrılarda
 * session.user.permissions geçilmeli.
 *
 * Long-term plan (Y6c): Kalite departmanındaki proper rol atamaları yapıldıktan
 * sonra departman fallback kaldırılır, sadece permission kalır.
 */
export function canEditCalibration(
  role?: string | null,
  ou?: string | null,
  department?: string | null,
  permissions?: string[] | null,
): boolean {
  // Öncelik 1: RBAC permission (Y3c matrisinde yönetilir)
  if (permissions && permissions.includes('kalibrasyon.admin')) return true

  const userRole = role || 'EMPLOYEE'

  // Öncelik 2: Legacy enum check
  if (['ADMIN', 'SUPER_ADMIN'].includes(userRole)) return true
  if (userRole === 'QUALITY_MANAGER') return true

  // Öncelik 3: Legacy departman-bazlı (Kalite + Laboratuvar)
  if (isKaliteDepartment(ou) || isKaliteDepartment(department)) return true

  return false
}
