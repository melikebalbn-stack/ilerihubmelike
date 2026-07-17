import { prisma } from '@/lib/prisma'

export type BulkCardScanAccessLevel = 'NONE' | 'FULL' | 'GRI'

export interface BulkCardScanAccess {
  level: BulkCardScanAccessLevel
  personnelId: string | null
  /** GRI kullanıcının kendi Personnel.bolum değeri — bağlı personel kapsamı bunun üzerinden kurulur. */
  bolum: string | null
}

const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN']

/**
 * Toplu Kart Okutamama yetki seviyesi — Personnel.yakaRengi'ye göre:
 *   BEYAZ -> FULL (tüm kayıtları görür/düzenler/siler)
 *   MAVI  -> NONE (forma hiç erişemez)
 *   GRI   -> GRI  (formu doldurabilir; kendi bölümündeki (Personnel.bolum) personel
 *                  ve kayıtlar üzerinde çalışır)
 * Ayrıca SUPER_ADMIN/ADMIN (legacy UserRoleEnum) Personnel bağlantısından
 * bağımsız olarak FULL sayılır (diğer formlardaki admin-her-zaman-erişir
 * kuralıyla tutarlı).
 *
 * "Bana bağlı personel" kapsamı BİRİM SORUMLUSU alanlarından (isim eşleştirmesi)
 * TÜRETİLMİYOR (bu yöntem yanlış bulundu) — bunun yerine GRI kullanıcının kendi
 * Personnel.bolum'u ile aynı bölümdeki personel esas alınır.
 */
export async function getBulkCardScanAccess(userId: string): Promise<BulkCardScanAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, personnelId: true, personnel: { select: { id: true, yakaRengi: true, bolum: true } } },
  })

  const yakaRengi = user?.personnel?.yakaRengi
  const personnelId = user?.personnel?.id ?? null
  const bolum = user?.personnel?.bolum ?? null

  if (user && FULL_ACCESS_ROLES.includes(user.role)) {
    return { level: 'FULL', personnelId, bolum }
  }
  if (yakaRengi === 'BEYAZ') {
    return { level: 'FULL', personnelId, bolum }
  }
  if (yakaRengi === 'MAVI') {
    return { level: 'NONE', personnelId, bolum }
  }
  if (yakaRengi === 'GRI') {
    return { level: 'GRI', personnelId, bolum }
  }

  // Personnel kaydı yok veya yakaRengi tanınmıyor (ör. sadece User hesabı var,
  // Personnel bağlantısı yok) -> erişim yok.
  return { level: 'NONE', personnelId, bolum }
}
