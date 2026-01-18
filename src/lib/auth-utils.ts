// Yetkilendirme yardımcı fonksiyonları

// Admin email listesi - bu liste veritabanından veya environment'dan okunabilir
const SUPER_ADMIN_EMAILS = [
  'melih.dilben@ilerigroup.com',
]

// Admin rolleri
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN']
const QUALITY_ROLES = ['QUALITY_MANAGER', 'ADMIN', 'SUPER_ADMIN']

/**
 * Kullanıcının admin olup olmadığını kontrol eder
 * @param email - Kullanıcı email adresi
 * @param role - Kullanıcı rolü
 * @returns true eğer admin ise
 */
export function isAdmin(email: string | null | undefined, role: string | null | undefined): boolean {
  if (!email) return false

  const normalizedEmail = email.toLowerCase()
  const userRole = role || 'EMPLOYEE'

  // Super admin email listesinde mi?
  if (SUPER_ADMIN_EMAILS.includes(normalizedEmail)) {
    return true
  }

  // Admin rolüne sahip mi?
  return ADMIN_ROLES.includes(userRole)
}

/**
 * Kullanıcının süper admin olup olmadığını kontrol eder
 * @param email - Kullanıcı email adresi
 * @param role - Kullanıcı rolü
 * @returns true eğer süper admin ise
 */
export function isSuperAdmin(email: string | null | undefined, role: string | null | undefined): boolean {
  if (!email) return false

  const normalizedEmail = email.toLowerCase()
  const userRole = role || 'EMPLOYEE'

  // Super admin email listesinde mi?
  if (SUPER_ADMIN_EMAILS.includes(normalizedEmail)) {
    return true
  }

  // SUPER_ADMIN rolüne sahip mi?
  return userRole === 'SUPER_ADMIN'
}

/**
 * Kullanıcının kalite yöneticisi yetkilerine sahip olup olmadığını kontrol eder
 * @param role - Kullanıcı rolü
 * @returns true eğer kalite yöneticisi veya üstü ise
 */
export function hasQualityManagerAccess(role: string | null | undefined): boolean {
  const userRole = role || 'EMPLOYEE'
  return QUALITY_ROLES.includes(userRole)
}

/**
 * Kullanıcının belirli rollere sahip olup olmadığını kontrol eder
 * @param role - Kullanıcı rolü
 * @param allowedRoles - İzin verilen roller
 * @returns true eğer kullanıcı izin verilen rollerden birine sahipse
 */
export function hasRole(role: string | null | undefined, allowedRoles: string[]): boolean {
  const userRole = role || 'EMPLOYEE'
  return allowedRoles.includes(userRole)
}
