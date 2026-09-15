import 'server-only'
import { prisma } from '@/lib/prisma'
import { statusCek, fizikselDurum } from '@/lib/ipro/fiziksel-aktivite'
import { tezgahlarinCanliOee, IDEAL_ESIK, type OeeCanliKart } from '@/lib/ipro/oee-pano-service'

/**
 * IPRO izleme panosu — SALT OKUMA veri katmanı (FAZ 2).
 *
 * Hiçbir yazma yok. Tek toplu çağrı (panoData) tüm panoyu tek istekte döndürür;
 * N tezgah kartı için N istek YAPILMAZ.
 *
 * NOT (IPRO bloğu deseni): personnelId FK'sız çıplak String — operatör adı
 * ilişki üzerinden çekilemez, ikinci sorguyla eşlenir.
 *
 * Poller YOK → sinyalli tezgah canlı sayaçları GÖSTERİLMEZ (backlog).
 */

/** Kart durumu — renk mantığı: çalışıyor=yeşil, duruşta=kırmızı, boşta=gri. */
export type KartDurum = 'calisiyor' | 'durusta' | 'bosta'

/** Kart üzerindeki tek açık iş (çoklu-iş listesinin bir elemanı). */
export type KartIs = {
  adSoyad: string | null
  sicilNo: string | null
  ifsOrderNo: string | null
  ifsOperationNo: number | null
  ifsPartNo: string | null // malzeme kodu (başla anında IFS snapshot)
  ifsPartDescription: string | null // malzeme adı
  baslatildiAt: string // ISO — süre istemcide hesaplanır (canlı sayaç)
}

export type TezgahKart = {
  id: string
  kod: string
  ad: string
  masGrupAdi: string | null
  aktif: boolean
  sinyalli: boolean
  durum: KartDurum
  /** Açık iş varsa dolu — kart "çalışıyor" görünür. Çoklu işte İLK (en erken) iş (geriye-uyum). */
  calisan: KartIs | null
  /**
   * Tezgahın TÜM açık işleri (en erken başlangıç önce). Tek iş → 1 eleman; 2+ → çoklu-iş kartı.
   * Aynı tezgahta paralel iş emirleri ayrı satır olarak tutulur (MAS aynası) → burada hepsi listelenir.
   */
  isler: KartIs[]
  /**
   * Açık duruş (IproMachineDowntime, bitis=null). DÜRÜST SINIR: kioskta duruş
   * akışı henüz YOK → bu her zaman null. Veri (FAZ 2.5 / PLC) gelince kart otomatik
   * kırmızıya döner. istemci "—" gösterir.
   */
  durus: {
    baslangicAt: string // ISO
    sebep: string | null
  } | null
  /** Canlı OEE bileşenleri — YALNIZ panoData({ oee:true }) çağrısında ve açık iş varsa dolu. */
  canliOee?: OeeCanliKart | null
}

export type GunOzeti = {
  kapananIs: number
  toplamIyi: number
  toplamHurda: number
  aktifOperator: number // açık oturum sayısı (distinct personel)
  // Kart durum sayaçları (OEE görünümü şeridi) — her çağrıda dolu.
  calisiyor: number
  durusta: number
  bosta: number
}

export type IfsKuyruk = {
  bekleyen: number // KAPALI, ifsCompleteYazildi=false, qty>0
  enEskiBeklemeAt: string | null // ISO — en eski bekleyenin bitirildiAt'ı
  hataliKayit: number // ifsCompleteHata dolu
}

export type PanoData = {
  olusturuldu: string // ISO — istemci "en son … güncellendi" için
  esik: number // OEE ideal güvenilirlik eşiği (X/esik gösterimi)
  tezgahlar: TezgahKart[]
  ozet: GunOzeti
  kuyruk: IfsKuyruk
}

