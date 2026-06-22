import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireSession } from '@/lib/auth/require-session'

/**
 * POST: Kullanıcının tüm bildirimlerini okundu olarak işaretle
 */
export async function POST() {
  try {
    // PR-Y2.5: requireSession — sadece userId yeterli
    const { userId, error } = await requireSession()
    if (error) return error

    // Kullanıcının tüm okunmamış bildirimlerini okundu olarak işaretle
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    })

    return apiSuccess({
      success: true,
      updatedCount: result.count,
      message: `${result.count} bildirim okundu olarak işaretlendi`,
    })
  } catch (error) {
    return apiError('Bildirimler okundu olarak işaretlenirken bir hata oluştu', 500, {
      endpoint: 'POST /api/notifications/read-all',
      error,
    })
  }
}
