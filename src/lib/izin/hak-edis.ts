/**
 * Yıllık izin hak edişi — SAF. Plan §3.1. 4857 sayılı İş Kanunu:
 *   m.53/2: hizmet 1–5 yıl (5 dahil) 14 gün; 5'ten fazla 15'ten az 20 gün; 15 (dahil) ve üzeri 26 gün.
 *   m.53/3: 18 ve daha küçük, 50 ve daha büyük yaştakilere 20 günden az olamaz → max(süre, 20).
 *   KIDEM (İV 28.09, iç karar): hak ediş SON İŞE GİRİŞ tarihinden (Personnel.iseGirisTarihi) — önceki
 *   dönemler BİRLEŞTİRİLMEZ. Ekranlardaki kıdem gösterimi topluluğa girişten (toplulukGirisi).
 * Hak ediş kıdem YILDÖNÜMÜNDE. 1 yıl dolmadan hak yok.
 * Doğum tarihi yalnız sunucuda (PersonnelSensitive) okunur; bu modül yalnız hesaplar — log/yanıt YOK.
 */
import { GUN, IzinGirdiHatasi, gunEkle } from './gun-sayimi'

export function yillikIzinSuresi(kidemYil: number, yas: number | null): number {
  if (!Number.isInteger(kidemYil) || kidemYil < 1) return 0
  const sure = kidemYil <= 5 ? 14 : kidemYil < 15 ? 20 : 26
  return yas !== null && (yas <= 18 || yas >= 50) ? Math.max(sure, 20) : sure
}

/** Tam yaş (tarih itibarıyla) */
export function yasHesapla(dogum: string, tarih: string): number {
  const [dy, dm, dd] = dogum.split('-').map(Number)
  const [ty, tm, td] = tarih.split('-').map(Number)
  return ty - dy - (tm < dm || (tm === dm && td < dd) ? 1 : 0)
}

export interface CalismaDonemi {
  giris: string
  cikis: string | null
}

/**
 * TOPLULUĞA GİRİŞ (yalnız GÖSTERİM kıdemi — İV 28.09): ilk çalışma döneminin başlangıcı; dönem yoksa
 * iseGirisTarihi. Hak edişte KULLANILMAZ.
 */
export function toplulukGirisi(donemler: CalismaDonemi[], iseGirisTarihi: string): string {
  return donemler.reduce((m, d) => (d.giris < m ? d.giris : m), iseGirisTarihi)
}

/** n. yıldönümü. 29 Şubat başlangıçlı kıdemde artık olmayan yılda 28 Şubat. */
export function yildonumu(baslangic: string, n: number): string {
  const [y, m, d] = baslangic.split('-').map(Number)
  const yil = y + n
  const sonGun = new Date(Date.UTC(yil, m, 0)).getUTCDate()
  return `${yil}-${String(m).padStart(2, '0')}-${String(Math.min(d, sonGun)).padStart(2, '0')}`
}

export interface HakEdis {
  tarih: string
  kidemYil: number
  gun: number
  anahtar: string // idempotency: HAK:<personel>:<yıl>
}

/**
 * [bas, bit] aralığına düşen yıldönümü hak edişleri. Açılış bakiyesi girildiyse açılış tarihine KADARKİ
 * yıldönümleri İV Excel'inde sayılmış kabul edilir (acilisTarihi dahil değil → sonraki yıldönümünden).
 * Ayrılış tarihinden SONRAKİ yıldönümü yazılmaz.
 */
export function hakEdisleri(k: {
  personnelId: string
  iseGirisTarihi: string
  /** Kullanılmaz (hak ediş son girişten) — geriye uyumluluk için kabul edilir. */
  donemler?: CalismaDonemi[]
  dogumTarihi: string | null
  ayrilisTarihi?: string | null
  acilisTarihi?: string | null
  bas: string
  bit: string
}): HakEdis[] {
  if (![k.iseGirisTarihi, k.bas, k.bit].every((x) => GUN.test(x))) throw new IzinGirdiHatasi('Tarihler YYYY-MM-DD olmalı')
  const etkin = k.iseGirisTarihi // SON işe giriş (İV 28.09)
  const sonuc: HakEdis[] = []
  for (let n = 1; n <= 80; n++) {
    const t = yildonumu(etkin, n)
    if (t > k.bit) break
    if (t < k.bas) continue
    if (k.acilisTarihi && t <= k.acilisTarihi) continue
    if (k.ayrilisTarihi && t > k.ayrilisTarihi) break
    const yas = k.dogumTarihi ? yasHesapla(k.dogumTarihi, t) : null
    sonuc.push({ tarih: t, kidemYil: n, gun: yillikIzinSuresi(n, yas), anahtar: `HAK:${k.personnelId}:${t.slice(0, 4)}` })
  }
  return sonuc
}
