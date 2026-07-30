import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
import { statusCek, fizikselDurum, type FizikselDurum } from '@/lib/ipro/fiziksel-aktivite'

// Fabrika Haritası CANLI DURUM endpoint'i — SALT OKUMA.
//
// Sahne (sahne.html) bunu ~30sn'de bir GET'ler; yanıt yoksa/boşsa temsili sürer.
// Yanıt sözleşmesi tezgah KODU → durum nesnesi:
//   { "tezgahlar": { "<KOD>": { "durum": "...", "say": null, ... } } }
//
// KAPSAM (v24): DB'deki TÜM aktif tezgahlar yanıta girer. FİZİKSEL AKTİVİTE KATMANI
// (poller /status): iş kaydı yoksa PLC duruş biti + sayaç hareketiyle çalışıyor/durusta
// türetilir. Poller erişilemezse bu katman ATLANIR, mevcut davranış aynen sürer.
//
// DÜRÜSTLÜK KURALI: bilinmeyen alan yanıta HİÇ konmaz (uydurma yok). Fiziksel kaynaklı
// kayıtlarda opr/ie KONMAZ (operatör bilinmiyor → sahne "—" gösterir). "say" poller
// sayacı işi bağlamında olmadığından null bırakılır.
//
// Öncelik (tezgah başına):
//   a) Açık iş kaydı / açık duruş kaydı  → mevcut mantık AYNEN (kiosk verisi kazanır).
//   b) Kayıt yok, tezgah /status'te taze → FİZİKSEL: duruş biti / sayaç hareketi.
//   c) /status'te yok (bayat/sinyalsiz)  → mevcut fallback (bosta).
//
// Auth guard birebir sahne/route.ts ile aynı.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Alias katmanı: DB tezgah kodu → sahne kodu ──────────────────────────────
const DB2SAHNE: Record<string, string> = {
  CN19: 'ARES', CN16: 'PM13', MM210: 'ELGAZI', MM30: '1410H',
  PH20: 'BROS', // DB PH20 = Broş Çekme; sahnedeki eski PH20 kutusu PH10 oldu
  KM01: 'KILIT-1', KM02: 'KILIT-2', KM03: 'KILIT-3',
  MM230: 'ELFREN-1', MM202: 'ELFREN-2', MM233: 'ELFREN-3',
  KH29: 'PM14', KR09: 'KR06',
  KP15: 'TRN-1', KP16: 'TRN-2',
  PK07: 'DIREKSIYON', PK08: '2197H', PK13: 'PK31',
  CN08: 'PM02', CN09: 'PM05', CN10: 'PM06', CN11: 'PM07',
  CN12: 'PM08', CN13: 'PM09', CN14: 'PM10', // matkap sırası teyit edilecek
}

// Robot kaynak fan-out: KR01-1..KR04-6 kapı istasyonları → KR01..KR04 kutusu.
const ROBOT_RE = /^(KR0[1-4])-\d+$/

// Fiziksel aktivite katmanı (poller /status) ORTAK MODÜLE taşındı — izleme panosu da
// aynı statusCek + hareket haritasını kullanır (src/lib/ipro/fiziksel-aktivite.ts).
// Harita'ya ÖZGÜ olanlar (alias/DB2SAHNE, robot fan-out, sahne agg) BURADA kalır.

type DurumTip = 'calisiyor' | 'durusta' | 'bosta'

type TezgahDurum = {
  durum: DurumTip
  say: number | null // poller sayacı iş bağlamında değil → null; uydurulmaz
  opr?: string
  ie?: string
  mlz?: string
  sebep?: string
  sure?: number // sn
  uretilen?: number
  plan?: number
}

