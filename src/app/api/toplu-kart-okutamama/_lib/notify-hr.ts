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

/**
 * Beyaz Yaka'nın kendisi için girdiği kayıt (SELF akışı) onay adayına/adaylarına
 * (1. Sorumlu / 2. Sorumlu) düştüğünde in-app bildirim gönderir — hangisi önce
 * onaylarsa/reddederse geçerli olduğu için ikisine de aynı anda bildirim gider.
 */
export async function notifyApproverOfPendingRecord(
  approverIds: string[],
  record: RecordSummary,
  submitterName: string
): Promise<void> {
  const recipientIds = [...new Set(approverIds.filter(Boolean))]
  if (recipientIds.length === 0) return
  try {
    await prisma.notification.createMany({
      data: recipientIds.map((approverId) => ({
        userId: approverId,
        title: `Onayınızı Bekleyen Kayıt: ${record.adSoyad}`,
        message: `${submitterName}, kart okutamama kaydını (${record.sicilNo || '-'}) onayınıza sundu.`,
        type: 'INFO' as const,
        link: '/forms/toplu-kart-okutamama',
      })),
    })
  } catch (err) {
    console.error('[toplu-kart-okutamama] Onay bildirimi hatası:', err)
  }
}

/**
 * Müdür kararını (onay/red) kaydı giren kişiye bildirir.
 */
export async function notifySubmitterOfDecision(
  submitterId: string,
  tarihLabel: string,
  decision: 'APPROVE' | 'REJECT',
  approverName: string
): Promise<void> {
  try {
    const approved = decision === 'APPROVE'
    await prisma.notification.create({
      data: {
        userId: submitterId,
        title: approved ? 'Kart Okutamama Kaydınız Onaylandı' : 'Kart Okutamama Kaydınız Reddedildi',
        message: approved
          ? `${approverName}, ${tarihLabel} tarihli kaydınızı onayladı.`
          : `${approverName}, ${tarihLabel} tarihli kaydınızı reddetti.`,
        type: approved ? ('SUCCESS' as const) : ('WARNING' as const),
        link: '/forms/toplu-kart-okutamama',
      },
    })
  } catch (err) {
    console.error('[toplu-kart-okutamama] Karar bildirimi hatası:', err)
  }
}

/**
 * Onaycısı hiç çözülemeyen SELF kayıt için İ.V. Müdürü'ne in-app bildirim.
 *
 * Kayıt BEKLIYOR'da doğar ama hiçbir onaycıya düşmez (1./2./3. Sorumlu adı
 * eşleşmedi, eşleşen kişinin User'ı yok ve bölüm müdürü fallback'i de boş).
 * Böyle bir kayıt kimsenin kuyruğunda görünmediği için sessizce asılı kalırdı;
 * İ.V. Müdürü ApprovalPosition HR_MANAGER üzerinden çözülür.
 */
export async function notifyHrManagerOfUnresolvedApprover(
  records: { adSoyad: string; tarih: Date }[]
): Promise<void> {
  if (records.length === 0) return

  try {
    const pozisyon = await prisma.approvalPosition.findFirst({
      where: { code: 'HR_MANAGER', isActive: true, userId: { not: null } },
      select: { userId: true },
    })
    if (!pozisyon?.userId) {
      console.warn('[toplu-kart-okutamama] HR_MANAGER pozisyonu atanmamış — orphan kayıt bildirimi gönderilemedi')
      return
    }

    await prisma.notification.createMany({
      data: records.map((r) => ({
        userId: pozisyon.userId as string,
        title: 'Onaycısı çözülemeyen kart okutamama kaydı',
        message: `Onaycısı çözülemeyen kart okutamama kaydı: ${r.adSoyad} ${r.tarih.toLocaleDateString('tr-TR')}`,
        type: 'WARNING' as const,
        link: '/forms/toplu-kart-okutamama',
      })),
    })
  } catch (err) {
    console.error('[toplu-kart-okutamama] Orphan kayıt bildirimi hatası:', err)
  }
}
