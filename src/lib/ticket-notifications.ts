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
import { ileriHubUrl } from '@/lib/email-templates/akademi/_base'

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

// ════════════════════════════════════════════════════════════
// PUBLIC: TICKET ATAMA BİLDİRİMİ
// ════════════════════════════════════════════════════════════

export type TicketAssignedInfo = {
  id: string
  ticketNumber: string
  subject: string
}

/**
 * Ticket bir kişiye atandığında SADECE o kişiye bildirim gönderir.
 *   - In-app: prisma.notification.create (atanan kullanıcı)
 *   - Push: sendPushToUser (abonelik yoksa 0 döner, sorun değil)
 * Mail YOK, durum değişikliği YOK, dept/unaccent araması YOK (atanan id ile belli).
 *
 * Best-effort: her kanal kendi try/catch'inde; fonksiyon throw ETMEZ →
 * caller (PUT) await etse bile atama bildirimden dolayı başarısız olmaz.
 */
export async function dispatchTicketAssigned(
  ticket: TicketAssignedInfo,
  assignedUserId: string,
  assignerName: string,
): Promise<void> {
  const link = `/it-support?ticket=${ticket.ticketNumber}`
  const title = `Size ticket atandı: ${ticket.ticketNumber}`
  const message = `${assignerName}: ${ticket.subject}`

  // Kanal 1: in-app
  try {
    await prisma.notification.create({
      data: { userId: assignedUserId, title, message, type: 'INFO' as const, link },
    })
  } catch (err) {
    console.error('[ticket-assign-notify] in-app failed:', err)
  }

  // Kanal 2: push (abonelik yoksa sendPushToUser 0 döner)
  try {
    await sendPushToUser(prisma, assignedUserId, {
      title,
      body: ticket.subject,
      url: link,
      tag: `ticket-${ticket.id}`,
      data: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
    })
  } catch (err) {
    console.error('[ticket-assign-notify] push failed:', err)
  }
}

// ════════════════════════════════════════════════════════════
// PUBLIC: HAVUZ — TAKIMA DÜŞEN TICKET BİLDİRİMİ (Faz 4)
// ════════════════════════════════════════════════════════════

/**
 * Ticket bir TAKIMA düştüğünde (havuz: assignedTeamId dolu, assignedTo boş)
 * takımın TÜM aktif üyelerine bildirim gönderir.
 *
 *   - In-app: prisma.notification.create (üye başına)
 *   - Push:   sendPushToUser (abonelik yoksa 0 döner)
 *   - Mail YOK (dispatchTicketAssigned ile aynı desen)
 *
 * KURALLAR:
 *   - `excludeEmail` (ticket'ı açan) üyeyse ONA GİTMEZ — kendi açtığı talebi
 *     kendine haber vermenin anlamı yok.
 *   - E-postası User tablosunda bulunmayan veya pasif olan üye SESSİZCE atlanır.
 *   - Her üye kendi try/catch'inde: birinin push'u patlarsa diğerleri gider.
 *   - Fonksiyon throw ETMEZ → caller (ticket create) bildirimden dolayı bozulmaz.
 */
export async function dispatchTicketToTeam(
  ticket: TicketAssignedInfo,
  teamName: string,
  memberEmails: string[],
  excludeEmail: string | null,
): Promise<void> {
  const haric = (excludeEmail ?? '').toLowerCase().trim()
  const alicilar = memberEmails.map((e) => e.toLowerCase().trim()).filter((e) => e !== '' && e !== haric)
  if (alicilar.length === 0) return

  let users: { id: string }[] = []
  try {
    users = await prisma.user.findMany({
      where: { email: { in: alicilar }, isActive: true },
      select: { id: true },
    })
  } catch (err) {
    console.error('[ticket-team-notify] üye çözümleme başarısız:', err)
    return
  }
  if (users.length === 0) return

  const link = `/it-support?ticket=${ticket.ticketNumber}`
  const title = `Takımınıza yeni ticket: ${ticket.ticketNumber}`
  const message = `${teamName} havuzunda: ${ticket.subject}`

  for (const u of users) {
    try {
      await prisma.notification.create({
        data: { userId: u.id, title, message, type: 'INFO' as const, link },
      })
    } catch (err) {
      console.error('[ticket-team-notify] in-app failed:', err)
    }
    try {
      await sendPushToUser(prisma, u.id, {
        title,
        body: ticket.subject,
        url: link,
        tag: `ticket-${ticket.id}`,
        data: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
      })
    } catch (err) {
      console.error('[ticket-team-notify] push failed:', err)
    }
  }
}

