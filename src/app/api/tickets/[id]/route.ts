import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { dispatchTicketAssigned } from '@/lib/ticket-notifications'
import { parseMembers, isTeamMember } from '@/lib/tickets/team-members'
import { getSlaAyar, getTatilMap } from '@/lib/sla'
import { duraklatmaGecisi, ihlalDegerlendir, type TakvimBaglami } from '@/lib/sla/ihlal'

// GET - Ticket detayı
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-tickets: requireUser → user.role/department (DB taze)
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const userIsITStaff = session.user.permissions?.includes('helpdesk.admin') ?? false

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        category: true,
        // `assignedTeam: true` idi → ham `members` JSON'ı talebi açan HERKESE
        // gidiyordu. Üyelik bilgisi sunucuda hesaplanıp bayrak olarak dönüyor.
        assignedTeam: { select: { id: true, name: true, members: true } },
        parentTicket: {
          select: { id: true, ticketNumber: true, subject: true }
        },
        childTickets: {
          select: { id: true, ticketNumber: true, subject: true, status: true }
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          where: userIsITStaff ? {} : { isInternal: false }
        },
        timeline: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        workLogs: userIsITStaff ? {
          orderBy: { createdAt: 'desc' },
        } : false,
      }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket bulunamadı' }, { status: 404 })
    }

    // HAVUZ: üyelik bayragi + "Üstlen" gösterilsin mi. members istemciye SIZMAZ.
    const takimUyeleri = ticket.assignedTeam ? parseMembers(ticket.assignedTeam.members) : []
    const currentUserIsTeamMember = isTeamMember(takimUyeleri, user.email)
    const currentUserCanClaim =
      currentUserIsTeamMember && !!ticket.assignedTeamId && !ticket.assignedTo

    return NextResponse.json({
      ...ticket,
      assignedTeam: ticket.assignedTeam
        ? { id: ticket.assignedTeam.id, name: ticket.assignedTeam.name }
        : null,
      currentUserIsTeamMember,
      currentUserCanClaim,
    })
  } catch (error) {
    console.error('Ticket detay hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// PUT - Ticket güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-tickets: requireUser
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const userIsITStaff = session.user.permissions?.includes('helpdesk.admin') ?? false

    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
      // HAVUZ: takım üyeliği yetki kontrolü için gerekli (aşağıda isTicketTeamMember)
      include: { assignedTeam: { select: { members: true } } },
    })

    if (!existingTicket) {
      return NextResponse.json({ error: 'Ticket bulunamadı' }, { status: 404 })
    }

    // Yetki kontrolü: Normal kullanıcılar sadece kendi ticket'larını güncelleyebilir
    // PR-EMAIL-NORMALIZE sonrası DB casing lowercase, user.email lowercase → match güvenli
    const isOwner = existingTicket.requesterEmail === user.email
    // İş 1: atanan teknisyen (assignedTo = e-posta) de ticket'ını yönetip KAPATABİLİR.
    // Başkasının atanmadığı ticket'ta isAssignee false → yetki yok (eşleşme şart).
    const isAssignee = !!existingTicket.assignedTo && existingTicket.assignedTo === user.email
    // HAVUZ (Faz 3): ticket bir takıma düşmüşse o takımın ÜYELERİ de yönetip
    // KAPATABİLİR — henüz kimse üstlenmemiş olsa bile (küçük iş için üstlenme
    // zorunlu değil). Üyelik `members` JSON'ından, tek kaynak team-members.ts.
    const isTicketTeamMember = isTeamMember(
      parseMembers(existingTicket.assignedTeam?.members ?? null),
      user.email,
    )
    const canChangeStatus = userIsITStaff || isAssignee || isTicketTeamMember
    if (!userIsITStaff && !isOwner && !isAssignee && !isTicketTeamMember) {
      return NextResponse.json({ error: 'Bu ticket\'ı güncelleme yetkiniz yok' }, { status: 403 })
    }

    const {
      subject,
      description,
      categoryId,
      priority,
      status,
      ticketType,
      assignedTo,
      assignedToName,
      assignedTeamId,
      resolutionSummary,
      rootCause,
      satisfactionRating,
      satisfactionComment,
      attachments,
    } = body

    // Durum değiştirme: IT ekibi (helpdesk.admin) VEYA atanan teknisyen (İş 1).
    // Diğerleri (yalnız owner/requester) sadece CANCELLED (iptal) yapabilir.
    if (!canChangeStatus && status && !['CANCELLED'].includes(status)) {
      return NextResponse.json({ error: 'Durum değiştirme yetkiniz yok' }, { status: 403 })
    }

    // HAVUZ "Üstlen" muafiyeti (dar kapsam): takım üyesi, KENDİ takımının HENÜZ
    // ATANMAMIŞ ticket'ını KENDİSİNE alabilir. Üç koşul birden aranır:
    //   1) isTicketTeamMember — bu ticket'ın assignedTeam.members'ında (herhangi
    //      bir takım değil; ticket takımsızsa members boş → false)
    //   2) !existingTicket.assignedTo — havuzda; atanmışı BAŞKASINDAN ALAMAZ
    //   3) assignedTo === user.email — yalnız KENDİNE; başkasına atayamaz
    // E-posta karşılaştırması normalize: DB lowercase invariant'ı bozulursa
    // meşru üstlenme sessizce 403'e düşmesin.
    const kendineUstleniyor =
      isTicketTeamMember &&
      !existingTicket.assignedTo &&
      typeof assignedTo === 'string' &&
      assignedTo.toLowerCase().trim() === (user.email ?? '').toLowerCase().trim()

    // Atama / öncelik / talep tipi yalnız IT ekibinde (atanan teknisyen bunları değiştiremez)
    if (!userIsITStaff) {
      // Takım DEĞİŞTİRME muafiyet DIŞI: üstlenme yalnız kişiye atamadır, ticket'ı
      // başka takıma taşımak her zaman IT ekibine özeldir.
      if (assignedTeamId !== undefined) {
        return NextResponse.json({ error: 'Atama yapma yetkiniz yok' }, { status: 403 })
      }
      if (assignedTo !== undefined && !kendineUstleniyor) {
        return NextResponse.json({ error: 'Atama yapma yetkiniz yok' }, { status: 403 })
      }
      if (priority !== undefined) {
        return NextResponse.json({ error: 'Öncelik değiştirme yetkiniz yok' }, { status: 403 })
      }
      if (ticketType !== undefined) {
        return NextResponse.json({ error: 'Talep tipi değiştirme yetkiniz yok' }, { status: 403 })
      }
    }

    const updateData: Record<string, unknown> = {}
    const timelineEntries: Array<{
      action: string
      description: string
      oldValue?: string
      newValue?: string
    }> = []

    // Değişiklikleri takip et
    if (subject !== undefined && subject !== existingTicket.subject) {
      updateData.subject = subject
      timelineEntries.push({
        action: 'subject_changed',
        description: 'Konu değiştirildi',
        oldValue: existingTicket.subject,
        newValue: subject,
      })
    }

    // Ekler: istemci TAM listeyi gönderir (mevcut + yeni). DB'de JSON metin.
    // Erişim kapısı yukarıdaki 403 ile aynı — talep sahibi de kendi ticket'ına ek koyabilir.
    if (attachments !== undefined) {
      updateData.attachments = Array.isArray(attachments) && attachments.length > 0
        ? JSON.stringify(attachments)
        : null
      timelineEntries.push({
        action: 'attachments_changed',
        description: 'Ekler güncellendi',
      })
    }

    if (description !== undefined && description !== existingTicket.description) {
      updateData.description = description
      timelineEntries.push({
        action: 'description_changed',
        description: 'Açıklama güncellendi',
      })
    }

    if (categoryId !== undefined && categoryId !== existingTicket.categoryId) {
      updateData.categoryId = categoryId
      timelineEntries.push({
        action: 'category_changed',
        description: 'Kategori değiştirildi',
      })
    }

    if (priority !== undefined && priority !== existingTicket.priority) {
      updateData.priority = priority
      timelineEntries.push({
        action: 'priority_changed',
        description: 'Öncelik değiştirildi',
        oldValue: existingTicket.priority,
        newValue: priority,
      })
    }

    if (ticketType !== undefined && ticketType !== existingTicket.ticketType) {
      updateData.ticketType = ticketType
      const typeLabels: Record<string, string> = {
        INCIDENT: 'Olay',
        SERVICE_REQUEST: 'Hizmet Talebi',
        PROBLEM: 'Problem',
        CHANGE_REQUEST: 'Değişiklik Talebi',
      }
      timelineEntries.push({
        action: 'ticket_type_changed',
        description: 'Talep tipi değiştirildi',
        oldValue: typeLabels[existingTicket.ticketType] || existingTicket.ticketType,
        newValue: typeLabels[ticketType] || ticketType,
      })
    }

    if (status !== undefined && status !== existingTicket.status) {
      updateData.status = status
      timelineEntries.push({
        action: 'status_changed',
        description: 'Durum değiştirildi',
        oldValue: existingTicket.status,
        newValue: status,
      })

      // ── SLA: duraklatma + ihlal (TEK KAYNAK: @/lib/sla/ihlal) ───────────
      const slaSimdi = new Date()
      const slaBaglam: TakvimBaglami = {
        ayar: await getSlaAyar(),
        tatilMap: await getTatilMap([
          slaSimdi.getUTCFullYear() - 1,
          slaSimdi.getUTCFullYear(),
        ]),
      }

      // Duraklatma geçişi (PENDING/ON_HOLD'a giriş-çıkış). Hedef tarih
      // KAYDIRILMAZ; birikim karşılaştırma anında düşülür.
      const durak = duraklatmaGecisi(
        existingTicket.status,
        status,
        {
          slaPausedAt: existingTicket.slaPausedAt,
          slaPausedMinutes: existingTicket.slaPausedMinutes,
        },
        slaSimdi,
        slaBaglam,
      )
      Object.assign(updateData, durak.guncelleme)
      if (durak.olay) {
        timelineEntries.push({
          action: durak.olay,
          description:
            durak.olay === 'sla_paused'
              ? 'SLA duraklatıldı (kullanıcı/harici bekleniyor)'
              : `SLA devam ediyor (${durak.kapananDk} iş dk duraklatma eklendi)`,
        })
      }

      // İhlal değerlendirmesi — duraklatma DÜŞÜLMÜŞ hâliyle.
      // Geçiş sonrası durumu yansıtsın diye güncellenmiş alanlar kullanılır.
      const slaKarar = ihlalDegerlendir(
        {
          status,
          respondedAt: existingTicket.respondedAt,
          resolvedAt: existingTicket.resolvedAt,
          responseDueAt: existingTicket.responseDueAt,
          resolutionDueAt: existingTicket.resolutionDueAt,
          slaResponseBreached: existingTicket.slaResponseBreached,
          slaResolutionBreached: existingTicket.slaResolutionBreached,
          slaPausedAt: durak.guncelleme.slaPausedAt !== undefined
            ? durak.guncelleme.slaPausedAt
            : existingTicket.slaPausedAt,
          slaPausedMinutes: durak.guncelleme.slaPausedMinutes ?? existingTicket.slaPausedMinutes,
        },
        slaSimdi,
        slaBaglam,
      )

      // İlk yanıt zamanı
      if (!existingTicket.respondedAt && ['ASSIGNED', 'IN_PROGRESS'].includes(status)) {
        updateData.respondedAt = slaSimdi
        if (slaKarar.yanitIhlali) updateData.slaResponseBreached = true
      }

      // Çözüm zamanı
      if (status === 'RESOLVED' && !existingTicket.resolvedAt) {
        updateData.resolvedAt = slaSimdi
        if (slaKarar.cozumIhlali) updateData.slaResolutionBreached = true
      }

      // Kapanış zamanı
      if (status === 'CLOSED' && !existingTicket.closedAt) {
        updateData.closedAt = new Date()
      }

      // Yeniden açılma
      if (status === 'REOPENED') {
        updateData.resolvedAt = null
        updateData.closedAt = null
      }
    }

    if (assignedTo !== undefined && assignedTo !== existingTicket.assignedTo) {
      updateData.assignedTo = assignedTo
      updateData.assignedToName = assignedToName || null

      // Atandığında durumu güncelle
      if (assignedTo && existingTicket.status === 'NEW') {
        updateData.status = 'ASSIGNED'
      }

      timelineEntries.push({
        action: 'assigned',
        description: assignedTo ? `${assignedToName || assignedTo} kişisine atandı` : 'Atama kaldırıldı',
      })
    }

    if (assignedTeamId !== undefined && assignedTeamId !== existingTicket.assignedTeamId) {
      updateData.assignedTeamId = assignedTeamId
      timelineEntries.push({
        action: 'team_assigned',
        description: 'Ekip ataması değiştirildi',
      })
    }

    if (resolutionSummary !== undefined) {
      updateData.resolutionSummary = resolutionSummary
    }

    if (rootCause !== undefined) {
      updateData.rootCause = rootCause
    }

    if (satisfactionRating !== undefined) {
      updateData.satisfactionRating = satisfactionRating
      updateData.satisfactionComment = satisfactionComment || null
      timelineEntries.push({
        action: 'satisfaction_rated',
        description: `Memnuniyet puanı: ${satisfactionRating}/5`,
      })
    }

    // Güncelle
    const ticket = await prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        assignedTeam: true,
      }
    })

    // FIX #13: Timeline kayıtları - createMany ile tek sorguda oluştur
    if (timelineEntries.length > 0) {
      await prisma.ticketTimeline.createMany({
        data: timelineEntries.map(entry => ({
          ticketId: id,
          action: entry.action,
          description: entry.description,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          performedBy: user.email,
          performedByName: user.name ?? user.email,
        }))
      })
    }

    // Atama bildirimi (best-effort): yeni bir KİŞİYE atandıysa SADECE o kişiye in-app + push.
    // Atama kaldırma (boş) ve kendine atama → bildirim yok. Bildirim düşse de PUT başarısız olmaz.
    if (
      assignedTo !== undefined &&
      assignedTo !== existingTicket.assignedTo &&
      assignedTo &&
      assignedTo !== user.email
    ) {
      try {
        const assignee = await prisma.user.findUnique({
          where: { email: assignedTo },
          select: { id: true },
        })
        if (assignee) {
          await dispatchTicketAssigned(
            { id: ticket.id, ticketNumber: ticket.ticketNumber, subject: ticket.subject },
            assignee.id,
            user.name ?? user.email,
          )
        }
      } catch (err) {
        console.error('[ticket-assign-notify] dispatch failed:', err)
      }
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('Ticket güncelleme hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// DELETE - Ticket sil (soft delete)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-tickets: requireUser → user.role
    const { session, user, error } = await requireUser()
    if (error) return error

    // Sadece admin silebilir
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params

    await prisma.ticket.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ticket silme hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
