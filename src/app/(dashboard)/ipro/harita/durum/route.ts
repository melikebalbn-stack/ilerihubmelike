import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'

// Fabrika Haritası CANLI DURUM endpoint'i — SALT OKUMA.
//
// Sahne (sahne.html) bunu ~30sn'de bir GET'ler; yanıt yoksa/boşsa temsili sürer.
// Yanıt sözleşmesi tezgah KODU → durum nesnesi:
//   { "tezgahlar": { "<KOD>": { "durum": "...", "say": null, ... } } }
//
// DÜRÜSTLÜK KURALI: bilinmeyen alan yanıta HİÇ konmaz (uydurma yok). Tek istisna
// "say" (sayaç): poller/PLC entegrasyonu yokken null bırakılır. Hiç veri/eşleşme
// olmayan tezgah yanıta KONMAZ → sahne o tezgahı "sinyal yok" gösterir.
//
// Auth guard birebir sahne/route.ts ile aynı.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Alias katmanı: DB tezgah kodu → sahne kodu ──────────────────────────────
// Onaylı eşleme turu. Anahtar = DB kodu, değer = sahnedeki kutu kodu. Yanıt
// anahtarları SAHNE koduyla yazılır. Burada olmayan DB kodları kendi koduyla
// geçer (DT06, KH04, KH13, KH27, PH09, PH13, PK15, MM150, MM151, HM15, HM16
// artık sahnede birebir var → alias gerekmez).
const DB2SAHNE: Record<string, string> = {
  CN19: 'ARES', CN16: 'PM13', MM210: 'ELGAZI', MM30: '1410H',
  PH20: 'BROS', // DB PH20 = Broş Çekme; sahnedeki eski PH20 kutusu PH10 oldu
  KM01: 'KILIT-1', KM02: 'KILIT-2', KM03: 'KILIT-3',
  MM230: 'ELFREN-1', MM202: 'ELFREN-2', MM233: 'ELFREN-3',
  KH29: 'PM14', KR09: 'KR06',
  KP15: 'TRN-1', KP16: 'TRN-2',
  PK07: 'DIREKSIYON', PK08: '2197H',
  PK13: 'PK31', // 2197 Rulman Çakma — ürün teyidi bekliyor (2197 mi 2489 mi)
  CN08: 'PM02', CN09: 'PM05', CN10: 'PM06', CN11: 'PM07',
  CN12: 'PM08', CN13: 'PM09', CN14: 'PM10', // matkap sırası teyit edilecek
}

// Robot kaynak fan-out: KR01-1..KR04-6 kapı istasyonları → KR01..KR04 kutusu.
const ROBOT_RE = /^(KR0[1-4])-\d+$/

