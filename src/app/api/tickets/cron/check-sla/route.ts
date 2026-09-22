import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push-notifications'
import { ileriHubUrl, escapeHtml } from '@/lib/email-templates/akademi/_base'
import { renderEmailHtml, logoAttachments } from '@/lib/email-templates/layout'
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

/**
 * IT ekibi — son çare bildirim alıcısı.
 *
 * ROL SLUG'INA göre çözülür, `helpdesk.admin` İZNİNE göre DEĞİL. O izin
 * super-admin'de de var ve üst yönetimi listeye sokuyordu: 27 Ağustos'ta
 * kategorisiz+atamasız bir ticket'ın SLA ihlali 8 kişiye gitti, aralarında
 * GM ve yönetim kademesi vardı.
 *
 * Aynı ayrımı assignable-users ucu daha önce yapmıştı (route.ts:19-24,
 * "super-admin BİLİNÇLİ hariç") — burada o desen tekrarlanıyor.
 *
 * ⚠ Bu YALNIZ bildirim alıcısını daraltır. `helpdesk.admin` izninin kendisine
 * dokunulmadı: KPI panosu, dahili yorum, viewMode kapsamı, requirePermission
 * kapıları aynen duruyor. Kimse yetki kaybetmiyor.
 */
async function itEkibi(): Promise<Alici[]> {
  const simdi = new Date()
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      userRoles: {
        some: {
          // Süresi dolmuş rol ataması bildirim üretmesin (eski davranış korundu).
          OR: [{ expiresAt: null }, { expiresAt: { gt: simdi } }],
          role: { slug: { in: ['it-admin', 'helpdesk-agent'] } },
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
 * Bildirim alıcıları: atanan kişi → yoksa takım üyeleri → yoksa IT ekibi.
 * Zincir, ticket'ı gerçekten takip eden en dar kümeden başlar.
 *
 * Liste BOŞ dönebilir; çağıran taraf onu zaten `alicilar.length > 0` ile
 * koruyor (ihlal bayrağı ve timeline yine yazılır, yalnız bildirim atlanır).
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

  return { alicilar: await itEkibi(), kaynak: 'it-ekibi' }
}

function mailGovdesi(t: { ticketNumber: string; subject: string }, etiket: string, link: string) {
  const subject = `SLA aşıldı: ${t.ticketNumber}`
  const text =
    `${etiket}.\n\n` +
    `Ticket: ${t.ticketNumber}\n` +
    `Konu: ${t.subject}\n\n` +
    `Talebe git: ${link}\n\nİleri Group`
  const html = renderEmailHtml({
    module: 'Destek',
    title: etiket,
    subtitle: `Talep No: ${t.ticketNumber}`,
    preheader: `${etiket} — ${t.ticketNumber}`,
    infoRows: [
      { label: 'Talep No', value: `<strong>${escapeHtml(t.ticketNumber)}</strong>` },
      { label: 'Konu', value: escapeHtml(t.subject) },
    ],
    cta: { label: 'Talebe git', url: link },
  })
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
            mail.subject, mail.text, mail.html, logoAttachments(),
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
