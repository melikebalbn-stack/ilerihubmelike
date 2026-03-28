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
 * ADMIN rolü, Kalite departmanı veya QUALITY_MANAGER rolü düzenleyebilir.
 */
export function canEditCalibration(
  role?: string | null,
  ou?: string | null,
  department?: string | null,
): boolean {
  const userRole = role || 'EMPLOYEE'

  // ADMIN ve SUPER_ADMIN her zaman düzenleyebilir
  if (['ADMIN', 'SUPER_ADMIN'].includes(userRole)) return true

  // QUALITY_MANAGER rolü düzenleyebilir (departmandan bağımsız)
  if (userRole === 'QUALITY_MANAGER') return true

  // Kalite departmanı (ou veya department) düzenleyebilir
  if (isKaliteDepartment(ou) || isKaliteDepartment(department)) return true

  return false
}
