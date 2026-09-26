// ============================================================================
// MASTER Madde 47 — Şikâyet / firma performansı DIŞA AKTARIM (Adım 5F · Excel)
// ============================================================================
//
// SAF: DB'ye, request'e, session'a DOKUNMAZ. Girdisi FİRMA GÖRÜNÜMÜNÜN
// (sikayetFirmaListesiGetir) döndürdüğü kayıtlardır — şikâyetçi kimliği o
// select'te zaten YOKTUR; uç ayrıca sikayet-firma-siniri.ts bekçisinden
// geçirir. Bu dosya üçüncü bir "hangi alan gider" uygulaması KURMAZ, yalnız
// gelen alanları sunuma çevirir.
//
// 🔴 KÜTÜPHANE NOTU (Melih'e raporlandı): satır/kolon → xlsx dönüşümü için
// src/lib/rapor/gorunum-xlsx.ts (exceljs) YENİDEN KULLANILIYOR; yeni bir
// Excel yazıcısı yazılmadı. Bunun bedeli, servis modülüne İKİNCİ bir Excel
// kütüphanesi girmesidir: madde 29 ve madde 62 `xlsx` kullanıyor ve
// veri-kalite-excel.ts başlığında "servis modülünde iki farklı Excel
// kütüphanesi olmasın" (rule 6) diye yazılı. Karar geri alınırsa değişecek
// TEK yer uçtaki gorunumXlsx() çağrısıdır — aşağıdaki kolon tanımları,
// etiketler ve satır dönüşümü aynen kalır.
//
// 🔴 KIRPMA YOK (madde 62 kararı): bu modül `slice`/`take` uygulamaz. Ekranın
// sunum limiti varsa o ekranda kalır; dosya TAM listedir.
//
// 🔴 ORAN/YÜZDE YOK (Ders 79): şikâyet kendi kendine bildirilen veridir, kaç
// sefer yapıldığı bilinmediği için paydası yoktur. Alt toplamlar yalnız
// SAYIM'dır ('say'), oran kolonu eklenmeyecektir.

import type { Gorunum } from '@/lib/rapor/tipler'
import type { Satir } from '@/lib/rapor/gorunum'
import type { FIRMA_GORUNUMU_SELECT } from './sikayet'
import type { Prisma } from '@/generated/prisma'
import {
  SIKAYET_DURUM_ETIKETLERI,
  SIKAYET_KATEGORI_ETIKETLERI,
  SIKAYET_KAYNAK_ETIKETLERI,
} from './sikayet-durum'

/**
 * Girdi kaydı — firma görünümü select'inden TÜRETİLİR, elle yazılmaz.
 * Select'e bir alan eklenirse tip kendiliğinden genişler; elle yazılsaydı
 * sessizce eskir (Ders 58).
 */
export type SikayetFirmaKaydi = Prisma.ServisSikayetGetPayload<{
  select: typeof FIRMA_GORUNUMU_SELECT
}>

/**
 * Dışa aktarımın TEK kolon tanımı — `alan` anahtarları satirlar[] ile birebir
 * aynıdır. Excel ve PDF ikisi de BURADAN türer (rule 6): kolon listesi iki
 * yere yazılsaydı zamanla ayrışır ve aynı raporun iki biçimi farklı veri
 * gösterirdi.
 *
 * `pdf` bayrağı: PDF A4 YATAY bir tabloya sığmak zorunda. 19 kolon okunaksız
 * olurdu, bu yüzden PDF tablosu daraltılmış bir ALT KÜME gösterir. Ayıklama
 * gizli değil, burada AÇIKÇA işaretli ve testle sabit — "PDF'te neden yok"
 * sorusunun cevabı tek satırda görünür. Excel her zaman TAM listedir.
 */
export const SIKAYET_EXPORT_KOLONLARI = [
  { alan: 'no', baslik: 'No', pdf: true, pdfGenislik: 10 },
  { alan: 'bildirimTarihi', baslik: 'Bildirim Tarihi', bicim: 'gg.aa.yyyy' as const, pdf: true, pdfGenislik: 22 },
  { alan: 'olayTarihi', baslik: 'Olay Tarihi', bicim: 'gg.aa.yyyy' as const, pdf: false },
  { alan: 'firmaAd', baslik: 'Firma', pdf: false }, // PDF'te grup başlığı
  { alan: 'guzergah', baslik: 'Güzergâh', pdf: true, pdfGenislik: 35 },
  { alan: 'durak', baslik: 'Durak', pdf: true, pdfGenislik: 32 },
  { alan: 'plaka', baslik: 'Plaka', pdf: true, pdfGenislik: 24 },
  { alan: 'soforAdSoyad', baslik: 'Sürücü', pdf: true, pdfGenislik: 30 },
  { alan: 'planlananSaat', baslik: 'Planlanan Saat', pdf: false },
  { alan: 'kategori', baslik: 'Kategori', pdf: true, pdfGenislik: 30 },
  { alan: 'kaynak', baslik: 'Kaynak', pdf: false },
  { alan: 'durum', baslik: 'Durum', pdf: true, pdfGenislik: 24 },
  { alan: 'aciklama', baslik: 'Açıklama', pdf: true }, // kalan genişlik
  { alan: 'aksiyon', baslik: 'Aksiyon', pdf: true },   // kalan genişlik
  { alan: 'aksiyonTarihi', baslik: 'Aksiyon Tarihi', bicim: 'gg.aa.yyyy' as const, pdf: false },
  { alan: 'termin', baslik: 'Termin', bicim: 'gg.aa.yyyy' as const, pdf: false },
  { alan: 'kapanisTarihi', baslik: 'Kapanış Tarihi', bicim: 'gg.aa.yyyy' as const, pdf: true, pdfGenislik: 22 },
  { alan: 'kapanisNotu', baslik: 'Kapanış Notu', pdf: false },
  { alan: 'sorumluAdSoyad', baslik: 'İV Sorumlusu', pdf: false },
] as const