async function durumTuret(): Promise<Record<string, TezgahDurum>> {
  const [tezgahlar, acikIsler, acikDuruslar, statusByKod] = await Promise.all([
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
    statusCek(), // poller down → null → fiziksel katman atlanır
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

  const now = Date.now()
  const sn = (ms: number) => Math.max(0, Math.floor((now - ms) / 1000))

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

  // FİZİKSEL katman ORTAK MODÜLDEN (statusByKod ile). null = /status'te yok / hareketsiz
  // (çağıran 'bosta' yapar). Sayaç hareketi 180sn penceresiyle, paylaşımlı hareket haritası.
  const fd_ = (kod: string): FizikselDurum | null => fizikselDurum(kod, statusByKod)

  const fizikselEntry = (fd: FizikselDurum): TezgahDurum =>
    fd === 'durusta'
      ? { durum: 'durusta', say: null, sebep: 'PLC duruş biti' }
      : { durum: fd, say: null }

  // Tek tezgah (fan-out dışı). Öncelik: iş/duruş kaydı → fiziksel → bosta.
  const entryFor = (tezgahId: string, dbKod: string): TezgahDurum => {
    const durus = durusByTezgah.get(tezgahId)
    if (durus) {
      const e: TezgahDurum = { durum: 'durusta', say: null, sure: sn(durus.baslangic.getTime()) }
      if (durus.durusSebebi?.ad) e.sebep = durus.durusSebebi.ad
      return e
    }
    const acik = acikByTezgah.get(tezgahId)
    if (acik && acik.baslatildiAt) return calisiyorEntry(acik)
    const fd = fd_(dbKod)
    if (fd) return fizikselEntry(fd)
    return { durum: 'bosta', say: null }
  }

  // Robot grubu (KR01..KR04) — istasyonları topla, tek kutuya indir.
  //   herhangi biri iş açık → calisiyor (sure=en güncel aktif, opr=ilk aktif)
  //   değilse biri duruş kaydı → durusta (sebep=ilk duruş, sure=en güncel duruş)
  //   değilse FİZİKSEL: biri hareketli → calisiyor; biri duruş biti → durusta; biri /status'te → bosta
  //   değilse → bosta
  const robotAgg = (stations: { id: string; kod: string }[]): TezgahDurum => {
    const aktifler = stations
      .map((s) => acikByTezgah.get(s.id))
      .filter((a): a is (typeof acikIsler)[number] => !!(a && a.baslatildiAt))
      .sort((x, y) => x.baslatildiAt!.getTime() - y.baslatildiAt!.getTime())
    if (aktifler.length) {
      const ilk = aktifler[0]
      const enGuncel = aktifler[aktifler.length - 1]
      const e = calisiyorEntry(ilk)
      e.sure = sn(enGuncel.baslatildiAt!.getTime())
      return e
    }
    const duruslar = stations
      .map((s) => durusByTezgah.get(s.id))
      .filter((d): d is (typeof acikDuruslar)[number] => !!d)
      .sort((x, y) => x.baslangic.getTime() - y.baslangic.getTime())
    if (duruslar.length) {
      const ilk = duruslar[0]
      const enGuncel = duruslar[duruslar.length - 1]
      const e: TezgahDurum = { durum: 'durusta', say: null, sure: sn(enGuncel.baslangic.getTime()) }
      if (ilk.durusSebebi?.ad) e.sebep = ilk.durusSebebi.ad
      return e
    }
    // Fiziksel katman: istasyon kodlarına göre.
    const fds = stations.map((s) => fd_(s.kod)).filter((f): f is FizikselDurum => f !== null)
    if (fds.some((f) => f === 'calisiyor')) return { durum: 'calisiyor', say: null }
    if (fds.some((f) => f === 'durusta')) return { durum: 'durusta', say: null, sebep: 'PLC duruş biti' }
    if (fds.length) return { durum: 'bosta', say: null }
    return { durum: 'bosta', say: null }
  }

  const out: Record<string, TezgahDurum> = {}
  const robotGruplari = new Map<string, { id: string; kod: string }[]>() // 'KR01' → istasyonlar

  for (const t of tezgahlar) {
    const rm = ROBOT_RE.exec(t.kod)
    if (rm) {
      const g = rm[1]
      const arr = robotGruplari.get(g) ?? []
      arr.push({ id: t.id, kod: t.kod })
      robotGruplari.set(g, arr)
      continue
    }
    out[DB2SAHNE[t.kod] ?? t.kod] = entryFor(t.id, t.kod)
  }

  for (const [g, stations] of robotGruplari) {
    out[g] = robotAgg(stations)
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
