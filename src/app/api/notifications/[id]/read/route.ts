import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiNotFound } from '@/lib/api-response'
import { requireSession } from '@/lib/auth/require-session'

/**
 * PATCH: Tek bir bildirimi okundu olarak işaretle
 * Bildirimin kullanıcıya ait olduğunu doğrular
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5: requireSession — sadece userId yeterli
    const { userId, error } = await requireSession()
    if (error) return error

    const { id } = await params

    // Bildirimi bul ve kullanıcıya ait olduğunu doğrula
    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId,
      },
    })

    if (!notification) {
      return apiNotFound('Bildirim bulunamadı veya bu bildirime erişim yetkiniz yok')
    }

    // Bildirimi okundu olarak işaretle
    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    })

    return apiSuccess(updatedNotification)
  } catch (error) {
    return apiError('Bildirim okundu olarak işaretlenirken bir hata oluştu', 500, {
      endpoint: 'PATCH /api/notifications/[id]/read',
      error,
    })
  }
}
