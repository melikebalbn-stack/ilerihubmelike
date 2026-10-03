import { prisma } from '@/lib/prisma'
import { bugunTR } from './tarih-kurallari'

// ============================================================================
// KAPASİTE MOTORU — TEK KAYNAK (B1)
//
// Servis Paneli, Kapasite Excel'i, güzergâh detayı kartları, kapasite sekmesi,
// alternatif servis önerisi ve Veri Kalite kontrolleri sayıları BURADAN alır.
// Gösterim katmanında (ekran, rapor) kapasite/boş koltuk/doluluk YENİDEN
// HESAPLANMAZ.
//
// Tanım (bir güzergâh × sefer dilimi çifti için, hesap günü X):
//   koltuk   = X gününde AKTİF ANA araç atamalarının (aktif araç) kapasite toplamı
//   personel = X gününde aktif, o dilimi kapsayan personel atamaları
//   boş      = koltuk − personel          (negatif = AŞIM)
//   doluluk  = personel / koltuk × 100    (koltuk yoksa TANIMSIZ: null)
//
// 🔴 "Paydası olmayan metrik oran olarak sunulmaz": koltuk = 0 iken doluluk
// 0 ya da 100 DÖNMEZ, null döner. Aracı olmayan güzergâh "ARAC_YOK"tur; koltuk
// ve boş koltuk ekranda "—" gösterilir, toplam koltuk/boş toplamlarına GİRMEZ.
// ============================================================================

import { KAPASITE_DURUM_ETIKETLERI, kapasiteDurumEtiketi, type KapasiteDurumu } from './kapasite-etiket'

// Etiketler prisma'sız modülde (istemci bileşenleri de kullanır); burada yeniden dışa aktarılır.
export { KAPASITE_DURUM_ETIKETLERI, kapasiteDurumEtiketi, type KapasiteDurumu }

/** Doluluk bu eşiğe (dahil) ulaşınca ve aşım yoksa "Dolmak üzere". */
export const DOLMAK_UZERE_ESIGI = 90

export type ServisKapasiteOzeti = {
  /** Koltuk toplamı (ANA araçlar). Araç yoksa 0 — ARAC_YOK'ta gösterilmez. */
  kapasite: number
  atananPersonelSayisi: number
  /** kapasite − personel. Negatif = aşım. ARAC_YOK'ta anlamsızdır (gösterme). */
  bosKoltuk: number
  /** Yüzde; koltuk yoksa null (paydasız oran sunulmaz). */
  dolulukOrani: number | null
  /** O gün aktif ANA araç atama sayısı. */
  aracSayisi: number
  durum: KapasiteDurumu
  /** Aşan kişi sayısı (>= 0). Aşım yoksa 0. */
  asimMiktari: number
}

export type TarihAralikliKayit = {
  baslangicTarihi: Date
  bitisTarihi: Date | null
}

export function tarihBaslangiciUTC(tarih: Date = new Date()): Date {
  return new Date(Date.UTC(tarih.getUTCFullYear(), tarih.getUTCMonth(), tarih.getUTCDate()))
}

export function tarihAraligiKapsar(kayit: TarihAralikliKayit, hesapTarihi: Date): boolean {
  const gun = tarihBaslangiciUTC(hesapTarihi)
  return kayit.baslangicTarihi <= gun && (kayit.bitisTarihi === null || kayit.bitisTarihi >= gun)
}

export function kapasiteOzetiHesapla(
  aracKapasiteleri: number[],
  atananPersonelSayisi: number,
): ServisKapasiteOzeti {
  const aracSayisi = aracKapasiteleri.length
  const kapasite = aracKapasiteleri.reduce((toplam, deger) => toplam + deger, 0)
  const bosKoltuk = kapasite - atananPersonelSayisi
  const dolulukOrani = kapasite > 0 ? (atananPersonelSayisi / kapasite) * 100 : null

  let durum: KapasiteDurumu
  if (aracSayisi === 0) durum = 'ARAC_YOK'
  else if (bosKoltuk < 0) durum = 'ASIM'
  else if (dolulukOrani !== null && dolulukOrani >= DOLMAK_UZERE_ESIGI) durum = 'DOLMAK_UZERE'
  else durum = 'UYGUN'

  return {
    kapasite,
    atananPersonelSayisi,
    bosKoltuk,
    dolulukOrani,
    aracSayisi,
    durum,
    asimMiktari: durum === 'ASIM' ? -bosKoltuk : 0,
  }
}

