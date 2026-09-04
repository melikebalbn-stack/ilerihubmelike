/**
 * Deneme (2 ay) ve ilk 6 ay değerlendirme tarihleri — TEK KAYNAK.
 *
 * KURAL: deneme = işe giriş + 2 ay · altı ay = işe giriş + 6 ay.
 * AY SONU KIRPMA: hedef ayda o gün yoksa AYIN SON GÜNÜNE kırpılır
 * (31.08 + 6 ay = 28.02). Davranış, iki personel formundaki `addMonths`
 * kopyalarından AYNEN alındı — `setDate(0)` deseni korunuyor.
 *
 * NEDEN BURADA: hesap yalnız istemci formlarında vardı ve yalnız kullanıcı
 * `iseGirisTarihi` alanını DEĞİŞTİRDİĞİNDE çalışıyordu. İşe alım dönüşümü
 * (`personele-donustur.ts`) bu alanları hiç yazmadığı için o yoldan gelen
 * personelde tarihler boş kalıyordu (ILR-01156, 01.09.2026).
 *
 * TARİH ARİTMETİĞİ UTC ÜZERİNDEN: girdi gün-hassasiyetli (`yyyy-mm-dd` veya
 * gece-yarısı Date). Yerel saat kullanılsaydı sunucu (UTC) ile tarayıcı (TR,
 * UTC+3) aynı girdi için farklı gün üretebilirdi. UTC ile ikisi de aynı sonucu
 * verir ve mevcut çıktılarla birebir uyumludur.
 */

const DENEME_AY = 2
const ALTI_AY = 6

/** `yyyy-mm-dd` string ya da Date → UTC gece yarısı Date. Geçersizse null. */
function tarihOku(girdi: string | Date | null | undefined): Date | null {
  if (!girdi) return null
  const d = girdi instanceof Date ? new Date(girdi.getTime()) : new Date(girdi)
  if (isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Verilen tarihe `ay` ekler; hedef ayda o gün yoksa ayın son gününe kırpar.
 * (Formlardaki `addMonths` ile aynı: taşarsa `setDate(0)`.)
 */
export function ayEkle(girdi: string | Date | null | undefined, ay: number): Date | null {
  const d = tarihOku(girdi)
  if (!d) return null
  const gun = d.getUTCDate()
  d.setUTCMonth(d.getUTCMonth() + ay)
  if (d.getUTCDate() !== gun) d.setUTCDate(0) // taşma → önceki ayın son günü
  return d
}

/** `yyyy-mm-dd` biçiminde döner (istemci formlarının beklediği biçim). */
export function ayEkleIso(girdi: string | Date | null | undefined, ay: number): string {
  const d = ayEkle(girdi, ay)
  return d ? d.toISOString().split('T')[0] : ''
}

export interface DegerlendirmeTarihleri {
  denemeDegerlendirme: Date | null
  altiAyDegerlendirme: Date | null
}

/** İşe giriş tarihinden iki değerlendirme tarihini üretir. */
export function degerlendirmeTarihleri(
  iseGirisTarihi: string | Date | null | undefined,
): DegerlendirmeTarihleri {
  return {
    denemeDegerlendirme: ayEkle(iseGirisTarihi, DENEME_AY),
    altiAyDegerlendirme: ayEkle(iseGirisTarihi, ALTI_AY),
  }
}

/**
 * Yazma yollarının ortak kuralı: gövdede AÇIKÇA dolu bir değer varsa o kazanır
 * (İK elle girmiş olabilir), yoksa işe giriş tarihinden hesaplanır.
 *
 * BOŞ/NULL "gönderilmedi" sayılır: personel formu tüm alanları her kayıtta
 * gönderiyor; boş geleni "kullanıcı bilerek boşalttı" saymak, bugünkü boşlukların
 * hiç dolmaması demek olurdu.
 */
export function degerlendirmeTarihleriniTamamla(
  iseGirisTarihi: string | Date | null | undefined,
  mevcut: { denemeDegerlendirme?: unknown; altiAyDegerlendirme?: unknown },
): DegerlendirmeTarihleri | null {
  if (!iseGirisTarihi) return null
  const hesap = degerlendirmeTarihleri(iseGirisTarihi)
  const dolu = (v: unknown) => v !== null && v !== undefined && v !== ''
  return {
    denemeDegerlendirme: dolu(mevcut.denemeDegerlendirme)
      ? (mevcut.denemeDegerlendirme as Date)
      : hesap.denemeDegerlendirme,
    altiAyDegerlendirme: dolu(mevcut.altiAyDegerlendirme)
      ? (mevcut.altiAyDegerlendirme as Date)
      : hesap.altiAyDegerlendirme,
  }
}
