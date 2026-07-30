import { prisma } from '@/lib/prisma'

// Menü yönetim yetkisi: HR/Admin rolleri VEYA İnsan Varlıkları bölümü (Melih onayı).
// Tek doğruluk kaynağı — import + POST + DELETE aynı kuralı kullanır.
const MENU_ROLES: string[] = ['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']
const IV_BOLUMLER: string[] = ['İNSAN VARLIKLARI', 'İNSAN VARLIKLARI MÜDÜRLÜĞÜ']

export async function canManageMenu(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, personnel: { select: { bolum: true } } },
  })
  if (!user) return false
  if (MENU_ROLES.includes(user.role)) return true
  const bolum = user.personnel?.bolum ?? ''
  return IV_BOLUMLER.includes(bolum)
}
