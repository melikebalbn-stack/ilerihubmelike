import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dispatchTicketCreated, dispatchTicketAssigned, dispatchTicketToTeam, dispatchTicketKaydedildi } from '@/lib/ticket-notifications'
import { parseMembers } from '@/lib/tickets/team-members'
import { requireUser } from '@/lib/auth/require-user'
import { getMyTeamIds, assignedToMeFilter } from '@/lib/tickets/my-teams'
import { cozumSlaDakika, hesaplaSlaHedefleri } from '@/lib/sla'
import { cihazAnlikGoruntu, ASSET_INFO_MAX } from '@/lib/tickets/cihaz-etiket'
import { ticketNumarasiUret } from '@/lib/tickets/ticket-numarasi'
import {
  KATEGORI_TURETME_SELECT,
  etkinOncelik,
  kategoriAtamasi,
  type KategoriVarsayilanlari,
} from '@/lib/tickets/kategori-turetme'


// GET - Ticket listesi
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-tickets: requireUser → user.email/role/department (DB taze)
    const { session, user, error } = await requireUser()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const viewMode = searchParams.get('viewMode') || 'all'
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')

    const userEmail = user.email
    // PR-Y9c: saf RBAC, helpdesk.admin permission. Eski legacy (role/dept fallback) kaldırıldı.
    const userIsITStaff = session.user.permissions?.includes('helpdesk.admin') ?? false

    // Filtreler
    const where: Record<string, unknown> = {
      isActive: true,
    }

    // Görünüm moduna göre filtrele
    if (viewMode === 'my') {
      // Benim açtığım ticket'lar
      where.requesterEmail = userEmail
    } else if (viewMode === 'assigned') {
      // HAVUZ: "bana atanan" = kişiye atanmış VEYA üyesi olduğum takıma düşmüş.
      //
      // ESKİDEN: `!userIsITStaff && myTeamIds.length === 0` → requesterEmail'e
      // düşülüyordu. Sonuç: helpdesk-agent rolündeki ve hiçbir takımda olmayan bir
      // teknisyene DOĞRUDAN atanmış talepler listede HİÇ görünmüyordu (sayaç ise
      // stats/route.ts'te koşulsuz assignedToMeFilter kullandığı için doğru sayıyordu
      // — rozet 2, liste 0). Kişisel atama takım üyeliğinden de helpdesk.admin'den de
      // BAĞIMSIZDIR: `helpdesk.ticket.resolve` yeten koşuldur (talebi işleyebilen
      // rol = helpdesk-agent / it-admin / super-admin; `helpdesk.ticket.view` temel
      // `kullanici` rolünde olduğu için ayrım yapmıyordu).
      //
      // assignedToMeFilter takımsız durumu zaten doğru işliyor ({ assignedTo: email }),
      // olduğu gibi kullanılıyor. İzni olmayan için eski davranış (requesterEmail) aynen.
      const myTeamIds = await getMyTeamIds(userEmail)
      const canSeeAssigned =
        userIsITStaff ||
        (session.user.permissions?.includes('helpdesk.ticket.resolve') ?? false) ||
        myTeamIds.length > 0
      if (!canSeeAssigned) {
        where.requesterEmail = userEmail
      } else {
        // AND ile ekleniyor: `where.OR` aşağıda ARAMA filtresi tarafından
        // kullanılıyor, doğrudan atansaydı arama bu koşulu ezerdi.
        where.AND = [assignedToMeFilter(userEmail, myTeamIds)]
      }
    } else if (viewMode === 'all') {
      // Tüm ticket'lar (sadece IT ekibi)
      if (!userIsITStaff) {
        where.requesterEmail = userEmail // IT değilse kendi ticket'larını görsün
      }
      // IT ekibi için filtre yok - hepsini görür
    } else if (viewMode === 'open') {
      // Açık ticket'lar
      where.status = { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'REOPENED'] }
      // Normal kullanıcılar sadece kendi açık ticket'larını görsün
      if (!userIsITStaff) {
        where.requesterEmail = userEmail
      }
    }

    // Durum filtresi
    if (status) {
      where.status = status
    }

    // Öncelik filtresi
    if (priority) {
      where.priority = priority
    }

    // Kategori filtresi
    if (categoryId) {
      where.categoryId = categoryId
    }

    // Arama
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { requesterName: { contains: search, mode: 'insensitive' } },
      ]
    }

    // B3 sıralama: AÇIK ticket'lar önce, sonra öncelik (desc), sonra en yeni.
    // Prisma enum tek alanla "açık önce" sıralayamaz → açık/kapalı iki partition,
    // her biri [priority desc, createdAt desc]; birleştir. Skip yok → top-N güvenli
    // (limit açık grubu doldurmazsa kalanı kapalıdan al). Mevcut where.status'u
    // ezmemek için AND ile kesişim.
    const OPEN_STATUSES = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'REOPENED']
    const CLOSED_STATUSES = ['RESOLVED', 'CLOSED', 'CANCELLED']
    const include = {
      category: { select: { id: true, name: true, color: true, icon: true } },
      assignedTeam: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    }
    const orderBy = [{ priority: 'desc' as const }, { createdAt: 'desc' as const }]
    const fetchPartition = (statuses: string[], take: number) =>
      take <= 0
        ? Promise.resolve([])
        : prisma.ticket.findMany({
            where: { AND: [where, { status: { in: statuses } }] },
            include,
            orderBy,
            take,
          })

    const openTickets = await fetchPartition(OPEN_STATUSES, limit)
    const closedTickets = await fetchPartition(CLOSED_STATUSES, limit - openTickets.length)
    const tickets = [...openTickets, ...closedTickets]

    return NextResponse.json(tickets)
  } catch (error) {
    console.error('Ticket listesi hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}

// POST - Yeni ticket oluştur
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-tickets: requireUser
    const { session, user, error } = await requireUser()
    if (error) return error

    const body = await request.json()
    const {
      subject,
      description,
      ticketType = 'INCIDENT',
      categoryId,
      // DİKKAT: burada `priority = 'NORMAL'` varsayılanı YOK — bilerek.
      // Varsayılan olsaydı "istemci göndermedi" ile "istemci NORMAL gönderdi"
      // ayırt edilemezdi ve kategorinin defaultPriority'si hiç devreye giremezdi.
      // Etkin değer aşağıda etkinOncelik() ile çözülüyor.
      priority,
      impact = 'INDIVIDUAL',
      urgency = 'MEDIUM',
      location,
      assetInfo,
      zimmetFormuId,
      attachments,
      // BAŞKASI ADINA KAYIT (IT ekibi): talep sahibi bu kişi olur, kaydeden
      // oturum sahibi olarak ayrıca saklanır.
      talepEdenEmail,
      kanal,
    } = body

    if (!subject?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: 'Konu ve açıklama zorunludur' },
        { status: 400 }
      )
    }

    // ── BAŞKASI ADINA KAYIT ──────────────────────────────────────────────
    // Yalnız IT ekibi (helpdesk.admin) başkası adına talep açabilir. İzin
    // yoksa gövdeden gelen talepEdenEmail YOK SAYILIR — 400 dönmüyoruz çünkü
    // eski istemciler bu alanı hiç göndermiyor ve akış bozulmamalı.
    //
    // İSTEMCİYE GÜVENİLMEZ: seçilen kişinin ad/departman bilgisi gövdeden
    // DEĞİL, User tablosundan okunuyor.
    const itEkibi = session.user.permissions?.includes('helpdesk.admin') ?? false
    const talepEdenHam =
      itEkibi && typeof talepEdenEmail === 'string' ? talepEdenEmail.toLowerCase().trim() : ''
    const baskasiAdina = talepEdenHam !== '' && talepEdenHam !== user.email.toLowerCase()

    let talepSahibi = {
      email: user.email,
      name: user.name ?? user.email,
      dept: user.department || null,
    }
    if (baskasiAdina) {
      const secilen = await prisma.user.findUnique({
        where: { email: talepEdenHam },
        select: { email: true, firstName: true, lastName: true, name: true, department: true, isActive: true },
      })
      if (!secilen || !secilen.isActive) {
        return NextResponse.json(
          { error: 'Seçilen talep eden bulunamadı veya pasif' },
          { status: 400 },
        )
      }
      const tam = [secilen.firstName, secilen.lastName].filter(Boolean).join(' ').trim()
      talepSahibi = {
        email: secilen.email,
        name: tam || secilen.name || secilen.email,
        dept: secilen.department || null,
      }
    }

    // Kanal: başkası adına kayıtta PHONE (varsayılan) veya WALK_IN.
    // Kendi adına açılan talep WEB_PORTAL kalır — enum'a MANUEL eklenmedi.
    const kaynak: 'WEB_PORTAL' | 'PHONE' | 'WALK_IN' = !baskasiAdina
      ? 'WEB_PORTAL'
      : kanal === 'WALK_IN'
      ? 'WALK_IN'
      : 'PHONE'

    // ── Zimmet (cihaz) bağı ──────────────────────────────────────────────
    // İSTEMCİYE GÜVENİLMEZ: gönderilen id gerçekten oturum sahibinin AKTİF ve
    // ONAYLANMIŞ zimmetinde mi, sunucuda doğrulanır. Başkasının cihaz id'sini
    // gönderen istek 400 alır — sahiplik filtresi sorgunun içinde, gövdeden
    // gelen hiçbir alanla ezilemez.
    let bagliZimmetId: string | null = null
    let cozulmusAssetInfo: string | null = null

    if (typeof zimmetFormuId === 'string' && zimmetFormuId.trim()) {
      const cihaz = await prisma.zimmetFormu.findFirst({
        where: {
          id: zimmetFormuId.trim(),
          zimmetSahibiId: user.id,
          silindiMi: false,
          cihazDurumu: 'AKTIF',
          durum: 'ONAYLANDI',
        },
        select: {
          id: true,
          tur: true,
          turDiger: true,
          marka: true,
          model: true,
          seriNumarasi: true,
          pcAdi: true,
        },
      })

      if (!cihaz) {
        return NextResponse.json(
          { error: 'Seçilen cihaz zimmetinizde bulunamadı' },
          { status: 400 }
        )
      }

      bagliZimmetId = cihaz.id
      // Cihaz seçildiyse istemciden gelen assetInfo YOK SAYILIR: alan artık
      // seçim anının anlık görüntüsü, kullanıcı metni değil.
      cozulmusAssetInfo = cihazAnlikGoruntu(cihaz) || null
    } else {
      // Serbest metin yolu. Boş/whitespace → "" DEĞİL, NULL yazılır.
      const serbest = typeof assetInfo === 'string' ? assetInfo.trim() : ''
      if (serbest.length > ASSET_INFO_MAX) {
        return NextResponse.json(
          { error: `İlgili cihaz bilgisi en fazla ${ASSET_INFO_MAX} karakter olabilir` },
          { status: 400 }
        )
      }
      cozulmusAssetInfo = serbest || null
    }

    const ticketNumber = await ticketNumarasiUret(prisma)
    const now = new Date()

    // Kategori varsayılan atama kontrolü
    let assignedTo = null
    let assignedToName = null
    let assignedTeamId = null
    // Kategori TEK değişkende: SLA dakikaları, atama ve öncelik varsayılanı
    // aynı kayıttan okunuyor.
    let kategori: KategoriVarsayilanlari | null = null

    if (categoryId) {
      kategori = await prisma.ticketCategory.findUnique({
        where: { id: categoryId },
        select: KATEGORI_TURETME_SELECT,
      })

      // Atama kuralı (takım > kişi) tek kaynakta: kategoriAtamasi(). Takıma düşen
      // ticket'ta assignedTo BOŞ kalır, dolayısıyla aşağıdaki
      // `status: assignedTo ? 'ASSIGNED' : 'NEW'` onu kendiliğinden NEW bırakır —
      // havuzda, üyelerden biri üstlenene kadar.
      const atama = kategoriAtamasi(kategori)
      assignedTeamId = atama.assignedTeamId
      assignedTo = atama.assignedTo
      // assignedToName LDAP'tan alınabilir (bugün null kalıyor)
    }

    // Etkin öncelik: istemci > kategori varsayılanı > 'NORMAL'.
    // SLA de bu değerle türer (cozumSlaDakika aşağıda onu alıyor).
    const etkinPriority = etkinOncelik(priority, kategori, 'NORMAL')

    // ── İŞ-SAATİ SLA (Faz 1b) ────────────────────────────────────────────
    // Dakikalar: kategori değeri varsa o, yoksa öncelik tabanı (cozumSlaDakika).
    // Hedefler çalışma takvimine göre ileri sarılır; gece/tatilde biten bir
    // hedef üretilmez. Eski TAKVİM-saati alanları (slaResponseDue /
    // slaResolutionDue) İHLAL HESABI hâlâ onları okuduğu için yerinde bırakıldı
    // — bu fazda ihlal mantığına dokunulmuyor.
    const slaDk = cozumSlaDakika(kategori, etkinPriority)
    const slaHedef = await hesaplaSlaHedefleri(now, slaDk.responseMin, slaDk.resolutionMin)

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        subject: subject.trim(),
        description: description.trim(),
        ticketType,
        categoryId,
        priority: etkinPriority,
        impact,
        urgency,
        status: assignedTo ? 'ASSIGNED' : 'NEW',
        requesterEmail: talepSahibi.email,
        requesterName: talepSahibi.name,
        requesterDept: talepSahibi.dept,
        // Kaydeden yalnız BAŞKASI ADINA açılan taleplerde dolu; kendi açtığında
        // NULL kalır (mevcut kayıtlarla aynı anlam).
        createdByEmail: baskasiAdina ? user.email : null,
        createdByName: baskasiAdina ? (user.name ?? user.email) : null,
        location,
        assetInfo: cozulmusAssetInfo,
        zimmetFormuId: bagliZimmetId,
        assignedTo,
        assignedToName,
        assignedTeamId,
        slaResponseDue: slaHedef.responseDueAt,
        slaResolutionDue: slaHedef.resolutionDueAt,
        responseDueAt: slaHedef.responseDueAt,
        resolutionDueAt: slaHedef.resolutionDueAt,
        attachments: attachments ? JSON.stringify(attachments) : null,
        source: kaynak,
      },
      include: {
        category: true,
      }
    })

    // Timeline kaydı
    await prisma.ticketTimeline.create({
      data: {
        ticketId: ticket.id,
        action: 'created',
        description: 'Ticket oluşturuldu',
        performedBy: user.email,
        performedByName: user.name ?? user.email,
      }
    })

    // ── Faz 4: CREATE'te ATAMA bildirimi ────────────────────────
    // Boşluk şuydu: dispatchTicketAssigned YALNIZ sonradan atama yapılan PUT
    // yolunda çağrılıyordu. Kategoriden gelen OTOMATİK atama (kişi) ve HAVUZA
    // düşme (takım) hiç kimseye haber vermiyordu.
    //
    // İki dal birbirini dışlar (create'teki öncelik kuralı: takım > kişi):
    //   assignedTo dolu  → kişiye atandı  → tek kişilik dispatchTicketAssigned
    //   assignedTeamId dolu & assignedTo boş → havuz → tüm üyelere
    //
    // Best-effort: tüm blok try/catch içinde, bildirim ticket'ı bozmaz.
    // Ticket zaten oluştu; buradaki hata yalnız loglanır.
    // Atama yolunda bildirilen e-postalar — oluşturma bildirimi bunları ATLAR
    // (aynı kişiye "atandı" + "yeni ticket" diye iki mail gitmesin). Talebi açan
    // kişi de baştan kümede: kendi açtığı talebi kendine duyurmayız.
    const zatenBildirilen: string[] = [user.email]
    try {
      if (ticket.assignedTo) {
        // Kendi kendine atama → bildirim yok (PUT yolundaki kuralla aynı).
        if (ticket.assignedTo !== user.email) {
          const assignee = await prisma.user.findUnique({
            where: { email: ticket.assignedTo },
            select: { id: true },
          })
          if (assignee) {
            await dispatchTicketAssigned(
              { id: ticket.id, ticketNumber: ticket.ticketNumber, subject: ticket.subject },
              assignee.id,
              user.name ?? user.email,
            )
            zatenBildirilen.push(ticket.assignedTo)
          }
        } else {
          zatenBildirilen.push(ticket.assignedTo)
        }
      } else if (ticket.assignedTeamId) {
        const team = await prisma.ticketTeam.findUnique({
          where: { id: ticket.assignedTeamId },
          select: { name: true, members: true },
        })
        if (team) {
          const uyeler = parseMembers(team.members).map((m) => m.email)
          await dispatchTicketToTeam(
            { id: ticket.id, ticketNumber: ticket.ticketNumber, subject: ticket.subject },
            team.name,
            uyeler,
            user.email, // açan kişi üyeyse ona gitmesin
          )
          zatenBildirilen.push(...uyeler)
        }
      }
    } catch (err) {
      console.error('[ticket-create-assign-notify] dispatch failed:', err)
    }

    // ── Bildirim dispatcher (PR-TKT-NTF-1A) ─────────────────────
    // Fire-and-forget: response'u bloklamaz. Hata olursa loglanır.
    // IT ekibi (Sistem Geliştirme dept'i) email + in-app + push alır.
    void dispatchTicketCreated(
      {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        category: ticket.category?.name ?? '(Kategorisiz)',
        categoryId: ticket.category?.id ?? null,
        requesterName: ticket.requesterName,
        requesterDept: ticket.requesterDept ?? '',
        createdAt: ticket.createdAt,
      },
      zatenBildirilen,
    ).catch((err) => {
      console.error('[ticket-notify] unhandled dispatch error:', err)
    })
    // ── BAŞKASI ADINA KAYIT: talep SAHİBİNE haber ver ───────────
    // dispatchTicketCreated IT ekibine gidiyor ve talebi AÇANI alıcı
    // kümesinden düşüyor; burada açan IT personeli, sahip başkası — sahip
    // hiçbir şey almaz ve adına açılmış talepten habersiz kalırdı.
    // Kendi adına açılan taleplerde çağrılmaz (baskasiAdina false).
    if (baskasiAdina) {
      void dispatchTicketKaydedildi({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        requesterEmail: ticket.requesterEmail,
        kaydedenAd: user.name ?? user.email,
        kanal: kaynak,
      }).catch((err) => {
        console.error('[ticket-kayit-notify] unhandled dispatch error:', err)
      })
    }
    // ────────────────────────────────────────────────────────────

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error('Ticket oluşturma hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
