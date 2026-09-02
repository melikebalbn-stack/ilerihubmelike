/**
 * IT Ticket Bildirim Dispatcher (PR-TKT-NTF-1A)
 *
 * Yeni ticket açıldığında SORUMLU alıcılara 3 kanaldan bildirim gönderir
 * (kural zinciri: kategori takımı → kategori varsayılan atananı → triage):
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
 * Recipient kuralı (bkz. resolveTicketRecipients):
 *   a) kategori.defaultTeamId → takım üyeleri
 *   b) kategori.defaultAssigneeEmail → o kişi
 *   c) ikisi de yoksa → triage e-postası
 *   Her üç kanal AYNI alıcı kümesini kullanır; atama yolunun zaten bildirdiği
 *   kişiler ve talebi açan kişi kümeden düşülür (çift bildirim yok).
 */

import { prisma } from '@/lib/prisma'
import { parseMembers } from '@/lib/tickets/team-members'
import { sendEmail, generateTicketCreatedEmailContent } from '@/lib/email'
import { sendPushToUser } from '@/lib/push-notifications'
import { ileriHubUrl, escapeHtml } from '@/lib/email-templates/akademi/_base'

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
  /** Alıcı zinciri buradan çözülür (null = kategorisiz → triage). */
  categoryId: string | null
  requesterName: string
  requesterDept: string
  createdAt: Date
}

// ════════════════════════════════════════════════════════════
// IT RECIPIENT RESOLVER
// ════════════════════════════════════════════════════════════

/** Kategorisiz / tanımsız talepler için son halka. */
const TRIAGE_KEY = 'ticket_triage_email'
const TRIAGE_YEDEK = 'melih.dilben@ilerigroup.com'

async function triageEpostasi(): Promise<string> {
  const env = (process.env.TICKET_TRIAGE_EMAIL ?? '').trim()
  if (env) return env
  try {
    const kayit = await prisma.systemSetting.findUnique({
      where: { key: TRIAGE_KEY },
      select: { value: true },
    })
    const v = (kayit?.value ?? '').trim()
    if (v) return v
  } catch (err) {
    console.error('[ticket-notify] triage ayari okunamadi:', err)
  }
  console.warn(`[ticket-notify] '${TRIAGE_KEY}' yok → yedek: ${TRIAGE_YEDEK}`)
  return TRIAGE_YEDEK
}

/**
 * Talep oluşturma bildiriminin alıcıları — KURAL ZİNCİRİ:
 *
 *   a) kategori.defaultTeamId dolu → TicketTeam.members
 *   b) yoksa kategori.defaultAssigneeEmail dolu → yalnız o kişi
 *   c) ikisi de yok / kategorisiz → triage (SystemSetting 'ticket_triage_email',
 *      env TICKET_TRIAGE_EMAIL onu ezer)
 *
 * Eski davranış (kaldırıldı): User.department LIKE '%sistem gelistirme%' —
 * kategori ne olursa olsun aynı 4 kişiye mail + in-app + push gidiyordu
 * (ölçüm 01.09.2026: son 6 talebin altısında da "resolved 4 recipients").
 *
 * `haric` = bu bildirimi ZATEN almış olanlar (atama yolu) + talebi açan kişi.
 */
