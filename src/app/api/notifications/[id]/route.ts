import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound } from '@/lib/api-response'

/**
 * DELETE: Tek bir bildirimi sil
 * Bildirimin kullanıcıya ait olduğunu doğrular
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    // Bildirimi bul ve kullanıcıya ait olduğunu doğrula
    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId: user.id,
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
