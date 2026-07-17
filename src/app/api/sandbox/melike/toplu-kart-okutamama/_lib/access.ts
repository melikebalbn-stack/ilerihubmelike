import { prisma } from '@/lib/prisma'

export type BulkCardScanAccessLevel = 'NONE' | 'FULL' | 'GRI'

export interface BulkCardScanAccess {
  level: BulkCardScanAccessLevel
  personnelId: string | null
}

/**
 * Toplu Kart Okutamama yetki seviyesi — Personnel.yakaRengi'ye göre:
 *   BEYAZ -> FULL (tüm kayıtları görür/düzenler/siler)
 *   MAVI  -> NONE (forma hiç erişemez)
 *   GRI   -> GRI  (formu doldurabilir, sadece kendi oluşturduğu kayıtları görür)
 *
 * NOT: YakaRengi enum'unda "GRI" değeri henüz bu ortamda yok (yaka-gri-detay
 * migration'ı bekleniyor — bkz. proje notları). Migration gelince Prisma
 * client tipi otomatik "GRI" içerecek, aşağıdaki `as string` cast'i kaldırılabilir.
 * "Bana bağlı personel" (GRI kullanıcının astları) kapsamı bilinçli olarak
 * BİRİM SORUMLUSU alanlarından TÜRETİLMİYOR (bu yöntem yanlış bulundu) —
 * o mekanizma netleşene kadar GRI kullanıcı sadece kendi oluşturduğu kayıtları görür.
 */
export async function getBulkCardScanAccess(userId: string): Promise<BulkCardScanAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { personnelId: true, personnel: { select: { id: true, yakaRengi: true } } },
  })

  const yakaRengi = user?.personnel?.yakaRengi as string | undefined
  const personnelId = user?.personnel?.id ?? null

  if (yakaRengi === 'BEYAZ') {
    return { level: 'FULL', personnelId }
  }
  if (yakaRengi === 'MAVI') {
    return { level: 'NONE', personnelId }
  }
  if (yakaRengi === 'GRI') {
    return { level: 'GRI', personnelId }
  }

  // Personnel kaydı yok veya yakaRengi tanınmıyor (ör. sadece User hesabı var,
  // Personnel bağlantısı yok) -> erişim yok.
  return { level: 'NONE', personnelId }
}
