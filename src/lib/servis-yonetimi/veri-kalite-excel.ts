// ============================================================================
// MASTER Madde 43 — Veri Kalite Merkezi · Excel export (saf fonksiyon)
// ============================================================================
//
// SAF: DB'ye, request'e, session'a dokunmaz. Girdi, veri-kalite API'sinin
// ürettiği satır yapısının AYNISIDIR — export ekranla AYNI veriyi gösterir,
// yeni parametre/filtre YOKTUR ("ekranda ne görüyorsam dosyada o var").
//
// Kütüphane: xlsx (madde 29'daki operasyonel servis listesi export'uyla
// tutarlılık — servis modülünde iki farklı Excel kütüphanesi olmasın, rule 6).
//
// 🔴 LİMİT: Bu export LİMİTSİZDİR. Ekranın KAYIT_LIMIT=200 kırpması bir SUNUM
// kararıdır (sorgular zaten `take` olmadan çalışıyor, kırpma DB'den sonra
// yapılıyor — yani limit sunucuda hiçbir şey tasarruf etmez). Buradaki
// EXCEL_SATIR_TAVANI bir kırpma politikası DEĞİL, bellek güvenlik tavanıdır;
// çarpılırsa Özet sayfasında "KIRPILDI" yazılır, sessiz kalınmaz.
//
// 🔴 KVKK: Personnel alanları YALNIZ id/sicilNo/adSoyad/bolum. Telefon, adres
// ve e-posta bu dosyada YOKTUR ve EKLENMEYECEKTİR. Madde 29'un firma listesi
// telefon içeriyordu — o AYRI bir amaç (acil iletişim), burada emsal DEĞİL.
//
// Audit izi BİLEREK YOK: veri yüzeyi ekranla birebir aynı ve audit-log.ts'e
// 'SERVIS' hedef tipini ekleme işi madde 49 dalında duruyor; burada
// tekrarlanırsa birleştirmede çakışır.

import * as XLSX from 'xlsx'

/** Kontrol başına ÜRETİLEN SATIR tavanı (düzleştirme SONRASI). Kırpma
 *  politikası değil, bellek güvenlik sınırı — bkz. dosya başlığı. */
export const EXCEL_SATIR_TAVANI = 50_000

/** Excel sayfa adı üst sınırı (biçimin kendi kuralı). */
export const SAYFA_ADI_MAX = 31

/** Excel'in sayfa adında kabul etmediği karakterler. */
const YASAKLI_SAYFA_KARAKTERLERI = /[:\\/?*[\]]/g

/**
 * Girdi satırı — `/api/servis-yonetimi/veri-kalite` yanıtındaki `data[]` ile
 * AYNI yapı. O tipler route.ts içinde tanımlı ve Next.js route dosyaları
 * yalnız HTTP metodu/config export edebildiği için oradan import EDİLEMEZ
 * (KAYIT_LIMIT'in export edilememesiyle aynı kısıt) — yapısal olarak burada
 * yeniden tarif ediliyor.
 */
export interface VeriKaliteExcelSatiri {
  kod: string
  baslik: string
  adet: number
  kayitlar: Record<string, unknown>[]
  /** Girdi zaten kırpılmış geldiyse (ekran yanıtı) true olur. */
  kirpildi?: boolean
  /** Henüz uygulanamayan kontrol (veri kaynağı yok). */
  kapsamDisi?: boolean
  not?: string
  /** Kontrol çalışırken hata aldıysa (veri-kalite.ts allSettled deseni). */
  hata?: string
}

// ----------------------------------------------------------------------------
// Biçimlendirme
// ----------------------------------------------------------------------------

/**
 * 🔴 TÜM tarihler YYYY-MM-DD METİN. Yerel biçim belirsizliği (gg.aa.yyyy vs
 * aa/gg/yyyy) istenmiyor; Excel'in kendi tarih tipine de bırakılmıyor.
 *
 * Değer hem `Date` (fonksiyon doğrudan çağrıldığında) hem ISO `string`
 * (yanıt JSON'dan geçtiğinde) olabilir — ikisi de karşılanır. Date'ler
 * `@db.Date` olduğu için UTC gece yarısıdır; yerel saat kullanmak günü
 * kaydırabileceğinden UTC üzerinden okunur.
 */
export function tarihMetni(deger: unknown): string {
  if (deger === null || deger === undefined || deger === '') return ''
  if (deger instanceof Date) {
    if (Number.isNaN(deger.getTime())) return ''
    return deger.toISOString().slice(0, 10)
  }
  if (typeof deger === 'string') {
    // "2026-09-23" veya "2026-09-23T00:00:00.000Z"
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(deger)
    return m ? m[1] : deger
  }
  return String(deger)
}

