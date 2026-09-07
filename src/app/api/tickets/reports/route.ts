import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { ortalama, yuzde } from '@/lib/tickets/kpi'

/**
 * Atanan kişilerin GÖRÜNEN ADI — e-postadan çözülür.
 *
 * NEDEN: `Ticket.assignedToName` bir anlık görüntü kolonu ve ATAMA YOLUNA GÖRE
 * BOŞ KALIYOR (POST /api/tickets:254 ve PUT /api/tickets/[id]:485 "LDAP'tan
 * isim alınabilir" notuyla açıkça null yazıyor). Rapor tarafı bu kolona
 * güvendiği için aynı kişi bazı ticket'larda adıyla, bazılarında e-postasıyla
 * görünüyordu; hangisinin kazandığı `assigneeMap`e ilk giren ticket'a bağlıydı
 * (sıra bağımlı → grafikte karışık liste).
 *
 * Sıra: User.email → Personnel (mailAdresi | azureAdEmail) → `assignedToName`
 * (doluysa) → çözülemezse e-postanın KENDİSİ. E-posta asla kırpılmaz, '@'
 * öncesinden isim uydurulmaz: yanlış isim göstermektense ham adresi göstermek
 * yeğdir.
 *
 * Son basamak neden hâlâ duruyor: kişi User'dan da Personnel'den de silinmişse
 * (işten ayrılma) elimizdeki tek ad o anlık görüntü kolonudur. Zincirin BAŞINDA
 * değil SONUNDA olması önemli — sorunun kaynağı ona ÖNCE bakılmasıydı.
 */
async function kisiAdlariniCoz(emails: string[]): Promise<Map<string, string>> {
  const ad = new Map<string, string>()
  const benzersiz = Array.from(
    new Set(emails.map((e) => e.toLowerCase().trim()).filter((e) => e !== '')),
  )
  if (benzersiz.length === 0) return ad

  // 1) User — PR-EMAIL-NORMALIZE sonrası DB casing lowercase, `in` yeterli.
  const users = await prisma.user.findMany({
    where: { email: { in: benzersiz } },
    select: { email: true, firstName: true, lastName: true, name: true },
  })
  for (const u of users) {
    const tam = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
    const gorunen = tam || u.name?.trim() || ''
    if (gorunen) ad.set(u.email.toLowerCase(), gorunen)
  }

  // 2) Personnel — User'da olmayanlar için. Bu iki alan normalize DEĞİL, o
  // yüzden alan başına insensitive eşitlik. Liste IT ekibi kadar kısa (tek
  // haneli), OR maliyeti önemsiz.
  const eksik = benzersiz.filter((e) => !ad.has(e))
  if (eksik.length > 0) {
    const personeller = await prisma.personnel.findMany({
      where: {
        OR: eksik.flatMap((e) => [
          { mailAdresi: { equals: e, mode: 'insensitive' as const } },
          { azureAdEmail: { equals: e, mode: 'insensitive' as const } },
        ]),
      },
      select: { adSoyad: true, mailAdresi: true, azureAdEmail: true },
    })
    for (const p of personeller) {
      const isim = p.adSoyad?.trim()
      if (!isim) continue
      for (const alan of [p.mailAdresi, p.azureAdEmail]) {
        const anahtar = alan?.toLowerCase().trim()
        if (anahtar && !ad.has(anahtar)) ad.set(anahtar, isim)
      }
    }
  }

  return ad
}

