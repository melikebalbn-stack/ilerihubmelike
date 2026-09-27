/**
 * Yıllık izin hak edişi — SAF. Plan §3.1. 4857 sayılı İş Kanunu:
 *   m.53/2: hizmet 1–5 yıl (5 dahil) 14 gün; 5'ten fazla 15'ten az 20 gün; 15 (dahil) ve üzeri 26 gün.
 *   m.53/3: 18 ve daha küçük, 50 ve daha büyük yaştakilere 20 günden az olamaz → max(süre, 20).
 *   m.54:   aynı işverende geçen süreler birleştirilir → kıdem EmploymentPeriod toplamı.
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

const gunFarki = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000)

export interface CalismaDonemi {
  giris: string
  cikis: string | null
}

/**
 * Kıdemin "etkin başlangıcı": son (açık) dönemin girişinden, ÖNCEKİ dönemlerde çalışılan gün toplamı kadar
 * geri. Yıldönümleri buradan takvim yılıyla sayılır. Dönem yoksa iseGirisTarihi.
 */
export function kidemBaslangici(donemler: CalismaDonemi[], iseGirisTarihi: string): string {
  if (!donemler.length) return iseGirisTarihi
  const sirali = [...donemler].sort((a, b) => a.giris.localeCompare(b.giris))
  const son = sirali[sirali.length - 1]
  const onceki = sirali.slice(0, -1).reduce((t, d) => t + (d.cikis ? gunFarki(d.giris, d.cikis) + 1 : 0), 0)
  return gunEkle(son.giris, -onceki)
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
  donemler: CalismaDonemi[]
  dogumTarihi: string | null
  ayrilisTarihi?: string | null
  acilisTarihi?: string | null
  bas: string
  bit: string
}): HakEdis[] {
  if (![k.iseGirisTarihi, k.bas, k.bit].every((x) => GUN.test(x))) throw new IzinGirdiHatasi('Tarihler YYYY-MM-DD olmalı')
  const etkin = kidemBaslangici(k.donemler, k.iseGirisTarihi)
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