// ════════════════════════════════════════════════════════════
// PUBLIC: KAPANIŞ + DEĞERLENDİRME DAVETİ
// ════════════════════════════════════════════════════════════

export type TicketKapanisInfo = {
  id: string
  ticketNumber: string
  subject: string
  /** Talebi açan — bildirim ONA gider. */
  requesterEmail: string
  /** RESOLVED | CLOSED */
  status: string
}

/**
 * Ticket RESOLVED/CLOSED'a geçtiğinde TALEBİ AÇAN kişiye kapanış bildirimi +
 * değerlendirme daveti gönderir. Kanallar dispatchTicketCreated ile aynı:
 * e-posta + in-app + push. Yeni altyapı yok, mevcut yardımcılar kullanılır.
 *
 * KURALLAR:
 *   - Kapanışı yapan kişi talebi açanla AYNIYSA gönderilmez (kendi kapattığı
 *     talebi kendine haber vermenin anlamı yok).
 *   - Tek sefer: RESOLVED→CLOSED ikinci geçişinde tekrar gitmez. Damga için
 *     YENİ KOLON eklenmedi; çağıran taraf TicketTimeline'da
 *     'satisfaction_requested' kaydının varlığına bakar.
 *   - Kullanıcı User tablosunda yoksa/pasifse sessizce atlanır.
 *   - throw ETMEZ → kapanış akışı bildirimden dolayı bozulmaz.
 */
export async function dispatchTicketKapandi(
  ticket: TicketKapanisInfo,
  kapatanEmail: string | null,
): Promise<void> {
  const acan = (ticket.requesterEmail ?? '').toLowerCase().trim()
  if (acan === '') return
  if (acan === (kapatanEmail ?? '').toLowerCase().trim()) return // kendi kapattı

  let user: { id: string; email: string; firstName: string | null; lastName: string | null; name: string | null } | null = null
  try {
    user = await prisma.user.findFirst({
      where: { email: acan, isActive: true },
      select: { id: true, email: true, firstName: true, lastName: true, name: true },
    })
  } catch (err) {
    console.error('[ticket-kapanis-notify] kullanıcı çözümlenemedi:', err)
    return
  }
  if (!user) return

  const r = toRecipient(user)
  const link = `/it-support?ticket=${ticket.ticketNumber}`
  const durumMetni = ticket.status === 'CLOSED' ? 'kapatıldı' : 'çözüldü'
  const title = `Talebiniz ${durumMetni}: ${ticket.ticketNumber}`
  const message = `${ticket.subject} — aldığınız hizmeti değerlendirebilirsiniz.`

  // Kanal 1: e-posta
  try {
    const text =
      `Talebiniz ${durumMetni}.\n\n` +
      `Talep No: ${ticket.ticketNumber}\n` +
      `Konu: ${ticket.subject}\n\n` +
      `Aldığınız hizmeti değerlendirmek için talebe gidin:\n${ileriHubUrl(link)}\n\n` +
      `Değerlendirme bağlantısı 14 gün geçerlidir.\n\nİleri Group`
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td bgcolor="#1B4F72" style="background:#1B4F72;padding:14px 24px;">
          <span style="color:#ffffff;font-size:15px;font-weight:700;">ILERIHub · IT Destek</span>
        </td></tr>
        <tr><td style="padding:22px 24px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#166534;">Talebiniz ${durumMetni}</h1>
          <p style="margin:0 0 8px;font-size:14px;color:#1f2733;"><strong>${ticket.ticketNumber}</strong></p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">${ticket.subject}</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">
            Aldığınız hizmeti değerlendirir misiniz? Bir dakikanızı alır.
          </p>
          <a href="${ileriHubUrl(link)}" style="display:inline-block;background:#1B4F72;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">Değerlendir</a>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">Bağlantı 14 gün geçerlidir.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
    await sendEmail([{ name: r.name, email: r.email }], title, text, html)
  } catch (err) {
    console.error('[ticket-kapanis-notify] email failed:', err)
  }

  // Kanal 2: in-app
  try {
    await prisma.notification.create({
      data: { userId: r.id, title, message, type: 'SUCCESS' as const, link },
    })
  } catch (err) {
    console.error('[ticket-kapanis-notify] in-app failed:', err)
  }

  // Kanal 3: push (abonelik yoksa 0 döner)
  try {
    await sendPushToUser(prisma, r.id, {
      title,
      body: ticket.subject,
      url: link,
      tag: `ticket-kapanis-${ticket.id}`,
      data: { ticketId: ticket.id, ticketNumber: ticket.ticketNumber },
    })
  } catch (err) {
    console.error('[ticket-kapanis-notify] push failed:', err)
  }
}
