/**
 * RMA/SMA Excel export/import — ortak sabitler ve yardımcılar (KAL-KYT-16, PR-3).
 *
 * Kütüphane: xlsx (SheetJS) — portalda baskın kütüphane (~35 dosya; exceljs yalnız 1).
 * Import okuma/limit/hata deseni toplu-kart-okutamama/import route'undan alındı
 * (MAX_SATIR=500, 2MB, {row,message}[], .xlsx uzantı kapısı).
 */
import { RmaTip, RmaIadeTuru, RmaKarar } from '@/generated/prisma'
import {
  RMA_TIP_LABELS,
  RMA_IADE_TURU_LABELS,
  RMA_KARAR_LABELS,
} from '@/lib/quality/rma-labels'

// Import limitleri — toplu-kart-okutamama/import ile birebir aynı.
export const MAX_SATIR = 500
export const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

// ── Import kolon başlıkları (başlık satırı zorunlu, sıra önemsiz, isimle eşleşir) ──
export const IMPORT_COLS = {
  grup: 'GRUP',
  tip: 'TİP',
  urunGelisTarihi: 'ÜRÜN GELİŞ TARİHİ',
  irsaliyeTarihi: 'İRSALİYE TARİHİ',
  irsaliyeNo: 'İRSALİYE NO',
  musteriKodu: 'MÜŞTERİ KODU',
  iadeTuru: 'İADE TÜRÜ',
  sorumluSicilNo: 'SORUMLU SİCİL NO',
  termin: 'TERMİN',
  urunKodu: 'ÜRÜN KODU',
  lotNo: 'LOT NO',
  iadeMiktari: 'İADE MİKTARI',
  musteriIadeSebebi: 'MÜŞTERİ İADE SEBEBİ',
  ilkIncelemeSonucu: 'İLK İNCELEME SONUCU',
  karar: 'KARAR',
  kararAciklama: 'KARAR AÇIKLAMASI',
  hurdaAdedi: 'HURDA ADEDİ',
  reworkAdedi: 'REWORK ADEDİ',
  kokNeden: 'KÖK NEDEN',
  aksiyon: 'AKSİYON',
} as const

// ── Export kolon sırası (kayıt bilgileri her satırda tekrar eder — Excel orijinal düzeni) ──
export const EXPORT_HEADERS = [
  'TİP',
  'NO',
  'ÜRÜN GELİŞ TARİHİ',
  'İRSALİYE TARİHİ',
  'İRSALİYE NO',
  'MÜŞTERİ KODU',
  'MÜŞTERİ',
  'İADE TÜRÜ',
  'SORUMLU',
  'TERMİN',
  'KAPANIŞ TARİHİ',
  'MALİYET',
  'DURUM',
  'SIRA',
  'ÜRÜN KODU',
  'LOT NO',
  'İADE MİKTARI',
  'MÜŞTERİ İADE SEBEBİ',
  'İLK İNCELEME SONUCU',
  'KARAR',
  'KARAR AÇIKLAMASI',
  'HURDA ADEDİ',
  'REWORK ADEDİ',
  'KÖK NEDEN',
  'AKSİYON',
] as const

/** Türkçe karakter normalizasyonu — iso27001/assets/import ve toplu-kart deseni. */
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
    .trim()
}

/** Türkçe etiket → enum key eşleme tablosu (normalize edilmiş anahtarla). */
function buildLabelToKey<T extends string>(labels: Record<T, string>): Map<string, T> {
  const m = new Map<string, T>()
  for (const key of Object.keys(labels) as T[]) {
    m.set(trNormalize(labels[key]), key) // Türkçe etikete göre
    m.set(trNormalize(key), key) // enum key'inin kendisine göre (esneklik)
  }
  return m
}

const TIP_MAP = buildLabelToKey(RMA_TIP_LABELS)
const IADE_TURU_MAP = buildLabelToKey(RMA_IADE_TURU_LABELS)
// GERİYE UYUM: "Garanti" → "Müşteri Şikayeti" yeniden adlandırıldı (20260907120000).
// Elde dolaşan eski şablonlar/dosyalar "Garanti" (ya da "GARANTI") yazıyor; etiket
// haritası artık bunu tanımadığı için import "Tanınmayan İADE TÜRÜ" verirdi.
// trNormalize her iki yazımı da aynı anahtara indirger → tek satır yeter.
IADE_TURU_MAP.set(trNormalize('Garanti'), RmaIadeTuru.MUSTERI_SIKAYETI)
const KARAR_MAP = buildLabelToKey(RMA_KARAR_LABELS)

export const TIP_GECERLI_DEGERLER = Object.values(RMA_TIP_LABELS).join(', ')
export const IADE_TURU_GECERLI_DEGERLER = Object.values(RMA_IADE_TURU_LABELS).join(', ')
export const KARAR_GECERLI_DEGERLER = Object.values(RMA_KARAR_LABELS).join(', ')

export function parseTip(v: string): RmaTip | undefined {
  return TIP_MAP.get(trNormalize(v))
}
export function parseIadeTuru(v: string): RmaIadeTuru | undefined {
  return IADE_TURU_MAP.get(trNormalize(v))
}
export function parseKarar(v: string): RmaKarar | undefined {
  return KARAR_MAP.get(trNormalize(v))
}

/**
 * Excel hücresinden tarih — toplu-kart-okutamama parseExcelDate deseni.
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