function gununBasi(): Date {
  // Sunucu saatiyle bugünün 00:00'ı. Prod tek TZ (Europe/Istanbul).
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function panoData(opts: { oee?: boolean } = {}): Promise<PanoData> {
  const bugun = gununBasi()
  const simdi = new Date()

  // ── Tek turda topla: tezgahlar + açık işler + gün özeti + kuyruk + açık duruşlar + faz2 son-hareket ──
  const [tezgahlar, acikIsler, acikDuruslar, kapananBugun, toplamlar, acikOturumlar, bekleyen, enEski, hatali, statusByKod, faz2Rows] =
    await Promise.all([
    prisma.iproTezgah.findMany({
      where: { aktif: true },
      orderBy: { kod: 'asc' },
      select: {
        id: true,
        kod: true,
        ad: true,
        masGrupAdi: true,
        aktif: true,
        _count: { select: { plcPinler: true } },
      },
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
      },
    }),
    // Açık duruşlar (bitis=null). Şu an akış yok → boş; kırmızı kart mantığı hazır.
    prisma.iproMachineDowntime.findMany({
      where: { bitis: null },
      orderBy: { baslangic: 'asc' },
      select: { tezgahId: true, baslangic: true, durusSebebi: { select: { ad: true } } },
    }),
    prisma.iproProductionLog.count({ where: { durum: 'KAPALI', bitirildiAt: { gte: bugun } } }),
    prisma.iproProductionLog.aggregate({
      where: { bitirildiAt: { gte: bugun } },
      _sum: { qtyComplete: true, qtyScrap: true },
    }),
    prisma.iproOperatorSession.findMany({ where: { cikisAt: null }, select: { personnelId: true } }),
    prisma.iproProductionLog.count({
      where: { durum: 'KAPALI', ifsCompleteYazildi: false, qtyComplete: { gt: 0 } },
    }),
    prisma.iproProductionLog.findFirst({
      where: { durum: 'KAPALI', ifsCompleteYazildi: false, qtyComplete: { gt: 0 } },
      orderBy: { bitirildiAt: 'asc' },
      select: { bitirildiAt: true },
    }),
    prisma.iproProductionLog.count({ where: { ifsCompleteHata: { not: null } } }),
    statusCek(), // poller /status — CANLI fiziksel aktivite; down/timeout → null → katman atlanır (pano yine açılır)
    // SOĞUK-BAŞLANGIÇ FIX: Faz 2 serisinden (disk) son-180sn hareketli tezgah kodları. fizikselDurum
    // bellek Map'i restart'ta sıfırlanır; bu deploy'dan ETKİLENMEZ → OEE panosuyla aynı durum mantığı.
    prisma.$queryRaw<{ tezgahKod: string }[]>`
      SELECT DISTINCT "tezgahKod" FROM ipro_sayac_okuma WHERE ts > now() - interval '180 seconds'
    `,
  ])

  // ── Açık işlerdeki operatör adlarını ikinci sorguyla eşle (FK yok) ──
  // Tezgah başına TÜM açık işler (en erken başlangıç önce) — çoklu-iş gösterimi için.
  const islerByTezgah = new Map<string, typeof acikIsler>()
  for (const a of acikIsler) {
    const arr = islerByTezgah.get(a.tezgahId)
    if (arr) arr.push(a)
    else islerByTezgah.set(a.tezgahId, [a])
  }
  for (const arr of islerByTezgah.values()) {
    arr.sort((x, y) => (x.baslatildiAt?.getTime() ?? 0) - (y.baslatildiAt?.getTime() ?? 0))
  }
  // İlk (en eski) açık duruş her tezgah için — kırmızı kart sinyali.
  const durusByTezgah = new Map<string, (typeof acikDuruslar)[number]>()
  for (const d of acikDuruslar) if (!durusByTezgah.has(d.tezgahId)) durusByTezgah.set(d.tezgahId, d)

  const personIds = [...new Set(acikIsler.map((a) => a.personnelId))]
  const personeller = personIds.length
    ? await prisma.personnel.findMany({
        where: { id: { in: personIds } },
        select: { id: true, adSoyad: true, sicilNo: true },
      })
    : []
  const personById = new Map(personeller.map((p) => [p.id, p]))

  // Faz2 son-180sn hareketli tezgah kodları — fizikselDurum'a EK 'calisiyor' kaynağı (soğuk-başlangıç-bağışık).
  const faz2SonHareket = new Set(faz2Rows.map((r) => r.tezgahKod))

  // Canlı OEE — yalnız istenirse (oee/ikisi görünümü). Açık iş sayısı kadar aggregate.
  const canliByTezgah = opts.oee
    ? await tezgahlarinCanliOee(prisma, tezgahlar, acikIsler, simdi)
    : new Map<string, OeeCanliKart>()

  let calisiyorN = 0
  let durustaN = 0
  let bostaN = 0
  const kartlar: TezgahKart[] = tezgahlar.map((t) => {
    const tIsler = islerByTezgah.get(t.id) ?? []
    const acik = tIsler[0] // en erken açık iş (primary)
    const durus = durusByTezgah.get(t.id)
    const calisiyor = !!(acik && acik.baslatildiAt)
    const isler: KartIs[] = tIsler
      .filter((i) => i.baslatildiAt)
      .map((i) => {
        const p = personById.get(i.personnelId)
        return {
          adSoyad: p?.adSoyad ?? null,
          sicilNo: p?.sicilNo ?? null,
          ifsOrderNo: i.ifsOrderNo,
          ifsOperationNo: i.ifsOperationNo,
          ifsPartNo: i.ifsPartNo,
          ifsPartDescription: i.ifsPartDescription,
          baslatildiAt: i.baslatildiAt!.toISOString(),
        }
      })
    // Öncelik: KİOSK açık duruş → KİOSK açık iş → PLC fiziksel hareket VEYA Faz2-son-180sn → bosta.
    // Kiosk kaydı KAZANIR (operatör esas). "durusta" YALNIZ kiosk kaydından (duruş biti 0/214 ölü dal).
    // fizikselDurum (bellek, ısınma ister) ile faz2SonHareket (disk, ısınmasız) aynı sayaç sinyalinden
    // türer → çelişmez; Faz2 soğuk-başlangıçta 2-poll ısınmayı atlar. OEE panosuyla AYNI mantık.
    const fiz = fizikselDurum(t.kod, statusByKod)
    const durum: KartDurum = durus
      ? 'durusta'
      : calisiyor
        ? 'calisiyor'
        : fiz === 'calisiyor' || faz2SonHareket.has(t.kod)
          ? 'calisiyor'
          : (fiz ?? 'bosta')
    if (durum === 'calisiyor') calisiyorN++
    else if (durum === 'durusta') durustaN++
    else bostaN++
    return {
      id: t.id,
      kod: t.kod,
      ad: t.ad,
      masGrupAdi: t.masGrupAdi,
      aktif: t.aktif,
      sinyalli: t._count.plcPinler > 0,
      durum,
      calisan: calisiyor ? isler[0] : null,
      isler,
      durus: durus
        ? { baslangicAt: durus.baslangic.toISOString(), sebep: durus.durusSebebi?.ad ?? null }
        : null,
      canliOee: opts.oee ? (canliByTezgah.get(t.id) ?? null) : undefined,
    }
  })

  return {
    olusturuldu: simdi.toISOString(),
    esik: IDEAL_ESIK,
    tezgahlar: kartlar,
    ozet: {
      kapananIs: kapananBugun,
      toplamIyi: toplamlar._sum.qtyComplete ?? 0,
      toplamHurda: toplamlar._sum.qtyScrap ?? 0,
      aktifOperator: new Set(acikOturumlar.map((o) => o.personnelId)).size,
      calisiyor: calisiyorN,
      durusta: durustaN,
      bosta: bostaN,
    },
    kuyruk: {
      bekleyen,
      enEskiBeklemeAt: enEski?.bitirildiAt?.toISOString() ?? null,
      hataliKayit: hatali,
    },
  }
}

