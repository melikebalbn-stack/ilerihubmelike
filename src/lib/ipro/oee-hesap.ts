// OEE motoru — iş kapanınca (is-bitir sonrası) hesaplanıp IproOeeKaydi'ne yazılır.
//
// NEDEN LIB (route DEĞİL): route dosyaları yalnız HTTP metodu export edebilir (23.07 dersi).
// is-bitir buradan çağırır; hata is-bitir'i BLOKLAMAZ (Faz2/mail deseni: try/catch).
//
// Saf fonksiyonlar (planliSaniyeHesapla / oeeBilesenleri) DB'siz test edilir; DB orkestrasyonu
// (oeeKaydiHesaplaVeYaz) ayrı. İdeal çevrim: [[ideal-cevrim]].
import type { PrismaClient } from '@/generated/prisma'
import { gunDurumu, tarihAnahtari, gecerliTatilTip, type IproTatilTip } from '@/lib/ipro/takvim-util'
import { idealCevrimGuncelle, araliklarKesisiyor } from '@/lib/ipro/ideal-cevrim'
import { cevrimSaniye } from '@/lib/ipro/cevrim-util'

/** Türkiye sabit UTC+3 (DST yok). Sunucu UTC çalışır; vardiya saatleri YEREL girilir. */
export const TR_OFFSET_DK = 180

// ─────────────────────────── SAF: planlı süre ───────────────────────────

export interface VardiyaSaat {
  baslangicSaat: string // "HH:mm" yerel
  bitisSaat: string
  ertesiGuneTasar: boolean
}

function saatDk(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** UTC an → ait olduğu YEREL takvim gününün UTC-gece-yarısı Date'i (gunDurumu/tarihAnahtari doğru çalışır). */
function yerelGun(utc: Date): Date {
  const y = new Date(utc.getTime() + TR_OFFSET_DK * 60000)
  return new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate()))
}

/**
 * [baslangic, bitis] penceresinin vardiya+tatil takvimiyle KESİŞİMİ (saniye). SAF — DB'siz test.
 *
 * - Her yerel gün × her aktif vardiya için vardiya aralığı YEREL saatten UTC'ye çevrilir
 *   (gunMs + dk − offset), pencereyle kesiştirilir.
 * - Gün faktörü vardiyanın BAŞLADIĞI güne göre: TATIL→0, YARIM→0.5, MESAI/CALISMA→1. Pazar
 *   otomatik TATIL (gunDurumu türetir). Gece vardiyası (ertesiGuneTasar) başladığı günün faktörünü alır.
 * - Gece vardiyası önceki yerel günden taşabildiği için döngü bir gün geriden başlar.
 * - VARSAYIM: aktif vardiyalar zaman-örtüşmez (VARDIYA-1 07-17 / VARDIYA-2 21-07 gibi); örtüşürlerse
 *   ortak saniye çift sayılır (pratikte olmaz).
 */
export function planliSaniyeHesapla(
  baslangicUtc: Date,
  bitisUtc: Date,
  vardiyalar: VardiyaSaat[],
  tatilMap: Map<string, IproTatilTip>,
): number {
  if (bitisUtc.getTime() <= baslangicUtc.getTime() || vardiyalar.length === 0) return 0
  let toplamSn = 0
  const sonGun = yerelGun(bitisUtc).getTime()
  for (let t = yerelGun(baslangicUtc).getTime() - 86400000; t <= sonGun; t += 86400000) {
    const gun = new Date(t)
    const durum = gunDurumu(gun, tatilMap)
    const faktor = durum === 'TATIL' ? 0 : durum === 'YARIM' ? 0.5 : 1
    if (faktor === 0) continue
    for (const v of vardiyalar) {
      const basMin = saatDk(v.baslangicSaat)
      const bitMin = saatDk(v.bitisSaat) + (v.ertesiGuneTasar ? 1440 : 0)
      if (bitMin <= basMin) continue // geçersiz/sıfır vardiya
      const vBasUtc = t + basMin * 60000 - TR_OFFSET_DK * 60000
      const vBitUtc = t + bitMin * 60000 - TR_OFFSET_DK * 60000
      const kesBas = Math.max(vBasUtc, baslangicUtc.getTime())
      const kesBit = Math.min(vBitUtc, bitisUtc.getTime())
      if (kesBit > kesBas) toplamSn += ((kesBit - kesBas) / 1000) * faktor
    }
  }
  return Math.round(toplamSn)
}

