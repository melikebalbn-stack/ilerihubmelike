/**
 * Zimmet Formu Onay Bildirimi — Zimmet Teslim Formu modülü.
 *
 * Yeni zimmet formu kaydedildiğinde tek onaylayana (Melih Dilben) 3
 * kanaldan bildirim gönderir:
 *   1. Email (bu dosyadaki küçük template + sendEmail)
 *   2. In-app Notification (prisma.notification.create, "link" alanı)
 *   3. Push (sendPushToUser)
 *
 * ticket-notifications.ts ile AYNI desen: fire-and-forget, kanal
 * izolasyonu için Promise.allSettled.
 */

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push-notifications'
import { ZIMMET_TUR_ETIKET } from '@/lib/zimmet/tur'

type Approver = {
  id: string
  email: string
  name: string
}

export type ZimmetForDispatch = {
  id: string
  zimmetSahibiAdi: string
  departman: string | null
  tur: string
  teslimEdenAdi: string
  createdAt: Date
}

// ════════════════════════════════════════════════════════════
// KANAL 1: EMAIL
// ════════════════════════════════════════════════════════════

function buildApprovalEmailContent(
  zimmet: ZimmetForDispatch,
  recipientName: string,
): { subject: string; body: string; html: string } {
  const turLabel = ZIMMET_TUR_ETIKET[zimmet.tur as keyof typeof ZIMMET_TUR_ETIKET] ?? zimmet.tur

  const esc = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

  const subject = `[ILERIHub] Onay bekleyen zimmet tutanağı: ${zimmet.zimmetSahibiAdi}`

  const body = `Merhaba ${recipientName},

${zimmet.teslimEdenAdi} tarafından yeni bir zimmet tutanağı oluşturuldu ve onayınızı bekliyor.

Zimmet sahibi: ${zimmet.zimmetSahibiAdi}
Departman: ${zimmet.departman ?? '—'}
Tür: ${turLabel}

Detayları görmek için ILERIHub'a giriş yapabilirsiniz.`

  const html = `
    <p>Merhaba ${esc(recipientName)},</p>
    <p><strong>${esc(zimmet.teslimEdenAdi)}</strong> tarafından yeni bir zimmet tutanağı oluşturuldu ve onayınızı bekliyor.</p>
    <ul>
      <li><strong>Zimmet sahibi:</strong> ${esc(zimmet.zimmetSahibiAdi)}</li>
      <li><strong>Departman:</strong> ${esc(zimmet.departman ?? '—')}</li>
      <li><strong>Tür:</strong> ${esc(turLabel)}</li>
    </ul>
    <p>Detayları görmek için ILERIHub'a giriş yapabilirsiniz.</p>
  `

  return { subject, body, html }
}

async function sendApprovalEmail(approver: Approver, zimmet: ZimmetForDispatch): Promise<void> {
  const { subject, body, html } = buildApprovalEmailContent(zimmet, approver.name)
  await sendEmail([{ name: approver.name, email: approver.email }], subject, body, html)
}

// ════════════════════════════════════════════════════════════
// KANAL 2: IN-APP NOTIFICATION
// ════════════════════════════════════════════════════════════

async function createApprovalInAppNotification(
  approver: Approver,
  zimmet: ZimmetForDispatch,
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: approver.id,
      title: 'Onay bekleyen zimmet tutanağı',
      message: `${zimmet.teslimEdenAdi}: ${zimmet.zimmetSahibiAdi} için zimmet tutanağı onayınızı bekliyor.`,
      type: 'INFO',
      link: `/zimmet-formu/${zimmet.id}/onayla`,
    },
  })
}

// ════════════════════════════════════════════════════════════
// KANAL 3: PUSH NOTIFICATION
// ════════════════════════════════════════════════════════════

async function sendApprovalPush(approver: Approver, zimmet: ZimmetForDispatch): Promise<void> {
  const subCount = await prisma.pushSubscription.count({ where: { userId: approver.id } })
  if (subCount === 0) {
    console.warn(`[zimmet-notify] ${approver.email} push subscription yok, push atlanıyor`)
    return
  }

  await sendPushToUser(prisma, approver.id, {
    title: 'Onay bekleyen zimmet tutanağı',
    body: `${zimmet.teslimEdenAdi}: ${zimmet.zimmetSahibiAdi}`,
    url: `/zimmet-formu/${zimmet.id}/onayla`,
    tag: `zimmet-${zimmet.id}`,
    data: { zimmetId: zimmet.id },
  })
}

// ════════════════════════════════════════════════════════════
// PUBLIC: DISPATCHER
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// ZİMMET SAHİBİ İMZA İSTEĞİ — 3 kanal (e-posta, in-app, push)
// ════════════════════════════════════════════════════════════

type ZimmetSahibiRecipient = {
  id: string
  email: string
  name: string | null
}

async function sendZimmetSahibiImzaEmail(
  zimmetSahibi: ZimmetSahibiRecipient,
  zimmetId: string,
): Promise<void> {
  const recipientName = zimmetSahibi.name ?? zimmetSahibi.email
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  const subject = '[ILERIHub] Zimmet tutanağınız onaylandı — imzanız bekleniyor'
  const body = `Merhaba ${recipientName},\n\nZimmet tutanağınız onaylandı ve imzanızı bekliyor.\n\nDetaylar için ILERIHub'a giriş yapabilirsiniz.`
  const html = `
    <p>Merhaba ${esc(recipientName)},</p>
    <p>Zimmet tutanağınız onaylandı ve imzanızı bekliyor.</p>
    <p>Detaylar için ILERIHub'a giriş yapabilirsiniz.</p>
  `
  await sendEmail([{ name: recipientName, email: zimmetSahibi.email }], subject, body, html)
}

