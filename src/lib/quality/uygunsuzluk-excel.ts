/**
 * Uygunsuzluk Excel export/import — ortak sabitler ve yardımcılar (KAL-KYT-15 Bölüm 2).
 *
 * Kütüphane: xlsx (SheetJS) — rma-excel.ts ile aynı.
 * Deseni birebir izler; MODÜLE ÖZEL FARKLAR:
 *   - MAX_SATIR 1000 (RMA 500) ve 5MB: 873 satırlık geçmiş göç tek dosyada geçsin.
 *   - GRUP kolonu YOK: başlık gruplaması (tarih günü + isEmriNo + mamulUrunKodu)
 *     üçlüsünden GLOBAL olarak türetilir (satırların bitişik olması gerekmez).
 *   - Bölüm sütunları KOD ya da AD kabul eder; hata kodu sütunu yalnız KOD.
 *   - Sayfa seçimi: ?sayfa= yoksa adı salt rakam olan sekme (yıl), o da yoksa ilki.
 */
import { UygunsuzlukKarar } from '@/generated/prisma'
import { UYGUNSUZLUK_KARAR_LABELS } from '@/lib/quality/uygunsuzluk-labels'

// Import limitleri — RMA'dan FARKLI, gerekçe yukarıda.
export const MAX_SATIR = 1000
export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

// ── Import kolon başlıkları (başlık satırı zorunlu, sıra önemsiz, isimle eşleşir) ──
// Adlar GERÇEK KAL-KYT-15 dosyasının '2026' sayfasıyla birebir hizalandı.
// Dosyada olup modelde karşılığı OLMAYAN sütunlar sessizce yok sayılır:
//   RED ORANI (hesaplanır), HURDA ADEDİ (bu modelde alan yok), DURUM (kapanıştan türer).
export const IMPORT_COLS = {
  tarih: 'TARİH',
  mamulUrunKodu: 'MAMUL ÜRÜN KODU',
  yariMamulKodu: 'YARI MAMUL ÜRÜN KODU',
  malzemeAdi: 'MALZEME ADI',
  isEmriNo: 'İŞ EMRİ NO',
  isEmriAdeti: 'İŞ EMRİ ADETİ',
  redAdeti: 'RED ADETİ',
  reworkAdedi: 'REWORK ADEDİ',
  tespitEdenBolum: 'TESPİT EDEN BÖLÜM',
  olusanBolum: 'HATANIN OLUŞTUĞU BÖLÜM',
  hataKodu: 'HATA KODU',
  hataDetayi: 'HATA DETAYI',
  karar: 'KARAR',
  kokNeden: 'KÖK NEDEN',
  duzelticiFaaliyet: 'DÜZELTİCİ FAALİYET',
  sorumlu: 'SORUMLU',
  termin: 'TERMİN',
  kapanisTarihi: 'KAPANIŞ TARİHİ',
} as const

/**
 * Export kolon sırası — Excel'in ORİJİNAL düzeni. Satır bazlı düz tablo:
 * her uygunsuzluk satırı bir Excel satırı, başlık alanları tekrar eder.
 * HURDA ADEDİ sütunu YOK (bu modülde böyle bir alan yok).
 */
export const EXPORT_HEADERS = [
  'TARİH',
  'MAMUL ÜRÜN KODU',
  'YARI MAMUL ÜRÜN KODU',
  'MALZEME ADI',
  'İŞ EMRİ NO',
  'İŞ EMRİ ADETİ',
  'RED ADETİ',
  'RED ORANI',
  'REWORK ADEDİ',
  'TESPİT EDEN BÖLÜM',
  'HATANIN OLUŞTUĞU BÖLÜM',
  'HATA KODU',
  'HATA DETAYI',
  'KARAR',
  'KÖK NEDEN',
  'DÜZELTİCİ FAALİYET',
  'SORUMLU',
  'TERMİN',
  'KAPANIŞ TARİHİ',
  'DURUM',
] as const

/** RED ORANI kolonunun 0-tabanlı indeksi — hücre biçimi için. */
export const RED_ORANI_COL = EXPORT_HEADERS.indexOf('RED ORANI')