// ─────────────────────────── SAF: OEE bileşenleri ───────────────────────────

export interface OeeGirdi {
  planliSaniye: number
  durusSaniye: number
  uretilenAdet: number
  iyiAdet: number
  idealSaniyeAdet: number | null // güvenilir ideal / IFS planı yoksa null → performance null
  // idealSaniyeAdet'in KAYNAĞI (hesapKaynagi damgası için; FORMÜLÜ etkilemez):
  //   'OLCULEN' → ölçülen güvenilir ideal (TAM), 'IFS' → IFS planlı çevrim fallback (PERF_IFS).
  //   yok/null → OLCULEN varsayılır (geriye dönük uyum: eski çağrılar 'TAM' alır).
  idealKaynak?: 'OLCULEN' | 'IFS' | null
  cakismaVar: boolean
}

export interface OeeBilesen {
  availability: number | null
  performance: number | null
  quality: number | null
  oee: number | null
  hesapKaynagi: string // TAM | PERF_IFS | PERF_YOK | PLANLI_YOK | CAKISMA_VAR
}

/**
 * OEE bileşenleri + hesapKaynagi. SAF — DB'siz test.
 * availability=(planli−durus)/planli · performance=(ideal×üretilen)/(planli−durus) · quality=iyi/üretilen.
 * Biri null ise oee null (null yayılımı). hesapKaynagi önceliği:
 * CAKISMA_VAR > PLANLI_YOK > PERF_YOK > (PERF_IFS | TAM).
 * PERF_IFS: performance IFS planlı çevrimden (ölçülen güvenilir ideal yerine) hesaplandı;
 * formül aynı, yalnız kaynak damgası farklı. idealKaynak yoksa TAM (geriye dönük uyum).
 */
export function oeeBilesenleri(g: OeeGirdi): OeeBilesen {
  const calisma = g.planliSaniye - g.durusSaniye
  const availability = g.planliSaniye > 0 ? calisma / g.planliSaniye : null
  const performance =
    g.idealSaniyeAdet != null && calisma > 0 ? (g.idealSaniyeAdet * g.uretilenAdet) / calisma : null
  const quality = g.uretilenAdet > 0 ? g.iyiAdet / g.uretilenAdet : null
  const oee =
    availability != null && performance != null && quality != null
      ? availability * performance * quality
      : null

  let hesapKaynagi: string
  if (g.cakismaVar) hesapKaynagi = 'CAKISMA_VAR'
  else if (g.planliSaniye <= 0) hesapKaynagi = 'PLANLI_YOK'
  else if (performance == null) hesapKaynagi = 'PERF_YOK'
  else hesapKaynagi = g.idealKaynak === 'IFS' ? 'PERF_IFS' : 'TAM'

  return { availability, performance, quality, oee, hesapKaynagi }
}

// ─────────────────────────── SAF: kapandı filtresi ───────────────────────────

/**
 * OEE hesaplanabilir mi. tamamlandi=true + kapanmış (baslatildi/bitirildi dolu) + LEGACY GUARD:
 * uretimAdet VEYA hesapKaynagi dolu (30.07 öncesi default-true TERK kayıtlarını eler — onlarda ikisi
 * de null). NOT: sinyalsiz (elle giriş) tezgahta is-bitir uretimAdet/hesapKaynagi yazmaz → OEE
 * hesaplanmaz (sayaç yok, performans zaten türetilemez).
 */
export function oeeHesaplanabilir(log: {
  tamamlandi: boolean
  baslatildiAt: Date | null
  bitirildiAt: Date | null
  uretimAdet: number | null
  hesapKaynagi: string | null
}): boolean {
  return (
    log.tamamlandi === true &&
    log.baslatildiAt != null &&
    log.bitirildiAt != null &&
    (log.uretimAdet != null || log.hesapKaynagi != null)
  )
}

// ─────────────────────────── DB katmanı ───────────────────────────

/** İş penceresiyle örtüşen duruşların toplam saniyesi. Açık duruş → pencere sonuna kadar sayılır. */
async function durusSaniyeHesapla(
  prisma: PrismaClient,
  tezgahId: string,
  bas: Date,
  bit: Date,
): Promise<number> {
  const duruslar = await prisma.iproMachineDowntime.findMany({
    where: { tezgahId, baslangic: { lt: bit }, OR: [{ bitis: null }, { bitis: { gt: bas } }] },
    select: { baslangic: true, bitis: true },
  })
  let sn = 0
  for (const d of duruslar) {
    const dBit = d.bitis ?? bit
    const kesBas = Math.max(d.baslangic.getTime(), bas.getTime())
    const kesBit = Math.min(dBit.getTime(), bit.getTime())
    if (kesBit > kesBas) sn += (kesBit - kesBas) / 1000
  }
  return Math.round(sn)
}

