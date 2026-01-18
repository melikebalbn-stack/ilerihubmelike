import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })

  if (!user) {
    return new Response('User not found', { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // İlk bağlantıda okunmamış bildirimleri gönder
      const unreadNotifications = await prisma.notification.findMany({
        where: {
          userId: user.id,
          isRead: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      const unreadCount = await prisma.notification.count({
        where: {
          userId: user.id,
          isRead: false,
        },
      })

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'init',
        notifications: unreadNotifications,
        unreadCount,
      })}\n\n`))

      // Polling interval (10 saniye)
      let lastCheck = new Date()
      const intervalId = setInterval(async () => {
        try {
          // Son kontrolden bu yana yeni bildirimler var mı?
          const newNotifications = await prisma.notification.findMany({
            where: {
              userId: user.id,
              createdAt: { gt: lastCheck },
            },
            orderBy: { createdAt: 'desc' },
          })

          if (newNotifications.length > 0) {
            const unreadCount = await prisma.notification.count({
              where: {
                userId: user.id,
                isRead: false,
              },
            })

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'new',
              notifications: newNotifications,
              unreadCount,
            })}\n\n`))
          }

          lastCheck = new Date()
        } catch (error) {
          console.error('SSE polling error:', error)
        }
      }, 10000) // 10 saniye

      // Heartbeat (30 saniye)
      const heartbeatId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          clearInterval(intervalId)
          clearInterval(heartbeatId)
        }
      }, 30000)

      // Connection closed
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId)
        clearInterval(heartbeatId)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
