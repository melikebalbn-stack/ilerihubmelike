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

/** Dosyadaki kolonlar — `alan` anahtarları satirlar[] ile birebir aynıdır. */
export const SIKAYET_EXPORT_KOLONLARI = [
  { alan: 'no', baslik: 'No' },
  { alan: 'bildirimTarihi', baslik: 'Bildirim Tarihi', bicim: 'gg.aa.yyyy' as const },
  { alan: 'olayTarihi', baslik: 'Olay Tarihi', bicim: 'gg.aa.yyyy' as const },
  { alan: 'firmaAd', baslik: 'Firma' },
  { alan: 'guzergah', baslik: 'Güzergâh' },
  { alan: 'durak', baslik: 'Durak' },
  { alan: 'plaka', baslik: 'Plaka' },
  { alan: 'soforAdSoyad', baslik: 'Sürücü' },
  { alan: 'planlananSaat', baslik: 'Planlanan Saat' },
  { alan: 'kategori', baslik: 'Kategori' },
  { alan: 'kaynak', baslik: 'Kaynak' },
  { alan: 'durum', baslik: 'Durum' },
  { alan: 'aciklama', baslik: 'Açıklama' },
  { alan: 'aksiyon', baslik: 'Aksiyon' },
  { alan: 'aksiyonTarihi', baslik: 'Aksiyon Tarihi', bicim: 'gg.aa.yyyy' as const },
  { alan: 'termin', baslik: 'Termin', bicim: 'gg.aa.yyyy' as const },
  { alan: 'kapanisTarihi', baslik: 'Kapanış Tarihi', bicim: 'gg.aa.yyyy' as const },
  { alan: 'kapanisNotu', baslik: 'Kapanış Notu' },
  { alan: 'sorumluAdSoyad', baslik: 'İV Sorumlusu' },
] as const

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
