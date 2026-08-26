import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { dispatchTicketAssigned, dispatchTicketKapandi } from '@/lib/ticket-notifications'
import { parseMembers, isTeamMember } from '@/lib/tickets/team-members'
import { getSlaAyar, getTatilMap, cozumSlaDakika, hesaplaSlaHedefleri } from '@/lib/sla'
import { duraklatmaGecisi, ihlalDegerlendir, type TakvimBaglami } from '@/lib/sla/ihlal'
import { z } from 'zod'
import { puanlayabilirMi, redHttpKodu, RED_MESAJLARI } from '@/lib/tickets/memnuniyet'
import {
  KATEGORI_TURETME_SELECT,
  etkinOncelik,
  istemciGonderdiMi,
  kategoriAtamasi,
  type KategoriVarsayilanlari,
} from '@/lib/tickets/kategori-turetme'

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
        // Bağlı cihaz — DAR select. Cihaz silinmiş/relation kopmuşsa null döner;
        // bu bir hata değil, Ticket.assetInfo o anki anlık görüntüyü taşımaya
        // devam eder ve detayda o gösterilir.
        zimmetFormu: {
          select: {
            id: true,
            tur: true,
            turDiger: true,
            marka: true,
            model: true,
            seriNumarasi: true,
            pcAdi: true,
            cihazDurumu: true,
          }
        },
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

    // ── Yeniden sınıflandırma: kategori + öncelik ─────────────────────────
    // Bu iki alan SLA hedeflerinin ve (atamasız ticket'ta) kuyruğun girdisi.
    // Değiştiklerinde aşağıda "yeniden türetme" bloğu devreye giriyor.
    const kategoriDegisti = categoryId !== undefined && categoryId !== existingTicket.categoryId
    const yeniKategoriId = categoryId !== undefined ? categoryId : existingTicket.categoryId

    if (kategoriDegisti) {
      updateData.categoryId = categoryId
      timelineEntries.push({
        action: 'category_changed',
        description: 'Kategori değiştirildi',
      })
    }

    // ETKİN kategori. Öncelik değiştiğinde de okunur, çünkü SLA dakikaları hâlâ
    // MEVCUT kategoriden gelir (kategoride açık dakika varsa öncelik tabanı hiç
    // devreye girmez). categoryId NULL'a çekildiyse null kalır.
    //
    // Sorgu KAPILI: yeniden türetmeyi tetikleyecek bir şey yoksa (durum değişimi,
    // yorum, atama gibi sıradan PUT'lar) kategoriye hiç bakılmaz — her PUT'a
    // fazladan bir DB turu bindirmemek için.
    const turetmeGerekli = kategoriDegisti || istemciGonderdiMi(priority)
    let kategori: KategoriVarsayilanlari | null = null
    if (turetmeGerekli && yeniKategoriId) {
      kategori = await prisma.ticketCategory.findUnique({
        where: { id: yeniKategoriId },
        select: KATEGORI_TURETME_SELECT,
      })
    }

    // Etkin öncelik: istemci > (kategori DEĞİŞTİYSE) yeni kategorinin varsayılanı
    // > mevcut öncelik. Kategori değişmediyse varsayılanı devreye sokmuyoruz:
    // yoksa alakasız bir PUT eski bir ticket'ın önceliğini sessizce değiştirirdi.
    const etkinPriority = etkinOncelik(priority, kategoriDegisti ? kategori : null, existingTicket.priority)
    const oncelikDegisti = etkinPriority !== existingTicket.priority

    if (oncelikDegisti) {
      updateData.priority = etkinPriority
      timelineEntries.push({
        action: 'priority_changed',
        description: istemciGonderdiMi(priority)
          ? 'Öncelik değiştirildi'
          : 'Öncelik yeni kategorinin varsayılanına güncellendi',
        oldValue: existingTicket.priority,
        newValue: etkinPriority,
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

    // ── YENİDEN TÜRETME: kategori/öncelik değiştiyse SLA + (boşsa) kuyruk ────
    // Açık atama bloklarından SONRA çalışır: istemci aynı istekte atama
    // gönderdiyse ona dokunmayız, türetme yalnız boşluğu doldurur.
    if (kategoriDegisti || oncelikDegisti) {
      const slaDk = cozumSlaDakika(kategori, etkinPriority)
      // BAŞLANGIÇ ANI createdAt — `now` DEĞİL. Yeniden sınıflandırma SLA saatini
      // sıfırlamaz; talep açıldığı andan itibaren işlemeye devam eder.
      const yeniHedef = await hesaplaSlaHedefleri(
        existingTicket.createdAt,
        slaDk.responseMin,
        slaDk.resolutionMin,
      )

      // KORUMA — her hedef AYRI değerlendirilir. İhlal işaretlenmişse ya da
      // hedefe zaten ulaşılmışsa o hedef DONAR. Gerekçe ihlal.ts:7'deki ilke:
      // "hedef tarih KAYDIRILMAZ — denetim izi". Geçmişe dönük bir hedef
      // kaydırması, gerçekleşmiş bir ihlali olmamış gibi gösterirdi.
      //
      // ESKİ KAYITLAR: responseDueAt/resolutionDueAt'i NULL olan motor öncesi
      // ticket'lar da buradan geçer ve hedefleri İLK KEZ üretilir — ihlal
      // bayrakları false, respondedAt/resolvedAt null olduğu sürece koruma
      // engellemez. NULL hedefli ticket'ları cron zaten hiç değerlendirmiyordu.
      const yanitGuncellenebilir =
        existingTicket.respondedAt === null && existingTicket.slaResponseBreached === false
      const cozumGuncellenebilir =
        existingTicket.resolvedAt === null && existingTicket.slaResolutionBreached === false

      const ayniAn = (a: Date | null, b: Date): boolean => a !== null && a.getTime() === b.getTime()

      const yanitDegisti = yanitGuncellenebilir && !ayniAn(existingTicket.responseDueAt, yeniHedef.responseDueAt)
      const cozumDegisti = cozumGuncellenebilir && !ayniAn(existingTicket.resolutionDueAt, yeniHedef.resolutionDueAt)

      if (yanitDegisti) {
        updateData.responseDueAt = yeniHedef.responseDueAt
        // Eski takvim-saati ikizi POST'ta hep aynı değerle yazılıyor; burada da
        // birlikte güncellenir ki ikili ilk kez ayrışmasın. (Okuyan mantık yok.)
        updateData.slaResponseDue = yeniHedef.responseDueAt
      }
      if (cozumDegisti) {
        updateData.resolutionDueAt = yeniHedef.resolutionDueAt
        updateData.slaResolutionDue = yeniHedef.resolutionDueAt
      }

      // Timeline YALNIZ hedef fiilen değiştiyse. Koruma engellediyse kayıt yok.
      if (yanitDegisti || cozumDegisti) {
        const bicim = (d: Date | null): string => (d === null ? '—' : d.toISOString())
        const parcalar: string[] = []
        if (yanitDegisti) parcalar.push(`yanıt ${bicim(existingTicket.responseDueAt)} → ${bicim(yeniHedef.responseDueAt)}`)
        if (cozumDegisti) parcalar.push(`çözüm ${bicim(existingTicket.resolutionDueAt)} → ${bicim(yeniHedef.resolutionDueAt)}`)
        const donan: string[] = []
        if (!yanitGuncellenebilir) donan.push('yanıt')
        if (!cozumGuncellenebilir) donan.push('çözüm')

        timelineEntries.push({
          action: 'sla_recalculated',
          description:
            `SLA hedefi yeniden hesaplandı (${parcalar.join(', ')})` +
            (donan.length > 0 ? ` — ${donan.join(' ve ')} hedefi dondu` : ''),
          oldValue: `${bicim(existingTicket.responseDueAt)} / ${bicim(existingTicket.resolutionDueAt)}`,
          newValue:
            `${bicim(yanitDegisti ? yeniHedef.responseDueAt : existingTicket.responseDueAt)} / ` +
            `${bicim(cozumDegisti ? yeniHedef.resolutionDueAt : existingTicket.resolutionDueAt)}`,
        })
      }

      // KUYRUK — yalnız ticket TAMAMEN atamasızsa. Atanmış/havuzdaki bir
      // ticket'tan kimsenin işini koparmıyoruz. İstemci aynı istekte atama
      // gönderdiyse de karışmıyoruz (yukarıdaki bloklar onu zaten işledi).
      const atamaBos =
        existingTicket.assignedTo === null &&
        existingTicket.assignedTeamId === null &&
        assignedTo === undefined &&
        assignedTeamId === undefined

      if (kategoriDegisti && atamaBos) {
        const atama = kategoriAtamasi(kategori)
        if (atama.assignedTeamId) {
          updateData.assignedTeamId = atama.assignedTeamId
          timelineEntries.push({
            action: 'team_assigned',
            description: 'Kategori değişimiyle ekibe atandı',
          })
        } else if (atama.assignedTo) {
          updateData.assignedTo = atama.assignedTo
          updateData.assignedToName = null // LDAP'tan isim alınabilir (POST'ta da null)
          timelineEntries.push({
            action: 'assigned',
            description: `Kategori değişimiyle ${atama.assignedTo} kişisine atandı`,
          })
          // POST'taki `status: assignedTo ? 'ASSIGNED' : 'NEW'` kuralının PUT
          // karşılığı: yalnız NEW ilerletilir (mevcut atama bloğuyla aynı guard,
          // satır ~351). IN_PROGRESS bir ticket geriye çekilmez. Aynı istekte
          // istemci durum gönderdiyse ona dokunulmaz.
          if (updateData.status === undefined && existingTicket.status === 'NEW') {
            updateData.status = 'ASSIGNED'
          }
        }
        // Takıma düşen ticket NEW kalır — havuzda bekler (POST ile aynı).
      }
    }

    if (resolutionSummary !== undefined) {
      updateData.resolutionSummary = resolutionSummary
    }

    if (rootCause !== undefined) {
      updateData.rootCause = rootCause
    }

    if (satisfactionRating !== undefined) {
      // ── MEMNUNİYET: sunucu-tarafı doğrulama (UI'ya güvenilmez) ──────────
      const memnuniyetSemasi = z.object({
        satisfactionRating: z.number().int().min(1).max(5),
        satisfactionComment: z.string().trim().max(500).optional().nullable(),
      })
      const cozumleme = memnuniyetSemasi.safeParse({ satisfactionRating, satisfactionComment })
      if (!cozumleme.success) {
        return NextResponse.json(
          { error: 'Geçersiz değerlendirme', detay: cozumleme.error.issues.map((i) => i.message) },
          { status: 400 },
        )
      }

      // Kurallar tek kaynakta (@/lib/tickets/memnuniyet) — UI aynısını kullanır.
      const karar = puanlayabilirMi(
        {
          requesterEmail: existingTicket.requesterEmail,
          status: existingTicket.status,
          closedAt: existingTicket.closedAt,
          resolvedAt: existingTicket.resolvedAt,
          satisfactionRating: existingTicket.satisfactionRating,
        },
        user.email,
        new Date(),
      )
      if (!karar.puanlayabilir) {
        return NextResponse.json(
          { error: RED_MESAJLARI[karar.sebep!] },
          { status: redHttpKodu(karar.sebep!) },
        )
      }

      updateData.satisfactionRating = cozumleme.data.satisfactionRating
      updateData.satisfactionComment = cozumleme.data.satisfactionComment?.trim() || null
      timelineEntries.push({
        action: 'satisfaction_rated',
        description: `Memnuniyet puanı: ${cozumleme.data.satisfactionRating}/5`,
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

    // ── KAPANIŞ + DEĞERLENDİRME DAVETİ (best-effort) ────────────────────
    // RESOLVED/CLOSED'a GEÇİŞTE talebi açana bir kez gider.
    // TEK SEFER: yeni kolon eklenmedi; damga TicketTimeline'daki
    // 'satisfaction_requested' kaydının varlığı. RESOLVED→CLOSED ikinci
    // geçişinde bu kayıt zaten durduğu için tekrar gönderilmez.
    if (
      status !== undefined &&
      status !== existingTicket.status &&
      ['RESOLVED', 'CLOSED'].includes(status)
    ) {
      try {
        const zatenIstendi = await prisma.ticketTimeline.findFirst({
          where: { ticketId: id, action: 'satisfaction_requested' },
          select: { id: true },
        })
        if (!zatenIstendi) {
          await dispatchTicketKapandi(
            {
              id: ticket.id,
              ticketNumber: ticket.ticketNumber,
              subject: ticket.subject,
              requesterEmail: ticket.requesterEmail,
              status,
            },
            user.email,
          )
          // Damgayı bildirim GİTTİKTEN sonra yaz: gönderim patlarsa bir
          // sonraki geçişte yeniden denenir (kapanış bildirimi 15 dakikada
          // bir tekrarlayan bir şey değil, kaçırmak göndermekten kötü).
          await prisma.ticketTimeline.create({
            data: {
              ticketId: id,
              action: 'satisfaction_requested',
              description: 'Değerlendirme daveti gönderildi',
              performedBy: 'system',
              performedByName: 'Sistem',
            },
          })
        }
      } catch (err) {
        console.error('[ticket-kapanis-notify] dispatch failed:', err)
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
