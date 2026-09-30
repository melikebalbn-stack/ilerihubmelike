/**
 * Kişi başı yıllık izin özeti — SAF (DB yok, birim testli). Bakiyeler (İV) ekranı ve Excel'i bunu kullanır.
 *
 *   bakiye     = defter toplamı (bugüne kadar)                     — bakiye.ts
 *   bekleyen   = BEKLIYOR_YONETICI / BEKLIYOR_IV yıllık taleplerin günü (rezerve)
 *   kalan      = bakiye − bekleyen                                  — talep ekranındaki "kalan" ile aynı
 *   kullanılan = bu takvim yılında KULLANIM − IPTAL_IADE (net, pozitif)
 *   yıllık hak = son yıldönümündeki hak ediş süresi (1 yıl dolmadıysa null)
 *   sonraki    = bugünden SONRAKİ ilk yıldönümü + süresi (ayrılmış kişide null)
 *
 * Yaş yalnız hak ediş süresini hesaplamak için kullanılır; ÇIKTIDA YAŞ YOK (yaş kuralı sessizce uygulanır).
 */
import { bakiye, type DefterSatiri } from './bakiye'
import { gunEkle } from './gun-sayimi'
import { yasHesapla, yildonumu, yillikIzinSuresi, type CalismaDonemi } from './hak-edis'

export interface KisiBakiyeGirdisi {
  defter: DefterSatiri[]
  bekleyenGunler: number[]
  iseGirisTarihi: string
  donemler: CalismaDonemi[]
  dogumTarihi: string | null
  aktif: boolean
  bugun: string
}

export interface KisiBakiyeOzeti {
  /** GÖSTERİM kıdeminin başlangıcı = topluluğa giriş (ilk dönem) */
  kidemBaslangici: string
  /** Hak edişin başlangıcı = SON işe giriş */
  hakEdisBaslangici: string
  kidemYil: number
  kidemAy: number
  yillikHak: number | null
  kullanilanBuYil: number
  bekleyen: number
  bakiye: number
  kalan: number
  sonraki: { tarih: string; gun: number; ilk: boolean } | null
}

const yarim = (x: number) => Math.round(x * 2)

/** bugün itibarıyla tamamlanan tam yıl ve (yıl dışı) tam ay */
export function kidemSuresi(baslangic: string, bugun: string): { yil: number; ay: number } {
  if (bugun < baslangic) return { yil: 0, ay: 0 }
  let yil = 0
  while (yildonumu(baslangic, yil + 1) <= bugun) yil++
  const [by, bm, bd] = yildonumu(baslangic, yil).split('-').map(Number)
  const [ty, tm, td] = bugun.split('-').map(Number)
  const ay = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0)
  return { yil, ay: Math.max(0, Math.min(11, ay)) }
}

export function kisiBakiyeOzeti(g: KisiBakiyeGirdisi): KisiBakiyeOzeti {
  // Hem hak ediş hem GÖSTERİM kıdemi SON işe girişten (İleri Group kararı: geçmiş dönemde çalışılsa
  // dahi yıllık izin son işe giriş tarihinden hesaplanır; ekrandaki kıdem de bununla tutarlı olmalı).
  // (donemler artık kıdem gösteriminde kullanılmıyor; geriye uyumluluk için girdi olarak kalıyor.)
  const bas = g.iseGirisTarihi
  const kidemG = kidemSuresi(bas, g.bugun)
  const yil = kidemG.yil
  const yas = (t: string) => (g.dogumTarihi ? yasHesapla(g.dogumTarihi, t) : null)

  const b = bakiye(g.defter, g.bugun)
  const bekleyen = g.bekleyenGunler.reduce((t, x) => t + yarim(x), 0) / 2
  const yilBasi = `${g.bugun.slice(0, 4)}-01-01`
  const kullanilanBuYil =
    -g.defter
      .filter((d) => (d.hareket === 'KULLANIM' || d.hareket === 'IPTAL_IADE') && d.tarih >= yilBasi && d.tarih <= g.bugun)
      .reduce((t, d) => t + yarim(d.gun), 0) / 2

  const yillikHak = yil >= 1 ? yillikIzinSuresi(yil, yas(yildonumu(bas, yil))) : null
  const sonrakiTarih = yildonumu(bas, yil + 1)
  const sonraki = g.aktif
    ? { tarih: sonrakiTarih, gun: yillikIzinSuresi(yil + 1, yas(sonrakiTarih)), ilk: yil === 0 }
    : null

  return {
    kidemBaslangici: bas,
    hakEdisBaslangici: bas,
    kidemYil: kidemG.yil,
    kidemAy: kidemG.ay,
    yillikHak,
    kullanilanBuYil: kullanilanBuYil === 0 ? 0 : kullanilanBuYil,
    bekleyen,
    bakiye: b,
    kalan: (yarim(b) - yarim(bekleyen)) / 2,
    sonraki,
  }
}

/** Önümüzdeki `gun` gün içinde (bugün hariç, sınır dahil) yıldönümü olanlar filtresi için */
export const yakindaMi = (o: KisiBakiyeOzeti, bugun: string, gun = 30) =>
  !!o.sonraki && o.sonraki.tarih <= gunEkle(bugun, gun)
