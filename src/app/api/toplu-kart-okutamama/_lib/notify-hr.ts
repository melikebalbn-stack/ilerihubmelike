import { prisma } from '@/lib/prisma'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'

interface RecordSummary {
  sicilNo: string | null
  adSoyad: string
}

/**
 * Kayıt oluşturulduğunda İnsan Varlıkları'na uygulama-içi (in-app) bildirim
 * gönderir — mail YOK, sadece prisma.notification (bkz. ticket-notifications.ts
 * deseni, burada sadece in-app kanalı kullanılıyor). Fire-and-forget: çağıran
 * route bu fonksiyonu await etmeden devam edebilir, hata sessizce loglanır.
 */
export async function notifyHrOfBulkCardScanRecords(
  records: RecordSummary[],
  creatorName: string
): Promise<void> {
  if (records.length === 0) return

  try {
    const users = await prisma.user.findMany({
      where: { isActive: true, department: { not: null } },
      select: { id: true, department: true },
    })
    const recipientIds = users.filter((u) => isInsanVarliklari(u.department)).map((u) => u.id)
    if (recipientIds.length === 0) return

    const title =
      records.length === 1
        ? `Toplu Kart Okutamama: ${records[0].adSoyad}`
        : `Toplu Kart Okutamama: ${records.length} kayıt`

    const message =
      records.length === 1
        ? `${records[0].adSoyad} (${records[0].sicilNo || '-'}) için ${creatorName} tarafından kart okutamama kaydı girildi.`
        : `${creatorName} tarafından ${records.length} kişi için kart okutamama kaydı girildi.`

    await prisma.notification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        title,
        message,
        type: 'INFO' as const,
        link: '/forms/toplu-kart-okutamama',
      })),
    })
  } catch (err) {
    console.error('[toplu-kart-okutamama] İK bildirim hatası:', err)
  }
}
