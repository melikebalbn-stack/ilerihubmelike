/**
 * Avans Formu Hatırlatma Bildirimi.
 *
 * Her ayın 15'inde birim sorumlularına "avans formunu 18'ine kadar
 * doldurun" hatırlatması 3 kanaldan gönderilir:
 *   1. Email (bu dosyadaki küçük template + sendEmail)
 *   2. In-app Notification (prisma.notification.create, "link" alanı)
 *   3. Push (sendPushToUser)
 *
 * zimmet-notifications.ts ile AYNI kanal deseni. Farkla: cron endpoint'i
 * (generate-notifications) çağıranın toplu sonuç sayısına ihtiyacı olduğu
 * için burada fire-and-forget DEĞİL — dispatchAvansHatirlatma await edilip
 * { ok, errors } döndürülür.
 */

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push-notifications'

export type AvansHatirlatmaRecipient = {
  id: string
  email: string
  name: string
}

const AVANS_FORMU_LINK = '/avans-formu'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildHatirlatmaEmailContent(
  recipientName: string
): { subject: string; body: string; html: string } {
  const subject = "[ILERIHub] Avans formunu 18'ine kadar doldurun"

  const body = `Merhaba ${recipientName},

Bu ayki avans formunu, sorumlusu olduğunuz mavi yaka personel için doldurmanız gerekiyor.

Son tarih: bu ayın 18'i.

Formu doldurmak için ILERIHub'a giriş yapabilirsiniz.`

  const html = `
    <p>Merhaba ${esc(recipientName)},</p>
    <p>Bu ayki avans formunu, sorumlusu olduğunuz mavi yaka personel için doldurmanız gerekiyor.</p>
    <p><strong>Son tarih:</strong> bu ayın 18'i.</p>
    <p>Formu doldurmak için ILERIHub'a giriş yapabilirsiniz.</p>
  `

  return { subject, body, html }
}

async function sendHatirlatmaEmail(recipient: AvansHatirlatmaRecipient): Promise<void> {
  const { subject, body, html } = buildHatirlatmaEmailContent(recipient.name)
  await sendEmail([{ name: recipient.name, email: recipient.email }], subject, body, html)
}

async function createHatirlatmaInAppNotification(
  recipient: AvansHatirlatmaRecipient
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: recipient.id,
      title: 'Avans formunu doldurun',
      message: "Bu ayki avans formunu ekibiniz için doldurmanız gerekiyor. Son tarih: ayın 18'i.",
      type: 'REMINDER',
      link: AVANS_FORMU_LINK,
    },
  })
}

async function sendHatirlatmaPush(recipient: AvansHatirlatmaRecipient): Promise<void> {
  const subCount = await prisma.pushSubscription.count({ where: { userId: recipient.id } })
  if (subCount === 0) {
    console.warn(`[avans-notify] ${recipient.email} push subscription yok, push atlanıyor`)
    return
  }

  await sendPushToUser(prisma, recipient.id, {
    title: 'Avans formunu doldurun',
    body: "Son tarih: bu ayın 18'i.",
    url: AVANS_FORMU_LINK,
    tag: `avans-hatirlatma-${recipient.id}`,
    data: { link: AVANS_FORMU_LINK },
  })
}

/**
 * Bir birim sorumlusuna avans formu hatırlatmasını 3 kanaldan gönderir.
 * generate-notifications route'u tarafından await edilir (toplu sonuç
 * sayısı response'a yansıtılmak zorunda olduğu için fire-and-forget değil).
 */
export async function dispatchAvansHatirlatma(
  recipient: AvansHatirlatmaRecipient
): Promise<{ ok: boolean; errors: string[] }> {
  const startedAt = Date.now()
  console.log(`[avans-notify] dispatch started → ${recipient.email}`)

  const results = await Promise.allSettled([
    sendHatirlatmaEmail(recipient),
    createHatirlatmaInAppNotification(recipient),
    sendHatirlatmaPush(recipient),
  ])

  const channelNames = ['email', 'in-app', 'push'] as const
  const errors: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[avans-notify] channel ${channelNames[i]} failed:`, r.reason)
      errors.push(channelNames[i])
    }
  })

  console.log(
    `[avans-notify] dispatch finished → ${recipient.email} in ${Date.now() - startedAt}ms`
  )
  return { ok: errors.length === 0, errors }
}

function buildKendiHatirlatmaEmailContent(
  recipientName: string
): { subject: string; body: string; html: string } {
  const subject = "[ILERIHub] Avans talebinizi 18'ine kadar girin"

  const body = `Merhaba ${recipientName},

Bu ayki avans talebinizi kendi hesabınızdan girmeniz gerekiyor.

Son tarih: bu ayın 18'i.

Talebi girmek için ILERIHub'a giriş yapabilirsiniz.`

  const html = `
    <p>Merhaba ${esc(recipientName)},</p>
    <p>Bu ayki avans talebinizi kendi hesabınızdan girmeniz gerekiyor.</p>
    <p><strong>Son tarih:</strong> bu ayın 18'i.</p>
    <p>Talebi girmek için ILERIHub'a giriş yapabilirsiniz.</p>
  `

  return { subject, body, html }
}

async function sendKendiHatirlatmaEmail(recipient: AvansHatirlatmaRecipient): Promise<void> {
  const { subject, body, html } = buildKendiHatirlatmaEmailContent(recipient.name)
  await sendEmail([{ name: recipient.name, email: recipient.email }], subject, body, html)
}

async function createKendiHatirlatmaInAppNotification(
  recipient: AvansHatirlatmaRecipient
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: recipient.id,
      title: 'Avans talebinizi girin',
      message: "Bu ayki avans talebinizi kendi hesabınızdan girmeniz gerekiyor. Son tarih: ayın 18'i.",
      type: 'REMINDER',
      link: AVANS_FORMU_LINK,
    },
  })
}

async function sendKendiHatirlatmaPush(recipient: AvansHatirlatmaRecipient): Promise<void> {
  const subCount = await prisma.pushSubscription.count({ where: { userId: recipient.id } })
  if (subCount === 0) {
    console.warn(`[avans-notify] ${recipient.email} push subscription yok, push atlanıyor`)
    return
  }

  await sendPushToUser(prisma, recipient.id, {
    title: 'Avans talebinizi girin',
    body: "Son tarih: bu ayın 18'i.",
    url: AVANS_FORMU_LINK,
    tag: `avans-kendi-hatirlatma-${recipient.id}`,
    data: { link: AVANS_FORMU_LINK },
  })
}

/**
 * Sorumlu olmayan BEYAZ yaka personele "kendi talebini gir" hatırlatmasını
 * 3 kanaldan gönderir. dispatchAvansHatirlatma ile aynı desen, farklı metin.
 */
export async function dispatchAvansKendiHatirlatma(
  recipient: AvansHatirlatmaRecipient
): Promise<{ ok: boolean; errors: string[] }> {
  const startedAt = Date.now()
  console.log(`[avans-notify][kendi] dispatch started → ${recipient.email}`)

  const results = await Promise.allSettled([
    sendKendiHatirlatmaEmail(recipient),
    createKendiHatirlatmaInAppNotification(recipient),
    sendKendiHatirlatmaPush(recipient),
  ])

  const channelNames = ['email', 'in-app', 'push'] as const
  const errors: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[avans-notify][kendi] channel ${channelNames[i]} failed:`, r.reason)
      errors.push(channelNames[i])
    }
  })

  console.log(
    `[avans-notify][kendi] dispatch finished → ${recipient.email} in ${Date.now() - startedAt}ms`
  )
  return { ok: errors.length === 0, errors }
}
