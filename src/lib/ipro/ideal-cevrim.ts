// OEE — ideal (en hızlı sürdürülebilir) çevrim süresi hesabı. tezgah+parça çifti başına.
//
// NEDEN LIB (route DEĞİL): route dosyaları yalnız HTTP metodu export edebilir (23.07 dersi).
// oee-hesap buradan çağırır. Saf hesap (idealHesapla/araliklarKesisiyor) DB'siz test edilir;
// DB katmanı (gozlemleriTopla/idealCevrimGuncelle) ayrı.
import type { PrismaClient } from '@/generated/prisma'
import { isPenceresiDeltaToplami } from '@/lib/ipro/faz2-delta'

/** Bir kapalı işin tek gözlemi: pencere süresi (sn) ve o penceredeki Σ delta (üretilen adet). */
export interface Gozlem {
  pencereSn: number
  toplamDelta: number
}

export interface IdealSonuc {
  /** sn/adet — hiç geçerli gözlem yoksa null. */
  ideal: number | null
  /** hesaba giren geçerli (delta>0, pencere>0) gözlem adedi. */
  ornekSayisi: number
  /** ornekSayisi eşiği geçti mi — false iken performans hesabına GİRMEZ. */
  guvenilir: boolean
}

/**
 * Güvenilirlik eşiği. SABİT BAŞLANGIÇ — prod verisiyle kalibre edilecek.
 * Eşik altı örneklemde ideal "güvenilmez" sayılır → o işte performance boş kalır (OEE kısmi).
 */
export const IDEAL_ORNEKLEM_ESIGI = 50

/** Artan sıralı dizinin medyanı (tek → orta, çift → iki orta ortalaması). Boş → 0 döner (çağıran korur). */
function medyan(sirali: number[]): number {
  const n = sirali.length
  if (n === 0) return 0
  const orta = Math.floor(n / 2)
  return n % 2 === 1 ? sirali[orta] : (sirali[orta - 1] + sirali[orta]) / 2
}

/**
 * İki zaman aralığı kesişiyor mu (çakışma guard). Sınır teması (bitiş==başlangıç) kesişim SAYILMAZ.
 * SAF — test edilebilir.
 */
export function araliklarKesisiyor(aBas: Date, aBit: Date, bBas: Date, bBit: Date): boolean {
  return aBas.getTime() < bBit.getTime() && bBas.getTime() < aBit.getTime()
}

/**
 * İdeal çevrim = TEMİZ gözlemlerin EN HIZLI %5'inin MEDYANI (aykırı-değere dayanıklı — tek anormal
 * hızlı okuma ideali bozmasın). %5 dilimi en az 1 gözleme yuvarlanır. guvenilir = ornekSayisi >= eşik.
 * SAF — DB'siz test edilir. Çakışma guard'ı çağıran (gozlemleriTopla) uygular; buraya temiz gelir.
 */
export function idealHesapla(gozlemler: Gozlem[], esik: number = IDEAL_ORNEKLEM_ESIGI): IdealSonuc {
  const cevrimler = gozlemler
    .filter((g) => g.toplamDelta > 0 && g.pencereSn > 0)
    .map((g) => g.pencereSn / g.toplamDelta) // sn/adet
    .sort((a, b) => a - b) // artan: en hızlı (küçük) başta
  const n = cevrimler.length
  if (n === 0) return { ideal: null, ornekSayisi: 0, guvenilir: false }
  const dilimBoyu = Math.max(1, Math.ceil(n * 0.05))
  const ideal = medyan(cevrimler.slice(0, dilimBoyu))
  return { ideal, ornekSayisi: n, guvenilir: n >= esik }
}

/**
 * Bir tezgah+parça çiftinin TÜM kapalı iş gözlemlerini toplar. ÇAKIŞMA GUARD: aynı tezgahta
 * zaman-örtüşen BAŞKA kapalı iş varsa o gözlemi DIŞLAR (delta atıfı belirsiz, çift-sayım riski).
 * Örtüşme tüm parçalar arası bakılır (makine fiziksel olarak tek iş yapar; örtüşme veri anomalisi).
 */
export async function gozlemleriTopla(
  prisma: PrismaClient,
  tezgahKod: string,
  parcaKod: string,
): Promise<Gozlem[]> {
  const tezgah = await prisma.iproTezgah.findUnique({ where: { kod: tezgahKod }, select: { id: true } })
  if (!tezgah) return []

  // Bu tezgahtaki TÜM kapalı işler (örtüşme kontrolü için hepsi lazım, yalnız aday parça değil).
  const tumKapali = await prisma.iproProductionLog.findMany({
    where: {
      tezgahId: tezgah.id,
      durum: 'KAPALI',
      baslatildiAt: { not: null },
      bitirildiAt: { not: null },
    },
    select: { id: true, ifsPartNo: true, baslatildiAt: true, bitirildiAt: true },
  })

  const gozlemler: Gozlem[] = []
  for (const l of tumKapali) {
    if (l.ifsPartNo !== parcaKod) continue
    const bas = l.baslatildiAt!
    const bit = l.bitirildiAt!
    // Çakışma guard: başka bir kapalı iş bu işin penceresiyle kesişiyor mu.
    const cakisiyor = tumKapali.some(
      (o) => o.id !== l.id && araliklarKesisiyor(bas, bit, o.baslatildiAt!, o.bitirildiAt!),
    )
    if (cakisiyor) continue
    const { toplam } = await isPenceresiDeltaToplami(prisma, tezgahKod, bas, bit)
    gozlemler.push({ pencereSn: (bit.getTime() - bas.getTime()) / 1000, toplamDelta: toplam })
  }
  return gozlemler
}

/**
 * Bir tezgah+parça için ideali yeniden hesaplar ve IproIdealCevrim'e upsert eder.
 * Geçerli gözlem yoksa (ideal null) upsert ETMEZ (idealSaniyeAdet NOT NULL). Sonucu döner.
 */
export async function idealCevrimGuncelle(
  prisma: PrismaClient,
  tezgahKod: string,
  parcaKod: string,
): Promise<IdealSonuc> {
  const gozlemler = await gozlemleriTopla(prisma, tezgahKod, parcaKod)
  const sonuc = idealHesapla(gozlemler)
  if (sonuc.ideal == null) return sonuc

  await prisma.iproIdealCevrim.upsert({
    where: { tezgahKod_parcaKod: { tezgahKod, parcaKod } },
    create: {
      tezgahKod,
      parcaKod,
      idealSaniyeAdet: sonuc.ideal,
      ornekSayisi: sonuc.ornekSayisi,
      guvenilir: sonuc.guvenilir,
    },
    update: {
      idealSaniyeAdet: sonuc.ideal,
      ornekSayisi: sonuc.ornekSayisi,
      guvenilir: sonuc.guvenilir,
      hesaplananAt: new Date(),
    },
  })
  return sonuc
}
