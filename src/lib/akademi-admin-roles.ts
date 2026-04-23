/**
 * Akademi admin rolleri — merkezi liste.
 * Server guard, client hook ve admin layout bu listeyi import eder.
 * Değişiklik burada, 1 yerde.
 */
export const AKADEMI_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "HR_MANAGER",
  "IT_MANAGER",
] as const;

export type AkademiAdminRole = (typeof AKADEMI_ADMIN_ROLES)[number];

export function isAkademiAdminRole(role: string | undefined | null): boolean {
  if (!role) return false;
  return AKADEMI_ADMIN_ROLES.includes(role as AkademiAdminRole);
}
