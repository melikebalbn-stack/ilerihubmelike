import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
import { tezgahDetay } from '@/lib/ipro/izleme-service'

// Fabrika Haritası — TEK TEZGAH ZENGİN DETAY endpoint'i (SALT OKUMA).
//
// Sahne, kart tıklamasında ./tezgah?kod=<SAHNE_KODU> çağırır. Yanıt sözleşmesi:
//   { "sureDagilimi": {"calisma":dk,"durus":dk,"bosta":dk},
//     "uretilen": n, "kapananIs": n, "durusSayisi": n, "oee": n|null }
// Veri yoksa alanlar null; 500 atılmaz. OEE serviste yok → null (uydurma yok).
//
// Detay hesabı izleme-service.ts:tezgahDetay() ile YENİDEN KULLANILIR (kopya yok).
// Auth guard durum/route.ts ile aynı.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sahne kodu → DB kodu (DB2SAHNE'nin tersi). durum/route.ts'teki alias tablosuyla
// birebir tutarlı. KR01-04 fan-out AYRI ele alınır (aşağıda kapı istasyonları).
const SAHNE2DB: Record<string, string> = {
  ARES: 'CN19', PM13: 'CN16', ELGAZI: 'MM210', '1410H': 'MM30', BROS: 'PH20',
  'KILIT-1': 'KM01', 'KILIT-2': 'KM02', 'KILIT-3': 'KM03',
  'ELFREN-1': 'MM230', 'ELFREN-2': 'MM202', 'ELFREN-3': 'MM233',
  PM14: 'KH29', KR06: 'KR09', 'TRN-1': 'KP15', 'TRN-2': 'KP16',
  DIREKSIYON: 'PK07', '2197H': 'PK08', PK31: 'PK13',
  PM02: 'CN08', PM05: 'CN09', PM06: 'CN10', PM07: 'CN11',
  PM08: 'CN12', PM09: 'CN13', PM10: 'CN14',
}

const ROBOT_RE = /^KR0[1-4]$/ // fan-out kutuları: kapı istasyonları toplanır

type TezgahYanit = {
  sureDagilimi: { calisma: number | null; durus: number | null; bosta: number | null }
  uretilen: number | null
  kapananIs: number | null
  durusSayisi: number | null
  oee: number | null
}

const BOS: TezgahYanit = {
  sureDagilimi: { calisma: null, durus: null, bosta: null },
  uretilen: null,
  kapananIs: null,
  durusSayisi: null,
  oee: null,
}

// tezgahDetay çıktısını sahne sözleşmesine indir.
type Detay = NonNullable<Awaited<ReturnType<typeof tezgahDetay>>>
function mapDetay(d: Detay): TezgahYanit {
  return {
    sureDagilimi: {
      calisma: d.sureDagilimi.calismaDk,
      durus: d.sureDagilimi.durusDk,
      bosta: d.sureDagilimi.bostaDk,
    },
    uretilen: d.uretim.gerceklesen,
    kapananIs: d.bugunKapanan.length,
    durusSayisi: d.bugunDuruslar.length,
    oee: null, // OEE serviste yok → uydurma yok
  }
}

// Birden çok istasyon detayını topla (robot fan-out).
function topla(detaylar: Detay[]): TezgahYanit {
  if (!detaylar.length) return BOS
  const s = (f: (d: Detay) => number) => detaylar.reduce((a, d) => a + f(d), 0)
  return {
    sureDagilimi: {
      calisma: s((d) => d.sureDagilimi.calismaDk),
      durus: s((d) => d.sureDagilimi.durusDk),
      bosta: s((d) => d.sureDagilimi.bostaDk),
    },
    uretilen: s((d) => d.uretim.gerceklesen),
    kapananIs: s((d) => d.bugunKapanan.length),
    durusSayisi: s((d) => d.bugunDuruslar.length),
    oee: null,
  }
}

async function detayFor(sahneKod: string): Promise<TezgahYanit> {
  // 1) Robot fan-out: KR01..KR04 → kapı istasyonlarının (KR0X-<n>) toplamı.
  if (ROBOT_RE.test(sahneKod)) {
    const istasyonlar = await prisma.iproTezgah.findMany({
      where: { kod: { startsWith: `${sahneKod}-` } },
      select: { id: true },
    })
    if (!istasyonlar.length) return BOS
    const detaylar = (await Promise.all(istasyonlar.map((t) => tezgahDetay(t.id)))).filter(
      (d): d is Detay => !!d,
    )
    return topla(detaylar)
  }

  // 2) Alias tersi (yoksa kod kendisi geçer — pass-through DB kodu).
  const dbKod = SAHNE2DB[sahneKod] ?? sahneKod
  const tezgah = await prisma.iproTezgah.findUnique({ where: { kod: dbKod }, select: { id: true } })
  if (!tezgah) return BOS
  const d = await tezgahDetay(tezgah.id)
  return d ? mapDetay(d) : BOS
}

export async function GET(req: NextRequest) {
  const { error } = await requireUser()
  if (error) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const canView = await hasPermission(['ipro.view', 'ipro.admin'])
  if (!canView) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const kod = req.nextUrl.searchParams.get('kod')?.trim()
  if (!kod) {
    return NextResponse.json(BOS, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const yanit = await detayFor(kod)
    return NextResponse.json(yanit, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    // Veri/servis hatasında 500 atma — boş sözleşme dön.
    return NextResponse.json(BOS, { headers: { 'Cache-Control': 'no-store' } })
  }
}