/**
 * Hesap tarihi sorgu parametresi: yok → BUGÜN (Türkiye günü); verilmişse geçerli YYYY-MM-DD
 * olmalı (geçersiz biçim/takvim günü → hata). Sunucu UTC olsa da gün Türkiye'ye göre.
 */
export function hesapTarihiCoz(girdi: string | null | undefined): Date {
  const deger = girdi?.trim()
  if (!deger) return new Date(`${bugunTR()}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deger)) throw new Error('Hesap tarihi YYYY-MM-DD formatında olmalıdır.')
  const tarih = new Date(`${deger}T00:00:00.000Z`)
  if (Number.isNaN(tarih.getTime()) || tarih.toISOString().slice(0, 10) !== deger) {
    throw new Error('Hesap tarihi geçersiz.')
  }
  return tarih
}

/** Pozitif AND-of-OR tarih filtresi — tek ve toplu sorgu AYNI filtreyi kullanır. */
export function tarihFiltresiOlustur(gun: Date) {
  return {
    baslangicTarihi: { lte: gun },
    OR: [{ bitisTarihi: null }, { bitisTarihi: { gte: gun } }],
  }
}

export async function servisKapasiteOzetiGetir(
  guzergahId: string,
  dilimId: string,
  hesapTarihi: Date = new Date(),
): Promise<ServisKapasiteOzeti> {
  const gun = tarihBaslangiciUTC(hesapTarihi)
  const tarihFiltresi = tarihFiltresiOlustur(gun)

  const [aracAtamalari, atananPersonelSayisi] = await Promise.all([
    prisma.servisGuzergahAracVarsayilan.findMany({
      where: {
        guzergahId,
        dilimId,
        rol: 'ANA',
        aktif: true,
        arac: { aktif: true },
        ...tarihFiltresi,
      },
      select: { arac: { select: { kapasite: true } } },
    }),
    prisma.servisPersonelAtama.count({
      where: {
        guzergahId,
        aktif: true,
        dilimler: { some: { dilimId } },
        ...tarihFiltresi,
      },
    }),
  ])

  return kapasiteOzetiHesapla(
    aracAtamalari.map((atama) => atama.arac.kapasite),
    atananPersonelSayisi,
  )
}

// ----------------------------------------------------------------------------
// TOPLU HESAP — tüm aktif güzergâhlar (Servis Paneli, Excel, Veri Kalite)
// ----------------------------------------------------------------------------

export type KapasiteGirdisi = {
  guzergahlar: { id: string; kod: string; ad: string }[]
  /** Aktif sefer dilimleri, görüntüleme sırasıyla. */
  dilimler: { id: string; kod: string; ad: string }[]
  /** Hesap gününde geçerli, aktif ANA araç atamaları (aktif araç). */
  aracAtamalari: { guzergahId: string; dilimId: string; plaka: string; kapasite: number }[]
  /**
   * Hesap gününde geçerli, aktif personel atamaları (kişi bilgisi YOK — yalnız güzergâh + dilimler).
   * atamaId/baslangicTarihi/kaynak ATAMA kaydının teknik alanlarıdır (personel kimliği değil);
   * yalnız "dilim bağlantısı olmayan atama" listesi için.
   */
  personelAtamalari: { guzergahId: string; dilimIdleri: string[]; atamaId?: string; baslangicTarihi?: string; kaynak?: string }[]
}

/**
 * Sefer dilimi bağlantısı OLMAYAN aktif personel ataması. Motor bu atamayı hiçbir
 * (güzergâh × dilim) çiftine saymaz — kapasiteye/KPI'ya GİRMEZ. Sayı sessizce kaybolmasın diye
 * ayrıca raporlanır (kural DEĞİŞMEDİ).
 */
export type DilimsizAtama = {
  atamaId: string | null
  guzergahId: string
  kod: string
  ad: string
  baslangicTarihi: string | null
  kaynak: string | null
}

export type KapasiteDilimSatiri = {
  guzergahId: string
  guzergahKod: string
  guzergahAd: string
  dilimId: string
  dilimKod: string
  dilimAd: string
  /** Plaka listesi (kişisel veri değil). */
  araclar: string[]
  ozet: ServisKapasiteOzeti
}

export type KapasiteGuzergahSatiri = {
  guzergahId: string
  kod: string
  ad: string
  /** Satırı belirleyen (en dar) dilim; hiç etkin dilim yoksa null. */
  dilimKod: string | null
  dilimSayisi: number
  /** O güzergâhta ANA araçlı dilim sayısı (0 = güzergâhın hiç aracı yok). */
  aracliDilimSayisi: number
  araclar: string[]
  ozet: ServisKapasiteOzeti
  dilimler: KapasiteDilimSatiri[]
}

export type KapasiteAsimi = {
  guzergahId: string
  kod: string
  ad: string
  dilimKod: string
  koltuk: number
  personel: number
  fazla: number
}

export type KapasiteToplamlari = {
  guzergahSayisi: number
  /** Satırlardaki personel toplamı (aracı olmayan güzergâhlar DAHİL). */
  atanmisPersonel: number
  /** Yalnız aracı olan güzergâhların koltuğu. */
  toplamKoltuk: number
  /** Aracı olan güzergâhların işaretli boş koltuk toplamı: aşımlar DÜŞÜLMÜŞ NET. */
  netBosKoltuk: number
  asimSayisi: number
  /** Aşan toplam kişi. */
  asimKisi: number
  aracsizGuzergahSayisi: number
  dolmakUzereSayisi: number
  /** dilimsizAtamalar.length — panel/veri kalite AYNI sayıyı gösterir. */
  dilimsizAtamaSayisi: number
}

export type ServisKapasiteToplu = {
  /** YYYY-MM-DD (hesap günü). */
  tarih: string
  guzergahlar: KapasiteGuzergahSatiri[]
  /** Tüm (güzergâh × dilim) çiftleri — Excel detay sayfası. */
  dilimSatirlari: KapasiteDilimSatiri[]
  asimlar: KapasiteAsimi[]
  /** Aktif güzergâhlardaki, dilim bağlantısı olmayan aktif atamalar (kapasiteye girmez). */
  dilimsizAtamalar: DilimsizAtama[]
  toplam: KapasiteToplamlari
}

/** Güzergâh satırını belirleyen çift: aşım > personelli araçsız > dolmak üzere > uygun > boş. */
function oncelik(ozet: ServisKapasiteOzeti): number {
  if (ozet.durum === 'ASIM') return 0
  if (ozet.durum === 'ARAC_YOK' && ozet.atananPersonelSayisi > 0) return 1
  if (ozet.durum === 'DOLMAK_UZERE') return 2
  if (ozet.durum === 'UYGUN') return 3
  return 4
}

/**
 * SAF çekirdek (DB'siz, test edilebilir): tek-çift hesabı (kapasiteOzetiHesapla) ile AYNI
 * kuralları tüm güzergâhlara uygular. Bir güzergâh için hesaplanacak (güzergâh × dilim)
 * çiftleri: o dilimde ANA araç atanmış YA DA personel atanmış olanlar.
 *
 * Güzergâh satırı = EN DAR dilimin değerleri (en kötü durum). Örn. sabah dilimi uygun,
 * akşam dilimi aşımsa güzergâh "Aşım" görünür; ayrıntı `dilimler`dedir.
 */
export function kapasiteTopluOlustur(girdi: KapasiteGirdisi, tarih: string): ServisKapasiteToplu {
  const aracKey = (g: string, d: string) => `${g}|${d}`
  const araclarByCift = new Map<string, { plaka: string; kapasite: number }[]>()
  for (const a of girdi.aracAtamalari) {
    const k = aracKey(a.guzergahId, a.dilimId)
    if (!araclarByCift.has(k)) araclarByCift.set(k, [])
    araclarByCift.get(k)!.push({ plaka: a.plaka, kapasite: a.kapasite })
  }
  const personelByCift = new Map<string, number>()
  for (const p of girdi.personelAtamalari) {
    for (const dilimId of new Set(p.dilimIdleri)) {
      const k = aracKey(p.guzergahId, dilimId)
      personelByCift.set(k, (personelByCift.get(k) ?? 0) + 1)
    }
  }

  const dilimSatirlari: KapasiteDilimSatiri[] = []
  const guzergahlar: KapasiteGuzergahSatiri[] = []

  for (const g of girdi.guzergahlar) {
    const cifter: KapasiteDilimSatiri[] = []
    for (const d of girdi.dilimler) {
      const araclar = araclarByCift.get(aracKey(g.id, d.id)) ?? []
      const personel = personelByCift.get(aracKey(g.id, d.id)) ?? 0
      if (araclar.length === 0 && personel === 0) continue // bu dilimde faaliyet yok
      cifter.push({
        guzergahId: g.id, guzergahKod: g.kod, guzergahAd: g.ad,
        dilimId: d.id, dilimKod: d.kod, dilimAd: d.ad,
        araclar: araclar.map((a) => a.plaka),
        ozet: kapasiteOzetiHesapla(araclar.map((a) => a.kapasite), personel),
      })
    }
    dilimSatirlari.push(...cifter)

    // En dar çift: önce öncelik, sonra doluluk (yüksek), sonra dilim sırası (girdi sırası).
    const secilen = [...cifter].sort((a, b) => {
      const o = oncelik(a.ozet) - oncelik(b.ozet)
      if (o !== 0) return o
      return (b.ozet.dolulukOrani ?? -1) - (a.ozet.dolulukOrani ?? -1)
    })[0]

    guzergahlar.push({
      guzergahId: g.id,
      kod: g.kod,
      ad: g.ad,
      dilimKod: secilen?.dilimKod ?? null,
      dilimSayisi: cifter.length,
      aracliDilimSayisi: cifter.filter((c) => c.ozet.aracSayisi > 0).length,
      araclar: secilen?.araclar ?? [],
      ozet: secilen?.ozet ?? kapasiteOzetiHesapla([], 0),
      dilimler: cifter,
    })
  }

  const aracli = guzergahlar.filter((g) => g.ozet.durum !== 'ARAC_YOK')
  const asimlar: KapasiteAsimi[] = dilimSatirlari
    .filter((c) => c.ozet.durum === 'ASIM')
    .map((c) => ({
      guzergahId: c.guzergahId, kod: c.guzergahKod, ad: c.guzergahAd, dilimKod: c.dilimKod,
      koltuk: c.ozet.kapasite, personel: c.ozet.atananPersonelSayisi, fazla: c.ozet.asimMiktari,
    }))
    .sort((a, b) => b.fazla - a.fazla || a.kod.localeCompare(b.kod, 'tr'))

  const guzergahById = new Map(girdi.guzergahlar.map((g) => [g.id, g]))
  const dilimsizAtamalar: DilimsizAtama[] = girdi.personelAtamalari
    .filter((p) => new Set(p.dilimIdleri).size === 0 && guzergahById.has(p.guzergahId))
    .map((p) => {
      const g = guzergahById.get(p.guzergahId)!
      return {
        atamaId: p.atamaId ?? null, guzergahId: g.id, kod: g.kod, ad: g.ad,
        baslangicTarihi: p.baslangicTarihi ?? null, kaynak: p.kaynak ?? null,
      }
    })
    .sort((a, b) => a.kod.localeCompare(b.kod, 'tr') || (a.atamaId ?? '').localeCompare(b.atamaId ?? ''))

  const toplam: KapasiteToplamlari = {
    guzergahSayisi: guzergahlar.length,
    atanmisPersonel: guzergahlar.reduce((t, g) => t + g.ozet.atananPersonelSayisi, 0),
    toplamKoltuk: aracli.reduce((t, g) => t + g.ozet.kapasite, 0),
    netBosKoltuk: aracli.reduce((t, g) => t + g.ozet.bosKoltuk, 0),
    asimSayisi: guzergahlar.filter((g) => g.ozet.durum === 'ASIM').length,
    asimKisi: guzergahlar.reduce((t, g) => t + g.ozet.asimMiktari, 0),
    aracsizGuzergahSayisi: guzergahlar.filter((g) => g.ozet.durum === 'ARAC_YOK').length,
    dolmakUzereSayisi: guzergahlar.filter((g) => g.ozet.durum === 'DOLMAK_UZERE').length,
    dilimsizAtamaSayisi: dilimsizAtamalar.length,
  }

  return { tarih, guzergahlar, dilimSatirlari, asimlar, dilimsizAtamalar, toplam }
}

/**
 * Tüm AKTİF güzergâhlar için kapasite (Servis Paneli / Excel / Veri Kalite). Tek-çift
 * `servisKapasiteOzetiGetir` ile AYNI filtre (tarihFiltresiOlustur) ve AYNI hesap
 * (kapasiteOzetiHesapla). `guzergahId` verilirse yalnız o güzergâh (detay kartları).
 *
 * KVKK: personel tablosundan yalnız güzergahId + dilimler.dilimId okunur; kişi alanı yok.
 */
export async function servisKapasiteTopluGetir(
  hesapTarihi: Date = new Date(),
  secenek?: { guzergahId?: string },
): Promise<ServisKapasiteToplu> {
  const gun = tarihBaslangiciUTC(hesapTarihi)
  const tarihFiltresi = tarihFiltresiOlustur(gun)
  const guzergahKosulu = secenek?.guzergahId ? { guzergahId: secenek.guzergahId } : {}

  const [guzergahlar, dilimler, aracAtamalari, personelAtamalari] = await Promise.all([
    prisma.servisGuzergah.findMany({
      where: { aktif: true, ...(secenek?.guzergahId ? { id: secenek.guzergahId } : {}) },
      select: { id: true, kod: true, ad: true },
      orderBy: { kod: 'asc' },
    }),
    prisma.servisSeferDilimi.findMany({
      where: { aktif: true },
      select: { id: true, kod: true, ad: true },
      orderBy: { sira: 'asc' },
    }),
    prisma.servisGuzergahAracVarsayilan.findMany({
      where: { rol: 'ANA', aktif: true, arac: { aktif: true }, ...guzergahKosulu, ...tarihFiltresi },
      select: { guzergahId: true, dilimId: true, arac: { select: { plaka: true, kapasite: true } } },
    }),
    prisma.servisPersonelAtama.findMany({
      where: { aktif: true, ...guzergahKosulu, ...tarihFiltresi },
      select: { id: true, guzergahId: true, baslangicTarihi: true, atamaKaynagi: true, dilimler: { select: { dilimId: true } } },
    }),
  ])

  return kapasiteTopluOlustur(
    {
      guzergahlar,
      dilimler,
      aracAtamalari: aracAtamalari.map((a) => ({
        guzergahId: a.guzergahId, dilimId: a.dilimId, plaka: a.arac.plaka, kapasite: a.arac.kapasite,
      })),
      personelAtamalari: personelAtamalari.map((p) => ({
        guzergahId: p.guzergahId, dilimIdleri: p.dilimler.map((d) => d.dilimId),
        atamaId: p.id, baslangicTarihi: p.baslangicTarihi.toISOString().slice(0, 10), kaynak: p.atamaKaynagi,
      })),
    },
    gun.toISOString().slice(0, 10),
  )
}
