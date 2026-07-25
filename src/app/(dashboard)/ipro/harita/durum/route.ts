import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'

// Fabrika Haritası CANLI DURUM endpoint'i — SALT OKUMA.
//
// Sahne (sahne.html) bunu ~30sn'de bir GET'ler; yanıt yoksa/boşsa temsili
// (simülasyon) sürer. Yanıt sözleşmesi tezgah KODU → durum nesnesi:
//   { "tezgahlar": { "<KOD>": { "durum": "...", "say": null, ... } } }
//
// DÜRÜSTLÜK KURALI: bilinmeyen alan yanıta HİÇ konmaz (uydurma yok). Tek istisna
// "say" (sayaç): poller/PLC entegrasyonu yokken null bırakılır. Hiç veri/eşleşme
// olmayan tezgah yanıta KONMAZ → sahne o tezgahı "sinyal yok" gösterir.
//
// Durum türetme, izleme panosuyla (izleme-service.ts) aynı kaynaklardan:
//   açık duruş (IproMachineDowntime.bitis=null)      → "durusta" (duruş > çalışıyor)
//   açık iş  (IproProductionLog.durum=ACIK)          → "calisiyor"
//   bugün kaydı var ama şu an açık iş/duruş yok       → "bosta"
//   hiçbiri                                           → tezgah atlanır (sinyalyok)
//
// Auth guard birebir sahne/route.ts ile aynı.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    // Açık duruşlar (bitis=null) — en eskisi tezgahın güncel duruşu sayılır.
    prisma.iproMachineDowntime.findMany({
      where: { bitis: null },
      orderBy: { baslangic: 'asc' },
      select: { tezgahId: true, baslangic: true, durusSebebi: { select: { ad: true } } },
    }),
    // "bosta" sinyali: bugün başlamış ya da bugün kapanmış herhangi bir iş kaydı.
    prisma.iproProductionLog.findMany({
      where: { OR: [{ baslatildiAt: { gte: bugun } }, { bitirildiAt: { gte: bugun } }] },
      select: { tezgahId: true },
    }),
  ])

  // Açık işlerdeki operatör adları (personnelId FK'sız — ikinci sorguyla eşlenir).
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
  const out: Record<string, TezgahDurum> = {}

  for (const t of tezgahlar) {
    const durus = durusByTezgah.get(t.id)
    const acik = acikByTezgah.get(t.id)

    if (durus) {
      const e: TezgahDurum = {
        durum: 'durusta',
        say: null,
        sure: Math.max(0, Math.floor((now - durus.baslangic.getTime()) / 1000)),
      }
      if (durus.durusSebebi?.ad) e.sebep = durus.durusSebebi.ad
      out[t.kod] = e
    } else if (acik && acik.baslatildiAt) {
      const e: TezgahDurum = {
        durum: 'calisiyor',
        say: null,
        sure: Math.max(0, Math.floor((now - acik.baslatildiAt.getTime()) / 1000)),
      }
      const opr = adById.get(acik.personnelId)
      if (opr) e.opr = opr
      if (acik.ifsOrderNo) {
        e.ie = acik.ifsOperationNo != null ? `${acik.ifsOrderNo}/${acik.ifsOperationNo}` : acik.ifsOrderNo
      }
      const mlz = acik.ifsPartDescription ?? acik.ifsPartNo
      if (mlz) e.mlz = mlz
      if (acik.qtyComplete != null) e.uretilen = acik.qtyComplete
      if (acik.ifsQtyDue != null) e.plan = acik.ifsQtyDue
      out[t.kod] = e
    } else if (bugunKayitVar.has(t.id)) {
      out[t.kod] = { durum: 'bosta', say: null }
    }
    // else: veri yok → tezgahı atla (sahne "sinyal yok" gösterir)
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
