/**
 * İzin bakiyesi — SAF. Plan §3. Bakiye = DEFTERİN (izin_bakiye_hareketi) toplamı; defter yalnız EKLENİR.
 * "Kalan" bekleyen (BEKLIYOR_YONETICI / BEKLIYOR_IV) talepleri REZERVE eder.
 * Tüm aritmetik tam sayı "yarım" biriminde (0,5 adımları).
 */
import { IzinGirdiHatasi, type IzinGunu } from './gun-sayimi'

export type IzinHareketTuru = 'HAK_EDIS' | 'KULLANIM' | 'IPTAL_IADE' | 'ACILIS' | 'DUZELTME'

export interface DefterSatiri {
  hareket: IzinHareketTuru
  gun: number
  tarih: string
}

const yarimBirim = (x: number) => {
  const b = Math.round(x * 2)
  if (Math.abs(b - x * 2) > 1e-9) throw new IzinGirdiHatasi(`Gün 0,5'in katı olmalı: ${x}`)
  return b
}
const topla = (xs: number[]) => xs.reduce((t, x) => t + yarimBirim(x), 0) / 2

/** Defter toplamı; `tarihe` verilirse o güne (dahil) kadarki hareketler. */
export function bakiye(defter: DefterSatiri[], tarihe?: string): number {
  return topla(defter.filter((d) => !tarihe || d.tarih <= tarihe).map((d) => d.gun))
}

/** Talep ekranı: "kalan X → talep sonrası Y". Bekleyen talepler rezerve. */
export function onizleme(o: { bakiye: number; bekleyen: number[]; yeniTalep: number }) {
  const kalan = topla([o.bakiye, ...o.bekleyen.map((x) => -x)])
  const sonrasi = topla([kalan, -o.yeniTalep])
  return { bakiye: o.bakiye, rezerve: topla(o.bekleyen), kalan, sonrasi, yeterli: sonrasi >= 0 }
}

export interface YeniHareket {
  hareket: IzinHareketTuru
  gun: number
  tarih: string
  talepId: string | null
  anahtar: string | null
  aciklama: string | null
}

/** Onayda: bakiyeli türün gün sayısı düşülür. Talep başına bir kez (anahtar). */
export function kullanimHareketi(t: { id: string; gunSayisi: number }, tarih: string): YeniHareket {
  yarimBirim(t.gunSayisi)
  return { hareket: 'KULLANIM', gun: -t.gunSayisi, tarih, talepId: t.id, anahtar: `KULLANIM:${t.id}`, aciklama: null }
}

/** Onaylı iznin başlamadan iptali: kullanılan gün iade. Talep başına bir kez. */
export function iptalIadeHareketi(t: { id: string; gunSayisi: number }, tarih: string): YeniHareket {
  yarimBirim(t.gunSayisi)
  return { hareket: 'IPTAL_IADE', gun: t.gunSayisi, tarih, talepId: t.id, anahtar: `IADE:${t.id}`, aciklama: 'onaylı izin iptali' }
}

/** Başlamış iznin erken bitirilmesi: yeni bitişten SONRAKİ günlerin payı iade edilir (İV). */
export function kismiIadeGunu(gunler: Pick<IzinGunu, 'tarih' | 'pay'>[], yeniBitis: string): number {
  return topla(gunler.filter((g) => g.tarih > yeniBitis).map((g) => g.pay))
}

/** Açılış bakiyesi (İV Excel'i) — kişi başı BİR kez (anahtar). */
export function acilisHareketi(personnelId: string, gun: number, tarih: string): YeniHareket {
  if (gun < 0) throw new IzinGirdiHatasi('Açılış bakiyesi negatif olamaz')
  yarimBirim(gun)
  return { hareket: 'ACILIS', gun, tarih, talepId: null, anahtar: `ACILIS:${personnelId}`, aciklama: 'açılış bakiyesi (İV Excel)' }
}

/** İşten ayrılışta ücrete çevrilecek gün (m.59): ayrılış gününe kadarki defter toplamı. */
export function ayrilisBakiyesi(defter: DefterSatiri[], ayrilisTarihi: string): number {
  return Math.max(0, bakiye(defter, ayrilisTarihi))
}