// GET - IT Raporları (Sadece IT Manager erişebilir)
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-tickets: requireUser → user.role
    const { session, user, error } = await requireUser()
    if (error) return error

    if (!session.user.permissions?.includes('helpdesk.admin')) {
      return NextResponse.json({ error: 'Bu rapora erişim yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30' // Son 30 gün varsayılan
    const daysAgo = parseInt(period)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysAgo)

    // Tüm ticketlar (periyot içinde)
    const allTickets = await prisma.ticket.findMany({
      where: {
        createdAt: { gte: startDate },
        isActive: true,
      },
      select: {
        id: true,
        status: true,
        priority: true,
        ticketType: true,
        assignedTo: true,
        assignedToName: true,
        // HAVUZ: takım bazlı iş yükü için. Ek SORGU YOK — aynı findMany'nin
        // select'ine eklenip aşağıda bellekte gruplanıyor.
        assignedTeamId: true,
        assignedTeam: { select: { name: true } },
        source: true,
        categoryId: true,
        category: { select: { name: true, color: true } },
        createdAt: true,
        respondedAt: true,
        resolvedAt: true,
        closedAt: true,
        slaResponseBreached: true,
        slaResolutionBreached: true,
        satisfactionRating: true,
      }
    })

    // AÇIK durum kümesi — tek kaynak (openTickets, kişi yükü ve takım havuzu
    // aynı tanımı kullansın; biri değişirse hepsi değişsin).
    const ACIK_DURUMLAR = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'REOPENED']
    const acikMi = (status: string) => ACIK_DURUMLAR.includes(status)

    // Genel İstatistikler
    const totalTickets = allTickets.length
    const openTickets = allTickets.filter(t => acikMi(t.status)).length
    const resolvedTickets = allTickets.filter(t => t.status === 'RESOLVED').length
    const closedTickets = allTickets.filter(t => t.status === 'CLOSED').length
    const slaBreached = allTickets.filter(t => t.slaResponseBreached || t.slaResolutionBreached).length

    // Ortalama çözüm süresi (saat)
    const resolvedWithTime = allTickets.filter(t => t.resolvedAt && t.createdAt)
    const avgResolutionTime = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, t) => {
          const created = new Date(t.createdAt).getTime()
          const resolved = new Date(t.resolvedAt!).getTime()
          return sum + (resolved - created)
        }, 0) / resolvedWithTime.length / (1000 * 60 * 60)
      : 0

    // Ortalama ilk yanıt süresi (saat)
    const respondedTickets = allTickets.filter(t => t.respondedAt && t.createdAt)
    const avgResponseTime = respondedTickets.length > 0
      ? respondedTickets.reduce((sum, t) => {
          const created = new Date(t.createdAt).getTime()
          const responded = new Date(t.respondedAt!).getTime()
          return sum + (responded - created)
        }, 0) / respondedTickets.length / (1000 * 60 * 60)
      : 0

    // Ortalama memnuniyet puanı
    const ratedTickets = allTickets.filter(t => t.satisfactionRating !== null)
    const avgSatisfaction = ratedTickets.length > 0
      ? ratedTickets.reduce((sum, t) => sum + (t.satisfactionRating || 0), 0) / ratedTickets.length
      : 0

    // Önceliğe göre dağılım
    const byPriority = {
      TICKET_CRITICAL: allTickets.filter(t => t.priority === 'TICKET_CRITICAL').length,
      TICKET_HIGH: allTickets.filter(t => t.priority === 'TICKET_HIGH').length,
      NORMAL: allTickets.filter(t => t.priority === 'NORMAL').length,
      TICKET_LOW: allTickets.filter(t => t.priority === 'TICKET_LOW').length,
    }

    // Tipe göre dağılım
    const byType = {
      INCIDENT: allTickets.filter(t => t.ticketType === 'INCIDENT').length,
      SERVICE_REQUEST: allTickets.filter(t => t.ticketType === 'SERVICE_REQUEST').length,
      PROBLEM: allTickets.filter(t => t.ticketType === 'PROBLEM').length,
      CHANGE_REQUEST: allTickets.filter(t => t.ticketType === 'CHANGE_REQUEST').length,
    }

    // Kategoriye göre dağılım
    const categoryMap = new Map<string, { name: string; color: string; count: number }>()
    allTickets.forEach(t => {
      if (t.category) {
        const key = t.categoryId || 'uncategorized'
        const existing = categoryMap.get(key)
        if (existing) {
          existing.count++
        } else {
          categoryMap.set(key, {
            name: t.category.name,
            color: t.category.color || '#6b7280',
            count: 1
          })
        }
      }
    })
    const byCategory = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count)

    // Duruma göre dağılım
    const byStatus = {
      NEW: allTickets.filter(t => t.status === 'NEW').length,
      ASSIGNED: allTickets.filter(t => t.status === 'ASSIGNED').length,
      IN_PROGRESS: allTickets.filter(t => t.status === 'IN_PROGRESS').length,
      PENDING: allTickets.filter(t => t.status === 'PENDING').length,
      ON_HOLD: allTickets.filter(t => t.status === 'ON_HOLD').length,
      RESOLVED: allTickets.filter(t => t.status === 'RESOLVED').length,
      CLOSED: allTickets.filter(t => t.status === 'CLOSED').length,
      CANCELLED: allTickets.filter(t => t.status === 'CANCELLED').length,
    }

    // Bireysel Performans (Atanan kişiye göre)
    const assigneeMap = new Map<string, {
      email: string
      name: string
      totalAssigned: number
      /** Şu an ÜZERİNDE olan açık ticket sayısı (mevcut yük) */
      openCount: number
      resolved: number
      closed: number
      avgResponseTime: number // saat
      avgResolutionTime: number // saat
      slaBreached: number
      avgSatisfaction: number
    }>()

    // `assignedToName` anlık görüntüleri — zincirin SON basamağı için. API
    // yanıtının şeklini bozmamak adına ayrı map'te tutuluyor.
    // İLK DOLU olan kazanır (ilk ticket değil): boş kolonlu bir ticket'ın
    // başta gelmesi artık adı e-postaya düşürmez.
    const adAnlikGoruntu = new Map<string, string>()

    allTickets.forEach(t => {
      if (t.assignedTo) {
        const key = t.assignedTo
        const anahtar = key.toLowerCase().trim()
        const anlik = t.assignedToName?.trim()
        if (anlik && !adAnlikGoruntu.has(anahtar)) adAnlikGoruntu.set(anahtar, anlik)

        let assignee = assigneeMap.get(key)

        if (!assignee) {
          assignee = {
            email: t.assignedTo,
            // Ad AŞAĞIDA tek seferde çözülür (kisiAdlariniCoz). Burada geçici
            // olarak e-posta duruyor: `assignedToName`e bakılmıyor, çünkü sıra
            // bağımlı ve boş olabilen bir kolondu — sorunun kaynağı oydu.
            name: t.assignedTo,
            totalAssigned: 0,
            openCount: 0,
            resolved: 0,
            closed: 0,
            avgResponseTime: 0,
            avgResolutionTime: 0,
            slaBreached: 0,
            avgSatisfaction: 0,
          }
          assigneeMap.set(key, assignee)
        }

        assignee.totalAssigned++
        if (acikMi(t.status)) assignee.openCount++

        if (t.status === 'RESOLVED') assignee.resolved++
        if (t.status === 'CLOSED') assignee.closed++
        if (t.slaResponseBreached || t.slaResolutionBreached) assignee.slaBreached++
      }
    })

    // Ortalama süreleri hesapla
    for (const [email, assignee] of assigneeMap) {
      const assigneeTickets = allTickets.filter(t => t.assignedTo === email)

      // Yanıt süresi
      const responded = assigneeTickets.filter(t => t.respondedAt && t.createdAt)
      if (responded.length > 0) {
        assignee.avgResponseTime = responded.reduce((sum, t) => {
          const created = new Date(t.createdAt).getTime()
          const resp = new Date(t.respondedAt!).getTime()
          return sum + (resp - created)
        }, 0) / responded.length / (1000 * 60 * 60)
      }

      // Çözüm süresi
      const resolved = assigneeTickets.filter(t => t.resolvedAt && t.createdAt)
      if (resolved.length > 0) {
        assignee.avgResolutionTime = resolved.reduce((sum, t) => {
          const created = new Date(t.createdAt).getTime()
          const res = new Date(t.resolvedAt!).getTime()
          return sum + (res - created)
        }, 0) / resolved.length / (1000 * 60 * 60)
      }

      // Memnuniyet
      const rated = assigneeTickets.filter(t => t.satisfactionRating !== null)
      if (rated.length > 0) {
        assignee.avgSatisfaction = rated.reduce((sum, t) => sum + (t.satisfactionRating || 0), 0) / rated.length
      }
    }

    // Görünen adları TEK sorgu turunda çöz (kişi başına sorgu yok).
    const adHaritasi = await kisiAdlariniCoz(Array.from(assigneeMap.keys()))
    for (const assignee of assigneeMap.values()) {
      const anahtar = assignee.email.toLowerCase().trim()
      assignee.name =
        adHaritasi.get(anahtar) || adAnlikGoruntu.get(anahtar) || assignee.email
    }

    const individualPerformance = Array.from(assigneeMap.values())
      .sort((a, b) => b.totalAssigned - a.totalAssigned)

    // ── HAVUZ: takım bazlı açık iş yükü ────────────────────────────────
    // individualPerformance yalnız `assignedTo` üzerinden gruplar; takıma
    // düşmüş ama HENÜZ ÜSTLENİLMEMİŞ ticket'ta o alan BOŞ olduğu için bu
    // ticket'lar iş yükü dağılımında hiç görünmüyordu. Havuz modelinde
    // (kategori → takım) taleplerin tamamı bu durumda başlıyor.
    //   poolCount    : havuzda bekliyor (assignedTo boş) — kimse üstlenmedi
    //   claimedCount : bir üye üstlendi ama henüz kapanmadı
    // Yalnız AÇIK ticket'lar sayılır; takımsızlar bu bloğa girmez.
    const teamMap = new Map<string, {
      teamId: string
      name: string
      poolCount: number
      claimedCount: number
      totalOpen: number
    }>()

    allTickets.forEach(t => {
      if (!t.assignedTeamId || !acikMi(t.status)) return
      let team = teamMap.get(t.assignedTeamId)
      if (!team) {
        team = {
          teamId: t.assignedTeamId,
          name: t.assignedTeam?.name ?? '(bilinmeyen takım)',
          poolCount: 0,
          claimedCount: 0,
          totalOpen: 0,
        }
        teamMap.set(t.assignedTeamId, team)
      }
      if (t.assignedTo) team.claimedCount++
      else team.poolCount++
      team.totalOpen++
    })

    const teamPerformance = Array.from(teamMap.values())
      .sort((a, b) => b.totalOpen - a.totalOpen)

    // Günlük trend (son 7 gün)
    // ── KAYNAK DAĞILIMI ─────────────────────────────────────────────────
    // Talep hangi kanaldan geldi. PHONE/WALK_IN "başkası adına kayıt"
    // özelliğiyle doluyor (04.09 öncesi hiç kullanılmamıştı), WEB_PORTAL
    // kullanıcının kendi açtığı, EMAIL destek@ kutusundan geleni.
    //
    // HAM SAYIMLAR: n<5 eşiği burada UYGULANMIYOR. Eşik ortalama/türetilmiş
    // metrikler içindi (bkz. lib/tickets/kpi ve recruitment/ornek-esigi);
    // "5 talep geldi" sayısını gizlemek bilgiyi yok eder. Eşik YÜZDELERE
    // uygulanıyor — 3 talepten "%67 telefon" çıkarmak yanıltıcı olur.
    const kaynakSayilari = allTickets.reduce<Record<string, number>>((acc, t) => {
      acc[t.source] = (acc[t.source] ?? 0) + 1
      return acc
    }, {})
    const kaynakToplam = allTickets.length
    const kaynakDagilimi = {
      toplam: kaynakToplam,
      // Yüzdeler yalnız yeterli örneklemde anlamlı; value null ise ekran
      // sayıyı gösterip oranı gizler.
      oran: yuzde(kaynakToplam, kaynakToplam),
      kalemler: (['WEB_PORTAL', 'EMAIL', 'PHONE', 'WALK_IN', 'CHAT', 'SYSTEM_AUTO'] as const)
        .map((kaynak) => ({
          kaynak,
          adet: kaynakSayilari[kaynak] ?? 0,
          yuzde: kaynakToplam > 0 ? Math.round(((kaynakSayilari[kaynak] ?? 0) / kaynakToplam) * 100) : 0,
        }))
        // Hiç kullanılmamış kanalları listeleme — bugün CHAT/SYSTEM_AUTO boş.
        .filter((k) => k.adet > 0),
    }

    // ── MEMNUNİYET ÖZETİ (Faz 2) ────────────────────────────────────────
    // Ortalama ve puanlama oranı AYRI iki soru: ortalama "puan verenler ne
    // dedi", oran "kaç kişi puan verdi". Oranın paydası anlamlıyken ortalamanın
    // örneklemi 1 olabilir; ikisini tek sayıya indirmek yanıltır.
    const puanlananlar = allTickets.filter((t) => t.satisfactionRating !== null)
    const puanlanabilirler = allTickets.filter(
      (t) => t.status === 'RESOLVED' || t.status === 'CLOSED',
    )
    const yildizDagilimi = [1, 2, 3, 4, 5].map((yildiz) => ({
      yildiz,
      adet: puanlananlar.filter((t) => t.satisfactionRating === yildiz).length,
    }))
    const memnuniyetOzeti = {
      ortalama: ortalama(puanlananlar.map((t) => t.satisfactionRating as number)),
      // n = payda (puanlanabilir talep sayısı), value = yüzde.
      puanlamaOrani: yuzde(puanlananlar.length, puanlanabilirler.length),
      puanlananSayisi: puanlananlar.length,
      puanlanabilirSayisi: puanlanabilirler.length,
      dagilim: yildizDagilimi,
    }

    // ── KRONİK ÖZETİ (Faz 2) ────────────────────────────────────────────
    // DÖNEM FİLTRESİNE TABİ DEĞİL (bilerek): "aktif kronik" o anki durumdur,
    // son 30 günde açılmış olması gerekmez. Yalnız "çözülen" penceresi 30 gün.
    // Bağlı talep sayısı da tüm zamanları kapsar — kronik sorunun ağırlığı
    // dönem seçimine göre değişmemeli.
    const otuzGunOnce = new Date()
    otuzGunOnce.setDate(otuzGunOnce.getDate() - 30)

    const kronikler = await prisma.kronikSorun.findMany({
      select: {
        id: true,
        baslik: true,
        durum: true,
        cozulenAt: true,
        _count: { select: { tickets: true } },
      },
      orderBy: [{ durum: 'asc' }, { createdAt: 'desc' }],
    })
    const aktifler = kronikler.filter((k) => k.durum === 'AKTIF')
    const kronikOzeti = {
      aktifSayisi: aktifler.length,
      aktifBagliTalep: aktifler.reduce((t, k) => t + k._count.tickets, 0),
      son30GunCozulen: kronikler.filter(
        (k) => k.durum === 'COZULDU' && k.cozulenAt !== null && k.cozulenAt >= otuzGunOnce,
      ).length,
      // Ekranda ilk 10 satır gösteriliyor; tamamı gerekirse kronik ucu var.
      liste: kronikler.slice(0, 10).map((k) => ({
        id: k.id,
        baslik: k.baslik,
        durum: k.durum,
        bagliTalep: k._count.tickets,
      })),
    }

    const dailyTrend: { date: string; created: number; resolved: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      const created = allTickets.filter(t => {
        const createdDate = new Date(t.createdAt).toISOString().split('T')[0]
        return createdDate === dateStr
      }).length

      const resolved = allTickets.filter(t => {
        if (!t.resolvedAt) return false
        const resolvedDate = new Date(t.resolvedAt).toISOString().split('T')[0]
        return resolvedDate === dateStr
      }).length

      dailyTrend.push({ date: dateStr, created, resolved })
    }

    return NextResponse.json({
      period: daysAgo,
      summary: {
        totalTickets,
        openTickets,
        resolvedTickets,
        closedTickets,
        slaBreached,
        avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
        avgResponseTime: Math.round(avgResponseTime * 10) / 10,
        avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
        resolutionRate: totalTickets > 0 ? Math.round(((resolvedTickets + closedTickets) / totalTickets) * 100) : 0,
        // ÖRNEKLEM SAYILARI — ortalamalar kaç kayıttan hesaplandı.
        // Ortalamalar veri yokken 0 dönüyor ve bu "hepsi 0" ile karışıyor
        // (özellikle avgSatisfaction: puan 1-5 aralığında, 0 mümkün değil).
        // Frontend bu sayılara bakıp "yeterli veri yok" veya "1 kayıttan"
        // diyebilsin diye açıkça taşınıyor.
        respondedCount: respondedTickets.length,
        resolvedCountForAvg: resolvedWithTime.length,
        ratedCount: ratedTickets.length,
      },
      byPriority,
      byType,
      byStatus,
      byCategory,
      individualPerformance,
      teamPerformance,
      dailyTrend,
      // Faz 2 — mevcut alanların hiçbiri değişmedi, yalnız ikisi eklendi.
      memnuniyetOzeti,
      kronikOzeti,
      kaynakDagilimi,
    })
  } catch (error) {
    console.error('Rapor hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
