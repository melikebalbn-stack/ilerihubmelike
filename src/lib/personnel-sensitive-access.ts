// Hassas personel verisi (TC/SGK/banka) GÖRÜNTÜLEME yetkisi — TEK KAYNAK.
// Hem API route (server) hem sayfa (client) bunu kullanır → sapma olmaz.
//
// Kök sebep: eskiden yalnız legacy `User.role` (VIEW_ROLES) kontrol ediliyordu.
// LDAP İK→HR_MANAGER dalı yalnız MÜDÜR unvanına verildiğinden İK SORUMLUSU (Gökçe)
// legacy EMPLOYEE kalıp hassas veriyi açamıyordu. Artık RBAC de kabul edilir:
// RBAC "HR Yöneticisi" rolüne özel `calisanrehberi.admin` permission'ı yeterli.
// (İK-departmanı geneli KASTEN kabul edilmiyor — çok geniş, KVKK riski.)

// Geriye uyum: legacy rolü zaten yeterli olanlar (iki İK Müdürü) görmeye devam eder.
export const SENSITIVE_VIEW_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

// RBAC sinyali: yalnız "HR Yöneticisi" rolüne atanan permission (dar; İK-özel).
export const SENSITIVE_VIEW_PERMISSION = 'calisanrehberi.admin'

export function canViewSensitive(
  role: string | null | undefined,
  permissions: string[] | null | undefined,
): boolean {
  if (role && SENSITIVE_VIEW_ROLES.includes(role)) return true
  return !!permissions?.includes(SENSITIVE_VIEW_PERMISSION)
}