async function resolveTicketRecipients(
  categoryId: string | null,
  haric: string[],
): Promise<Recipient[]> {
  let epostalar: string[] = []

  const kategori = categoryId
    ? await prisma.ticketCategory.findUnique({
        where: { id: categoryId },
        select: {
          defaultAssigneeEmail: true,
          defaultTeam: { select: { name: true, members: true } },
        },
      })
    : null

  if (kategori?.defaultTeam) {
    epostalar = parseMembers(kategori.defaultTeam.members).map((m) => m.email)
  } else if (kategori?.defaultAssigneeEmail) {
    epostalar = [kategori.defaultAssigneeEmail]
  }

  if (epostalar.length === 0) {
    epostalar = [await triageEpostasi()]
  }

  const haricSet = new Set(haric.map((e) => e.toLowerCase().trim()).filter(Boolean))
  const benzersiz = [
    ...new Set(epostalar.map((e) => e.toLowerCase().trim()).filter((e) => e !== '' && !haricSet.has(e))),
  ]
  if (benzersiz.length === 0) return []

  const users = await prisma.user.findMany({
    where: { email: { in: benzersiz }, isActive: true },
    select: { id: true, email: true, firstName: true, lastName: true, name: true },
  })
  if (users.length === 0) {
    console.warn(`[ticket-notify] alici e-postalari User'da bulunamadi/pasif: ${benzersiz.join(', ')}`)
  }
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
export async function dispatchTicketCreated(
  ticket: TicketForDispatch,
  /** Atama yolunun ZATEN bildirdiği e-postalar + talebi açan (tekilleştirme). */
  zatenBildirilen: string[] = [],
): Promise<void> {
  const startedAt = Date.now()
  console.log(`[ticket-notify] dispatch started for ${ticket.ticketNumber}`)

  let recipients: Recipient[]
  try {
    recipients = await resolveTicketRecipients(ticket.categoryId, zatenBildirilen)
  } catch (err) {
    console.error('[ticket-notify] resolveTicketRecipients failed:', err)
    return
  }

  if (recipients.length === 0) {
    console.warn(
      `[ticket-notify] alici yok (kategori=${ticket.category}, haric=${zatenBildirilen.length}) — dispatch atlandi`,
    )
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

// ════════════════════════════════════════════════════════════
// PUBLIC: TICKET YORUM BİLDİRİMİ
// ════════════════════════════════════════════════════════════

export type TicketYorumInfo = {
  id: string
  ticketNumber: string
  subject: string
  /** Talebi açan. */
  requesterEmail: string
  /** Atanan teknisyenin e-postası (null = havuzda / atanmamış). */
  assignedTo: string | null
}

/**
 * Yoruma göre karşı tarafa bildirim gönderir. Kanal: e-posta (kapanış
 * bildirimiyle aynı şablon iskeleti, aynı hata yutma davranışı).
 *
 * KURALLAR:
 *   - Dahili not (isInternal) → HİÇ bildirim. Dahili not talep sahibine
 *     kapalıdır; haber vermek onu sızdırmak olurdu.
 *   - Yorumu yazan ≠ talep sahibi (IT ekibi yanıtı) → TALEP SAHİBİNE gider.
 *   - Yorumu yazan = talep sahibi → atanan teknisyene gider; ticket atanmamışsa
 *     alıcı yok, yalnız log düşülür (havuza düşmüş talebin bildirimi ayrı iş).
 *   - Kendine bildirim gönderilmez (alıcı = yazar ise atlanır).
 *   - throw ETMEZ → yorum akışı bildirimden dolayı bozulmaz.
 *
 * ALICI ÇÖZÜMÜ kapanış bildiriminden bir noktada AYRILIYOR: orada alıcı User'da
 * yoksa gönderim atlanıyor. Burada atlanmaz — e-posta kanalından (destek@) açılan
 * talebin sahibi sistemde kayıtlı OLMAYABİLİR (mail-isle.ts bilinmeyen göndereni
 * kabul ediyor) ve yanıtı görmesi gereken kişi tam olarak odur. User kaydı varsa
 * adı oradan alınır, pasifse gönderilmez.
 */
export async function dispatchTicketYorum(
  ticket: TicketYorumInfo,
  yorum: { content: string; isInternal: boolean; authorEmail: string; authorName: string },
): Promise<void> {
  if (yorum.isInternal) return // dahili not → bildirim yok

  const yazan = (yorum.authorEmail ?? '').toLowerCase().trim()
  const acan = (ticket.requesterEmail ?? '').toLowerCase().trim()

  // Yazan talep sahibiyse muhatap atanan teknisyendir, değilse talep sahibi.
  const hedef =
    yazan !== '' && yazan === acan ? (ticket.assignedTo ?? '').toLowerCase().trim() : acan

  // Adres yoksa (talep atanmamış) veya adres değilse atla. mail-isle.ts
  // gönderen çözülemediğinde requesterEmail'e '(bilinmiyor)' yazıyor — onu
  // SMTP'ye götürmenin anlamı yok, hata olarak geri dönerdi.
  if (hedef === '' || !hedef.includes('@')) {
    console.log(`[ticket-yorum-notify] ${ticket.ticketNumber}: gecerli alici yok — atlandi`)
    return
  }
  if (hedef === yazan) return // kendi yorumunu kendine haber verme

  let user:
    | { id: string; email: string; firstName: string | null; lastName: string | null; name: string | null; isActive: boolean }
    | null = null
  try {
    user = await prisma.user.findFirst({
      where: { email: hedef },
      select: { id: true, email: true, firstName: true, lastName: true, name: true, isActive: true },
    })
  } catch (err) {
    console.error('[ticket-yorum-notify] kullanıcı çözümlenemedi:', err)
    return
  }
  if (user && !user.isActive) {
    console.log(`[ticket-yorum-notify] ${ticket.ticketNumber}: alici pasif (${hedef}) — atlandi`)
    return
  }

  // User yoksa (mail kanalından gelen dış talep sahibi) adres adın yerine geçer.
  const r = user ? toRecipient(user) : { id: '', email: hedef, name: hedef }
  const link = `/it-support?ticket=${ticket.ticketNumber}`
  const title = `[Ticket #${ticket.ticketNumber}] Yeni yanıt`
  const govde = yorum.content.trim()

  try {
    const text =
      `Talebinize yeni bir yanıt eklendi.\n\n` +
      `Talep No: ${ticket.ticketNumber}\n` +
      `Konu: ${ticket.subject}\n` +
      `Yanıtlayan: ${yorum.authorName}\n\n` +
      `${govde}\n\n` +
      `Talebe gitmek için:\n${ileriHubUrl(link)}\n\nİleri Group`
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td bgcolor="#1B4F72" style="background:#1B4F72;padding:14px 24px;">
          <span style="color:#ffffff;font-size:15px;font-weight:700;">ILERIHub · IT Destek</span>
        </td></tr>
        <tr><td style="padding:22px 24px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#1B4F72;">Talebinize yeni yanıt</h1>
          <p style="margin:0 0 8px;font-size:14px;color:#1f2733;"><strong>${ticket.ticketNumber}</strong></p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">${escapeHtml(ticket.subject)}</p>
          <div style="margin:0 0 16px;padding:12px 14px;background:#f8fafc;border-left:3px solid #1B4F72;border-radius:4px;">
            <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">${escapeHtml(yorum.authorName)}</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#1f2733;white-space:pre-wrap;">${escapeHtml(govde)}</p>
          </div>
          <a href="${ileriHubUrl(link)}" style="display:inline-block;background:#1B4F72;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">Talebe Git</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
    await sendEmail([{ name: r.name, email: r.email }], title, text, html)
  } catch (err) {
    console.error('[ticket-yorum-notify] email failed:', err)
  }
}
