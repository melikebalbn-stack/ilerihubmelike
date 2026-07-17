import { prisma } from '@/lib/prisma'

export type BulkCardScanAccessLevel = 'NONE' | 'FULL' | 'GRI'

export interface BulkCardScanAccess {
  level: BulkCardScanAccessLevel
  personnelId: string | null
  /** GRI kullanıcının kendi Personnel.bolum değeri — bağlı personel kapsamı bunun üzerinden kurulur. */
  bolum: string | null
}

const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN']

// Beyaz Yaka'nın TAMAMI değil, sadece bu bölümlerdeki personel FULL erişim alır.
// SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ şimdilik (test/geliştirme amaçlı) dahil — asıl
// sahiplik İnsan Varlıkları'nda, bu ikinci bölüm daha sonra kaldırılabilir.
const FULL_ACCESS_BOLUMLER = ['İNSAN VARLIKLARI', 'SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ']

/**
 * Toplu Kart Okutamama yetki seviyesi:
 *   - Personnel.bolum İnsan Varlıkları veya Sistem Geliştirme Müdürlüğü ise -> FULL
 *     (Beyaz Yaka'nın TAMAMI değil, sadece bu bölümler — diğer beyaz yaka bölümleri
 *     bu forma erişemez)
 *   - MAVI  -> NONE (forma hiç erişemez)
 *   - GRI   -> GRI  (formu doldurabilir; kendi bölümündeki (Personnel.bolum) personel
 *                    ve kayıtlar üzerinde çalışır)
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
  if (bolum && FULL_ACCESS_BOLUMLER.includes(bolum)) {
    return { level: 'FULL', personnelId, bolum }
  }
  if (yakaRengi === 'MAVI') {
    return { level: 'NONE', personnelId, bolum }
  }
  if (yakaRengi === 'GRI') {
    return { level: 'GRI', personnelId, bolum }
  }

  // Beyaz Yaka ama İnsan Varlıkları/Sistem Geliştirme dışında, ya da Personnel
  // kaydı/yakaRengi hiç yok -> erişim yok.
  return { level: 'NONE', personnelId, bolum }
}
