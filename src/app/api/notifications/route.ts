import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiForbidden } from '@/lib/api-response'
import { sendPushToUser } from '@/lib/push-notifications'
import { requireSession } from '@/lib/auth/require-session'
import { requireUser } from '@/lib/auth/require-user'

/**
 * GET: Kullanıcının bildirimlerini sayfalı olarak listele
 * Query params: page, limit, unreadOnly (boolean)
 * Return: { notifications: [], pagination: { page, limit, total, totalPages }, unreadCount }
 */
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5: requireSession — DB hit yok (sadece userId yeter)
    const { userId, error } = await requireSession()
    if (error) return error

    // Query parametrelerini al
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    // Filtreleme koşulları
    const where = {
      userId,
      ...(unreadOnly && { isRead: false }),
    }

    // Bildirimleri, toplam sayıyı ve okunmamış sayısını paralel olarak al
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ])

    // Toplam sayfa sayısını hesapla
    const totalPages = Math.ceil(total / limit)

    return apiSuccess({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      unreadCount,
    })
  } catch (error) {
    return apiError('Bildirim listesi alınırken bir hata oluştu', 500, {
      endpoint: 'GET /api/notifications',
      error,
    })
  }
}

/**
 * POST: Yeni bildirim oluştur (sadece yetkili kullanıcılar)
 */
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5: requireUser — rol kontrolü için DB user gerekli
    const { user, error } = await requireUser()
    if (error) return error

    if (!['SUPER_ADMIN', 'ADMIN', 'IT_MANAGER'].includes(user.role)) {
      return apiForbidden()
    }

    const body = await request.json()
    const { userId, title, message, type = 'INFO', link } = body

    // Gerekli alanları kontrol et
    if (!userId || !title || !message) {
      return apiError('userId, title ve message alanları gereklidir', 400)
    }

    // Bildirim tipini doğrula
    const validTypes = ['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'REMINDER']
    if (!validTypes.includes(type)) {
      return apiError(`Geçersiz bildirim tipi. Geçerli tipler: ${validTypes.join(', ')}`, 400)
    }

    // Bildirimi oluştur
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
      },
    })

    // Push bildirim gönder
    sendPushToUser(prisma, userId, {
      title,
      body: message,
      url: link || '/',
    }).catch(() => {})

    return apiSuccess(notification, 201)
  } catch (error) {
    return apiError('Bildirim oluşturulurken bir hata oluştu', 500, {
      endpoint: 'POST /api/notifications',
      error,
    })
  }
}
