import { prisma } from '@/lib/prisma'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'

// Menü yönetim yetkisi: HR/Admin rolleri VEYA İnsan Varlıkları bölümü (Melih onayı).
// Tek doğruluk kaynağı — import + POST + DELETE aynı kuralı kullanır.
const MENU_ROLES: string[] = ['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']

export async function canManageMenu(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, personnel: { select: { bolum: true } } },
  })
  if (!user) return false
  if (MENU_ROLES.includes(user.role)) return true
  // Bölüm adı SABİT LİSTEDEN değil, normalize önek eşleşmesiyle (tek kaynak
  // personnel-access.ts). "İNSAN VARLIKLARI" / "İnsan Varlıkları Müdürlüğü" gibi
  // yazım ve ek farkları kırmaz; DB'de ad değişse de çalışır.
  return isInsanVarliklari(user.personnel?.bolum)
}