/** Boş/haber vermeyen değerleri tek bir sunuma indirger. */
function metin(deger: unknown): string {
  if (deger === null || deger === undefined) return ''
  if (typeof deger === 'boolean') return deger ? 'Evet' : 'Hayır'
  return String(deger)
}

function sayi(deger: unknown): number | string {
  return typeof deger === 'number' ? deger : metin(deger)
}

// ----------------------------------------------------------------------------
// Sayfa adları
// ----------------------------------------------------------------------------

/**
 * Kontrol kodu → kısa Türkçe sayfa adı. Kodların kendisi sınırın üstünde
 * (ör. `adres-degismis-servis-yeniden-degerlendirilmemis` 48 karakter), o
 * yüzden doğrudan kullanılamaz.
 */
const SAYFA_ADLARI: Record<string, string> = {
  'aktif-personel-servis-yok': 'Personel Var Servis Yok',
  'pasif-personel-servis-aktif': 'Pasif Personel Servis Aktif',
  'mukerrer-aktif-servis': 'Mükerrer Aktif Servis',
  'servis-var-arac-yok': 'Araç Yok',
  'servis-var-sofor-yok': 'Sürücü Yok',
  'guzergah-sefer-dilimi-tanimsiz': 'Sefer Dilimi Tanımsız',
  'kapasitesi-eksik-arac': 'Kapasitesi Eksik Araç',
  'koordinatsiz-durak': 'Koordinatsız Durak',
  'cakisan-atamalar': 'Çakışan Atamalar',
  'suresi-bitmis-gecici-atama': 'Süresi Bitmiş Atama',
  'tarih-cakismasi-arac-sofor': 'Tarih Çakışması',
  'aktif-arac-pasif-firma': 'Aktif Araç Pasif Firma',
  'dis-firma-soforu-firmasiz': 'Dış Firma Sürücüsü',
}

/**
 * Bir adı Excel'in sayfa adı kurallarına uydurur: yasaklı karakterler atılır,
 * 31 karaktere kırpılır. TEKİLLİK `sayfaAdiUret` tarafından sağlanır.
 */
function sayfaAdiTemizle(ham: string): string {
  const temiz = ham.replace(YASAKLI_SAYFA_KARAKTERLERI, ' ').replace(/\s+/g, ' ').trim()
  return (temiz || 'Sayfa').slice(0, SAYFA_ADI_MAX)
}

/**
 * Sayfa adı üretir ve kullanılmış adlar kümesine yazar.
 *
 * Haritada olmayan bir kod için `baslik`ten türetir — bilerek HATA FIRLATMAZ:
 * veri-kalite.ts'e yeni bir kontrol eklendiğinde bu dosya güncellenmemişse
 * tüm export'un çökmesi, o kontrolün otomatik bir adla çıkmasından daha kötü.
 * Çakışma olursa sonuna sayı eklenir; sınır yine 31'de tutulur.
 */
function sayfaAdiUret(satir: VeriKaliteExcelSatiri, kullanilan: Set<string>): string {
  const temel = sayfaAdiTemizle(SAYFA_ADLARI[satir.kod] ?? satir.baslik ?? satir.kod)
  if (!kullanilan.has(temel)) {
    kullanilan.add(temel)
    return temel
  }
  for (let i = 2; i < 1000; i++) {
    const ek = ` (${i})`
    const aday = temel.slice(0, SAYFA_ADI_MAX - ek.length) + ek
    if (!kullanilan.has(aday)) {
      kullanilan.add(aday)
      return aday
    }
  }
  /* c8 ignore next 2 */
  kullanilan.add(temel)
  return temel
}

// ----------------------------------------------------------------------------
// Kolon tanımları ve düzleştirme
// ----------------------------------------------------------------------------

type Kolon = { baslik: string; deger: (kayit: Record<string, unknown>) => string | number }

/** Bir kaydın 1+ satıra açılması (iç içe diziler için). */
type Duzlestirici = (kayit: Record<string, unknown>) => Record<string, unknown>[]

type SayfaTanimi = { kolonlar: Kolon[]; duzlestir?: Duzlestirici }

const PERSONEL_KOLONLARI: Kolon[] = [
  { baslik: 'Sicil No', deger: k => metin(k.sicilNo) },
  { baslik: 'Ad Soyad', deger: k => metin(k.adSoyad) },
  { baslik: 'Bölüm', deger: k => metin(k.bolum) },
]

