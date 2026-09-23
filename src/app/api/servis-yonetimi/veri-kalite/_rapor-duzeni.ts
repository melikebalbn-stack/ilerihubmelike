// MASTER Madde 43 — Veri kalite raporunun EKRAN DÜZENİ.
//
// Ekran ucu (route.ts) ve Excel export ucu (export/route.ts) AYNI 16 satırı,
// AYNI sırada göstersin diye burada; ikinci kez yazılmasın (rule 6).
// Next.js route dosyası olarak algılanmasın diye alt çizgiyle başlıyor
// (_filtre.ts / _erisim-izi.ts deseninin eşi).
//
// 🔴 KIRPMA BU DOSYADA YOKTUR ve OLMAYACAKTIR. Buradan dönen satırların
// `kayitlar` dizisi TAMDIR. Ekranın KAYIT_LIMIT kırpması bir SUNUM kararıdır
// ve route.ts'te, bu fonksiyonun ÇIKTISI ÜZERİNDE uygulanır. Export bu
// fonksiyonu doğrudan kullanır ve hiçbir şey kırpmaz — buraya bir kırpma
// eklenirse Excel dosyası sessizce eksik çıkar.
import type { VeriKaliteRaporSatiri } from '@/lib/servis-yonetimi/veri-kalite'

// MASTER madde 43'ün 14 anomalisinden salt okunur tespiti YAPILAMAYAN
// üçü (8 vardiya, 10 adres, 12 kapasite — bkz. keşif raporu B.8/B.10/F)
// burada "Bu Ay Ne Değişti?" API'sindeki kapsamDisi/not deseniyle
// placeholder olarak döner — hata fırlatmaz, ekran normal bir kart
// olarak render edebilir.
export type VeriKaliteKapsamDisiSatiri = {
  kod: string
  baslik: string
  adet: 0
  kayitlar: never[]
  kirpildi: false
  kapsamDisi: true
  not: string
}

/** Sıralanmış ama KIRPILMAMIŞ gerçek kontrol satırı. `kirpildi` alanı YOK —
 *  o alanı yalnız route.ts'teki kirp() ekler (VeriKaliteKirpilmisSatiri). */
export type VeriKaliteDuzenliSatiri = VeriKaliteRaporSatiri

/** Düzenin bir satırı: ya kırpılmamış gerçek kontrol, ya yer tutucu. */
export type VeriKaliteDuzenSatiri = VeriKaliteDuzenliSatiri | VeriKaliteKapsamDisiSatiri

export const VARDIYA_UYUMSUZLUGU: VeriKaliteKapsamDisiSatiri = {
  kod: 'vardiya-uyumsuzlugu',
  baslik: 'Vardiya uyumsuzluğu',
  adet: 0,
  kayitlar: [],
  kirpildi: false,
  kapsamDisi: true,
  not:
    "Personnel'de vardiya alanı yok, ServisSeferDilimi.grupKodu IproVardiya'ya kasıtlı olarak bağlı değil — " +
    'güvenilir bir eşleştirme kurulamıyor (bkz. keşif raporu madde B.8).',
}

export const ADRES_DEGISMIS: VeriKaliteKapsamDisiSatiri = {
  kod: 'adres-degismis-servis-yeniden-degerlendirilmemis',
  baslik: 'Adres değişmiş / servis yeniden değerlendirilmemiş',
  adet: 0,
  kayitlar: [],
  kirpildi: false,
  kapsamDisi: true,
  not:
    "Personnel için izlenebilir bir adres değişikliği kaynağı (audit/tarihçe) yok — madde 31'deki aynı açık " +
    'sorun (bkz. keşif raporu madde B.10).',
}

export const KAPASITE_ASIMI: VeriKaliteKapsamDisiSatiri = {
  kod: 'kapasite-asimi',
  baslik: 'Kapasite aşımı',
  adet: 0,
  kayitlar: [],
  kirpildi: false,
  kapsamDisi: true,
  not:
    "Kapasite motoru (servisKapasiteOzetiGetir) henüz main'e girmedi — bu kontrol motor main'e girdiğinde " +
    'eklenecek (TODO, madde 43/12).',
}

// Rapor dizisini MASTER'ın 1-14 sırasına göre dizer (kontrat: her kod
// yalnız bir kez, eksik kod = kod/route arasında bozulmuş bir sözleşme —
// bilerek fail-loud, salt tespitin "sessiz hata yutma" prensibinden
// FARKLI: bu bir programlama hatası, veri anomalisi değil).
export function raporSiraliOlustur(rapor: VeriKaliteRaporSatiri[]): VeriKaliteDuzenSatiri[] {
  const byKod = new Map(rapor.map(r => [r.kod, r]))
  const al = (kod: string): VeriKaliteDuzenliSatiri => {
    const satir = byKod.get(kod)
    if (!satir) throw new Error(`Veri kalite raporunda beklenen kontrol eksik: ${kod}`)
    return satir
  }

  return [
    al('aktif-personel-servis-yok'),
    al('pasif-personel-servis-aktif'),
    al('mukerrer-aktif-servis'),
    al('servis-var-arac-yok'),
    al('servis-var-sofor-yok'),
    al('guzergah-sefer-dilimi-tanimsiz'),
    al('kapasitesi-eksik-arac'),
    al('koordinatsiz-durak'),
    VARDIYA_UYUMSUZLUGU,
    al('cakisan-atamalar'),
    ADRES_DEGISMIS,
    al('suresi-bitmis-gecici-atama'),
    KAPASITE_ASIMI,
    al('tarih-cakismasi-arac-sofor'),
    al('aktif-arac-pasif-firma'),
    al('dis-firma-soforu-firmasiz'),
  ]
}