/** PDF tablosunun kolonları — üstteki tek tanımdan TÜRETİLİR, elle yazılmaz. */
export const SIKAYET_PDF_KOLONLARI = SIKAYET_EXPORT_KOLONLARI.filter(k => k.pdf)

/**
 * Dosyanın görünümü: firmaya göre gruplanır, her grubun altında KAYIT SAYISI
 * yazar ('say' — toplam/ortalama değil, çünkü sayılacak tek şey adet).
 *
 * `filtreler` BOŞ: süzme sorgu katmanında (sikayetWhereOlustur) yapılır;
 * burada ikinci bir süzgeç olsaydı ekranla dosya ayrışırdı.
 */
export const SIKAYET_EXPORT_GORUNUMU: Gorunum = {
  kolonlar: SIKAYET_EXPORT_KOLONLARI.map(k => ({
    alan: k.alan,
    baslik: k.baslik,
    gorunur: true,
    // Yalnız "No" kolonunda alt toplam: grup başına KAÇ ŞİKÂYET.
    ...(k.alan === 'no' ? { toplam: 'say' as const } : {}),
    ...('bicim' in k ? { bicim: k.bicim } : {}),
  })),
  gruplar: ['firmaAd'],
  siralama: null,
  filtreler: {},
  grafik: null,
}

/** Güzergâh "KOD — Ad"; kayıtta güzergâh yoksa boş. */
function guzergahMetni(guzergah: SikayetFirmaKaydi['guzergah']): string {
  if (!guzergah) return ''
  return guzergah.kod ? `${guzergah.kod} — ${guzergah.ad}` : guzergah.ad
}

/** Durak "KOD — Ad"; kod yoksa yalnız ad. */
function durakMetni(durak: SikayetFirmaKaydi['durak']): string {
  if (!durak) return ''
  return durak.kod ? `${durak.kod} — ${durak.ad}` : durak.ad
}

/**
 * Firma görünümü kayıtlarını dosya satırlarına çevirir.
 *
 * 🔴 Ham ID KOLONU YOK: guzergahId/dilimId/aracId/soforId/firmaId/durakId
 * dosyaya YAZILMAZ — firma için okunaksız UUID'lerdir. Bunların insan
 * okunur karşılığı zaten firmaAd / plaka / soforAdSoyad / durak alanlarıdır.
 *
 * Güzergâh ve durak, ORTAK_SELECT'teki ilişkilerden "KOD — Ad" olarak
 * yazılır; ham ID'lerinin dosyada karşılığı yoktur.
 */
export function sikayetExcelSatirlari(kayitlar: SikayetFirmaKaydi[]): Satir[] {
  return kayitlar.map(k => ({
    no: k.no,
    bildirimTarihi: k.bildirimTarihi,
    olayTarihi: k.tarih,
    firmaAd: k.firmaAd ?? 'Firma belirtilmemiş',
    guzergah: guzergahMetni(k.guzergah),
    durak: durakMetni(k.durak),
    plaka: k.plaka ?? '',
    soforAdSoyad: k.soforAdSoyad ?? '',
    planlananSaat: k.planlananSaat ?? '',
    kategori: SIKAYET_KATEGORI_ETIKETLERI[k.kategori] ?? k.kategori,
    kaynak: SIKAYET_KAYNAK_ETIKETLERI[k.kaynak] ?? k.kaynak,
    durum: SIKAYET_DURUM_ETIKETLERI[k.durum] ?? k.durum,
    aciklama: k.aciklama ?? '',
    aksiyon: k.aksiyon ?? '',
    aksiyonTarihi: k.aksiyonTarihi,
    termin: k.termin,
    kapanisTarihi: k.kapanisTarihi,
    kapanisNotu: k.kapanisNotu ?? '',
    sorumluAdSoyad: k.sorumluAdSoyad ?? '',
  }))
}

export const SIKAYET_EXPORT_BASLIGI = 'Servis Firma Performansı — Şikâyet Kayıtları'

/**
 * Dosyanın alt başlığı. Reddedilenlerin firma performansına sayılmadığı
 * bilgisi 5E ekranında yazıyor; dosya tek başına dolaşacağı için AYNI
 * uyarı burada da bulunmalı.
 */
export const SIKAYET_EXPORT_ALT_BASLIGI =
  'Reddedilen şikâyetler firma performansına sayılmaz. Oran/yüzde yoktur: şikâyet kendi kendine bildirilen veridir, paydası bilinmez.'

/**
 * Dosya adı — 🔴 SALT ASCII. Content-Disposition latin-1 bir başlık alanıdır,
 * Türkçe karakter kodlaması bozulur (madde 62 ile aynı kural).
 */
export function sikayetExcelDosyaAdi(now = new Date()): string {
  return `Servis-Sikayet-Firma-Raporu-${now.toISOString().slice(0, 10)}.xlsx`
}