const EKSIK_VARSAYILAN_KOLONLARI: Kolon[] = [
  { baslik: 'Güzergah Kod', deger: k => metin(k.guzergahKod) },
  { baslik: 'Güzergah Ad', deger: k => metin(k.guzergahAd) },
  { baslik: 'Dilim Kod', deger: k => metin(k.dilimKod) },
  { baslik: 'Dilim Ad', deger: k => metin(k.dilimAd) },
  { baslik: 'Etkilenen Personel Sayısı', deger: k => sayi(k.etkilenenPersonelSayisi) },
]

/** `atama1`/`atama2` gibi iç nesnelerden alan okur. */
function ic(kayit: Record<string, unknown>, nesne: string, alan: string): unknown {
  const n = kayit[nesne]
  if (n && typeof n === 'object') return (n as Record<string, unknown>)[alan]
  return undefined
}

function ciftKolonlari(etiket1: string, etiket2: string): Kolon[] {
  return [
    { baslik: `${etiket1} Güzergah`, deger: k => metin(ic(k, 'atama1', 'guzergahKod')) },
    { baslik: `${etiket1} Başlangıç`, deger: k => tarihMetni(ic(k, 'atama1', 'baslangicTarihi')) },
    { baslik: `${etiket1} Bitiş`, deger: k => tarihMetni(ic(k, 'atama1', 'bitisTarihi')) },
    { baslik: `${etiket2} Güzergah`, deger: k => metin(ic(k, 'atama2', 'guzergahKod')) },
    { baslik: `${etiket2} Başlangıç`, deger: k => tarihMetni(ic(k, 'atama2', 'baslangicTarihi')) },
    { baslik: `${etiket2} Bitiş`, deger: k => tarihMetni(ic(k, 'atama2', 'bitisTarihi')) },
  ]
}

/** İç içe diziden türeyen sayfalar — satır sayısı kayıt sayısından FAZLA olur. */
const ICICE_KODLAR = new Set(['mukerrer-aktif-servis', 'cakisan-atamalar'])

