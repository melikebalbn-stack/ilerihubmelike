import { buAyNeDegistiGetir, type BuAyNeDegistiSonucu } from './bu-ay-ne-degisti'
import { veriKaliteRaporuGetir, type VeriKaliteRaporSatiri } from './veri-kalite'
import { servisKapasiteTopluGetir } from './kapasite'

// Servis Paneli (B2) — sağ kolon özetleri. KAPASİTE sayıları BURADA YOK: kapasite
// motorundan (kapasite.ts) doğrudan gelir (kapasite-toplu ucu). Bu dosya yalnız
// "Bu Ay Ne Değişti?" ve "Veri Kalitesi" kartlarının SAYILARINI üretir.
//
// KVKK: "Bu Ay Ne Değişti?" sonucu personel adı/sicil taşır; panele YALNIZ SAYILAR geçer
// (kişi bilgisi dışarı çıkmaz). Veri kalitesi: kontrol başlığı + adet; kayıt listesi yok.

export type BuAyOzeti = {
  yil: number
  ay: number
  yeniServisKullanicisi: number
  servistenAyrilan: number
  servisDegistiren: number
  durakDegistiren: number
  aracDegisenServis: number
  soforDegisenServis: number
  vardiyaDegistiren: number
  /** Yukarıdakilerin toplamı (kartta "N değişiklik"). */
  toplam: number
}

export function buAyOzetiOlustur(s: BuAyNeDegistiSonucu): BuAyOzeti {
  const ozet = {
    yeniServisKullanicisi: s.yeniServisKullanicilari.length,
    servistenAyrilan: s.servistenAyrilanlar.length,
    servisDegistiren: s.servisDegistirenler.length,
    durakDegistiren: s.durakDegistirenler.length,
    aracDegisenServis: s.aracDegisenServisler.length,
    soforDegisenServis: s.soforDegisenServisler.length,
    vardiyaDegistiren: s.vardiyaDegistirenler.length,
  }
  return { yil: s.yil, ay: s.ay, ...ozet, toplam: Object.values(ozet).reduce((t, n) => t + n, 0) }
}

export type VeriKaliteOzetiSatiri = { kod: string; baslik: string; adet: number; hata: boolean }

export type VeriKaliteOzeti = {
  kontrolSayisi: number
  /** adet > 0 olan kontrol sayısı. */
  bulguluKontrol: number
  toplamBulgu: number
  /** Çalışırken hata veren kontrol sayısı (sessiz yutulmaz). */
  hataliKontrol: number
  /**
   * "Sefer dilimi bağlantısı olmayan personel ataması" kontrolünün sayısı (kapasite motoruyla
   * AYNI kaynak). Kontrol hata verdiyse null (0 gibi gösterilmez).
   */
  dilimsizAtama: number | null
  /** En çok bulgusu olan ilk 5 kontrol. */
  enCokBulgu: VeriKaliteOzetiSatiri[]
}

export function veriKaliteOzetiOlustur(rapor: VeriKaliteRaporSatiri[]): VeriKaliteOzeti {
  const bulgulu = rapor.filter((r) => r.adet > 0)
  const dilimsiz = rapor.find((r) => r.kod === 'personel-atamasi-dilimsiz')
  return {
    dilimsizAtama: dilimsiz && dilimsiz.hata === undefined ? dilimsiz.adet : null,
    kontrolSayisi: rapor.length,
    bulguluKontrol: bulgulu.length,
    toplamBulgu: rapor.reduce((t, r) => t + r.adet, 0),
    hataliKontrol: rapor.filter((r) => r.hata !== undefined).length,
    enCokBulgu: [...bulgulu]
      .sort((a, b) => b.adet - a.adet || a.baslik.localeCompare(b.baslik, 'tr'))
      .slice(0, 5)
      .map((r) => ({ kod: r.kod, baslik: r.baslik, adet: r.adet, hata: r.hata !== undefined })),
  }
}

export type ServisPaneliOzeti = { buAy: BuAyOzeti; veriKalite: VeriKaliteOzeti }

export async function servisPaneliOzetiGetir(): Promise<ServisPaneliOzeti> {
  const [buAy, rapor] = await Promise.all([buAyNeDegistiGetir(), veriKaliteRaporuGetir()])
  return { buAy: buAyOzetiOlustur(buAy), veriKalite: veriKaliteOzetiOlustur(rapor) }
}

export { servisKapasiteTopluGetir }
