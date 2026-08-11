// OEE PANO (Paket 2) — SALT OKUMA veri katmanı. Tek toplu çağrı; 214 tezgah için N istek YAPILMAZ.
//
// izleme-service.ts'e DOKUNMAZ — durum için fiziksel-aktivite.ts'i (ortak modül) İMPORT eder.
// Canlı OEE: oee-canli.ts (açık iş, quality açık işte null). Motor (oee-hesap.ts) donmuş.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { statusCek, fizikselDurum } from '@/lib/ipro/fiziksel-aktivite'
import { planliSaniyeHesapla } from '@/lib/ipro/oee-hesap'
import { isPenceresiDeltaToplami } from '@/lib/ipro/faz2-delta'
import { durusSaniyeCanli, oeeCanliBilesenleri, type OeeCanliSonuc } from '@/lib/ipro/oee-canli'
import { gecerliTatilTip, tarihAnahtari, type IproTatilTip } from '@/lib/ipro/takvim-util'

/** Kart durumu — izleme ile aynı sözlük (çalışıyor=yeşil, duruşta=kırmızı, boşta=gri). */
export type OeeDurum = 'calisiyor' | 'durusta' | 'bosta'

export type OeeCalisan = {
  adSoyad: string | null
  sicilNo: string | null
  ifsOrderNo: string | null
  ifsOperationNo: number | null
  ifsPartNo: string | null
  ifsPartDescription: string | null
  baslatildiAt: string // ISO
}

/** Canlı OEE bileşenleri (açık iş varsa dolu; quality açık işte null → tam OEE iş kapanınca). */
export type OeeCanliKart = {
  availability: number | null
  performance: number | null
  quality: null
  oeeCanli: number | null
  durum: OeeCanliSonuc['durum']
  planliSaniye: number
  durusSaniye: number
  uretilen: number
  idealGuvenilir: boolean
  ornekSayisi: number // X — güvenilirlik eşiği 50 (X/50)
}

export type OeeTezgahKart = {
  id: string
  kod: string
  ad: string
  hat: string | null // masGrupAdi
  sinyalli: boolean
  durum: OeeDurum
  calisan: OeeCalisan | null
  canliOee: OeeCanliKart | null // yalnız açık iş varsa; boşta/sinyalsiz → null
}

export type OeePanoData = {
  olusturuldu: string // ISO
  esik: number // ideal güvenilirlik eşiği (X/esik gösterimi)
  tezgahlar: OeeTezgahKart[]
  ozet: { toplam: number; calisiyor: number; durusta: number; bosta: number; aktifOperator: number }
}

// İdeal güvenilirlik eşiği — oee-canli/ideal-cevrim ile hizalı (X/50 gösterimi için pano'ya taşınır).
const IDEAL_ESIK = 50

/**
 * OEE panosunun TAMAMI tek istekte: tüm tezgahlar + durum (fiziksel-aktivite) + açık iş künyesi +
 * canlı OEE bileşenleri. N+1 YOK — açık iş sayısı kadar (tipik <30) canlı aggregate; 214 tezgah değil.
 */
