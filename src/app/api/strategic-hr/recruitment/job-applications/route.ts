import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { bekleyenTaraf, kullaniciAdi } from '@/lib/recruitment/bekleyen'
import { TASLAK_STATULER } from '@/lib/recruitment/taslak-statuler'
import { efektifOturumDurumu, type SinavRozeti } from '@/lib/recruitment/assessment-session'
import { mukerrerRozetleri, mukerrerTcListesi } from '@/lib/recruitment/mukerrer-basvuru'

// GET - Tüm iş başvurularını listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (role/department session'dan)
    const { session, error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    // Müdür kararı filtresi: APPROVED | REJECTED | YOK (karar verilmemiş). Sunucu tarafında
    // süzülür → sayfalama toplamı (count) aynı where'i kullandığı için tutarlı kalır.
    const mudurKarariFiltre = searchParams.get('mudurKarari')
    const search = searchParams.get('search')
    // "Bana atananlar": yalnız oturum sahibinin atanan müdür olduğu başvurular.
    // Filtreleme SUNUCUDA (assignedManagerId = session.user.id); client'ta filtreleme yok.
    const assignedToMe = searchParams.get('assignedToMe') === '1'

    // PR-RECRUIT-RBAC: PublicJobApplication (CV başvuruları) HR-only.
    // TEK İSTİSNA — atanan müdür kendi kuyruğu: ?assignedToMe=1 + recruitment.view.
    // Müdür, kendisine atanan başvuruyu detay ucunda zaten görebiliyordu (assignedManagerId
    // yetkisi); listeyi görememesi yüzünden kuyruğuna yalnız bildirim linkinden ulaşabiliyordu.
    const izinler = session.user.permissions ?? []
    const ikYetkili = izinler.includes('recruitment.admin')
    const atananMudurYolu = !ikYetkili && assignedToMe && izinler.includes('recruitment.view')
    if (!ikYetkili && !atananMudurYolu) {
      return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
    }

    // Sınav sonucu filtresi: 'GECTI' | 'KALDI' | 'YOK' (sonuçlanmamış) | yok/'all' (tümü)
    const sinavSonuc = searchParams.get('sinavSonuc')
    // Tekrar başvuranlar filtresi: 'EVET' | 'HAYIR' | yok/'all' (tümü)
    const tekrar = searchParams.get('tekrar')

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Filtreleme
    const where: any = {}

    if (status && status !== 'all') {
      // Kullanıcı AÇIKÇA bir statü seçtiyse (taslak statüleri dahil) onu göster.
      where.status = status
    } else {
      // VARSAYILAN: taslaklar (form GÖNDERİLMEMİŞ kayıtlar) listede ÇIKMAZ.
      // Eskiden çıkıyordu ve İK yarım kalmış bir kaydı tamamlanmış başvuru sanabiliyordu;
      // ayrıca liste sayısı dashboard'la (taslakları zaten hariç tutuyordu) ayrışıyordu.
      // Küme TEK KAYNAK: src/lib/recruitment/taslak-statuler.ts
      // NOT: `total` aşağıda AYNI `where` ile sayılır → sayfalama toplamı da tutarlı.
      where.status = { notIn: TASLAK_STATULER }
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobilePhone: { contains: search, mode: 'insensitive' } },
        { applicationNumber: { contains: search, mode: 'insensitive' } },
        { requestedPosition: { contains: search, mode: 'insensitive' } },
      ]
    }

    // SINAV SONUCU filtresi — SUNUCU tarafında. Aynı `where` hem findMany hem count'ta
    // kullanıldığı için sayfalama toplamı da tutarlı kalır (status filtresiyle aynı ilke).
    // Küme TAM: Geçti / Kaldı / Sonuçlanmamış birleşimi tüm başvuruları kapsar.
    //   GECTI/KALDI       → sonuçlanmış (result dolu) EN AZ BİR oturum var
    //   YOK (sonuçlanmamış) → sonuçlanmış HİÇBİR oturum yok (oturumu olmayanlar dahil)
    if (sinavSonuc === 'GECTI' || sinavSonuc === 'KALDI') {
      where.assessmentSessions = { some: { result: sinavSonuc } }
    } else if (sinavSonuc === 'YOK') {
      where.assessmentSessions = { none: { result: { not: null } } }
    }

    // TEKRAR BAŞVURANLAR filtresi — SUNUCU tarafında, sınav filtresiyle AYNI ilke:
    // aynı `where` hem findMany hem count'ta kullanılır → sayfalama toplamı tutarlı.
    // Mükerrer TC kümesi tek groupBy ile çözülür (yalnız filtre AÇIKKEN sorgulanır).
    // Küme TAM: EVET ∪ HAYIR = tüm başvurular (TC'si boş kayıtlar HAYIR tarafında).
    if (tekrar === 'EVET' || tekrar === 'HAYIR') {
      const mukerrerTcler = await mukerrerTcListesi(prisma)
      if (tekrar === 'EVET') {
        where.tcKimlikNo = { in: mukerrerTcler }
      } else {
        // `notIn` tek başına NULL'ları da eler (SQL NULL semantiği) — TC'si olmayan
        // kayıt "tekrar başvuran değil"dir, düşmemeli. AND ile OR bloğu eklenir;
        // where.OR arama filtresine ait olduğu için ÜZERINE YAZILMAZ.
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          { OR: [{ tcKimlikNo: null }, { tcKimlikNo: { notIn: mukerrerTcler } }] },
        ]
      }
    }

    // KISIT EN SON ve KOŞULSUZ yazılır — yukarıdaki hiçbir filtre (status/search/sınav) bunu
    // gevşetemez veya üzerine yazamaz. Atanan müdür yolunda kısıt ZORUNLUdur (atananMudurYolu
    // zaten assignedToMe=1 demek); İK için davranış eskisi gibi opsiyonel toggle.
    if (assignedToMe || atananMudurYolu) {
      where.assignedManagerId = session.user.id
    }

    // Müdür kararı filtresi — where'e eklendiği için count da aynı süzgeci görür.
    if (mudurKarariFiltre === 'APPROVED' || mudurKarariFiltre === 'REJECTED') {
      where.mudurKarari = mudurKarariFiltre
    } else if (mudurKarariFiltre === 'YOK') {
      where.mudurKarari = null
    }

    // Başvuruları getir
    const [applications, total] = await Promise.all([
      prisma.publicJobApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          applicationNumber: true,
          fullName: true,
          email: true,
          mobilePhone: true,
          birthDate: true,
          gender: true,
          requestedPosition: true,
          expectedSalary: true,
          availableStartDate: true,
          educationLevel: true,
          // Kaynak SÖZLÜKTEN (referralSourceId → ReferralSourceDef.name). Eski `referralSource`
          // enum kolonu okunmaz: yazma tarafı ona ARTIK YAZMIYOR, dolayısıyla listede
          // "Bize Nasıl Ulaştı" sütunu her kayıtta boş görünüyordu.
          referralSourceDef: { select: { name: true } },
          photoUrl: true,
          status: true,
          notes: true,
          digitalSignature: true,
          signatureDate: true,
          createdAt: true,
          // "Bekleyen" sütunu icin — musteri adi asagida TEK toplu sorguyla cozulur.
          assignedManagerId: true,
          // Müdür kararı rozeti — PublicJobApplication'ın KENDİ kolonu, ek sorgu YOK.
          // (Sınav rozeti ayrı tablodan geldiği için toplu çözülüyordu; bunda gerek yok.)
          mudurKarari: true,
          // Mükerrer rozeti SUNUCUDA hesaplansın diye çekilir; yanıtta HİÇ dönmez
          // (aşağıda `tcKimlikNo` alanı ayrıştırılıp atılıyor — İK yolunda da).
          tcKimlikNo: true,
        }
      }),
      prisma.publicJobApplication.count({ where })
    ])

    // "Bekleyen" — SUNUCUDA hesaplanir; client basvuru basina fetch YAPMAZ.
    // Sayfadaki tum assignedManagerId'ler TEK findMany ile cozulur (N+1 yok).
    const managerIds = [
      ...new Set(applications.map((a) => a.assignedManagerId).filter((x): x is string => !!x)),
    ]
    const managers = managerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: managerIds } },
          select: { id: true, name: true, firstName: true, lastName: true, email: true },
        })
      : []
    const managerById = new Map(managers.map((u) => [u.id, u]))

    // SINAV ROZETİ — sayfadaki TÜM başvuruların oturumları TEK findMany ile çekilir (N+1 yok,
    // "bekleyen" sütunuyla aynı desen). Her başvuru için EN YENİ oturum rozeti belirler:
    // sıralama createdAt DESC olduğundan Map'e ilk düşen zaten en yenisidir.
    //
    // token/sinavLink BU SORGUYA HİÇ GİRMEZ — rozet hiçbir role link sızdıramaz (İK dahil;
    // İK linki detay ucundan, oturumOzetiGetir({ik:true}) ile alır).
    const appIds = applications.map((a) => a.id)
    const oturumlar = appIds.length
      ? await prisma.assessmentSession.findMany({
          where: { publicJobApplicationId: { in: appIds } },
          orderBy: { createdAt: 'desc' },
          select: {
            publicJobApplicationId: true,
            status: true,
            score: true,
            result: true,
            expiresAt: true,
            assessment: { select: { passingScore: true } },
          },
        })
      : []
    const simdi = Date.now()
    const rozetById = new Map<string, SinavRozeti>()
    for (const o of oturumlar) {
      if (rozetById.has(o.publicJobApplicationId)) continue // en yenisi zaten alındı
      rozetById.set(o.publicJobApplicationId, {
        // Lazy expiry TEK KAYNAK (assessment-session.ts) — liste ile detay aynı durumu gösterir.
        durum: efektifOturumDurumu(o.status, o.expiresAt, simdi),
        puan: o.score,
        gecmeNotu: o.assessment.passingScore,
        gecti: o.result === null ? null : o.result === 'GECTI',
      })
    }

    // MÜKERRER ROZETİ — sayfadaki TÜM başvurular için TEK findMany (N+1 yok, sınav
    // rozetiyle aynı desen). Rozet yalnız aynı TC'de birden fazla taslak-olmayan
    // başvuru varsa üretilir. Kural TEK KAYNAK: mukerrer-basvuru.ts
    const mukerrerById = await mukerrerRozetleri(
      prisma,
      applications.map((a) => ({ id: a.id, tcKimlikNo: a.tcKimlikNo })),
    )

    const withBekleyen = applications.map(({ tcKimlikNo: _tc, referralSourceDef, ...a }) => ({
      ...a,
      // İstemciye DÜZ ad verilir (ilişki nesnesi sızmaz); bağı yoksa null → sütun "-" çizer.
      referralSourceAdi: referralSourceDef?.name ?? null,
      bekleyen: bekleyenTaraf(
        a.status,
        kullaniciAdi(a.assignedManagerId ? managerById.get(a.assignedManagerId) : undefined),
      ),
      // Oturum yoksa null → client rozeti HİÇ çizmez.
      sinavRozeti: rozetById.get(a.id) ?? null,
      // Tek başvurusu olan adayda null → rozet çizilmez.
      mukerrer: mukerrerById.get(a.id) ?? null,
    }))

    // Saf müdür (İK yetkisi yok) görünürlüğü: detay ucundaki MANAGER_SELECT ile AYNI ilke —
    // hassas alanlar (iletişim, doğum, cinsiyet, ücret beklentisi, İK notu, KVKK imzası)
    // client'a HİÇ gönderilmez. İK yolunda projeksiyon birebir eskisi gibi kalır.
    const cikti = ikYetkili
      ? withBekleyen
      : withBekleyen.map((a) => ({
          id: a.id,
          applicationNumber: a.applicationNumber,
          fullName: a.fullName,
          requestedPosition: a.requestedPosition,
          educationLevel: a.educationLevel,
          photoUrl: a.photoUrl,
          status: a.status,
          createdAt: a.createdAt,
          assignedManagerId: a.assignedManagerId,
          bekleyen: a.bekleyen,
          // Müdür puanı/durumu GÖREBİLİR (mevcut davranış — oturumOzetiGetir({ik:false}) ile
          // aynı ilke). Rozet zaten token/link taşımıyor, bu yüzden aynen geçer.
          sinavRozeti: a.sinavRozeti,
          // Müdür kendi verdiği kararı görür (rozet, hassas veri taşımaz).
          mudurKarari: a.mudurKarari,
          // `mukerrer` BİLEREK YOK: adayın geçmiş başvuruları İV'nin bilgisi. Müdürün işi
          // önündeki güncel başvuru. (Alan listesi açık yazıldığı için sızma da olamaz.)
        }))

    return NextResponse.json({
      applications: cikti,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Is basvurulari listelenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
