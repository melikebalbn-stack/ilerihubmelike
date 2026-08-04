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

// ── DÜZENLEME yetkisi — TEK KAYNAK (buton + PUT aynı kuralı kullanır, asimetri olmaz).
// Legacy rol ADMIN/SUPER_ADMIN VEYA İnsan Varlıkları bölümü.
export const SENSITIVE_EDIT_ROLES = ['ADMIN', 'SUPER_ADMIN']

// Bölüm İK mi? İki farklı kaynak yakalanır: Personnel.bolum ("İNSAN VARLIKLARI" /
// "İNSAN VARLIKLARI MÜDÜRLÜĞÜ") ve User.department ("İnsan Varliklari Departmanı").
// NFD-normalize + aksan-strip + lowercase → Türkçe İ/i + "Departmanı"/"Müdürlüğü"
// eki toleransı (can-manage-menu deseni). 'insan varliklari' contains ile eşle.
function normBolum(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function isIkBolum(bolum: string | null | undefined): boolean {
  return normBolum(bolum).includes('insan varliklari')
}

export function canEditSensitive(
  role: string | null | undefined,
  bolum: string | null | undefined,
): boolean {
  if (role && SENSITIVE_EDIT_ROLES.includes(role)) return true
  return isIkBolum(bolum)
}
