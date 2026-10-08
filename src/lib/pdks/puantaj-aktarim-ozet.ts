/**
 * PDKS → IFS puantaj (DEVAM) aktarımı — SAF ÇEKİRDEK (DB yok; birim testli).
 *
 * İK kararı: Hub'da MAAŞ/ÜCRET bilgisi TUTULMAZ. Bu modül yalnız DEVAM verisi (gün/saat) üretir;
 * ücret, ek ödeme, kesinti, net/brüt hiçbir yerde hesaplanmaz veya saklanmaz.
 *
 * Bir kişinin bir aydaki PdksPuantajGun satırlarından IFS'e gidecek aylık devam özetini çıkarır.
 */

export type GunDurumKod =
  | 'TAM'
  | 'TAM_FORMLA'
  | 'MESAI'
  | 'IZINLI'
  | 'RAPORLU'
  | 'EKSIK_GIRIS'
  | 'EKSIK_CIKIS'
  | 'GELMEDI'
  | 'TATIL'
  | 'HAFTA_SONU'
  | 'BEKLENMIYOR'

/** IFS'e taşınacak gün tipi (devam kodu) — ücretle ilgisi yok. */
export type DevamTip = 'CALISMA' | 'MESAI' | 'IZIN' | 'RAPOR' | 'HAFTA_TATILI' | 'RESMI_TATIL' | 'DEVAMSIZ' | 'EKSIK'

export interface AktarimGunSatir {
  gun: Date // o güne ait tarih (gün numarası buradan alınır)
  durum: GunDurumKod
  calismaDakika: number | null // net çalışma (mola düşülmüş)
  fazlaDakika: number | null // onaylı fazla mesai dakikası
  izinPay: number | null // 1 | 0.5 (izin/rapor günü payı)
  gece: boolean // vardiya gece mi (giriş > çıkış, ör. 21:00–07:00)
}

export interface AktarimGunDetay {
  gun: number // ayın günü (1..31)
  tip: DevamTip
  saat: number // o günün net çalışma saati (çalışma dışı 0)
}

export interface AktarimOzet {
  calismaSaat: number
  fazlaMesaiSaat: number
  geceSaat: number
  normalGun: number
  mesaiGun: number
  haftaTatiliGun: number
  resmiTatilGun: number
  izinGun: number
  raporGun: number
  eksikGun: number
  eksikKayitGun: number
  gunler: AktarimGunDetay[]
}

const r2 = (n: number) => Math.round(n * 100) / 100
const saat = (dk: number | null) => (dk && dk > 0 ? dk / 60 : 0)

const TIP_HARITA: Record<GunDurumKod, DevamTip | null> = {
  TAM: 'CALISMA',
  TAM_FORMLA: 'CALISMA',
  MESAI: 'MESAI',
  IZINLI: 'IZIN',
  RAPORLU: 'RAPOR',
  HAFTA_SONU: 'HAFTA_TATILI',
  TATIL: 'RESMI_TATIL',
  GELMEDI: 'DEVAMSIZ',
  EKSIK_GIRIS: 'EKSIK',
  EKSIK_CIKIS: 'EKSIK',
  BEKLENMIYOR: null, // vardiyası olmayan gün — IFS'e satır gitmez
}

/**
 * Kişinin bir aydaki günlerinden devam özetini çıkarır.
 *  - calismaSaat: TAM/TAM_FORMLA günlerinin net saati.
 *  - fazlaMesaiSaat: tüm günlerin fazlaDakika'sı + MESAI günlerinin net saati (tümü fazla sayılır).
 *  - geceSaat: gece vardiyasındaki çalışılan günlerin net saati.
 */
export function aktarimOzetiHesapla(gunler: AktarimGunSatir[]): AktarimOzet {
  const ozet: AktarimOzet = {
    calismaSaat: 0,
    fazlaMesaiSaat: 0,
    geceSaat: 0,
    normalGun: 0,
    mesaiGun: 0,
    haftaTatiliGun: 0,
    resmiTatilGun: 0,
    izinGun: 0,
    raporGun: 0,
    eksikGun: 0,
    eksikKayitGun: 0,
    gunler: [],
  }

  let calisma = 0
  let fazla = 0
  let gece = 0

  for (const g of gunler) {
    const tip = TIP_HARITA[g.durum]
    if (!tip) continue

    const netSaat = saat(g.calismaDakika)
    fazla += saat(g.fazlaDakika)

    switch (tip) {
      case 'CALISMA':
        ozet.normalGun += 1
        calisma += netSaat
        if (g.gece) gece += netSaat
        break
      case 'MESAI':
        ozet.mesaiGun += 1
        fazla += netSaat // mesai günü tamamen fazla mesai
        if (g.gece) gece += netSaat
        break
      case 'IZIN':
        ozet.izinGun += g.izinPay ?? 1
        break
      case 'RAPOR':
        ozet.raporGun += g.izinPay ?? 1
        break
      case 'HAFTA_TATILI':
        ozet.haftaTatiliGun += 1
        break
      case 'RESMI_TATIL':
        ozet.resmiTatilGun += 1
        break
      case 'DEVAMSIZ':
        ozet.eksikGun += 1
        break
      case 'EKSIK':
        ozet.eksikKayitGun += 1
        break
    }

    ozet.gunler.push({ gun: g.gun.getUTCDate(), tip, saat: r2(tip === 'CALISMA' || tip === 'MESAI' ? netSaat : 0) })
  }

  ozet.calismaSaat = r2(calisma)
  ozet.fazlaMesaiSaat = r2(fazla)
  ozet.geceSaat = r2(gece)
  ozet.izinGun = r2(ozet.izinGun)
  ozet.raporGun = r2(ozet.raporGun)
  ozet.gunler.sort((a, b) => a.gun - b.gun)
  return ozet
}