/** Aynı tezgahta zaman-örtüşen BAŞKA kapalı iş var mı (CAKISMA_VAR işareti için). */
async function cakismaVarMi(
  prisma: PrismaClient,
  tezgahId: string,
  logId: string,
  bas: Date,
  bit: Date,
): Promise<boolean> {
  const diger = await prisma.iproProductionLog.findFirst({
    where: {
      tezgahId,
      durum: 'KAPALI',
      id: { not: logId },
      baslatildiAt: { lt: bit }, // strict → sınır teması (araliklarKesisiyor deseni) örtüşme sayılmaz
      bitirildiAt: { gt: bas },
    },
    select: { id: true },
  })
  return diger != null
}

/** İşin başladığı YEREL saat hangi aktif vardiyaya düşüyor (vardiyaId etiketi; bulunamazsa null). */
async function vardiyaBul(prisma: PrismaClient, basUtc: Date): Promise<string | null> {
  const vardiyalar = await prisma.iproVardiya.findMany({
    where: { aktif: true },
    select: { id: true, baslangicSaat: true, bitisSaat: true, ertesiGuneTasar: true },
    orderBy: { sira: 'asc' },
  })
  const yerel = new Date(basUtc.getTime() + TR_OFFSET_DK * 60000)
  const dk = yerel.getUTCHours() * 60 + yerel.getUTCMinutes()
  for (const v of vardiyalar) {
    const b = saatDk(v.baslangicSaat)
    const e = saatDk(v.bitisSaat)
    const icinde = v.ertesiGuneTasar ? dk >= b || dk < e : dk >= b && dk < e
    if (icinde) return v.id
  }
  return null
}

/** Tatil sorgusu alt sınırı — başlangıcın YEREL gününden bir gün öncesi (gece vardiyası taşması). */
function tatilAltSinir(basUtc: Date): Date {
  const y = new Date(basUtc.getTime() + TR_OFFSET_DK * 60000)
  return new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate()) - 86400000)
}

/**
 * Bir kapalı iş için OEE hesaplayıp IproOeeKaydi'ne upsert eder. is-bitir'den çağrılır; HATA FIRLATMAZ
 * mantığı çağıranın try/catch'inde — ama içeride de ideal-guncelle try/catch'li (OEE'yi durdurmasın).
 * Sıra: önce ideali güncelle (bu işin gözlemi dahil), sonra OEE hesapla-yaz.
 */