async function sendZimmetSahibiImzaPush(
  zimmetSahibi: ZimmetSahibiRecipient,
  zimmetId: string,
): Promise<void> {
  const subCount = await prisma.pushSubscription.count({ where: { userId: zimmetSahibi.id } })
  if (subCount === 0) {
    console.warn(`[zimmet-notify] ${zimmetSahibi.email} push subscription yok, push atlanıyor`)
    return
  }
  await sendPushToUser(prisma, zimmetSahibi.id, {
    title: 'Zimmet imzanız bekleniyor',
    body: 'Zimmet tutanağınız onaylandı. İmzalamak için tıklayın.',
    url: `/zimmet-formu/${zimmetId}/imzala`,
    tag: `zimmet-imza-${zimmetId}`,
    data: { zimmetId },
  })
}

/**
 * Melih onayladıktan sonra zimmet sahibine imza isteği gönderir.
 * Fire-and-forget — caller `await dispatchZimmetSahibiImzaIstegi(...)` YAPMAMALI.
 */
export async function dispatchZimmetSahibiImzaIstegi({
  zimmet,
  zimmetSahibi,
}: {
  zimmet: { id: string }
  zimmetSahibi: ZimmetSahibiRecipient
}): Promise<void> {
  const startedAt = Date.now()
  console.log(`[zimmet-notify] imza-istegi dispatch started for ${zimmet.id} → ${zimmetSahibi.email}`)

  const results = await Promise.allSettled([
    sendZimmetSahibiImzaEmail(zimmetSahibi, zimmet.id),
    prisma.notification.create({
      data: {
        userId: zimmetSahibi.id,
        title: 'Zimmet imzanız bekleniyor',
        message: 'Zimmet tutanağınız onaylandı. İmzalamak için tıklayın.',
        type: 'INFO',
        link: `/zimmet-formu/${zimmet.id}/imzala`,
      },
    }),
    sendZimmetSahibiImzaPush(zimmetSahibi, zimmet.id),
  ])

  const channelNames = ['email', 'in-app', 'push'] as const
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[zimmet-notify] imza-istegi channel ${channelNames[i]} failed:`, r.reason)
    }
  })

  console.log(`[zimmet-notify] imza-istegi dispatch finished for ${zimmet.id} in ${Date.now() - startedAt}ms`)
}

// ════════════════════════════════════════════════════════════

/**
 * Yeni zimmet formu kaydedildiğinde çağrılır. Fire-and-forget — caller
 * `await dispatchZimmetApproval(...)` YAPMAMALI.
 */
export async function dispatchZimmetApproval({
  zimmet,
  approver,
}: {
  zimmet: ZimmetForDispatch
  approver: Approver
}): Promise<void> {
  const startedAt = Date.now()
  console.log(`[zimmet-notify] dispatch started for ${zimmet.id} → ${approver.email}`)

  const results = await Promise.allSettled([
    sendApprovalEmail(approver, zimmet),
    createApprovalInAppNotification(approver, zimmet),
    sendApprovalPush(approver, zimmet),
  ])

  const channelNames = ['email', 'in-app', 'push'] as const
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[zimmet-notify] channel ${channelNames[i]} failed:`, r.reason)
    }
  })

  console.log(`[zimmet-notify] dispatch finished for ${zimmet.id} in ${Date.now() - startedAt}ms`)
}

// ════════════════════════════════════════════════════════════
// DEVİR ONAY İSTEĞİ — kişi başına TEK bildirim (e-posta + in-app)
// ════════════════════════════════════════════════════════════

type DevirBildirimRecipient = {
  id: string
  email: string
  name: string | null
}

/**
 * Syteline devir kayıtları için sahibe TEK toplu bildirim gönderir (kayıt başına
 * DEĞİL). Fire-and-forget. E-posta + in-app; devir-onay ekranına yönlendirir.
 */
export async function dispatchZimmetDevirOnayIstegi({
  kullanici,
  kayitSayisi,
}: {
  kullanici: DevirBildirimRecipient
  kayitSayisi: number
}): Promise<void> {
  const recipientName = kullanici.name ?? kullanici.email
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

  const subject = `[ILERIHub] Üzerinize kayıtlı ${kayitSayisi} zimmet onayınızı bekliyor`
  const body = `Merhaba ${recipientName},

Eski sistemden aktarılan ${kayitSayisi} zimmet kaydı üzerinize kayıtlı ve onayınızı bekliyor. Lütfen kontrol edip size ait olanları onaylayın, olmayanları gerekçesiyle reddedin.

Zimmetlerim ekranından işlem yapabilirsiniz: /zimmet-formu/zimmetlerim`
  const html = `
    <p>Merhaba ${esc(recipientName)},</p>
    <p>Eski sistemden aktarılan <strong>${kayitSayisi}</strong> zimmet kaydı üzerinize kayıtlı ve onayınızı bekliyor. Lütfen kontrol edip size ait olanları onaylayın, olmayanları gerekçesiyle reddedin.</p>
    <p><a href="/zimmet-formu/zimmetlerim">Zimmetlerim</a> ekranından işlem yapabilirsiniz.</p>
  `

  const results = await Promise.allSettled([
    sendEmail([{ name: recipientName, email: kullanici.email }], subject, body, html),
    prisma.notification.create({
      data: {
        userId: kullanici.id,
        title: `Üzerinize kayıtlı ${kayitSayisi} zimmet onayınızı bekliyor`,
        message: 'Eski sistemden aktarılan zimmetleri kontrol edip onaylayın/reddedin.',
        type: 'INFO',
        link: '/zimmet-formu/zimmetlerim',
      },
    }),
  ])

  const channelNames = ['email', 'in-app'] as const
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[zimmet-notify] devir-onay channel ${channelNames[i]} failed:`, r.reason)
    }
  })
}