const SAYFA_TANIMLARI: Record<string, SayfaTanimi> = {
  'aktif-personel-servis-yok': { kolonlar: PERSONEL_KOLONLARI },
  'pasif-personel-servis-aktif': { kolonlar: PERSONEL_KOLONLARI },

  // Düzleştirme: her ATAMA ayrı satır, personel kimliği tekrar edilir.
  'mukerrer-aktif-servis': {
    duzlestir: k => {
      const atamalar = Array.isArray(k.atamalar) ? (k.atamalar as Record<string, unknown>[]) : []
      if (atamalar.length === 0) return [{ ...k, atama: {} }]
      return atamalar.map(a => ({ ...k, atama: a }))
    },
    kolonlar: [
      ...PERSONEL_KOLONLARI,
      { baslik: 'Aktif Atama Sayısı', deger: k => sayi(k.aktifAtamaSayisi) },
      { baslik: 'Güzergah Kod', deger: k => metin(ic(k, 'atama', 'guzergahKod')) },
      { baslik: 'Güzergah Ad', deger: k => metin(ic(k, 'atama', 'guzergahAd')) },
      { baslik: 'Başlangıç', deger: k => tarihMetni(ic(k, 'atama', 'baslangicTarihi')) },
      { baslik: 'Bitiş', deger: k => tarihMetni(ic(k, 'atama', 'bitisTarihi')) },
    ],
  },

  'servis-var-arac-yok': { kolonlar: EKSIK_VARSAYILAN_KOLONLARI },
  'servis-var-sofor-yok': { kolonlar: EKSIK_VARSAYILAN_KOLONLARI },

  'guzergah-sefer-dilimi-tanimsiz': {
    kolonlar: [
      { baslik: 'Güzergah Kod', deger: k => metin(k.guzergahKod) },
      { baslik: 'Güzergah Ad', deger: k => metin(k.guzergahAd) },
    ],
  },

  'kapasitesi-eksik-arac': {
    kolonlar: [
      { baslik: 'Plaka', deger: k => metin(k.plaka) },
      { baslik: 'Kapasite', deger: k => sayi(k.kapasite) },
      { baslik: 'Firma', deger: k => metin(k.firmaAd) },
    ],
  },

  'koordinatsiz-durak': {
    kolonlar: [
      { baslik: 'Durak Kod', deger: k => metin(k.kod) },
      { baslik: 'Durak Ad', deger: k => metin(k.ad) },
      { baslik: 'İl', deger: k => metin(k.il) },
      { baslik: 'İlçe', deger: k => metin(k.ilce) },
      { baslik: 'Aktif', deger: k => metin(k.aktif) },
      { baslik: 'Aktif Güzergaha Bağlı', deger: k => metin(k.aktifGuzergahaBagli) },
    ],
  },

  // Düzleştirme: her ÇAKIŞAN ÇİFT ayrı satır, personel kimliği tekrar edilir.
  'cakisan-atamalar': {
    duzlestir: k => {
      const ciftler = Array.isArray(k.ciftler) ? (k.ciftler as Record<string, unknown>[]) : []
      if (ciftler.length === 0) return [{ ...k }]
      return ciftler.map(c => ({ ...k, ...c }))
    },
    kolonlar: [
      ...PERSONEL_KOLONLARI,
      { baslik: 'Çakışan Çift Sayısı', deger: k => sayi(k.cakisanCiftSayisi) },
      ...ciftKolonlari('Atama 1', 'Atama 2'),
    ],
  },

  'suresi-bitmis-gecici-atama': {
    kolonlar: [
      ...PERSONEL_KOLONLARI,
      { baslik: 'Güzergah Kod', deger: k => metin(k.guzergahKod) },
      { baslik: 'Güzergah Ad', deger: k => metin(k.guzergahAd) },
      { baslik: 'Başlangıç', deger: k => tarihMetni(k.baslangicTarihi) },
      { baslik: 'Bitiş', deger: k => tarihMetni(k.bitisTarihi) },
    ],
  },

  // 🔴 TEK "Kaynak" kolonu: aracPlaka ve soforAdSoyad birbirini dışlıyor,
  // iki ayrı kolon açılsaydı her satırda biri HEP boş kalırdı.
  'tarih-cakismasi-arac-sofor': {
    kolonlar: [
      { baslik: 'Tür', deger: k => (k.tur === 'ARAC' ? 'ARAÇ' : k.tur === 'SOFOR' ? 'ŞOFÖR' : metin(k.tur)) },
      { baslik: 'Kaynak (Plaka / Sürücü)', deger: k => metin(k.aracPlaka ?? k.soforAdSoyad) },
      { baslik: 'Dilim Kod', deger: k => metin(k.dilimKod) },
      ...ciftKolonlari('Atama 1', 'Atama 2'),
    ],
  },

  'aktif-arac-pasif-firma': {
    kolonlar: [
      { baslik: 'Plaka', deger: k => metin(k.plaka) },
      { baslik: 'Pasif Firma', deger: k => metin(k.firmaAd) },
    ],
  },

  'dis-firma-soforu-firmasiz': {
    kolonlar: [
      { baslik: 'Ad Soyad', deger: k => metin(k.adSoyad) },
      { baslik: 'Dış Firma Sürücü Kodu', deger: k => metin(k.disFirmaSoforKodu) },
    ],
  },
}

/**
 * Haritada tanımı olmayan kod için genel çözüm: kayıtların ilkel (nesne/dizi
 * olmayan) alanlarından kolon üretir. `id` alanları atlanır — dosyada işe
 * yaramaz, KVKK açısından da gereksiz.
 */
function genelTanimUret(kayitlar: Record<string, unknown>[]): SayfaTanimi {
  const alanlar: string[] = []
  for (const kayit of kayitlar) {
    for (const [ad, deger] of Object.entries(kayit)) {
      if (alanlar.includes(ad)) continue
      if (ad === 'id' || ad.endsWith('Id')) continue
      if (deger !== null && typeof deger === 'object') continue
      alanlar.push(ad)
    }
  }
  return { kolonlar: alanlar.map(ad => ({ baslik: ad, deger: k => metin(k[ad]) })) }
}

/**
 * Bir kontrolün kayıtlarını Excel satırlarına (başlık dahil) çevirir.
 * Tavana çarpılırsa `kirpildi: true` döner.
 */
export function kontrolSatirlariOlustur(satir: VeriKaliteExcelSatiri): {
  satirlar: (string | number)[][]
  veriSatirSayisi: number
  kirpildi: boolean
} {
  const tanim = SAYFA_TANIMLARI[satir.kod] ?? genelTanimUret(satir.kayitlar)

  const duzlesmis: Record<string, unknown>[] = []
  let kirpildi = false
  for (const kayit of satir.kayitlar) {
    const parcalar = tanim.duzlestir ? tanim.duzlestir(kayit) : [kayit]
    for (const parca of parcalar) {
      if (duzlesmis.length >= EXCEL_SATIR_TAVANI) {
        kirpildi = true
        break
      }
      duzlesmis.push(parca)
    }
    if (kirpildi) break
  }

  const basliklar = tanim.kolonlar.map(k => k.baslik)
  const govde = duzlesmis.map(kayit => tanim.kolonlar.map(k => k.deger(kayit)))

  return { satirlar: [basliklar, ...govde], veriSatirSayisi: duzlesmis.length, kirpildi }
}

