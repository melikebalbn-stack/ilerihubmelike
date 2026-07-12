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
  // GUARD (opt-IN): bildirim test-modu. NOTIFY_TEST_MODE === "true" ise push TAMAMEN KAPALI —
  // abonelik sorgusu/gönderim YAPILMAZ, yalnız log. Prod'da bayrak set edilmez → normal akış.
  if (process.env.NOTIFY_TEST_MODE === 'true') {
    console.warn(`🧪 NOTIFY_TEST_MODE AKTİF — push GÖNDERİLMEDİ (kapalı). userId=${userId}, başlık="${payload.title}"`)
    return 0
  }

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

/**
 * Bildirim oluştur + push gönder (tek fonksiyon)
 * Tüm notification.create çağrıları yerine bu kullanılmalı
 */
export async function createNotificationWithPush(
  prismaClient: {
    notification: {
      create: (args: { data: { userId: string; title: string; message: string; type: string; url?: string | null } }) => Promise<unknown>
    }
    pushSubscription: {
      findMany: (args: { where: { userId: string } }) => Promise<Array<{
        endpoint: string
        p256dh: string
        auth: string
      }>>
    }
  },
  data: {
    userId: string
    title: string
    message: string
    type: string
    url?: string | null
  }
): Promise<void> {
  // 1) In-app bildirim oluştur
  await prismaClient.notification.create({ data })

  // 2) Push bildirim gönder (hata olursa sessizce geç)
  try {
    await sendPushToUser(prismaClient, data.userId, {
      title: data.title,
      body: data.message,
      url: data.url || '/',
      tag: `notification-${Date.now()}`,
    })
  } catch (err) {
    console.error('Push gönderimi başarısız (in-app bildirim oluşturuldu):', err)
  }
}

/**
 * Toplu bildirim oluştur + push gönder
 */
export async function createManyNotificationsWithPush(
  prismaClient: {
    notification: {
      createMany: (args: { data: Array<{ userId: string; title: string; message: string; type: string; url?: string | null }> }) => Promise<unknown>
    }
    pushSubscription: {
      findMany: (args: { where: { userId: string } }) => Promise<Array<{
        endpoint: string
        p256dh: string
        auth: string
      }>>
    }
  },
  notifications: Array<{
    userId: string
    title: string
    message: string
    type: string
    url?: string | null
  }>
): Promise<void> {
  // 1) In-app bildirimleri toplu oluştur
  await prismaClient.notification.createMany({ data: notifications })

  // 2) Her kullanıcıya push gönder
  const uniqueUserIds = [...new Set(notifications.map(n => n.userId))]
  for (const userId of uniqueUserIds) {
    const userNotification = notifications.find(n => n.userId === userId)
    if (!userNotification) continue
    try {
      await sendPushToUser(prismaClient, userId, {
        title: userNotification.title,
        body: userNotification.message,
        url: userNotification.url || '/',
        tag: `notification-${Date.now()}`,
      })
    } catch (err) {
      console.error(`Push gönderimi başarısız (userId: ${userId}):`, err)
    }
  }
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
