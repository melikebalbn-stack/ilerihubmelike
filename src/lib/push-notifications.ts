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

/**
 * Abonelik ÖLÜ mü — tarayıcı/push servisi kaydı geri çekti.
 *
 * Web Push standardı: 404 Not Found ve 410 Gone "bu endpoint artık yok" demektir
 * ve RFC 8030'a göre abonelik SİLİNMELİDİR. Diğer hatalar geçici olabilir
 * (429 kota, 5xx servis, ağ) — onlarda kayıt KORUNUR, aksi hâlde geçici bir
 * arıza kullanıcının tüm cihazlarını bildirimden düşürürdü.
 *
 * 07.10.2026 gözlemi: Gökçe Ekşioğlu'nun 3 kaydından biri 410 veriyordu
 * ("push subscription has unsubscribed or expired") ve her gönderimde tekrar
 * denenip log kirletiyordu.
 */
export function oluAbonelikMi(hata: unknown): boolean {
  const kod = (hata as { statusCode?: unknown } | null | undefined)?.statusCode
  return kod === 404 || kod === 410
}

export type PushGonderimSonucu = { ok: boolean; olu: boolean }

/**
 * Tek aboneliğe gönderim — ölü/geçici hata ayrımıyla. `sendPushNotification`
 * geriye uyum için boolean döndürmeye devam eder.
 */
export async function pushGonder(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<PushGonderimSonucu> {
  try {
    await sendPushNotificationRaw(subscription, payload)
    return { ok: true, olu: false }
  } catch (error) {
    const olu = oluAbonelikMi(error)
    if (olu) {
      console.warn('Push aboneliği ölü (404/410) — kayıt silinecek:', subscription.endpoint.slice(0, 60))
    } else {
      console.error('Push notification gönderme hatası:', error)
    }
    return { ok: false, olu }
  }
}

export async function sendPushNotification(
  subscription: {
    endpoint: string
    p256dh: string
    auth: string
  },
  payload: PushPayload
): Promise<boolean> {
  return (await pushGonder(subscription, payload)).ok
}

/** Ham gönderim — hatayı YUTMAZ, çağıran sınıflandırır. */
async function sendPushNotificationRaw(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<void> {
  {
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
  }
}

/**
 * Abonelik döngüsü — gönderim ve silme ENJEKTE edilir (test edilebilirlik).
 * Ölü (404/410) abonelikler silinir; geçici hatalarda kayıt korunur.
 */
export async function pushDongusu<T extends { id?: string; endpoint: string; p256dh: string; auth: string }>(
  abonelikler: T[],
  gonder: (a: T) => Promise<PushGonderimSonucu>,
  sil?: (a: T) => Promise<void>,
): Promise<{ basarili: number; silinen: number; basarisiz: number }> {
  let basarili = 0
  let silinen = 0
  let basarisiz = 0
  for (const a of abonelikler) {
    const sonuc = await gonder(a)
    if (sonuc.ok) {
      basarili++
      continue
    }
    basarisiz++
    if (!sonuc.olu || !sil) continue
    try {
      await sil(a)
      silinen++
    } catch (e) {
      // Silme patlarsa gönderim sonucunu BOZMA — bir sonraki denemede tekrar silinir.
      console.error('Ölü push aboneliği silinemedi:', e)
    }
  }
  return { basarili, silinen, basarisiz }
}

export async function sendPushToUser(
  prisma: {
    pushSubscription: {
      findMany: (args: { where: { userId: string } }) => Promise<Array<{
        id?: string
        endpoint: string
        p256dh: string
        auth: string
      }>>
      /** OPSİYONEL: varsa ölü (404/410) abonelikler silinir. Dar mock'lar bunu
       *  geçmez; o durumda temizlik ATLANIR, gönderim davranışı değişmez. */
      deleteMany?: (args: { where: { endpoint: { in: string[] } } }) => Promise<{ count: number }>
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

  // Ölü abonelikler TOPLANIR ve tek deleteMany ile silinir (abonelik başına
  // ayrı DELETE yerine). `endpoint` zaten @unique — id'siz mock'larda da çalışır.
  const oluEndpointler: string[] = []
  const { basarili } = await pushDongusu(
    subscriptions,
    (a) => pushGonder(a, payload),
    async (a) => {
      oluEndpointler.push(a.endpoint)
    },
  )

  if (oluEndpointler.length > 0 && prisma.pushSubscription.deleteMany) {
    try {
      const { count } = await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: oluEndpointler } },
      })
      console.warn(`Ölü push aboneliği silindi: ${count} kayıt (userId=${userId})`)
    } catch (e) {
      console.error('Ölü push abonelikleri silinemedi:', e)
    }
  }

  return basarili
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