// ----------------------------------------------------------------------------
// Özet
// ----------------------------------------------------------------------------

export const KAPSAM_DISI_METNI = 'KAPSAM DIŞI — henüz uygulanmadı'
export const KIRPILDI_METNI = 'KIRPILDI'

const ICICE_NOTU = 'Satır sayısı kayıt sayısından FAZLADIR — her atama/çift ayrı satırdır.'

export const OZET_BASLIKLARI = ['Kod', 'Kontrol', 'Adet', 'Satır', 'Durum', 'Not'] as const

/** Özet sayfasının tek bir satırı. Durum/adet kuralları burada, tek yerde. */
function ozetSatiriOlustur(
  satir: VeriKaliteExcelSatiri,
  veriSatirSayisi: number | null,
  kirpildi: boolean,
): (string | number)[] {
  // 🔴 Yer tutucular: adet hücresine 0 YAZILMAZ — "0 anomali bulundu" ile
  // "bu kontrol henüz yapılamıyor" karıştırılmamalı.
  if (satir.kapsamDisi) {
    return [satir.kod, satir.baslik, '', '', KAPSAM_DISI_METNI, satir.not ?? '']
  }

  const notlar: string[] = []
  if (ICICE_KODLAR.has(satir.kod)) notlar.push(ICICE_NOTU)
  if (satir.not) notlar.push(satir.not)

  let durum: string
  if (satir.hata) {
    durum = `HATA: ${satir.hata}`
  } else if (kirpildi || satir.kirpildi) {
    // İki sebep de aynı anlama gelir: dosya eksiktir.
    durum = KIRPILDI_METNI
    notlar.push(
      kirpildi
        ? `Kontrol başına ${EXCEL_SATIR_TAVANI} satır güvenlik tavanına ulaşıldı.`
        : 'Girdi zaten kırpılmış geldi (ekran limiti).',
    )
  } else if (satir.adet === 0) {
    durum = 'Temiz'
  } else {
    durum = 'Kayıt var'
  }

  return [satir.kod, satir.baslik, satir.adet, veriSatirSayisi ?? '', durum, notlar.join(' ')]
}

// ----------------------------------------------------------------------------
// Ana fonksiyon
// ----------------------------------------------------------------------------

/**
 * Veri kalite raporundan Excel dosyası üretir.
 *
 * Sayfa yapısı:
 *   1) "Özet" — HER kontrol (yer tutucular dahil) listelenir.
 *   2) Kaydı OLAN her kontrol için ayrı sayfa. Kaydı olmayan için sayfa
 *      AÇILMAZ — Özet'te zaten görünüyor, boş sayfa gürültüdür.
 */
export function veriKaliteExcelOlustur(sonuclar: VeriKaliteExcelSatiri[]): Buffer {
  const wb = XLSX.utils.book_new()
  const kullanilanSayfaAdlari = new Set<string>(['Özet'])
  const ozetSatirlari: (string | number)[][] = [[...OZET_BASLIKLARI]]
  const veriSayfalari: { ad: string; satirlar: (string | number)[][] }[] = []

  for (const satir of sonuclar) {
    if (satir.kapsamDisi || satir.kayitlar.length === 0) {
      ozetSatirlari.push(ozetSatiriOlustur(satir, satir.kapsamDisi ? null : 0, false))
      continue
    }

    const { satirlar, veriSatirSayisi, kirpildi } = kontrolSatirlariOlustur(satir)
    ozetSatirlari.push(ozetSatiriOlustur(satir, veriSatirSayisi, kirpildi))
    veriSayfalari.push({ ad: sayfaAdiUret(satir, kullanilanSayfaAdlari), satirlar })
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ozetSatirlari), 'Özet')
  for (const sayfa of veriSayfalari) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sayfa.satirlar), sayfa.ad)
  }

  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer
}

/** Dosya adı — tarih YYYY-MM-DD (ISO), tıpkı hücrelerdeki gibi. */
export function veriKaliteExcelDosyaAdi(now = new Date()): string {
  return `Veri-Kalite-Raporu-${now.toISOString().slice(0, 10)}.xlsx`
}
