import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound } from '@/lib/api-response'

/**
 * POST: Kullanıcının tüm bildirimlerini okundu olarak işaretle
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return apiUnauthorized()
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return apiNotFound('Kullanıcı bulunamadı')
    }

    // Kullanıcının tüm okunmamış bildirimlerini okundu olarak işaretle
    const result = await prisma.notification.updateMany({
      where: {
        userId: user.id,
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
