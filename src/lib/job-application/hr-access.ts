// İK (İnsan Varlıkları) — iş başvurusu özel-nitelikli veri erişim kuralı.
// PersonnelSensitive deseni BİREBİR: rol-gate + TC maskeleme.

export const VIEW_ROLES = ["ADMIN", "HR_MANAGER", "SUPER_ADMIN"] as const;

/** Sağlık/KVKK bölümünü görebilir mi? (User.role) */
export function canViewJobAppSensitive(role: string | null | undefined): boolean {
  return !!role && (VIEW_ROLES as readonly string[]).includes(role);
}

/** TC maskeleme — PersonnelSensitive maskValue ile aynı (ilk 3 + **** + son 3). */
export function maskTc(tc: string | null | undefined): string | null {
  if (!tc) return null;
  if (tc.length <= 6) return "***";
  return tc.substring(0, 3) + "****" + tc.substring(tc.length - 3);
}
