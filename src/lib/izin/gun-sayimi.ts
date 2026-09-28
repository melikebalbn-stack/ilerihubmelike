/**
 * İzin gün sayımı — SAF (DB yok, birim testli). Plan §3.1.
 * Takvim tipi PDKS'TEKİ AYNI fonksiyondan (pdksTakvimTipi) — kopya değil: izin ile puantaj aynı takvimi
 * görür (IproTatil TATIL / YARIM; Cumartesi + Pazar hafta sonu; IproTatil MESAI tipi yok sayılır).
 *
 * IS_GUNU:  hafta sonu / TATIL 0 · YARIM tatil 0,5 · diğer 1.
 *           Yarım gün izin 0,5; YARIM tatil gününe SABAH izni 0,5, ÖĞLEDEN SONRA izni 0 (13:00 zaten çıkış).
 * TAKVIM_GUNU: her gün 1 (yarım 0,5) — tatil/hafta sonu düşülmez (ANALIK).
 * Hesap içeride tam sayı "yarım" biriminde yapılır (0,5 adımları kayan nokta hatasına düşmesin).
 */
import { pdksTakvimTipi, type TakvimTipi } from '../pdks/puantaj-motor'

export type IzinYarim = 'SABAH' | 'OGLEDEN_SONRA'
export type IzinGunSayimi = 'IS_GUNU' | 'TAKVIM_GUNU'

export class IzinGirdiHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'IzinGirdiHatasi'
  }
}

/** Ekrana/uca erişim yetkisi yok (API 403). */
export class IzinYetkiHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'IzinYetkiHatasi'
  }
}

export interface IzinGunu {
  tarih: string // YYYY-MM-DD
  pay: number // 0 | 0.5 | 1
  yarim: IzinYarim | null
  takvim: TakvimTipi
}

export const GUN = /^\d{4}-\d{2}-\d{2}$/
export const MAKS_TALEP_GUNU = 366

export function gunEkle(gun: string, n: number): string {
  const d = new Date(`${gun}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Yarım birim (0, 1, 2) → pay */
const pay = (yarimBirim: number) => yarimBirim / 2

export function izinGunleri(g: {
  baslangic: string
  bitis: string
  baslangicYarim?: IzinYarim | null
  bitisYarim?: IzinYarim | null
  gunSayimi: IzinGunSayimi
  /** 'YYYY-MM-DD' → IproTatil tipi ('TATIL' | 'YARIM' | 'MESAI') */
  tatiller: ReadonlyMap<string, string>
}): { gunler: IzinGunu[]; toplam: number } {
  const { baslangic, bitis } = g
  if (!GUN.test(baslangic) || !GUN.test(bitis)) throw new IzinGirdiHatasi('Tarihler YYYY-MM-DD olmalı')
  if (bitis < baslangic) throw new IzinGirdiHatasi('Bitiş başlangıçtan önce olamaz')
  const bY = g.baslangicYarim ?? null
  const sY = g.bitisYarim ?? null
  if (bY && bY !== 'OGLEDEN_SONRA') throw new IzinGirdiHatasi('İlk gün yalnız öğleden sonra yarım olabilir')
  if (sY && sY !== 'SABAH') throw new IzinGirdiHatasi('Son gün yalnız sabah yarım olabilir')
  if (baslangic === bitis && bY && sY) throw new IzinGirdiHatasi('Tek günlük talepte yalnız bir yarım seçilebilir (sabah ya da öğleden sonra)')

  const gunler: IzinGunu[] = []
  let toplamYarim = 0
  for (let t = baslangic, i = 0; t <= bitis; t = gunEkle(t, 1), i++) {
    if (i >= MAKS_TALEP_GUNU) throw new IzinGirdiHatasi(`Talep en fazla ${MAKS_TALEP_GUNU} gün olabilir`)
    const takvim = pdksTakvimTipi(t, g.tatiller.get(t) ?? null)
    const yarim: IzinYarim | null = t === baslangic && bY ? bY : t === bitis && sY ? sY : null
    let birim: number
    if (g.gunSayimi === 'TAKVIM_GUNU') birim = yarim ? 1 : 2
    else if (takvim === 'HAFTA_SONU' || takvim === 'TATIL') birim = 0
    else if (takvim === 'YARIM') birim = yarim === 'OGLEDEN_SONRA' ? 0 : 1 // yarım tatil günü zaten 13:00'te biter
    else birim = yarim ? 1 : 2
    toplamYarim += birim
    gunler.push({ tarih: t, pay: pay(birim), yarim, takvim })
  }
  return { gunler, toplam: pay(toplamYarim) }
}
