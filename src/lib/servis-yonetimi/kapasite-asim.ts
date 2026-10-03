import { servisKapasiteOzetiGetir } from './kapasite'

// ============================================================================
// ORTAK KAPASİTE AŞIMI KURALI (C0) — Yeni Atama, Transfer, Dilim Ata (B5) ve Excel toplu atama
// AYNI yardımcıyı kullanır; kural bir yerde tutulur.
// ============================================================================
//
//  • Etki, kapasite motorunun (servisKapasiteOzetiGetir) BUGÜNKÜ sayısı üzerine hesaplanır; ekranda
//    yeniden hesap yok (sunucu önizleme döner).
//  • YALNIZ bugünün kapasitesine girenler sayılır: başlangıcı henüz gelmemiş ya da bitmiş atama
//    etkiyi artırmaz (motorun tarih filtresiyle aynı mantık).
//  • Aşım yalnız ARAÇLI dilimde ve işlem kişi EKLİYORSA olur. Araçsız dilimde koltuk yoktur →
//    aşım sayılmaz (motorla aynı kural); satır "araç yok" bilgisiyle gösterilir.
//  • Aşım olacaksa onay (asimOnayi) olmadan KAYIT YAPILMAZ: sunucu 409 + ASIM_ONAYI_GEREKLI döner,
//    istemci uyarıyı gösterip onayla yeniden gönderir.

export type AtamaDilimHataKodu = 'ASIM_ONAYI_GEREKLI' | 'DILIMSIZ_ONAYI_GEREKLI' | 'DOGRULAMA'

/** Atama/dilim işlemlerinin doğrulama + onay hatası (HTTP: DOGRULAMA→400, *_ONAYI_GEREKLI→409). */
export class AtamaDilimHatasi extends Error {
  constructor(
    message: string,
    public readonly kod: AtamaDilimHataKodu = 'DOGRULAMA',
    public readonly ayrinti?: unknown,
  ) {
    super(message)
    this.name = 'AtamaDilimHatasi'
  }
}

export type KapasiteEtkisiSatiri = {
  dilimId: string
  dilimKod: string
  dilimAd: string
  /** Güzergâh (Excel toplu atama gibi çok güzergâhlı işlemlerde satırı ayırt eder). */
  guzergahId?: string
  guzergahKod?: string
  /** Bu dilimde şu an sayılan personel (motor). */
  once: number
  /** İşlem sonrası. */
  sonra: number
  /** Koltuk; aracı olmayan dilimde null. */
  koltuk: number | null
  aracYok: boolean
  asim: boolean
  fazla: number
}

type Dilim = { id: string; kod: string; ad: string }

/** Atama, verilen gün için kapasiteye giriyor mu (motorun tarih filtresiyle aynı mantık). */
export function atamaGunuKapsar(a: { baslangicTarihi: Date; bitisTarihi: Date | null }, gun: string): boolean {
  const g = new Date(`${gun}T00:00:00.000Z`)
  return a.baslangicTarihi.getTime() <= g.getTime() && (a.bitisTarihi === null || a.bitisTarihi.getTime() >= g.getTime())
}

export function etkiSatiriOlustur(
  dilim: Dilim,
  motor: { atananPersonelSayisi: number; kapasite: number; durum: string },
  eklenenKisi: number,
): KapasiteEtkisiSatiri {
  const aracYok = motor.durum === 'ARAC_YOK'
  const sonra = motor.atananPersonelSayisi + eklenenKisi
  const asim = !aracYok && eklenenKisi > 0 && sonra > motor.kapasite
  return {
    dilimId: dilim.id, dilimKod: dilim.kod, dilimAd: dilim.ad,
    once: motor.atananPersonelSayisi, sonra,
    koltuk: aracYok ? null : motor.kapasite, aracYok,
    asim, fazla: asim ? sonra - motor.kapasite : 0,
  }
}

/**
 * Bir güzergâhın verilen dilimleri için kapasite etkisi. `eklenenKisi`: dilimId → bugünün
 * kapasitesine GİRECEK kişi sayısı (çağıran, atamaGunuKapsar ile eler).
 */
export async function kapasiteEtkisiHesapla(
  guzergah: { id: string; kod?: string },
  dilimler: Dilim[],
  eklenenKisi: Map<string, number>,
  gun: string,
): Promise<KapasiteEtkisiSatiri[]> {
  const hesapTarihi = new Date(`${gun}T00:00:00.000Z`)
  const satirlar: KapasiteEtkisiSatiri[] = []
  for (const dilim of dilimler) {
    const motor = await servisKapasiteOzetiGetir(guzergah.id, dilim.id, hesapTarihi)
    satirlar.push({
      ...etkiSatiriOlustur(dilim, motor, eklenenKisi.get(dilim.id) ?? 0),
      guzergahId: guzergah.id,
      ...(guzergah.kod ? { guzergahKod: guzergah.kod } : {}),
    })
  }
  return satirlar
}

export const ASIM_VARSAYILAN_MESAJ = 'Bu işlem kapasiteyi aşacak. Devam etmek için aşım onayı gerekir.'

/** Aşım var ve onay yoksa 409 hatası fırlatır (kayıt YAPILMAZ). */
export function asimOnayiKontrol(etki: KapasiteEtkisiSatiri[], onay: boolean | undefined, mesaj = ASIM_VARSAYILAN_MESAJ): void {
  const asimlar = etki.filter((e) => e.asim)
  if (asimlar.length > 0 && !onay) throw new AtamaDilimHatasi(mesaj, 'ASIM_ONAYI_GEREKLI', { etki: asimlar })
}
