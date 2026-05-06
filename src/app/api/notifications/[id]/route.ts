import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiNotFound } from '@/lib/api-response'
import { requireSession } from '@/lib/auth/require-session'

/**
 * DELETE: Tek bir bildirimi sil
 * Bildirimin kullanıcıya ait olduğunu doğrular
 */
export async function DELETE(
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

    // Bildirimi sil
    await prisma.notification.delete({
      where: { id },
    })

    return apiSuccess({
      success: true,
      message: 'Bildirim başarıyla silindi',
    })
  } catch (error) {
    return apiError('Bildirim silinirken bir hata oluştu', 500, {
      endpoint: 'DELETE /api/notifications/[id]',
      error,
    })
  }
}
