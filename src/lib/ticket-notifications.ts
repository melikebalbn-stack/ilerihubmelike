/**
 * IT Ticket Bildirim Dispatcher (PR-TKT-NTF-1A)
 *
 * Yeni ticket açıldığında Sistem Geliştirme departmanındaki aktif
 * kullanıcılara 3 kanaldan bildirim gönderir:
 *   1. Email (sendEmail + generateTicketCreatedEmailContent)
 *   2. In-app Notification (prisma.notification.createMany)
 *   3. Push Notification (sendPushToUser)
 *
 * Mimari:
 *   - Fire-and-forget: ticket POST endpoint'i bu fonksiyonu await ETMEZ.
 *   - Kanal izolasyonu: Promise.allSettled — biri patlasa diğeri devam.
 *   - Recipient resolver: pattern-based DB sorgusu, runtime'da çalışır
 *     (statik kullanıcı listesi YOK).
 *
 * Recipient kuralı:
 *   isActive = true VE department adında "sistem gelistirme" geçen kullanıcılar
 *   (Türkçe karakterler unaccent ile normalize edilir; unaccent yoksa fallback)
 */

import { prisma } from '@/lib/prisma'
import { sendEmail, generateTicketCreatedEmailContent } from '@/lib/email'
import { sendPushToUser } from '@/lib/push-notifications'

// ════════════════════════════════════════════════════════════
// TİP TANIMLARI
// ════════════════════════════════════════════════════════════

type Recipient = {
  id: string
  email: string
  name: string
}

export type TicketForDispatch = {
  id: string
  ticketNumber: string
  subject: string
  description: string
  priority: string
  category: string
  requesterName: string
  requesterDept: string
  createdAt: Date
}

// ════════════════════════════════════════════════════════════
// IT RECIPIENT RESOLVER
// ════════════════════════════════════════════════════════════

/**
 * Sistem Geliştirme departmanındaki aktif kullanıcıları döner.
 *
 * Birinci tercih: PG `unaccent()` extension ile diakritik normalize + ILIKE.
 * Fallback: unaccent yoksa Prisma `contains` ile iki varyant taraması.
 */
async function resolveITRecipients(): Promise<Recipient[]> {
  // 1) unaccent ile dene
  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; email: string; firstName: string | null; lastName: string | null; name: string | null }>
    >`
      SELECT id, email, "firstName", "lastName", name
      FROM "User"
      WHERE "isActive" = true
        AND department IS NOT NULL
        AND LOWER(unaccent(department)) LIKE '%sistem gelistirme%'
    `
    return rows.map(toRecipient)
  } catch (err) {
    console.warn('[ticket-notify] unaccent query failed, using fallback:', err)
  }

  // 2) Fallback: Türkçe karakter varyant taraması
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { department: { contains: 'Sistem Geliştirme', mode: 'insensitive' } },
        { department: { contains: 'Sistem Gelistirme', mode: 'insensitive' } },
      ],
    },
    select: { id: true, email: true, firstName: true, lastName: true, name: true },
  })
  return users.map(toRecipient)
}

function toRecipient(u: {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  name: string | null
}): Recipient {
  const composed = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  const name = composed || u.name || u.email
  return { id: u.id, email: u.email, name }
}

// ════════════════════════════════════════════════════════════
// KANAL 1: EMAIL
// ════════════════════════════════════════════════════════════

async function sendEmails(recipients: Recipient[], ticket: TicketForDispatch): Promise<void> {
  if (recipients.length === 0) return

  for (const r of recipients) {
    try {
      const { subject, body, html } = generateTicketCreatedEmailContent(
        {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          description: ticket.description,
          priority: ticket.priority,
          category: ticket.category,
          requesterName: ticket.requesterName,
          requesterDept: ticket.requesterDept,
          createdAt: ticket.createdAt,
        },
        r.name,
      )
      await sendEmail([{ name: r.name, email: r.email }], subject, body, html)
    } catch (err) {
      console.error(`[ticket-notify] email to ${r.email} failed:`, err)
    }
  }
}

// ════════════════════════════════════════════════════════════
// KANAL 2: IN-APP NOTIFICATION
// ════════════════════════════════════════════════════════════

async function createInAppNotifications(
  recipients: Recipient[],
  ticket: TicketForDispatch,
): Promise<void> {
  if (recipients.length === 0) return

  const isCritical = ticket.priority === 'CRITICAL' || ticket.priority === 'TICKET_CRITICAL'
  const link = `/it-support?ticket=${ticket.ticketNumber}`
  const titlePrefix = isCritical ? 'ACİL — ' : ''

  await prisma.notification.createMany({
    data: recipients.map((r) => ({
      userId: r.id,
      title: `${titlePrefix}Yeni IT Talebi: ${ticket.ticketNumber}`,
      message: `${ticket.requesterName} (${ticket.requesterDept}): ${ticket.subject}`,
      type: 'INFO' as const,
      link,
    })),
  })
}

// ════════════════════════════════════════════════════════════
// KANAL 3: PUSH NOTIFICATION
// ════════════════════════════════════════════════════════════

async function sendPushNotifications(
  recipients: Recipient[],
  ticket: TicketForDispatch,
): Promise<void> {
  if (recipients.length === 0) return

  const isCritical = ticket.priority === 'CRITICAL' || ticket.priority === 'TICKET_CRITICAL'
  const url = `/it-support?ticket=${ticket.ticketNumber}`
  const titlePrefix = isCritical ? '🔴 ACİL — ' : ''

  for (const r of recipients) {
    try {
      const subCount = await prisma.pushSubscription.count({ where: { userId: r.id } })
      if (subCount === 0) {
        console.warn(
          `[ticket-notify] user ${r.email} has no push subscriptions, skipping push`,
        )
        continue
      }

      await sendPushToUser(prisma, r.id, {
        title: `${titlePrefix}Yeni IT Talebi: ${ticket.ticketNumber}`,
        body: `${ticket.requesterName}: ${ticket.subject}`,
        url,
        tag: `ticket-${ticket.id}`,
        data: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
      })
    } catch (err) {
      console.error(`[ticket-notify] push to ${r.email} failed:`, err)
    }
  }
}

// ════════════════════════════════════════════════════════════
// PUBLIC: DISPATCHER
// ════════════════════════════════════════════════════════════

/**
 * Yeni ticket açıldığında çağrılır. Fire-and-forget — caller
 * `await dispatchTicketCreated(...)` YAPMAMALI.
 */
export async function dispatchTicketCreated(ticket: TicketForDispatch): Promise<void> {
  const startedAt = Date.now()
  console.log(`[ticket-notify] dispatch started for ${ticket.ticketNumber}`)

  let recipients: Recipient[]
  try {
    recipients = await resolveITRecipients()
  } catch (err) {
    console.error('[ticket-notify] resolveITRecipients failed:', err)
    return
  }

  if (recipients.length === 0) {
    console.warn('[ticket-notify] no IT recipients (Sistem Geliştirme dept boş?), dispatch skipped')
    return
  }

  console.log(
    `[ticket-notify] resolved ${recipients.length} recipients: ${recipients
      .map((r) => r.email)
      .join(', ')}`,
  )

  const results = await Promise.allSettled([
    sendEmails(recipients, ticket),
    createInAppNotifications(recipients, ticket),
    sendPushNotifications(recipients, ticket),
  ])

  const channelNames = ['email', 'in-app', 'push'] as const
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[ticket-notify] channel ${channelNames[i]} failed:`, r.reason)
    }
  })

  console.log(
    `[ticket-notify] dispatch finished for ${ticket.ticketNumber} in ${Date.now() - startedAt}ms`,
  )
}