function gununBasi(): Date {
  // Sunucu saatiyle bugünün 00:00'ı (prod tek TZ: Europe/Istanbul).
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

type DurumTip = 'calisiyor' | 'durusta' | 'bosta'

type TezgahDurum = {
  durum: DurumTip
  say: number | null // poller yok → null; uydurulmaz
  opr?: string
  ie?: string
  mlz?: string
  sebep?: string
  sure?: number // sn
  uretilen?: number
  plan?: number
}

async function durumTuret(): Promise<Record<string, TezgahDurum>> {
  const bugun = gununBasi()

  const [tezgahlar, acikIsler, acikDuruslar, bugunKayitlar] = await Promise.all([
    prisma.iproTezgah.findMany({
      where: { aktif: true },
      select: { id: true, kod: true },
    }),
    prisma.iproProductionLog.findMany({
      where: { durum: 'ACIK' },
      select: {
        tezgahId: true,
        personnelId: true,
        ifsOrderNo: true,
        ifsOperationNo: true,
        ifsPartNo: true,
        ifsPartDescription: true,
        baslatildiAt: true,
        qtyComplete: true,
        ifsQtyDue: true,
      },
    }),
    prisma.iproMachineDowntime.findMany({
      where: { bitis: null },
      orderBy: { baslangic: 'asc' },
      select: { tezgahId: true, baslangic: true, durusSebebi: { select: { ad: true } } },
    }),
    prisma.iproProductionLog.findMany({
      where: { OR: [{ baslatildiAt: { gte: bugun } }, { bitirildiAt: { gte: bugun } }] },
      select: { tezgahId: true },
    }),
  ])

  const personIds = [...new Set(acikIsler.map((a) => a.personnelId))]
  const personeller = personIds.length
    ? await prisma.personnel.findMany({
        where: { id: { in: personIds } },
        select: { id: true, adSoyad: true },
      })
    : []
  const adById = new Map(personeller.map((p) => [p.id, p.adSoyad]))

  const acikByTezgah = new Map(acikIsler.map((a) => [a.tezgahId, a]))
  const durusByTezgah = new Map<string, (typeof acikDuruslar)[number]>()
  for (const d of acikDuruslar) if (!durusByTezgah.has(d.tezgahId)) durusByTezgah.set(d.tezgahId, d)
  const bugunKayitVar = new Set(bugunKayitlar.map((r) => r.tezgahId))

  const now = Date.now()
  const sn = (ms: number) => Math.max(0, Math.floor((now - ms) / 1000))

  // Açık iş kaydını durum nesnesine çevir (calisiyor).
  const calisiyorEntry = (acik: (typeof acikIsler)[number]): TezgahDurum => {
    const e: TezgahDurum = { durum: 'calisiyor', say: null, sure: sn(acik.baslatildiAt!.getTime()) }
    const opr = adById.get(acik.personnelId)
    if (opr) e.opr = opr
    if (acik.ifsOrderNo) {
      e.ie = acik.ifsOperationNo != null ? `${acik.ifsOrderNo}/${acik.ifsOperationNo}` : acik.ifsOrderNo
    }
    const mlz = acik.ifsPartDescription ?? acik.ifsPartNo
    if (mlz) e.mlz = mlz
    if (acik.qtyComplete != null) e.uretilen = acik.qtyComplete
    if (acik.ifsQtyDue != null) e.plan = acik.ifsQtyDue
    return e
  }

  // Tek tezgah için ham durum (fan-out dışı).
  const entryFor = (tezgahId: string): TezgahDurum | null => {
    const durus = durusByTezgah.get(tezgahId)
    if (durus) {
      const e: TezgahDurum = { durum: 'durusta', say: null, sure: sn(durus.baslangic.getTime()) }
      if (durus.durusSebebi?.ad) e.sebep = durus.durusSebebi.ad
      return e
    }
    const acik = acikByTezgah.get(tezgahId)
    if (acik && acik.baslatildiAt) return calisiyorEntry(acik)
    if (bugunKayitVar.has(tezgahId)) return { durum: 'bosta', say: null }
    return null
  }

  // Robot grubu (KR01..KR04) — istasyonları topla, tek kutuya indir.
  //   herhangi biri calisiyor → calisiyor (sure=en güncel aktif, opr=ilk aktif)
  //   değilse biri durusta → durusta (sebep=ilk duruş, sure=en güncel duruş)
  //   değilse bugün kaydı varsa → bosta
  const robotAgg = (stationIds: string[]): TezgahDurum | null => {
    const aktifler = stationIds
      .map((id) => acikByTezgah.get(id))
      .filter((a): a is (typeof acikIsler)[number] => !!(a && a.baslatildiAt))
      .sort((x, y) => x.baslatildiAt!.getTime() - y.baslatildiAt!.getTime())
    if (aktifler.length) {
      const ilk = aktifler[0] // ilk (en eski) aktif → tanımlayıcı alanlar
      const enGuncel = aktifler[aktifler.length - 1] // en güncel (en yeni) → sure
      const e = calisiyorEntry(ilk)
      e.sure = sn(enGuncel.baslatildiAt!.getTime())
      return e
    }
    const duruslar = stationIds
      .map((id) => durusByTezgah.get(id))
      .filter((d): d is (typeof acikDuruslar)[number] => !!d)
      .sort((x, y) => x.baslangic.getTime() - y.baslangic.getTime())
    if (duruslar.length) {
      const ilk = duruslar[0] // sebep = ilk duruş
      const enGuncel = duruslar[duruslar.length - 1] // sure = en güncel duruş
      const e: TezgahDurum = { durum: 'durusta', say: null, sure: sn(enGuncel.baslangic.getTime()) }
      if (ilk.durusSebebi?.ad) e.sebep = ilk.durusSebebi.ad
      return e
    }
    if (stationIds.some((id) => bugunKayitVar.has(id))) return { durum: 'bosta', say: null }
    return null
  }

  const out: Record<string, TezgahDurum> = {}
  const robotGruplari = new Map<string, string[]>() // 'KR01' → [tezgahId, ...]

  for (const t of tezgahlar) {
    const rm = ROBOT_RE.exec(t.kod)
    if (rm) {
      const g = rm[1]
      const arr = robotGruplari.get(g) ?? []
      arr.push(t.id)
      robotGruplari.set(g, arr)
      continue
    }
    const e = entryFor(t.id)
    if (e) out[DB2SAHNE[t.kod] ?? t.kod] = e
  }

  for (const [g, ids] of robotGruplari) {
    const e = robotAgg(ids)
    if (e) out[g] = e
  }

  return out
}

export async function GET(_req: NextRequest) {
  const { error } = await requireUser()
  if (error) {
    return NextResponse.redirect(new URL('/login', _req.url))
  }

  const canView = await hasPermission(['ipro.view', 'ipro.admin'])
  if (!canView) {
    return NextResponse.redirect(new URL('/dashboard', _req.url))
  }

  const tezgahlar = await durumTuret()
  return NextResponse.json(
    { tezgahlar },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
