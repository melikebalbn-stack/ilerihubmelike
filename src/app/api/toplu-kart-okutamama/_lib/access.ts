import { prisma } from '@/lib/prisma'
import { isIvBolumuFk } from '@/lib/auth/iv-bolum-fk'
import { getManagedPersonnelIds } from './approvers'

export type BulkCardScanAccessLevel = 'NONE' | 'FULL' | 'GRI' | 'SELF'

export interface BulkCardScanAccess {
  level: BulkCardScanAccessLevel
  personnelId: string | null
  /** Personel Yönetimi'ndeki Personnel.bolum değeri (görüntüleme amaçlı). */
  bolum: string | null
}

// Eskiden FULL veren roller — ARTIK FULL VERMEZ (Melih kararı). İV-dışıysa org
// şemasına iner: sorumluysa GRİ, değilse SELF.
const DEMOTE_ROLES = ['SUPER_ADMIN', 'ADMIN']

/**
 * Kart Okutamama yetki seviyesi — görünürlük ORGANİZASYON ŞEMASINDAN gelir:
 *   - İnsan Varlıkları (isInsanVarliklari) -> FULL (tüm fabrika: Eski Kayıtlar, bulk,
 *     İV onayı, sorumsuz/orphan kararı). SUPER_ADMIN/ADMIN ROLÜ FABRİKA GÖRÜNÜRLÜĞÜ VERMEZ.
 *   - MAVI -> NONE (forma hiç erişemez — ama başkasının kaydına konu olabilir).
 *   - İV-dışı SUPER_ADMIN/ADMIN -> sorumluysa (getManagedPersonnelIds > 0) GRİ (ekip),
 *     değilse SELF (yalnız kendi). Rol artık en fazla GRİ/SELF'e iner.
 *   - GRİ yaka -> GRI · BEYAZ yaka -> SELF. Her ikisi kendi adına girer + sorumlusu
 *     olduğu ekip için açabilir; GRI/SELF ayrımı Excel import gibi ikincil farklar içindir.
 */
export async function getBulkCardScanAccess(userId: string): Promise<BulkCardScanAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      personnelId: true,
      personnel: { select: { id: true, yakaRengi: true, bolum: true, departmentId: true } },
    },
  })

  const yakaRengi = user?.personnel?.yakaRengi
  const personnelId = user?.personnel?.id ?? null
  const bolum = user?.personnel?.bolum ?? null

  // Fabrika görünürlüğü YALNIZ İnsan Varlıkları'ndan gelir (rol DEĞİL).
  // FAZ 3a: karar Personnel.departmentId FK'sından; FK boşsa eski normalize yolu.
  if (await isIvBolumuFk(user?.personnel?.departmentId, bolum)) {
    return { level: 'FULL', personnelId, bolum }
  }
  // MAVI -> forma erişemez.
  if (yakaRengi === 'MAVI') {
    return { level: 'NONE', personnelId, bolum }
  }
  // İV-dışı SUPER_ADMIN/ADMIN: eskiden rolle FULL'du; artık org şemasına iner —
  // sorumluysa ekibini (GRİ), değilse yalnız kendini (SELF). Personnel kaydı şart.
  if (user && DEMOTE_ROLES.includes(user.role) && personnelId) {
    const managed = await getManagedPersonnelIds(personnelId)
    return { level: managed.length > 0 ? 'GRI' : 'SELF', personnelId, bolum }
  }
  if (yakaRengi === 'GRI' && personnelId) {
    return { level: 'GRI', personnelId, bolum }
  }
  if (yakaRengi === 'BEYAZ' && personnelId) {
    return { level: 'SELF', personnelId, bolum }
  }

  // Personnel kaydı/yakaRengi hiç yok -> erişim yok.
  return { level: 'NONE', personnelId, bolum }
}
