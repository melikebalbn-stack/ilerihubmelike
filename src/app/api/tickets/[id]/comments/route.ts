import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getSlaAyar, getTatilMap } from '@/lib/sla'
import { duraklatmaGecisi, ihlalDegerlendir, type TakvimBaglami } from '@/lib/sla/ihlal'
import { canAccessTicket } from '@/lib/ticket-yetki'
import { dispatchTicketYorum } from '@/lib/ticket-notifications'

// GET - Ticket yorumları
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-tickets: requireUser → user.role
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id: ticketId } = await params
    // Internal yorumları sadece IT staff görebilir.
    const isAdmin = session.user.permissions?.includes('helpdesk.admin') ?? false

    // YETKİ: eskiden burada HİÇBİR kontrol yoktu — oturum açmış herkes, ticket
    // id'sini bilmesi kâfi, başkasının talebinin yorumlarını okuyabiliyordu.
    // Kural PUT ile aynı (owner / atanan / takım üyesi / IT ekibi), tek kaynak.
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        requesterEmail: true,
        assignedTo: true,
        assignedTeam: { select: { members: true } },
      },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket bulunamadı' }, { status: 404 })
    }
    if (!canAccessTicket(ticket, { email: user.email, isITStaff: isAdmin })) {
      return NextResponse.json({ error: 'Bu ticket\'ı görüntüleme yetkiniz yok' }, { status: 403 })
    }

    const comments = await prisma.ticketComment.findMany({
      where: {
        ticketId,
        // Admin değilse dahili notları gösterme
        ...(isAdmin ? {} : { isInternal: false })
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error('Yorumlar getirilemedi:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// POST - Yeni yorum ekle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-tickets: requireUser
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id: ticketId } = await params
    const body = await request.json()
    const { content, isInternal = false, isResolution = false, attachments } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Yorum içeriği zorunludur' }, { status: 400 })
    }

    // Ticket'ı kontrol et — takım üyeleri yetki kontrolünde gerekli (canAccessTicket)
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { assignedTeam: { select: { members: true } } },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket bulunamadı' }, { status: 404 })
    }

    // PR-Y9a: Sadece IT staff dahili not ekleyebilir
    const isAdmin = session.user.permissions?.includes('helpdesk.admin') ?? false

    // YETKİ: eskiden yalnız oturum aranıyordu → ticket id'sini bilen herkes
    // başkasının talebine yorum yazabiliyordu. Kural PUT ile aynı, tek kaynak.
    if (!canAccessTicket(ticket, { email: user.email, isITStaff: isAdmin })) {
      return NextResponse.json({ error: 'Bu ticket\'a yorum yazma yetkiniz yok' }, { status: 403 })
    }

    const finalIsInternal = isAdmin ? isInternal : false

    // Yorum oluştur
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId,
        authorEmail: user.email,
        authorName: user.name ?? user.email,
        content: content.trim(),
        isInternal: finalIsInternal,
        isResolution,
        attachments: attachments ? JSON.stringify(attachments) : null,
      }
    })

    // Timeline kaydı
    await prisma.ticketTimeline.create({
      data: {
        ticketId,
        action: finalIsInternal ? 'internal_note_added' : 'comment_added',
        description: finalIsInternal ? 'Dahili not eklendi' : 'Yorum eklendi',
        performedBy: user.email,
        performedByName: user.name ?? user.email,
      }
    })

    // ── SLA: ihlal hesabı TEK KAYNAK (@/lib/sla/ihlal) ────────────────────
    // Eskiden burada slaResponseDue/slaResolutionDue ile ayrı bir karşılaştırma
    // vardı; formül üç dosyada kopyalanıyordu. Artık tek fonksiyon, duraklatma
    // düşülmüş hâliyle.
    const slaSimdi = new Date()
    const slaBaglam: TakvimBaglami = {
      ayar: await getSlaAyar(),
      tatilMap: await getTatilMap([slaSimdi.getUTCFullYear() - 1, slaSimdi.getUTCFullYear()]),
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

    // İlk yanıt kontrolü (IT personeli yanıt verdiyse)
    if (isAdmin && !ticket.respondedAt) {
      const karar = ihlalDegerlendir(slaGirdi, slaSimdi, slaBaglam)
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          respondedAt: slaSimdi,
          slaResponseBreached: karar.yanitIhlali || ticket.slaResponseBreached,
        }
      })
    }

    // Çözüm notu ise durumu güncelle
    if (isResolution && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
      // RESOLVED kapalı durumdur: duraklatmadaysa birikim burada kapanır.
      const durak = duraklatmaGecisi(ticket.status, 'RESOLVED', slaGirdi, slaSimdi, slaBaglam)
      const karar = ihlalDegerlendir(slaGirdi, slaSimdi, slaBaglam)
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'RESOLVED',
          resolvedAt: slaSimdi,
          resolutionSummary: content.trim(),
          slaResolutionBreached: karar.cozumIhlali || ticket.slaResolutionBreached,
          ...durak.guncelleme,
        }
      })

      // Timeline kaydı
      await prisma.ticketTimeline.create({
        data: {
          ticketId,
          action: 'status_changed',
          description: 'Durum değiştirildi',
          oldValue: ticket.status,
          newValue: 'RESOLVED',
          performedBy: user.email,
          performedByName: user.name ?? user.email,
        }
      })
    }

    // ── YORUM BİLDİRİMİ (best-effort) ───────────────────────────────────
    // Yorum + timeline + SLA işleri BİTTİKTEN sonra; PUT'taki dispatch
    // çağrılarıyla aynı kalıp (try/catch, hata yutulur, yanıt bloklanmaz).
    // Dahili notta dispatch kendisi çıkıyor — koşul burada tekrarlanmıyor.
    try {
      await dispatchTicketYorum(
        {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          requesterEmail: ticket.requesterEmail,
          assignedTo: ticket.assignedTo,
        },
        {
          content: comment.content,
          isInternal: finalIsInternal,
          authorEmail: comment.authorEmail,
          authorName: comment.authorName,
        },
      )
    } catch (err) {
      console.error('[ticket-yorum-notify] dispatch failed:', err)
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Yorum ekleme hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
