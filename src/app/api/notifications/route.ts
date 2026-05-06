import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response'
import { sendPushToUser } from '@/lib/push-notifications'

/**
 * GET: Kullanıcının bildirimlerini sayfalı olarak listele
 * Query params: page, limit, unreadOnly (boolean)
 * Return: { notifications: [], pagination: { page, limit, total, totalPages }, unreadCount }
 */
export async function GET(request: NextRequest) {
  try {
    // PR-NTF-FIX: session.user.id (cuid) direkt kullan — email-based findUnique
    // pattern'i LDAP email casing nedeniyle 401 üretiyordu (PR-Y2.1 sonrası).
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return apiUnauthorized()
    }

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
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return apiUnauthorized()
    }

    // Kullanıcıyı bul ve yetkisini kontrol et
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!currentUser || !['SUPER_ADMIN', 'ADMIN', 'IT_MANAGER'].includes(currentUser.role)) {
      return apiError('Bu işlem için yetkiniz yok', 403)
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