/**
 * Türkçe karakter normalizasyonu — rma-excel.ts deseni + İÇ BOŞLUK SADELEŞTİRME.
 *
 * `\s+ -> ' '` FARKI ÖNEMLİ: gerçek KAL-KYT-15 dosyasında başlıklar
 * "REWORK  ADEDİ" ve "HATA  KODU" şeklinde ÇİFT boşlukla yazılmış. Sadeleştirme
 * olmadan bu iki kolon eşleşmiyor ve — zorunlu olmadıkları için hata da vermeden —
 * sessizce boş geçiyordu. Hata kodu göçün en kritik alanı, o yüzden şart.
 */
export function trNormalize(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildLabelToKey<T extends string>(labels: Record<T, string>): Map<string, T> {
  const m = new Map<string, T>()
  for (const key of Object.keys(labels) as T[]) {
    m.set(trNormalize(labels[key]), key)
    m.set(trNormalize(key), key)
  }
  return m
}

const KARAR_MAP = buildLabelToKey(UYGUNSUZLUK_KARAR_LABELS)

export const KARAR_GECERLI_DEGERLER = Object.values(UYGUNSUZLUK_KARAR_LABELS).join(', ')

export function parseKarar(v: string): UygunsuzlukKarar | undefined {
  return KARAR_MAP.get(trNormalize(v))
}

/**
 * Excel hücresinden tarih — rma-excel.ts parseExcelDate deseni.
 * Kabul: Date | seri numarası (XLSX.SSF) | "DD.MM.YYYY" | "DD/MM/YYYY" | ISO.
 */
export function parseExcelDate(
  value: string | number | Date | undefined | null,
  ssfParse: (n: number) => { y: number; m: number; d: number } | null | undefined,
): Date | null {
  if (value === undefined || value === null || value === '') return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const parsed = ssfParse(value)
    if (!parsed) return null
    return new Date(parsed.y, parsed.m - 1, parsed.d)
  }
  const str = String(value).trim()
  const match = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (match) {
    const [, d, m, y] = match
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  const fallback = new Date(str)
  return isNaN(fallback.getTime()) ? null : fallback
}

/** Export için tarih biçimlendirme (tr-TR, boşsa ''). */
export function formatDateTR(d: Date | string | null | undefined): string {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('tr-TR')
}

/**
 * Bölüm ADI → KOD açık eşleme tablosu.
 *
 * Gerçek dosyada bölüm sütunları kod yerine AD taşıyabiliyor ve bu adlar
 * HataKodu'daki resmî adla birebir aynı olmayabiliyor. Buraya yalnız
 * KENDİLİĞİNDEN ÇÖZÜLEMEYEN adlar yazılır; anahtar trNormalize'dan geçmiş hâlidir.
 *
 * İLERİDE BÜYÜYECEK — yeni bir eşleşmeyen ad çıkarsa tek yer burası.
 */
export const BOLUM_AD_ISTISNA: Record<string, number> = {
  matkap: 400, // "Matkap punta" bölümünün kısa yazımı
  punta: 400, // aynı bölüm, diğer kısa yazım
}

/**
 * Sayfa seçimi: `?sayfa=` verilmişse o; verilmemişse adı SALT RAKAM olan
 * sayfa (ör. "2026" — yıl sekmesi); o da yoksa ilk sayfa.
 * Gerçek dosyada veri 3. sekmede ("HATA CODE ", "Sayfa1", "2026").
 */
export function sayfaSec(sheetNames: string[], istenen?: string | null): string | null {
  if (istenen) {
    const m = sheetNames.find((n) => trNormalize(n) === trNormalize(istenen))
    return m ?? null // istenen sayfa yoksa çağıran hata döndürsün
  }
  const rakam = sheetNames.find((n) => /^\d+$/.test(n.trim()))
  return rakam ?? sheetNames[0] ?? null
}

/**
 * Başlık gruplama anahtarı: tarih (gün) + iş emri no + mamul ürün kodu.
 * Tarih saat bileşeninden arındırılır — aynı günün farklı saatleri ayrı grup olmasın.
 */
export function grupAnahtari(tarih: Date, isEmriNo: string, mamulUrunKodu: string): string {
  const g = `${tarih.getFullYear()}-${tarih.getMonth() + 1}-${tarih.getDate()}`
  return `${g}|${trNormalize(isEmriNo)}|${trNormalize(mamulUrunKodu)}`
}
