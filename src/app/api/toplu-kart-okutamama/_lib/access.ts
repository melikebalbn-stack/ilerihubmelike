import { prisma } from '@/lib/prisma'

export type BulkCardScanAccessLevel = 'NONE' | 'FULL' | 'GRI' | 'SELF'

export interface BulkCardScanAccess {
  level: BulkCardScanAccessLevel
  personnelId: string | null
  /** GRI kullanıcının kendi Personnel.bolum değeri — bağlı personel kapsamı bunun üzerinden kurulur. */
  bolum: string | null
  /**
   * FULL erişimi olsa bile KENDİ kaydı için müdür onayından geçmesi gereken
   * bölümler için true (örn. Sistem Geliştirme). İV bu kuraldan muaftır —
   * İK zaten onay bildirimlerinin nihai alıcısı, kendi onayını kendine
   * vermesi anlamsız olurdu. SELF seviyesinde bu alan her zaman true'dur
   * (SELF zaten daima onaydan geçer) ama route'lar SELF'i level üzerinden
   * ayrıca kontrol ettiği için pratikte sadece FULL+bu bayrak kombinasyonu anlamlıdır.
   */
  selfApprovalRequired: boolean
}

const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN']

// Beyaz Yaka'nın TAMAMI değil, sadece bu bölümlerdeki personel FULL erişim alır.
const FULL_ACCESS_BOLUMLER = ['İNSAN VARLIKLARI', 'SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ']

// FULL erişimi olan bu bölümler, kendi adlarına girdikleri kayıtta yine de
// müdür onayından geçer (başkaları için girdiklerinde onay gerekmez).
const SELF_APPROVAL_REQUIRED_BOLUMLER = ['SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ']

/**
 * Toplu Kart Okutamama yetki seviyesi:
 *   - Personnel.bolum İnsan Varlıkları veya Sistem Geliştirme Müdürlüğü ise -> FULL
 *     (Beyaz Yaka'nın TAMAMI değil, sadece bu bölümler — diğer beyaz yaka bölümleri
 *     bu forma erişemez)
 *   - MAVI  -> NONE (forma hiç erişemez)
 *   - GRI   -> GRI  (formu doldurabilir; kendi bölümündeki (Personnel.bolum) personel
 *                    ve kayıtlar üzerinde çalışır)
 *   - BEYAZ (FULL_ACCESS_BOLUMLER dışında) + Personnel kaydı var -> SELF
 *                    (formu SADECE kendisi için doldurabilir, müdür onayından geçer)
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
    return { level: 'FULL', personnelId, bolum, selfApprovalRequired: false }
  }
  if (bolum && FULL_ACCESS_BOLUMLER.includes(bolum)) {
    return { level: 'FULL', personnelId, bolum, selfApprovalRequired: SELF_APPROVAL_REQUIRED_BOLUMLER.includes(bolum) }
  }
  if (yakaRengi === 'MAVI') {
    return { level: 'NONE', personnelId, bolum, selfApprovalRequired: false }
  }
  if (yakaRengi === 'GRI') {
    return { level: 'GRI', personnelId, bolum, selfApprovalRequired: false }
  }
  if (yakaRengi === 'BEYAZ' && personnelId) {
    return { level: 'SELF', personnelId, bolum, selfApprovalRequired: true }
  }

  // Personnel kaydı/yakaRengi hiç yok -> erişim yok.
  return { level: 'NONE', personnelId, bolum, selfApprovalRequired: false }
}
