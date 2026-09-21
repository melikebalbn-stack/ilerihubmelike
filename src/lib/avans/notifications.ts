/**
 * Avans Formu Hatırlatma Bildirimi.
 *
 * Her ayın 12'sinde birim sorumlularına "avans formunu 15'ine kadar
 * doldurun" hatırlatması SADECE push ile gönderilir (bkz. Melih Bey talebi:
 * email ve in-app kanalları kaldırıldı, gürültü/tekrar bildirim şikayeti).
 * cron endpoint'i (generate-notifications) çağıranın toplu sonuç sayısına
 * ihtiyacı olduğu için burada fire-and-forget DEĞİL — dispatchAvansHatirlatma
 * await edilip { ok, errors } döndürülür.
 */

import { prisma } from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push-notifications'

export type AvansHatirlatmaRecipient = {
  id: string
  email: string
  name: string
}

const AVANS_FORMU_LINK = '/avans-formu'

async function sendHatirlatmaPush(recipient: AvansHatirlatmaRecipient): Promise<void> {
  const subCount = await prisma.pushSubscription.count({ where: { userId: recipient.id } })
  if (subCount === 0) {
    console.warn(`[avans-notify] ${recipient.email} push subscription yok, push atlanıyor`)
    return
  }

  await sendPushToUser(prisma, recipient.id, {
    title: 'Avans formunu doldurun',
    body: "Son tarih: bu ayın 15'i.",
    url: AVANS_FORMU_LINK,
    tag: `avans-hatirlatma-${recipient.id}`,
    data: { link: AVANS_FORMU_LINK },
  })
}

/**
 * Bir birim sorumlusuna avans formu hatırlatmasını push ile gönderir.
 * generate-notifications route'u tarafından await edilir (toplu sonuç
 * sayısı response'a yansıtılmak zorunda olduğu için fire-and-forget değil).
 */
export async function dispatchAvansHatirlatma(
  recipient: AvansHatirlatmaRecipient
): Promise<{ ok: boolean; errors: string[] }> {
  const startedAt = Date.now()
  console.log(`[avans-notify] dispatch started → ${recipient.email}`)

  const results = await Promise.allSettled([sendHatirlatmaPush(recipient)])

  const channelNames = ['push'] as const
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

async function sendKendiHatirlatmaPush(recipient: AvansHatirlatmaRecipient): Promise<void> {
  const subCount = await prisma.pushSubscription.count({ where: { userId: recipient.id } })
  if (subCount === 0) {
    console.warn(`[avans-notify] ${recipient.email} push subscription yok, push atlanıyor`)
    return
  }

  await sendPushToUser(prisma, recipient.id, {
    title: 'Avans talebinizi girin',
    body: "Son tarih: bu ayın 15'i.",
    url: AVANS_FORMU_LINK,
    tag: `avans-kendi-hatirlatma-${recipient.id}`,
    data: { link: AVANS_FORMU_LINK },
  })
}

/**
 * Sorumlu olmayan BEYAZ yaka personele "kendi talebini gir" hatırlatmasını
 * push ile gönderir. dispatchAvansHatirlatma ile aynı desen, farklı metin.
 */
export async function dispatchAvansKendiHatirlatma(
  recipient: AvansHatirlatmaRecipient
): Promise<{ ok: boolean; errors: string[] }> {
  const startedAt = Date.now()
  console.log(`[avans-notify][kendi] dispatch started → ${recipient.email}`)

  const results = await Promise.allSettled([sendKendiHatirlatmaPush(recipient)])

  const channelNames = ['push'] as const
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