export async function oeePanoData(): Promise<OeePanoData> {
  const simdi = new Date()

  const [tezgahlar, acikIsler, acikDuruslar, statusByKod, vardiyalar, tatiller, faz2Rows] = await Promise.all([
    prisma.iproTezgah.findMany({
      where: { aktif: true },
      orderBy: { kod: 'asc' },
      select: { id: true, kod: true, ad: true, masGrupAdi: true, _count: { select: { plcPinler: true } } },
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
    prisma.iproMachineDowntime.findMany({
      where: { bitis: null },
      orderBy: { baslangic: 'asc' },
      select: { tezgahId: true, baslangic: true },
    }),
    statusCek(), // poller /status — down/timeout → null → fiziksel katman atlanır, pano yine açılır
    prisma.iproVardiya.findMany({
      where: { aktif: true },
      select: { baslangicSaat: true, bitisSaat: true, ertesiGuneTasar: true },
    }),
    prisma.iproTatil.findMany({ select: { tarih: true, tip: true } }),
    // SOĞUK-BAŞLANGIÇ FIX: Faz 2 serisinden (disk, kalıcı) son-hareket. Restart'ta sıfırlanan
    // fizikselDurum bellek Map'inin aksine deploy'dan ETKİLENMEZ. delta>0 değişmez (poller yalnız
    // delta>0 yazar) → son 180sn (HAREKET_PENCERESI_MS) satırı olan tezgah = çalışıyor. Mevcut
    // (tezgahKod, ts) index → Index-Only-Scan (~21ms, yeni index yok).
    prisma.$queryRaw<{ tezgahKod: string }[]>`
      SELECT DISTINCT "tezgahKod" FROM ipro_sayac_okuma WHERE ts > now() - interval '180 seconds'
    `,
  ])

  const tatilMap = new Map<string, IproTatilTip>()
  for (const t of tatiller) if (gecerliTatilTip(t.tip)) tatilMap.set(tarihAnahtari(t.tarih), t.tip)

  // Faz2 son-180sn hareketli tezgah kodları — fizikselDurum'a EK 'calisiyor' kaynağı (soğuk-başlangıç-bağışık).
  const faz2SonHareket = new Set(faz2Rows.map((r) => r.tezgahKod))

  const kodById = new Map(tezgahlar.map((t) => [t.id, t.kod]))
  const acikByTezgah = new Map(acikIsler.map((a) => [a.tezgahId, a]))
  const durusByTezgah = new Set(acikDuruslar.map((d) => d.tezgahId))

  // Operatör adları — FK'sız ikinci sorgu (IPRO bloğu deseni).
  const personIds = [...new Set(acikIsler.map((a) => a.personnelId))]
  const personeller = personIds.length
    ? await prisma.personnel.findMany({ where: { id: { in: personIds } }, select: { id: true, adSoyad: true, sicilNo: true } })
    : []
  const personById = new Map(personeller.map((p) => [p.id, p]))

  // İdeal çevrimler — açık işlerin (tezgahKod, parcaKod) çiftleri tek sorguda.
  const ciftler = acikIsler
    .filter((a) => a.ifsPartNo)
    .map((a) => ({ tezgahKod: kodById.get(a.tezgahId)!, parcaKod: a.ifsPartNo! }))
  const idealler = ciftler.length
    ? await prisma.iproIdealCevrim.findMany({
        where: { OR: ciftler.map((c) => ({ tezgahKod: c.tezgahKod, parcaKod: c.parcaKod })) },
        select: { tezgahKod: true, parcaKod: true, idealSaniyeAdet: true, guvenilir: true, ornekSayisi: true },
      })
    : []
  const idealByKey = new Map(idealler.map((i) => [`${i.tezgahKod}|${i.parcaKod}`, i]))

  // Canlı OEE — her AÇIK iş için (küçük küme). Σdelta + duruş paralel.
  const canliByTezgah = new Map<string, OeeCanliKart>()
  await Promise.all(
    acikIsler.map(async (a) => {
      if (!a.baslatildiAt) return
      const tezgahKod = kodById.get(a.tezgahId)!
      const [{ toplam: uretilen }, durusSaniye] = await Promise.all([
        isPenceresiDeltaToplami(prisma, tezgahKod, a.baslatildiAt, simdi),
        durusSaniyeCanli(prisma, a.tezgahId, a.baslatildiAt, simdi),
      ])
      const planliSaniye = planliSaniyeHesapla(a.baslatildiAt, simdi, vardiyalar, tatilMap)
      const ideal = a.ifsPartNo ? idealByKey.get(`${tezgahKod}|${a.ifsPartNo}`) : undefined
      const idealSaniyeAdet = ideal?.guvenilir ? ideal.idealSaniyeAdet : null
      const b = oeeCanliBilesenleri({ planliSaniye, durusSaniye, uretilen, idealSaniyeAdet })
      canliByTezgah.set(a.tezgahId, {
        ...b,
        planliSaniye,
        durusSaniye,
        uretilen,
        idealGuvenilir: !!ideal?.guvenilir,
        ornekSayisi: ideal?.ornekSayisi ?? 0,
      })
    }),
  )

  let calisiyorN = 0
  let durustaN = 0
  let bostaN = 0
  const kartlar: OeeTezgahKart[] = tezgahlar.map((t) => {
    const acik = acikByTezgah.get(t.id)
    const acikDurus = durusByTezgah.has(t.id)
    const person = acik ? personById.get(acik.personnelId) : null
    const calisiyor = !!(acik && acik.baslatildiAt)
    // Öncelik: kiosk açık duruş → kiosk açık iş → PLC fiziksel hareket VEYA Faz2-son-180sn → boşta.
    // 'durusta' YALNIZ kiosk kaydından (duruş biti 0/214 ölü dal — bilinen sınır).
    // fizikselDurum (bellek, ısınma ister) ile faz2SonHareket (disk, ısınmasız) AYNI sayaç sinyalinden
    // türer → çelişmez; Faz2 soğuk-başlangıçta 2-poll ısınmayı atlar (restart sonrası anında yeşil).
    const fiz = fizikselDurum(t.kod, statusByKod)
    const durum: OeeDurum = acikDurus
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
      hat: t.masGrupAdi,
      sinyalli: t._count.plcPinler > 0,
      durum,
      calisan: calisiyor
        ? {
            adSoyad: person?.adSoyad ?? null,
            sicilNo: person?.sicilNo ?? null,
            ifsOrderNo: acik!.ifsOrderNo,
            ifsOperationNo: acik!.ifsOperationNo,
            ifsPartNo: acik!.ifsPartNo,
            ifsPartDescription: acik!.ifsPartDescription,
            baslatildiAt: acik!.baslatildiAt!.toISOString(),
          }
        : null,
      canliOee: canliByTezgah.get(t.id) ?? null,
    }
  })

  return {
    olusturuldu: simdi.toISOString(),
    esik: IDEAL_ESIK,
    tezgahlar: kartlar,
    ozet: {
      toplam: kartlar.length,
      calisiyor: calisiyorN,
      durusta: durustaN,
      bosta: bostaN,
      aktifOperator: new Set(acikIsler.map((a) => a.personnelId)).size,
    },
  }
}
