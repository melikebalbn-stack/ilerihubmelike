/**
 * PDKS Adım 7 — anomali / kart paylaşımı tespiti. SAF ÇEKİRDEK (DB yok; birim testli).
 * Kişi başına, zaman sıralı geçerli geçişler üzerinde ardışık çiftleri inceler:
 *  - ARDISIK_GIRIS / ARDISIK_CIKIS: çıkış/giriş yapmadan aynı yön tekrar (tailgating / unutulmuş okutma).
 *  - COK_HIZLI_FARKLI_NOKTA: iki okutma arası eşikten kısa VE farklı kapı/cihaz → aynı kart iki yerde
 *    (kart paylaşımı şüphesi; tek kişi fiziksel olarak o sürede iki noktada olamaz).
 * Veri kaynağı / tüm personel taraması servis katmanında (anomali-servis).
 */
export type AnomaliTur = 'ARDISIK_GIRIS' | 'ARDISIK_CIKIS' | 'COK_HIZLI_FARKLI_NOKTA'

export interface GecisNokta {
  id: string
  zaman: Date
  yon: 'GIRIS' | 'CIKIS'
  kapiNo: number | null
  cihazId: string
}

export interface Anomali {
  tur: AnomaliTur
  personnelId: string
  zaman: Date // ikinci (tetikleyen) geçişin zamanı
  oncekiGecisId: string
  gecisId: string
  detay: string
}

export interface AnomaliAyar {
  /** Kart paylaşımı şüphesi için iki okutma arası alt sınır (sn). */
  hizEsikSn: number
}

export const VARSAYILAN_ANOMALI_AYAR: AnomaliAyar = { hizEsikSn: 60 }

/** Tek kişinin zaman-sıralı geçişlerinde anomalileri bulur. */
export function anomaliBul(personnelId: string, gecisler: GecisNokta[], ayar: AnomaliAyar = VARSAYILAN_ANOMALI_AYAR): Anomali[] {
  const sirali = [...gecisler].sort((a, b) => a.zaman.getTime() - b.zaman.getTime())
  const sonuc: Anomali[] = []
  for (let i = 1; i < sirali.length; i++) {
    const onceki = sirali[i - 1]
    const simdi = sirali[i]
    const farkSn = (simdi.zaman.getTime() - onceki.zaman.getTime()) / 1000

    if (simdi.yon === onceki.yon) {
      sonuc.push({
        tur: simdi.yon === 'GIRIS' ? 'ARDISIK_GIRIS' : 'ARDISIK_CIKIS',
        personnelId,
        zaman: simdi.zaman,
        oncekiGecisId: onceki.id,
        gecisId: simdi.id,
        detay: simdi.yon === 'GIRIS' ? 'Çıkış yapmadan tekrar giriş' : 'Giriş yapmadan tekrar çıkış',
      })
    }

    const farkliNokta = onceki.cihazId !== simdi.cihazId || onceki.kapiNo !== simdi.kapiNo
    if (farkSn >= 0 && farkSn < ayar.hizEsikSn && farkliNokta) {
      sonuc.push({
        tur: 'COK_HIZLI_FARKLI_NOKTA',
        personnelId,
        zaman: simdi.zaman,
        oncekiGecisId: onceki.id,
        gecisId: simdi.id,
        detay: `${Math.round(farkSn)} sn içinde farklı noktada okutma — kart paylaşımı şüphesi`,
      })
    }
  }
  return sonuc
}
