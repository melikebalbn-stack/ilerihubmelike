import { prisma } from '@/lib/prisma'
import { isIvBolumuFk } from '@/lib/auth/iv-bolum-fk'

// Menü yönetim yetkisi: HR/Admin rolleri VEYA İnsan Varlıkları bölümü (Melih onayı).
// Tek doğruluk kaynağı — import + POST + DELETE aynı kuralı kullanır.
const MENU_ROLES: string[] = ['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']

export async function canManageMenu(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, personnel: { select: { bolum: true, departmentId: true } } },
  })
  if (!user) return false
  if (MENU_ROLES.includes(user.role)) return true
  // FAZ 3a: karar Personnel.departmentId FK'sından. FK boşsa (pasif kayıt / FK'dan
  // önceki veri) eski normalize önek eşleşmesine düşülür — davranış birebir aynı.
  return isIvBolumuFk(user.personnel?.departmentId, user.personnel?.bolum)
}
