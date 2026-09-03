import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { ticketYetkileri } from '@/lib/ticket-yetki'
import { getSlaAyar, getTatilMap } from '@/lib/sla'
import { duraklatmaGecisi, ihlalDegerlendir, type TakvimBaglami } from '@/lib/sla/ihlal'
import { cozulebilirMi, otomatikKapanmaAni, ITIRAZ_SURESI_GUN } from '@/lib/tickets/cozum'
import { dispatchTicketCozuldu } from '@/lib/ticket-notifications'

/**
 * POST /api/tickets/[id]/cozum — talebi ÇÖZÜLDÜ işaretle.
 *
 * TEK ÇÖZÜM YOLU. Eskiden iki yol vardı:
 *   1) `isResolution: true` yorumu → status'ü RESOLVED yapıyordu
 *   2) PUT /api/tickets/[id] ile doğrudan `status: 'RESOLVED'`
 * İkisi de resolvedBy / autoCloseAt damgalarını bilmiyordu ve biri
 * resolutionSummary yazarken öbürü yazmıyordu. Faz 1'de ikisi de kapatıldı;
 * bu uç tek giriş noktası.
 *
 * Çözüm metni OPSİYONEL: boş gelirse talep yine çözülür, yalnız arşive
 * girmez (arşiv `resolutionSummary` dolu olanları listeler).
 *
 * Yetki: durum değiştirebilenler (IT ekibi / atanan / takım üyesi) —
 * PUT'takiyle aynı kural, tek kaynak @/lib/ticket-yetki.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id: ticketId } = await params
    const body = await request.json().catch(() => ({}))
    const cozumHam = typeof body?.cozum === 'string' ? body.cozum.trim() : ''

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { assignedTeam: { select: { members: true } } },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket bulunamadı' }, { status: 404 })
    }

    const userIsITStaff = session.user.permissions?.includes('helpdesk.admin') ?? false
    const { canChangeStatus } = ticketYetkileri(ticket, {
      email: user.email,
      isITStaff: userIsITStaff,
    })
    if (!canChangeStatus) {
      return NextResponse.json({ error: 'Bu talebi çözme yetkiniz yok' }, { status: 403 })
    }

    if (!cozulebilirMi(ticket.status)) {
      return NextResponse.json(
        { error: `Bu talep zaten ${ticket.status === 'RESOLVED' ? 'çözüldü' : 'kapalı'}` },
        { status: 409 },
      )
    }

    const simdi = new Date()
    const cozenAd = user.name ?? user.email

    // ── SLA: RESOLVED kapalı durumdur; duraklatma birikimi burada kapanır.
    // Hesap TEK KAYNAK (@/lib/sla/ihlal) — formül kopyalanmıyor.
    const baglam: TakvimBaglami = {
      ayar: await getSlaAyar(),
      tatilMap: await getTatilMap([simdi.getUTCFullYear() - 1, simdi.getUTCFullYear()]),
    }
    const slaGirdi = {
      status: ticket.status,
      respondedAt: ticket.respondedAt,
      resolvedAt: ticket.resolvedAt,
      responseDueAt: ticket.responseDueAt,
      resolutionDueAt: ticket.resolutionDueAt,
      slaResponseBreached: ticket.slaResponseBreached,
      slaResolutionBreached: ticket.slaResolutionBreached,
      slaPausedAt: ticket.slaPausedAt,
      slaPausedMinutes: ticket.slaPausedMinutes,
    }
    const durak = duraklatmaGecisi(ticket.status, 'RESOLVED', slaGirdi, simdi, baglam)
    const karar = ihlalDegerlendir(slaGirdi, simdi, baglam)

    // Çözüm metni bir TicketComment olarak da yazılır: tarihçe orada birikir
    // (itiraz sonrası yeniden çözülürse eski metin kaybolmaz) ve kullanıcı
    // çözümü yorum akışında görür. Ticket.resolutionSummary onun son kopyası.
    //
    // DİKKAT: bu yorum için dispatchTicketYorum ÇAĞRILMAZ — aşağıdaki
    // dispatchTicketCozuldu zaten aynı metni gönderiyor, ikisi birden giderse
    // kullanıcı aynı şeyi iki kez alır.
    await prisma.$transaction(async (tx) => {
      if (cozumHam) {
        await tx.ticketComment.create({
          data: {
            ticketId,
            authorEmail: user.email,
            authorName: cozenAd,
            content: cozumHam,
            isInternal: false,
            isResolution: true,
          },
        })
      }

      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'RESOLVED',
          resolvedAt: simdi,
          resolvedByEmail: user.email,
          resolvedByName: cozenAd,
          // Boş çözümde eski metni EZMİYORUZ: itiraz sonrası ikinci turda
          // teknisyen metin yazmazsa ilk turun çözümü arşivde kalsın.
          ...(cozumHam ? { resolutionSummary: cozumHam } : {}),
          autoCloseAt: otomatikKapanmaAni(simdi),
          slaResolutionBreached: karar.cozumIhlali || ticket.slaResolutionBreached,
          ...durak.guncelleme,
        },
      })

      await tx.ticketTimeline.create({
        data: {
          ticketId,
          action: 'resolved',
          description: cozumHam
            ? 'Çözüldü olarak işaretlendi (çözüm notu eklendi)'
            : 'Çözüldü olarak işaretlendi (çözüm notu yazılmadı)',
          oldValue: ticket.status,
          newValue: 'RESOLVED',
          performedBy: user.email,
          performedByName: cozenAd,
        },
      })
    })

    // Bildirim best-effort: gönderim patlasa da talep çözülü kalır.
    try {
      await dispatchTicketCozuldu({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        requesterEmail: ticket.requesterEmail,
        cozenAd,
        cozumMetni: cozumHam || null,
        itirazGunu: ITIRAZ_SURESI_GUN,
      })
    } catch (err) {
      console.error('[ticket-cozum] bildirim gönderilemedi:', ticket.ticketNumber, err)
    }

    const guncel = await prisma.ticket.findUnique({ where: { id: ticketId } })
    return NextResponse.json(guncel)
  } catch (error) {
    console.error('Çözüm işaretleme hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
