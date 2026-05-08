/**
 * @deprecated PR-Y5a (2026-05-08) sonrası kullanılmıyor.
 *
 * Akademi yetki kontrolü artık RBAC permission tabanlı:
 * - Server: `requireAkademiAdmin()` (akademi-admin-guard.ts) veya
 *   `hasPermission('akademi.admin')`
 * - Client: `useAkademiAuth()` veya
 *   `session.user.permissions.includes('akademi.admin')`
 *
 * Bu dosya geriye dönük uyum için bırakıldı (unutulmuş external import'lar
 * build kırmasın). PR-Y5c-CLEANUP ile tamamen kaldırılacak.
 */

/** @deprecated PR-Y5a: enum check kullanılmıyor */
export const AKADEMI_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "HR_MANAGER",
  "IT_MANAGER",
] as const;

/** @deprecated PR-Y5a: enum check kullanılmıyor */
export type AkademiAdminRole = (typeof AKADEMI_ADMIN_ROLES)[number];

/**
 * @deprecated PR-Y5a: `hasPermission('akademi.admin')` veya
 * `requireAkademiAdmin()` kullanın.
 */
export function isAkademiAdminRole(role: string | undefined | null): boolean {
  if (!role) return false;
  return AKADEMI_ADMIN_ROLES.includes(role as AkademiAdminRole);
}