// ── Tek tezgah detayı (kart tıklaması → dialog). ON-DEMAND: 10sn poll'a girmez. ──

export type TezgahIsSatiri = {
  id: string
  ifsOrderNo: string | null
  ifsOperationNo: number | null
  ifsPartNo: string | null
  ifsPartDescription: string | null
  qtyComplete: number
  qtyScrap: number
  baslatildiAt: string | null
  bitirildiAt: string | null
  operator: string | null // adSoyad, FK'sız ikinci sorgudan
  // Plan snapshot (başla anında ShopOrderOperations'tan) — aktif iş detayında gösterilir.
  ifsQtyDue: number | null
  ifsDueDate: string | null
  ifsNeedDate: string | null
  ifsMachRunFactor: number | null
  ifsLaborRunFactor: number | null
  ifsRunTimeCode: string | null
}

export type TezgahDurusSatiri = {
  id: string
  sebep: string | null
  /** Operatörün kiosktan yazdığı opsiyonel not (yoksa null). */
  yorum: string | null
  baslangicAt: string
  bitisAt: string | null // null = hâlâ açık
  operator: string | null
}

export type TezgahDetay = {
  id: string
  kod: string
  ad: string
  masGrupAdi: string | null
  aktif: boolean
  sinyalli: boolean
  durum: KartDurum
  aktifIs: TezgahIsSatiri | null // İLK ACIK satır (geriye-uyum; çoklu işte en erken)
  aktifIsler: TezgahIsSatiri[] // TÜM açık işler (paralel iş emirleri), en erken başlangıç önce
  durus: { baslangicAt: string; sebep: string | null } | null
  bugunKapanan: TezgahIsSatiri[] // bugün KAPANMIŞ işler, en yeni önce
  bugunDuruslar: TezgahDurusSatiri[] // bugün başlayan + hâlâ açık duruşlar, en yeni önce
  // Bugün (gün başından şimdiye) süre dağılımı — dakika. DB'den hesaplanır, IFS yok.
  sureDagilimi: { calismaDk: number; durusDk: number; bostaDk: number; elapsedDk: number }
  // Üretim ilerleme — gerçekleşen (bugün kapananların iyi toplamı) / planlanan (aktif iş ifsQtyDue).
  uretim: { gerceklesen: number; planlanan: number | null }
}

