import * as XLSX from 'xlsx'

export const CATEGORY_LABELS: Record<string, string> = {
  GENEL: 'Genel',
  SISTEM_GELISTIRME: 'Sistem Geliştirme',
}

export const EXPORT_HEADERS = [
  'Tarih',
  'Firma',
  'Fatura No',
  'Tutar',
  'Para Birimi',
  'TL Karşılığı',
  '€ Karşılığı',
  'Kategori',
  'Not',
] as const

export function categoryToLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

export function labelToCategory(value: unknown): 'GENEL' | 'SISTEM_GELISTIRME' {
  const v = (value ?? '').toString().trim().toLocaleUpperCase('tr-TR')
  if (v.includes('SISTEM') || v.includes('SİSTEM')) return 'SISTEM_GELISTIRME'
  return 'GENEL'
}

export function labelToCurrency(value: unknown): 'TRY' | 'USD' | 'EUR' {
  const v = (value ?? '').toString().trim().toUpperCase()
  if (v === 'USD' || v === '$') return 'USD'
  if (v === 'EUR' || v === '€') return 'EUR'
  return 'TRY'
}

/** Excel serial tarih, Date objesi veya "YYYY-MM-DD" / "DD.MM.YYYY" string'ini normalize eder */
export function parseExcelDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
    return d.toISOString().slice(0, 10)
  }

  const str = value.toString().trim()
  // DD.MM.YYYY
  const trMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (trMatch) {
    const [, dd, mm, yyyy] = trMatch
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10)

  const parsed = new Date(str)
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

export function parseExcelAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value
  const cleaned = value.toString().trim().replace(/\./g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}
