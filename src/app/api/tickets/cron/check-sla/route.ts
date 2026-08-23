import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push-notifications'
import { ileriHubUrl } from '@/lib/email-templates/akademi/_base'
import { parseMembers } from '@/lib/tickets/team-members'
import { ihlalDegerlendir, ihlalEtiketi, KAPALI_DURUMLAR, type IhlalKarari, type TakvimBaglami } from '@/lib/sla/ihlal'
import { getSlaAyar, getTatilMap } from '@/lib/sla'

export const dynamic = 'force-dynamic'

/**
 * IT Ticket — SLA İHLAL TESPİTİ (Faz 1c).
 *
 * Açık ticket'ları tarar, hedefi geçmiş olanların ihlal bayrağını false→true
 * çevirir ve İLGİLİYE bir kez bildirim gönderir.
 *
 * DAMGA = BAYRAĞIN KENDİSİ. Ayrı "bildirim gönderildi" alanı yok; bayrak true
 * olduktan sonra o ticket bir daha bildirilmez. Bu yüzden bayrak yazımı
 * bildirimden ÖNCE yapılır: mail patlarsa bile ikinci turda tekrar
 * bildirilmez — çift bildirim, kaçan bildirimden daha zararlı.
 *
 * DURAKLATMA (Faz 1d): PENDING/ON_HOLD'da saat durur. Bu uç duraklatma
 * alanlarını OKUR ama YAZMAZ — yazma yalnız durum geçişinde ([id]/route.ts).
 *
 * KAPSAM DIŞI (bilinçli):
 *   - Eski takvim-saati alanları (slaResponseDue/slaResolutionDue): okunmaz.
 *   - Geriye dönük backfill: hedefi NULL olan kayıtlar atlanır.
 *
 * Auth: x-cron-secret (overtime/cron/check-overdue ile birebir aynı).
 * Kuru koşu: ?dryRun=1 → ne değişeceğini döndürür, YAZMAZ.
 */

type Alici = { id: string; email: string; name: string }

/** helpdesk.admin izni taşıyan aktif kullanıcılar (son çare alıcı). */
async function helpdeskAdminleri(): Promise<Alici[]> {
  const simdi = new Date()
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      userRoles: {
        some: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: simdi } }],
          role: { rolePermissions: { some: { permission: { key: 'helpdesk.admin' } } } },
        },
      },
    },
    select: { id: true, email: true, firstName: true, lastName: true, name: true },
  })
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.name || u.email,
  }))
}

/**
 * Bildirim alıcıları: atanan kişi → yoksa takım üyeleri → yoksa helpdesk.admin.
 * Zincir, ticket'ı gerçekten takip eden en dar kümeden başlar.
 */
async function alicilariCoz(t: {
  assignedTo: string | null
  assignedTeamId: string | null
}): Promise<{ alicilar: Alici[]; kaynak: string }> {
  const eposta = (t.assignedTo ?? '').toLowerCase().trim()
  if (eposta !== '') {
    const u = await prisma.user.findFirst({
      where: { email: eposta, isActive: true },
      select: { id: true, email: true, firstName: true, lastName: true, name: true },
    })
    if (u) {
      return {
        alicilar: [{
          id: u.id,
          email: u.email,
          name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.name || u.email,
        }],
        kaynak: 'atanan',
      }
    }
  }

  if (t.assignedTeamId) {
    const takim = await prisma.ticketTeam.findUnique({
      where: { id: t.assignedTeamId },
      select: { members: true },
    })
    const epostalar = parseMembers(takim?.members ?? null)
      .map((m) => m.email.toLowerCase().trim())
      .filter((e) => e !== '')
    if (epostalar.length > 0) {
      const users = await prisma.user.findMany({
        where: { email: { in: epostalar }, isActive: true },
        select: { id: true, email: true, firstName: true, lastName: true, name: true },
      })
      if (users.length > 0) {
        return {
          alicilar: users.map((u) => ({
            id: u.id,
            email: u.email,
            name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.name || u.email,
          })),
          kaynak: 'takım',
        }
      }
    }
  }

  return { alicilar: await helpdeskAdminleri(), kaynak: 'helpdesk.admin' }
}

