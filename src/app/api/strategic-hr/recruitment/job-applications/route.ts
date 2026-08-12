import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { bekleyenTaraf, kullaniciAdi } from '@/lib/recruitment/bekleyen'
import { TASLAK_STATULER } from '@/lib/recruitment/taslak-statuler'

// GET - Tüm iş başvurularını listele
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-strategic-hr: requireSession (role/department session'dan)
    const { session, error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
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

    // KISIT EN SON ve KOŞULSUZ yazılır — yukarıdaki hiçbir filtre (status/search) bunu
    // gevşetemez veya üzerine yazamaz. Atanan müdür yolunda kısıt ZORUNLUdur (atananMudurYolu
    // zaten assignedToMe=1 demek); İK için davranış eskisi gibi opsiyonel toggle.
    if (assignedToMe || atananMudurYolu) {
      where.assignedManagerId = session.user.id
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
          referralSource: true,
          photoUrl: true,
          status: true,
          notes: true,
          digitalSignature: true,
          signatureDate: true,
          createdAt: true,
          // "Bekleyen" sütunu icin — musteri adi asagida TEK toplu sorguyla cozulur.
          assignedManagerId: true,
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

    const withBekleyen = applications.map((a) => ({
      ...a,
      bekleyen: bekleyenTaraf(
        a.status,
        kullaniciAdi(a.assignedManagerId ? managerById.get(a.assignedManagerId) : undefined),
      ),
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