export async function oeeKaydiHesaplaVeYaz(
  prisma: PrismaClient,
  productionLogId: string,
  // secenek.masAdedi: MAS aynası SİNYALSİZ tezgahta üretilen adedi MAS'tan geçirir → uretilenAdet
  // olarak kullanılır ve hesapKaynagi'na '/MAS' damgası eklenir. Verilmezse mevcut davranış (IPRO PLC).
  secenek?: { masAdedi?: number | null },
): Promise<void> {
  const log = await prisma.iproProductionLog.findUnique({
    where: { id: productionLogId },
    select: {
      id: true,
      tezgahId: true,
      ifsPartNo: true,
      baslatildiAt: true,
      bitirildiAt: true,
      tamamlandi: true,
      uretimAdet: true,
      hesapKaynagi: true,
      qtyComplete: true,
      qtyScrap: true,
      // IFS planlı çevrim snapshot'ı (başla anında yazılır) — ölçülen ideal yoksa fallback kaynağı.
      ifsMachRunFactor: true,
      ifsRunTimeCode: true,
      tezgah: { select: { kod: true } },
    },
  })
  if (!log || !oeeHesaplanabilir(log)) return
  const tezgahKod = log.tezgah.kod
  const parcaKod = log.ifsPartNo
  const bas = log.baslatildiAt!
  const bit = log.bitirildiAt!

  // 1) İdeali önce güncelle (bu işin gözlemi de dahil), sonra oku.
  if (parcaKod) {
    try {
      await idealCevrimGuncelle(prisma, tezgahKod, parcaKod)
    } catch {
      /* ideal hesabı hatası OEE'yi durdurmasın — performance null kalır */
    }
  }
  const ideal = parcaKod
    ? await prisma.iproIdealCevrim.findUnique({
        where: { tezgahKod_parcaKod: { tezgahKod, parcaKod } },
        select: { idealSaniyeAdet: true, guvenilir: true },
      })
    : null
  // idealSaniyeAdet seçimi (FORMÜL değişmez, yalnız KAYNAK genişler):
  //  1) ölçülen güvenilir ideal varsa onu kullan → 'OLCULEN' (damga TAM),
  //  2) yoksa IFS planlı çevrime (log snapshot'ından, sorgu YOK) düş → 'IFS' (damga PERF_IFS),
  //  3) ikisi de yoksa null → performance null (damga PERF_YOK, mevcut davranış).
  // idealCevrimGuncelle biriktikçe (1) devreye girer; olgunlaşınca IFS→ölçülen otomatik geçer.
  const ifsPlanSn = cevrimSaniye(log.ifsMachRunFactor, log.ifsRunTimeCode)
  let idealSaniyeAdet: number | null
  let idealKaynak: 'OLCULEN' | 'IFS' | null
  if (ideal?.guvenilir) {
    idealSaniyeAdet = ideal.idealSaniyeAdet
    idealKaynak = 'OLCULEN'
  } else if (ifsPlanSn != null) {
    idealSaniyeAdet = ifsPlanSn
    idealKaynak = 'IFS'
  } else {
    idealSaniyeAdet = null
    idealKaynak = null
  }

  // 2) planliSaniye — vardiya+tatil kesişimi
  const [vardiyalar, tatiller] = await Promise.all([
    prisma.iproVardiya.findMany({
      where: { aktif: true },
      select: { baslangicSaat: true, bitisSaat: true, ertesiGuneTasar: true },
    }),
    prisma.iproTatil.findMany({
      where: { tarih: { gte: tatilAltSinir(bas), lte: bit } },
      select: { tarih: true, tip: true },
    }),
  ])
  const tatilMap = new Map<string, IproTatilTip>()
  for (const t of tatiller) if (gecerliTatilTip(t.tip)) tatilMap.set(tarihAnahtari(t.tarih), t.tip)
  const planliSaniye = planliSaniyeHesapla(bas, bit, vardiyalar, tatilMap)

  // 3) durusSaniye · 4) miktarlar · 5) çakışma
  const durusSaniye = await durusSaniyeHesapla(prisma, log.tezgahId, bas, bit)
  const uretilenAdet = secenek?.masAdedi != null ? secenek.masAdedi : (log.uretimAdet ?? log.qtyComplete + log.qtyScrap)
  const iyiAdet = log.qtyComplete
  const cakismaVar = await cakismaVarMi(prisma, log.tezgahId, log.id, bas, bit)

  // 6) bileşenler · 7) vardiya etiketi
  const b = oeeBilesenleri({ planliSaniye, durusSaniye, uretilenAdet, iyiAdet, idealSaniyeAdet, idealKaynak, cakismaVar })
  // Sinyalsiz MAS aynasında kaynak damgasına '/MAS' eklenir (adet MAS'tan geldi — audit).
  const hesapKaynagi = secenek?.masAdedi != null ? `${b.hesapKaynagi}/MAS` : b.hesapKaynagi
  const vardiyaId = await vardiyaBul(prisma, bas)

  await prisma.iproOeeKaydi.upsert({
    where: { productionLogId: log.id },
    create: {
      productionLogId: log.id,
      tezgahKod,
      parcaKod,
      vardiyaId,
      planliSaniye,
      durusSaniye,
      uretilenAdet,
      iyiAdet,
      idealSaniyeAdet,
      availability: b.availability,
      performance: b.performance,
      quality: b.quality,
      oee: b.oee,
      hesapKaynagi,
    },
    update: {
      tezgahKod,
      parcaKod,
      vardiyaId,
      planliSaniye,
      durusSaniye,
      uretilenAdet,
      iyiAdet,
      idealSaniyeAdet,
      availability: b.availability,
      performance: b.performance,
      quality: b.quality,
      oee: b.oee,
      hesapKaynagi,
      hesaplananAt: new Date(),
    },
  })
}

// araliklarKesisiyor ideal-cevrim'den re-export (test/çağıran kolaylığı — tek kaynak orada).
export { araliklarKesisiyor }
