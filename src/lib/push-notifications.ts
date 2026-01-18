import webpush from 'web-push'

// VAPID ayarlarını yapılandır
if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
  data?: Record<string, unknown>
}

export async function sendPushNotification(
  subscription: {
    endpoint: string
    p256dh: string
    auth: string
  },
  payload: PushPayload
): Promise<boolean> {
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.svg',
      badge: payload.badge || '/icons/icon-72x72.svg',
      url: payload.url || '/',
      tag: payload.tag,
      data: payload.data,
    })

    await webpush.sendNotification(pushSubscription, notificationPayload)
    return true
  } catch (error) {
    console.error('Push notification gönderme hatası:', error)
    return false
  }
}

export async function sendPushToUser(
  prisma: {
    pushSubscription: {
      findMany: (args: { where: { userId: string } }) => Promise<Array<{
        endpoint: string
        p256dh: string
        auth: string
      }>>
    }
  },
  userId: string,
  payload: PushPayload
): Promise<number> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  })

  let successCount = 0
  for (const sub of subscriptions) {
    const success = await sendPushNotification(sub, payload)
    if (success) successCount++
  }

  return successCount
}

export async function sendPushToAll(
  prisma: {
    pushSubscription: {
      findMany: () => Promise<Array<{
        endpoint: string
        p256dh: string
        auth: string
      }>>
    }
  },
  payload: PushPayload
): Promise<number> {
  const subscriptions = await prisma.pushSubscription.findMany()

  let successCount = 0
  for (const sub of subscriptions) {
    const success = await sendPushNotification(sub, payload)
    if (success) successCount++
  }

  return successCount
}
