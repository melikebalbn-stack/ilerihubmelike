import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getSlaAyar, getTatilMap } from '@/lib/sla'
import { duraklatmaGecisi, type TakvimBaglami } from '@/lib/sla/ihlal'
import { onayBekliyorMu } from '@/lib/tickets/cozum'
import { dispatchTicketItiraz, dispatchTicketKapandi } from '@/lib/ticket-notifications'

/**
 * POST /api/tickets/[id]/cozum/onay — talep sahibinin kararı.
 *
 * body: { karar: 'ONAYLA' | 'ITIRAZ' }
 *   ONAYLA → CLOSED (autoClosed=false). Kapanış + memnuniyet daveti mevcut
 *            dispatchTicketKapandi ile gider; PUT'taki tek-sefer damgası
 *            ('satisfaction_requested' timeline kaydı) burada da uygulanır.
 *   ITIRAZ → IN_PROGRESS, itiraz sayacı artar, atanan teknisyene mail.
 *
 * YETKİ: yalnız TALEP SAHİBİ. IT ekibi kullanıcı adına onaylayamaz — onay
 * kullanıcının beyanı; IT için karşılığı zaten "Çözüldü" işaretlemesi.
 *
 * REOPENED enum'u kullanılmıyor (karar: itiraz → IN_PROGRESS).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const { id: ticketId } = await params
    const body = await request.json().catch(() => ({}))
    const karar = body?.karar

    if (karar !== 'ONAYLA' && karar !== 'ITIRAZ') {
      return NextResponse.json(
        { error: "karar 'ONAYLA' veya 'ITIRAZ' olmalıdır" },
        { status: 400 },
      )
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket bulunamadı' }, { status: 404 })
    }

    const sahip =
      (ticket.requesterEmail ?? '').toLowerCase().trim() ===
      (user.email ?? '').toLowerCase().trim()
    if (!sahip) {
      return NextResponse.json(
        { error: 'Bu kararı yalnız talep sahibi verebilir' },
        { status: 403 },
      )
    }

    if (!onayBekliyorMu(ticket.status)) {
      return NextResponse.json(
        { error: 'Bu talep onay bekleyen durumda değil' },
        { status: 409 },
      )
    }

    const simdi = new Date()
    const kullaniciAdi = user.name ?? user.email

    if (karar === 'ONAYLA') {
      await prisma.$transaction([
        prisma.ticket.update({
          where: { id: ticketId },
          data: {
            status: 'CLOSED',
            closedAt: simdi,
            autoClosed: false, // kullanıcı onayladı — sessizce kapanmadı
            autoCloseAt: null, // cron'un eline düşmesin
          },
        }),
        prisma.ticketTimeline.create({
          data: {
            ticketId,
            action: 'status_changed',
            description: 'Kullanıcı çözümü onayladı, talep kapandı',
            oldValue: ticket.status,
            newValue: 'CLOSED',
            performedBy: user.email,
            performedByName: kullaniciAdi,
          },
        }),
      ])

      // Kapanış + puanlama daveti: MEVCUT akış aynen. Tek sefer damgası PUT
      // ile aynı ('satisfaction_requested'), böylece kullanıcı hem burada hem
      // PUT üzerinden kapatılan taleplerde iki davet almaz.
      try {
        const zatenIstendi = await prisma.ticketTimeline.findFirst({
          where: { ticketId, action: 'satisfaction_requested' },
          select: { id: true },
        })
        if (!zatenIstendi) {
          await dispatchTicketKapandi(
            {
              id: ticket.id,
              ticketNumber: ticket.ticketNumber,
              subject: ticket.subject,
              requesterEmail: ticket.requesterEmail,
              status: 'CLOSED',
            },
            user.email,
          )
          await prisma.ticketTimeline.create({
            data: {
              ticketId,
              action: 'satisfaction_requested',
              description: 'Değerlendirme daveti gönderildi',
              performedBy: 'system',
              performedByName: 'Sistem',
            },
          })
        }
      } catch (err) {
        console.error('[ticket-onay] kapanış bildirimi gönderilemedi:', err)
      }

      // NOT: kapatan kişi = talep sahibi olduğu için dispatchTicketKapandi
      // kendi kuralı gereği maili göndermez (kendi kapattığına haber vermez).
      // Puanlama kartı ekranda zaten açılıyor; davet maili gereksiz.
      const guncel = await prisma.ticket.findUnique({ where: { id: ticketId } })
      return NextResponse.json(guncel)
    }

    // ── ITIRAZ ──────────────────────────────────────────────────────────
    // RESOLVED kapalı bir durumdu; IN_PROGRESS'e dönerken SLA duraklatma
    // muhasebesi tek kaynaktan geçsin.
    const baglam: TakvimBaglami = {
      ayar: await getSlaAyar(),
      tatilMap: await getTatilMap([simdi.getUTCFullYear() - 1, simdi.getUTCFullYear()]),
    }
    const durak = duraklatmaGecisi(
      ticket.status,
      'IN_PROGRESS',
      { slaPausedAt: ticket.slaPausedAt, slaPausedMinutes: ticket.slaPausedMinutes },
      simdi,
      baglam,
    )

    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'IN_PROGRESS',
          // Talep artık çözülü DEĞİL: damgalar temizlenir ki ikinci çözüm
          // kendi tarihini yazsın ve puanlama penceresi yanlış açılmasın.
          resolvedAt: null,
          autoCloseAt: null,
          objectionCount: { increment: 1 },
          lastObjectionAt: simdi,
          ...durak.guncelleme,
        },
      }),
      prisma.ticketTimeline.create({
        data: {
          ticketId,
          action: 'status_changed',
          description: 'Kullanıcı sorunun devam ettiğini bildirdi',
          oldValue: ticket.status,
          newValue: 'IN_PROGRESS',
          performedBy: user.email,
          performedByName: kullaniciAdi,
        },
      }),
    ])

    try {
      await dispatchTicketItiraz({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        assignedTo: ticket.assignedTo,
        itirazEdenAd: kullaniciAdi,
      })
    } catch (err) {
      console.error('[ticket-itiraz] bildirim gönderilemedi:', ticket.ticketNumber, err)
    }

    const guncel = await prisma.ticket.findUnique({ where: { id: ticketId } })
    return NextResponse.json(guncel)
  } catch (error) {
    console.error('Çözüm onay hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
