// Helpdesk modülü yetkilendirme helper'ı
// PR-Y9a: Dual-check tampon (Y6 Kalibrasyon pattern'iyle aynı yaklaşım)

/**
 * Kullanıcının helpdesk IT staff yetkisine sahip olup olmadığını kontrol eder.
 *
 * Bu yetki kapsamı:
 * - Tüm ticket'ları görme (sadece kendi değil)
 * - Ticket atama, çözüm, durum güncelleme
 * - Internal yorum okuma/yazma
 * - Reports ve stats erişimi
 *
 * PR-Y9a: Dual-check tampon. RBAC permission önceliklidir; eski enum +
 * departman mantığı geriye dönük uyum için fallback olarak korundu.
 *
 * Öncelik sırası:
 * 1. permissions array'inde 'helpdesk.admin' var → ✅ (Y3c matrisi yönetir)
 * 2. IT_MANAGER / ADMIN / SUPER_ADMIN enum → ✅ (legacy)
 * 3. department contains 'sistem'/'bilgi teknoloji'/'information' → ✅
 *    (legacy, Sistem Geliştirme Departmanı user'ları)
 *
 * permissions parametresi opsiyonel — verilmezse sadece legacy mantık çalışır.
 *
 * Long-term plan (Y9c): Sistem Geliştirme departmanındaki proper rol
 * atamaları yapıldıktan sonra (Enes vb. it-admin slug'ı) departman + enum
 * fallback'leri kaldırılır, sadece permission kalır.
 */
export function isHelpdeskStaff(
  role?: string | null,
  department?: string | null,
  permissions?: string[] | null,
): boolean {
  // Öncelik 1: RBAC permission (Y3c matrisinde yönetilir)
  if (permissions && permissions.includes('helpdesk.admin')) return true

  // Öncelik 2: Legacy enum check
  if (role && ['IT_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) return true

  // Öncelik 3: Legacy departman-bazlı (Sistem Geliştirme + IT)
  if (department) {
    const dept = department.toLowerCase()
    if (
      dept.includes('sistem') ||
      dept.includes('bilgi teknoloji') ||
      dept.includes('information')
    ) {
      return true
    }
  }

  return false
}
