import * as XLSX from 'xlsx'
import {
  kapasiteDurumEtiketi,
  type KapasiteDilimSatiri,
  type KapasiteGuzergahSatiri,
  type ServisKapasiteOzeti,
  type ServisKapasiteToplu,
} from './kapasite'

// Kapasite Raporu (Excel) — Servis Paneli ile AYNI kaynak (kapasite motoru, ServisKapasiteToplu).
// Burada HESAP YOK: sayılar motordan geldiği gibi yazılır; yalnız sunum (araç yok → boş hücre).
//
// KVKK (minimum veri): personel ADI/SİCİLİ yok — yalnız güzergâh, plaka ve SAYILAR.
// Koltuk/Boş/Doluluk: araç yoksa BOŞ hücre (0 ya da %100 yazılmaz — paydasız oran sunulmaz).

type Hucre = string | number
type Sayfa = Hucre[][]

export const KAPASITE_OZET_BASLIKLARI = ['GÖSTERGE', 'DEĞER'] as const

export const KAPASITE_GUZERGAH_BASLIKLARI = [
  'GÜZERGÂH KODU',
  'GÜZERGÂH',
  'ARAÇ (PLAKA)',
  'KOLTUK',
  'PERSONEL',
  'BOŞ KOLTUK',
  'DOLULUK (%)',
  'DURUM',
  'EN DOLU DİLİM',
] as const

export const KAPASITE_DILIM_BASLIKLARI = [
  'GÜZERGÂH KODU',
  'GÜZERGÂH',
  'SEFER DİLİMİ',
  'ARAÇ (PLAKA)',
  'KOLTUK',
  'PERSONEL',
  'BOŞ KOLTUK',
  'DOLULUK (%)',
  'DURUM',
] as const

export const KAPASITE_ASIM_BASLIKLARI = ['GÜZERGÂH KODU', 'GÜZERGÂH', 'SEFER DİLİMİ', 'KOLTUK', 'PERSONEL', 'FAZLA KİŞİ'] as const

const yuzde = (oran: number | null): Hucre => (oran === null ? '' : Math.round(oran * 10) / 10)
const koltuk = (o: ServisKapasiteOzeti): Hucre => (o.durum === 'ARAC_YOK' ? '' : o.kapasite)
const bos = (o: ServisKapasiteOzeti): Hucre => (o.durum === 'ARAC_YOK' ? '' : o.bosKoltuk)
const plakalar = (a: string[]) => a.join(', ')

export function kapasiteGuzergahSatirlari(g: KapasiteGuzergahSatiri[]): Sayfa {
  return [
    [...KAPASITE_GUZERGAH_BASLIKLARI],
    ...g.map((s) => [
      s.kod, s.ad, plakalar(s.araclar), koltuk(s.ozet), s.ozet.atananPersonelSayisi, bos(s.ozet),
      yuzde(s.ozet.dolulukOrani), kapasiteDurumEtiketi(s.ozet), s.dilimKod ?? '',
    ]),
  ]
}

export function kapasiteDilimSatirlari(d: KapasiteDilimSatiri[]): Sayfa {
  return [
    [...KAPASITE_DILIM_BASLIKLARI],
    ...d.map((s) => [
      s.guzergahKod, s.guzergahAd, `${s.dilimKod} — ${s.dilimAd}`, plakalar(s.araclar), koltuk(s.ozet),
      s.ozet.atananPersonelSayisi, bos(s.ozet), yuzde(s.ozet.dolulukOrani), kapasiteDurumEtiketi(s.ozet),
    ]),
  ]
}

export function kapasiteAsimSatirlari(toplu: ServisKapasiteToplu): Sayfa {
  return [
    [...KAPASITE_ASIM_BASLIKLARI],
    ...toplu.asimlar.map((a) => [a.kod, a.ad, a.dilimKod, a.koltuk, a.personel, a.fazla]),
  ]
}

export function kapasiteOzetSatirlari(toplu: ServisKapasiteToplu): Sayfa {
  const t = toplu.toplam
  return [
    [...KAPASITE_OZET_BASLIKLARI],
    ['Rapor tarihi', toplu.tarih],
    ['Güzergâh sayısı', t.guzergahSayisi],
    ['Atanmış personel', t.atanmisPersonel],
    ['Toplam koltuk (yalnız aracı olan güzergâhlar)', t.toplamKoltuk],
    ['Boş koltuk (aşımlar düşülmüş net)', t.netBosKoltuk],
    ['Kapasite aşımı (güzergâh/dilim)', t.asimSayisi],
    ['Aşan toplam kişi', t.asimKisi],
    ['Aracı olmayan güzergâh', t.aracsizGuzergahSayisi],
    ['Dolmak üzere (≥%90)', t.dolmakUzereSayisi],
  ]
}

/** Satır sayısı = güzergâh satırı (denetim kaydı için). */
export function kapasiteExcelOlustur(toplu: ServisKapasiteToplu): Buffer {
  const wb = XLSX.utils.book_new()
  const ekle = (ad: string, satirlar: Sayfa, genislik: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(satirlar)
    ws['!cols'] = genislik.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, ad)
  }
  ekle('Özet', kapasiteOzetSatirlari(toplu), [46, 16])
  ekle('Güzergâh Kapasitesi', kapasiteGuzergahSatirlari(toplu.guzergahlar), [14, 34, 24, 10, 10, 12, 13, 16, 16])
  ekle('Dilim Detayı', kapasiteDilimSatirlari(toplu.dilimSatirlari), [14, 34, 28, 24, 10, 10, 12, 13, 16])
  ekle('Aşımlar', kapasiteAsimSatirlari(toplu), [14, 34, 16, 10, 10, 12])
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer
}

/** Dosya adı SALT ASCII (Content-Disposition latin-1). */
export const kapasiteExcelDosyaAdi = (tarih: string) => `Kapasite-Raporu-${tarih}.xlsx`
