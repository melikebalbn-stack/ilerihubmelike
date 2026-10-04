import { bugunTR } from './tarih-kurallari'

// ============================================================================
// "GEÇERLİ ATAMA" — TEK KAYNAK (C7-1)
// ============================================================================
//
// Bir personel atamasının belirli bir günde GEÇERLİ olması = aktif:true VE başlangıç ≤ gün VE
// (bitiş boş ya da bitiş ≥ gün). Hem Prisma `where` (gecerliAtamaFiltresi) hem JS karşılığı
// (gecerliAtamaMi / atamaGunuKapsar) AYNI kuraldır; okuyucular bunu paylaşır.
//
// NEDEN: ileri tarihli transferde (atama-gecis.ts) eski atama geçiş gününe kadar aktif kalır, geçiş
// gününden sonra da `aktif=true` işaretiyle DURUR (otomatik pasife alma işi yok). `aktif` bayrağı tek
// başına "şu an geçerli mi" sorusuna cevap vermez: okuyucular aktif + tarih aralığını BİRLİKTE kullanır.
//
// GÜN: her yerde Türkiye günü (bugunTR). UTC günü 00:00–03:00 (TR) arasında "dün"dür.
//
// PRISMA'SIZ saf modül: istemci de durum rozeti için kullanabilir.
// ============================================================================

export type AtamaTarihli = { aktif: boolean; baslangicTarihi: Date; bitisTarihi: Date | null }

/** Hesaplanan durum: Aktif (şimdi geçerli) / Başlamadı / Süresi doldu / Pasif (aktif=false). */
export type AtamaDurumu = 'AKTIF' | 'BASLAMADI' | 'SURESI_DOLDU' | 'PASIF'

export const ATAMA_DURUM_ETIKETLERI: Record<AtamaDurumu, string> = {
  AKTIF: 'Aktif',
  BASLAMADI: 'Başlamadı',
  SURESI_DOLDU: 'Süresi doldu',
  PASIF: 'Pasif',
}

/** YYYY-MM-DD → UTC gün başı (DB @db.Date değerleriyle aynı biçim). */
export const gunTarihi = (gun: string): Date => new Date(`${gun}T00:00:00.000Z`)

/** Türkiye gününün UTC gün başı karşılığı — sorgularda "bugün". */
export function bugunTRTarihi(simdi: Date = new Date()): Date {
  return gunTarihi(bugunTR(simdi))
}

/** Tarih aralığı koşulu (başlangıç ≤ gün ve bitiş boş/≥ gün) — atama, araç ve şoför varsayılanları için ortak. */
export function tarihAraligiFiltresi(gun: Date) {
  return {
    baslangicTarihi: { lte: gun },
    OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: gun } }],
  }
}

/** Geçerli atama: aktif:true + tarih aralığı (Prisma where). */
export function gecerliAtamaFiltresi(gun: Date) {
  return { aktif: true as const, ...tarihAraligiFiltresi(gun) }
}

/** Tarih aralığı verilen günü kapsıyor mu (aktif bayrağına BAKMAZ). */
export function atamaGunuKapsar(a: Pick<AtamaTarihli, 'baslangicTarihi' | 'bitisTarihi'>, gun: string): boolean {
  const g = gunTarihi(gun).getTime()
  return a.baslangicTarihi.getTime() <= g && (a.bitisTarihi === null || a.bitisTarihi.getTime() >= g)
}

/** gecerliAtamaFiltresi'nin JS karşılığı. */
export function gecerliAtamaMi(a: AtamaTarihli, gun: string): boolean {
  return a.aktif && atamaGunuKapsar(a, gun)
}

export function atamaDurumu(a: AtamaTarihli, gun: string = bugunTR()): AtamaDurumu {
  if (!a.aktif) return 'PASIF'
  const g = gunTarihi(gun).getTime()
  if (a.baslangicTarihi.getTime() > g) return 'BASLAMADI'
  if (a.bitisTarihi !== null && a.bitisTarihi.getTime() < g) return 'SURESI_DOLDU'
  return 'AKTIF'
}
