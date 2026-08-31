// Hassas personel verisi (TC/SGK/banka) GÖRÜNTÜLEME yetkisi — TEK KAYNAK.
import { normalizeDept } from '@/lib/auth/personnel-access'
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
// "İnsan Varlıkları Müdürlüğü") ve User.department ("İnsan Varliklari Departmanı").
//
// NORMALIZE TEK KAYNAK: personnel-access.ts · normalizeDept (İ/I/ı→i, ş→s, ğ→g, …).
// Eskiden burada NFD + aksan-strip kullanılıyordu; NFD noktasız "ı" (U+0131) harfini
// ÇÖZMEDİĞİ için "İnsan Varlıkları Müdürlüğü" değeri "insan varlıkları …" olarak
// normalize oluyor ve eşleşme SESSİZCE düşüyordu (30.08 bölüm adı değişikliğinden
// sonra 10 aktif kişi hassas veri düzenleyemedi). Artık tek normalize kullanılıyor.
export function isIkBolum(bolum: string | null | undefined): boolean {
  return normalizeDept(bolum).includes('insan varliklari')
}

export function canEditSensitive(
  role: string | null | undefined,
  bolum: string | null | undefined,
): boolean {
  if (role && SENSITIVE_EDIT_ROLES.includes(role)) return true
  return isIkBolum(bolum)
}