/** Tezgah + aktif iş + bugün kapanan işler. Bulunamazsa null. */
export async function tezgahDetay(tezgahId: string): Promise<TezgahDetay | null> {
  const bugun = gununBasi()

  const [tezgah, satirlar, durus, duruslar] = await Promise.all([
    prisma.iproTezgah.findUnique({
      where: { id: tezgahId },
      select: { id: true, kod: true, ad: true, masGrupAdi: true, aktif: true, _count: { select: { plcPinler: true } } },
    }),
    // Açık iş + bugün kapananlar tek sorguda.
    prisma.iproProductionLog.findMany({
      where: { tezgahId, OR: [{ durum: 'ACIK' }, { durum: 'KAPALI', bitirildiAt: { gte: bugun } }] },
      orderBy: [{ durum: 'asc' }, { bitirildiAt: 'desc' }],
      select: {
        id: true,
        durum: true,
        personnelId: true,
        ifsOrderNo: true,
        ifsOperationNo: true,
        ifsPartNo: true,
        ifsPartDescription: true,
        ifsQtyDue: true,
        ifsDueDate: true,
        ifsNeedDate: true,
        ifsMachRunFactor: true,
        ifsLaborRunFactor: true,
        ifsRunTimeCode: true,
        qtyComplete: true,
        qtyScrap: true,
        baslatildiAt: true,
        bitirildiAt: true,
      },
    }),
    prisma.iproMachineDowntime.findFirst({
      where: { tezgahId, bitis: null },
      orderBy: { baslangic: 'asc' },
      select: { baslangic: true, durusSebebi: { select: { ad: true } } },
    }),
    // Bugün başlayan + hâlâ açık duruşlar (detay dialog tablosu).
    prisma.iproMachineDowntime.findMany({
      where: { tezgahId, OR: [{ bitis: null }, { baslangic: { gte: bugun } }] },
      orderBy: { baslangic: 'desc' },
      select: {
        id: true,
        personnelId: true,
        baslangic: true,
        bitis: true,
        yorum: true,
        durusSebebi: { select: { ad: true } },
      },
    }),
  ])

  if (!tezgah) return null

  // Operatör adlarını FK'sız eşle (IPRO deseni) — iş satırları + duruşlar birlikte.
  const personIds = [
    ...new Set([
      ...satirlar.map((s) => s.personnelId),
      ...duruslar.map((d) => d.personnelId).filter((x): x is string => !!x),
    ]),
  ]
  const personeller = personIds.length
    ? await prisma.personnel.findMany({ where: { id: { in: personIds } }, select: { id: true, adSoyad: true } })
    : []
  const adById = new Map(personeller.map((p) => [p.id, p.adSoyad]))

  const map = (s: (typeof satirlar)[number]): TezgahIsSatiri => ({
    id: s.id,
    ifsOrderNo: s.ifsOrderNo,
    ifsOperationNo: s.ifsOperationNo,
    ifsPartNo: s.ifsPartNo,
    ifsPartDescription: s.ifsPartDescription,
    qtyComplete: s.qtyComplete,
    qtyScrap: s.qtyScrap,
    baslatildiAt: s.baslatildiAt?.toISOString() ?? null,
    bitirildiAt: s.bitirildiAt?.toISOString() ?? null,
    operator: adById.get(s.personnelId) ?? null,
    ifsQtyDue: s.ifsQtyDue,
    ifsDueDate: s.ifsDueDate?.toISOString() ?? null,
    ifsNeedDate: s.ifsNeedDate?.toISOString() ?? null,
    ifsMachRunFactor: s.ifsMachRunFactor,
    ifsLaborRunFactor: s.ifsLaborRunFactor,
    ifsRunTimeCode: s.ifsRunTimeCode,
  })

  const aktifler = satirlar
    .filter((s) => s.durum === 'ACIK')
    .sort((a, b) => (a.baslatildiAt?.getTime() ?? 0) - (b.baslatildiAt?.getTime() ?? 0))
  const aktif = aktifler[0]
  const kapananlar = satirlar.filter((s) => s.durum === 'KAPALI')
  const calisiyor = !!(aktif && aktif.baslatildiAt)
  const durum: KartDurum = durus ? 'durusta' : calisiyor ? 'calisiyor' : 'bosta'

  // ── Bugün süre dağılımı (dakika) — production_log + downtime'dan, gün başından şimdiye ──
  const now = new Date()
  const clampDk = (start: Date, end: Date): number => {
    const s = Math.max(start.getTime(), bugun.getTime())
    const e = Math.min(end.getTime(), now.getTime())
    return Math.max(0, (e - s) / 60000)
  }
  const uretimDk = satirlar.reduce(
    (acc, s) => acc + (s.baslatildiAt ? clampDk(s.baslatildiAt, s.bitirildiAt ?? now) : 0),
    0,
  )
  const durusDk = duruslar.reduce((acc, d) => acc + clampDk(d.baslangic, d.bitis ?? now), 0)
  const elapsedDk = Math.max(0, (now.getTime() - bugun.getTime()) / 60000)
  // Çalışma = üreten süre eksi duruş (duruş, iş açıkken makine durması). Boşta = kalan.
  const calismaDk = Math.max(0, uretimDk - durusDk)
  const bostaDk = Math.max(0, elapsedDk - calismaDk - durusDk)
  const yuvarla = (n: number) => Math.round(n)

  const gerceklesen =
    kapananlar.reduce((a, s) => a + s.qtyComplete, 0) + aktifler.reduce((a, s) => a + s.qtyComplete, 0)

  return {
    id: tezgah.id,
    kod: tezgah.kod,
    ad: tezgah.ad,
    masGrupAdi: tezgah.masGrupAdi,
    aktif: tezgah.aktif,
    sinyalli: tezgah._count.plcPinler > 0,
    durum,
    aktifIs: aktif ? map(aktif) : null,
    aktifIsler: aktifler.map(map),
    durus: durus ? { baslangicAt: durus.baslangic.toISOString(), sebep: durus.durusSebebi?.ad ?? null } : null,
    bugunKapanan: kapananlar.map(map),
    bugunDuruslar: duruslar.map((d) => ({
      id: d.id,
      sebep: d.durusSebebi?.ad ?? null,
      yorum: d.yorum,
      baslangicAt: d.baslangic.toISOString(),
      bitisAt: d.bitis?.toISOString() ?? null,
      operator: d.personnelId ? (adById.get(d.personnelId) ?? null) : null,
    })),
    sureDagilimi: {
      calismaDk: yuvarla(calismaDk),
      durusDk: yuvarla(durusDk),
      bostaDk: yuvarla(bostaDk),
      elapsedDk: yuvarla(elapsedDk),
    },
    uretim: { gerceklesen, planlanan: aktif?.ifsQtyDue ?? null },
  }
}
