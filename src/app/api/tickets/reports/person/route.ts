import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import {
  ONAY_AKISI_BASLANGICI,
  donemBaslangici,
  donemGun,
  olcum,
  ortalama,
  yuzde,
  type Olcum,
} from '@/lib/tickets/kpi'

/**
 * GET /api/tickets/reports/person?email=&period=30|90|all
 *
 * Kişi bazlı performans. Eskiden yalnız ham ticket listesi dönüyordu; metrikler
 * ekranda dört karta sığdırılmıştı. Faz 2'de metrik hesabı buraya taşındı.
 *
 * SÖZLEŞME: her metrik { value, n } — n, değerin kaç kayıttan geldiği. "Yeterli
 * veri var mı" kararı BURADA VERİLMEZ; API n=1 olsa da doğru sayıyı döner,
 * gizleme kuralını (n<5) ekran uygular. Böylece eşik değişirse tek yer değişir
 * ve API'nin döndüğü şey hep ham gerçek kalır.
 *
 * İKİ FARKLI KİŞİ TANIMI, bilerek ayrı:
 *   assignedTo      → "üzerine düşen iş". SLA, memnuniyet, itiraz ve kapanış
 *                     metriklerinin tabanı budur.
 *   resolvedByEmail → "fiilen bitirdiği iş". Yalnız 04.09.2026'dan beri
 *                     doldurulduğu için eski dönemde boş kalır; ekranda kalıcı
 *                     dipnotu var.
 *
 * Yetki: mevcut kural aynen — helpdesk.admin.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireUser()
    if (error) return error

    if (!session.user.permissions?.includes('helpdesk.admin')) {
      return NextResponse.json({ error: 'Yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    // PR-Y2.5-tickets: query email lowercase normalize (DB casing invariant)
    const email = searchParams.get('email')?.toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Email gerekli' }, { status: 400 })
    }

    const gun = donemGun(searchParams.get('period'))
    const baslangic = donemBaslangici(gun)
    const donemKosulu = baslangic ? { createdAt: { gte: baslangic } } : {}

    // ── ÜZERİNE DÜŞEN İŞ (assignedTo) ────────────────────────────────────
    const atananlar = await prisma.ticket.findMany({
      where: { assignedTo: email, isActive: true, ...donemKosulu },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        respondedAt: true,
        resolvedAt: true,
        closedAt: true,
        resolutionDueAt: true,
        slaResponseBreached: true,
        slaResolutionBreached: true,
        satisfactionRating: true,
        objectionCount: true,
        autoClosed: true,
        category: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // ── FİİLEN BİTİRDİĞİ İŞ (resolvedByEmail) ────────────────────────────
    // Ayrı sorgu: başkasına atanmış ama bu kişinin çözdüğü talepler de sayılsın.
    const cozdugu = await prisma.ticket.count({
      where: { resolvedByEmail: email, isActive: true, ...donemKosulu },
    })

    const acikDurumlar = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'REOPENED']
    const saat = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 36e5

    // Süre ortalamaları — yalnız ilgili damgası OLAN talepler paydaya girer.
    const yanitSureleri = atananlar
      .filter((t) => t.respondedAt)
      .map((t) => saat(t.createdAt, t.respondedAt as Date))
    const cozumSureleri = atananlar
      .filter((t) => t.resolvedAt)
      .map((t) => saat(t.createdAt, t.resolvedAt as Date))

    // SLA uyumu: paydada yalnız İŞ-SAATİ HEDEFİ OLAN talepler var. Hedefi
    // olmayan eski kayıtlar oranı şişirmesin diye dışarıda.
    const hedefliler = atananlar.filter((t) => t.resolutionDueAt !== null)
    const cozumIhlali = hedefliler.filter((t) => t.slaResolutionBreached).length
    const yanitIhlali = atananlar.filter((t) => t.slaResponseBreached).length

    // Memnuniyet: kişinin üzerindeki taleplerde kullanıcı puanı.
    const puanlar = atananlar
      .filter((t) => t.satisfactionRating !== null)
      .map((t) => t.satisfactionRating as number)

    // İtiraz oranı: payda = çözüm aşamasına gelmiş talepler (itiraz ancak
    // çözüldükten sonra mümkün); pay = en az bir kez itiraz edilmiş olanlar.
    const cozumeGelenler = atananlar.filter(
      (t) => t.resolvedAt !== null || t.status === 'RESOLVED' || t.status === 'CLOSED',
    )
    const itirazEdilen = cozumeGelenler.filter((t) => (t.objectionCount ?? 0) > 0).length

    // Kapanış türü: YALNIZ onay akışı canlıya çıktıktan sonraki kapanışlar.
    // Öncesinde autoClosed=false yalnız kolon varsayılanı (bkz. lib/tickets/kpi).
    const akisSonrasiKapananlar = atananlar.filter(
      (t) => t.closedAt !== null && (t.closedAt as Date) >= ONAY_AKISI_BASLANGICI,
    )
    const otomatikKapanan = akisSonrasiKapananlar.filter((t) => t.autoClosed).length
    const onayliKapanan = akisSonrasiKapananlar.length - otomatikKapanan

    // Kategori kırılımı — üzerine düşen işin dağılımı.
    const kategoriMap = new Map<string, number>()
    for (const t of atananlar) {
      const ad = t.category?.name ?? '(kategorisiz)'
      kategoriMap.set(ad, (kategoriMap.get(ad) ?? 0) + 1)
    }
    const kategoriKirilimi = Array.from(kategoriMap, ([ad, adet]) => ({ ad, adet })).sort(
      (a, b) => b.adet - a.adet,
    )

    const metrikler: Record<string, Olcum> = {
      atanan: olcum(atananlar.length, atananlar.length),
      acikAtanan: olcum(
        atananlar.filter((t) => acikDurumlar.includes(t.status)).length,
        atananlar.length,
      ),
      cozdugu: olcum(cozdugu, cozdugu),
      ortYanitSaat: ortalama(yanitSureleri),
      ortCozumSaat: ortalama(cozumSureleri),
      // Uyum = hedefi olanların ihlal etmeyen oranı.
      slaUyum: yuzde(hedefliler.length - cozumIhlali, hedefliler.length),
      memnuniyet: ortalama(puanlar),
      itirazOrani: yuzde(itirazEdilen, cozumeGelenler.length),
      otomatikKapanisOrani: yuzde(otomatikKapanan, akisSonrasiKapananlar.length),
    }

    return NextResponse.json({
      email,
      period: gun === null ? 'all' : gun,
      metrikler,
      // Ham sayılar: ekran "3 ihlal" gibi ayrıntıları oranın yanında gösteriyor.
      detay: {
        cozumIhlali,
        yanitIhlali,
        slaHedefliTalep: hedefliler.length,
        otomatikKapanan,
        onayliKapanan,
        akisSonrasiKapanan: akisSonrasiKapananlar.length,
        itirazEdilen,
        cozumeGelen: cozumeGelenler.length,
      },
      kategoriKirilimi,
      // Mevcut liste — ekranın alt bölümü bunu kullanmaya devam ediyor.
      tickets: atananlar.slice(0, 100).map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        respondedAt: t.respondedAt,
        resolvedAt: t.resolvedAt,
        slaResponseBreached: t.slaResponseBreached,
        slaResolutionBreached: t.slaResolutionBreached,
        satisfactionRating: t.satisfactionRating,
        categoryName: t.category?.name || 'Kategorisiz',
      })),
    })
  } catch (error) {
    console.error('Personel rapor hatasi:', error)
    return NextResponse.json({ error: 'Islem basarisiz' }, { status: 500 })
  }
}