function mailGovdesi(t: { ticketNumber: string; subject: string }, etiket: string, link: string) {
  const subject = `SLA aşıldı: ${t.ticketNumber}`
  const text =
    `${etiket}.\n\n` +
    `Ticket: ${t.ticketNumber}\n` +
    `Konu: ${t.subject}\n\n` +
    `Talebe git: ${link}\n\nİleri Group`
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td bgcolor="#1B4F72" style="background:#1B4F72;padding:14px 24px;">
          <span style="color:#ffffff;font-size:15px;font-weight:700;">ILERIHub · IT Destek</span>
        </td></tr>
        <tr><td style="padding:22px 24px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#b91c1c;">${etiket}</h1>
          <p style="margin:0 0 8px;font-size:14px;color:#1f2733;"><strong>${t.ticketNumber}</strong></p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">${t.subject}</p>
          <a href="${link}" style="display:inline-block;background:#1B4F72;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">Talebe git</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  return { subject, text, html }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1'
  const now = new Date()

  // Takvim bağlamı bir kez okunur, tüm ticket'lar için paylaşılır.
  const ayar = await getSlaAyar()
  const tatilMap = await getTatilMap([now.getUTCFullYear() - 1, now.getUTCFullYear()])
  const baglam: TakvimBaglami = { tatilMap, ayar }

  // Aday süzme DB'de: kapalı olmayan + en az bir hedefi geçmiş + ilgili bayrağı false.
  // NULL hedefler `lt` ile zaten elenir. DURAKLATMADAKİ ticket'lar da adaydır:
  // hedefi geçmiş olabilir ama duraklatma düşülünce ihlal çıkmayabilir — bu
  // kararı SQL değil ihlalDegerlendir verir.
  const adaylar = await prisma.ticket.findMany({
    where: {
      status: { notIn: [...KAPALI_DURUMLAR] },
      OR: [
        { slaResponseBreached: false, respondedAt: null, responseDueAt: { lt: now } },
        { slaResolutionBreached: false, resolvedAt: null, resolutionDueAt: { lt: now } },
      ],
    },
    select: {
      id: true, ticketNumber: true, subject: true, status: true,
      assignedTo: true, assignedTeamId: true,
      respondedAt: true, resolvedAt: true,
      responseDueAt: true, resolutionDueAt: true,
      slaResponseBreached: true, slaResolutionBreached: true,
      slaPausedAt: true, slaPausedMinutes: true,
    },
  })

  let responseBreached = 0
  let resolutionBreached = 0
  let notified = 0
  const hatalar: string[] = []
  const planlanan: { ticketNumber: string; etiket: string; alici: string }[] = []

  // Ticket BAŞINA işlenir: birinin bildirimi patlarsa parti düşmesin.
  for (const t of adaylar) {
    try {
      const karar: IhlalKarari = ihlalDegerlendir(t, now, baglam)
      if (!karar.yanitIhlali && !karar.cozumIhlali) continue

      const etiket = ihlalEtiketi(karar)
      const { alicilar, kaynak } = await alicilariCoz(t)

      if (karar.yanitIhlali) responseBreached++
      if (karar.cozumIhlali) resolutionBreached++

      if (dryRun) {
        planlanan.push({
          ticketNumber: t.ticketNumber,
          etiket,
          alici: `${kaynak} (${alicilar.length})`,
        })
        continue
      }

      // 1) BAYRAK ÖNCE — damga budur, çift bildirimi engeller.
      await prisma.ticket.update({
        where: { id: t.id },
        data: {
          ...(karar.yanitIhlali ? { slaResponseBreached: true } : {}),
          ...(karar.cozumIhlali ? { slaResolutionBreached: true } : {}),
        },
      })

      // 2) Timeline
      try {
        await prisma.ticketTimeline.create({
          data: {
            ticketId: t.id,
            action: 'sla_breach',
            description: etiket,
            performedBy: 'system',
            performedByName: 'Sistem (SLA kontrolü)',
          },
        })
      } catch (err) {
        console.error(`[ticket-sla] ${t.ticketNumber}: timeline yazılamadı:`, err)
      }

      // 3) Bildirim — her alıcı kendi try/catch'inde
      const link = `/it-support?ticket=${t.ticketNumber}`
      const mail = mailGovdesi(t, etiket, ileriHubUrl(link))

      if (alicilar.length > 0) {
        try {
          await sendEmail(
            alicilar.map((a) => ({ email: a.email, name: a.name })),
            mail.subject, mail.text, mail.html,
          )
        } catch (err) {
          console.error(`[ticket-sla] ${t.ticketNumber}: mail hatası:`, err)
        }

        for (const a of alicilar) {
          try {
            await prisma.notification.create({
              data: {
                userId: a.id,
                title: `${etiket}: ${t.ticketNumber}`,
                message: t.subject,
                type: 'WARNING' as const,
                link,
              },
            })
          } catch (err) {
            console.error(`[ticket-sla] ${t.ticketNumber}: in-app hatası (${a.email}):`, err)
          }
          try {
            await sendPushToUser(prisma, a.id, {
              title: `${etiket}: ${t.ticketNumber}`,
              body: t.subject,
              url: link,
              tag: `ticket-sla-${t.id}`,
              data: { ticketId: t.id, ticketNumber: t.ticketNumber },
            })
          } catch (err) {
            console.error(`[ticket-sla] ${t.ticketNumber}: push hatası (${a.email}):`, err)
          }
        }
        notified++
      } else {
        console.warn(`[ticket-sla] ${t.ticketNumber}: alıcı bulunamadı, bildirim yok`)
      }
    } catch (err) {
      const msg = `${t.ticketNumber}: ${err instanceof Error ? err.message : String(err)}`
      console.error('[ticket-sla]', msg)
      hatalar.push(msg)
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    scanned: adaylar.length,
    responseBreached,
    resolutionBreached,
    notified,
    ...(hatalar.length > 0 ? { errors: hatalar } : {}),
    ...(dryRun ? { planlanan } : {}),
    checkedAt: now.toISOString(),
  })
}
