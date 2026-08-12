import { prisma } from '@/lib/prisma'

export type BulkCardScanAccessLevel = 'NONE' | 'FULL' | 'GRI' | 'SELF'

export interface BulkCardScanAccess {
  level: BulkCardScanAccessLevel
  personnelId: string | null
  /** Personel Yönetimi'ndeki Personnel.bolum değeri (görüntüleme amaçlı). */
  bolum: string | null
}

const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN']

// Beyaz Yaka'nın TAMAMI değil, sadece İnsan Varlıkları FULL erişim alır.
const FULL_ACCESS_BOLUMLER = ['İNSAN VARLIKLARI']

/**
 * Kart Okutamama yetki seviyesi:
 *   - SUPER_ADMIN/ADMIN (legacy UserRoleEnum) veya İnsan Varlıkları bölümü -> FULL
 *     (herkesi bölümden bağımsız yönetir, toplu işlem yapar, Eski Kayıtlar'ı görür,
 *     İV onayı verir)
 *   - MAVI  -> NONE (forma hiç erişemez — ama başkasının kaydına konu olabilir)
 *   - GRI ve BEYAZ (FULL dışında) + Personnel kaydı var -> aynı davranış:
 *     kendi adına kayıt girer (kendi 1./2./3. Sorumlusu'ndan onay ister),
 *     Personel Yönetimi'nde kendisinin 1./2./3. Sorumlu olarak tanımlandığı
 *     kişiler varsa (yaka rengi fark etmez) onlar için de onaysız kayıt açabilir.
 *     GRI/SELF ayrımı sadece Excel import yetkisi gibi ikincil farklar için korunur.
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
  if (yakaRengi === 'GRI' && personnelId) {
    return { level: 'GRI', personnelId, bolum }
  }
  if (yakaRengi === 'BEYAZ' && personnelId) {
    return { level: 'SELF', personnelId, bolum }
  }

  // Personnel kaydı/yakaRengi hiç yok -> erişim yok.
  return { level: 'NONE', personnelId, bolum }
}
