/**
 * Rapor hücre biçimlendirme — tr-TR (binlik nokta, ondalık virgül), gg.aa.yyyy.
 * null/undefined → boş metin (tire değil).
 */
import type { Bicim } from './tipler'

const NF: Record<string, Intl.NumberFormat> = {
  '0': new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }),
  '2': new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  '1': new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  'auto': new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }),
}

export function sayiMi(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'bigint') return true
  if (typeof v === 'object' && v !== null && typeof (v as { toNumber?: unknown }).toNumber === 'function') return true // Prisma Decimal
  return false
}

export function tarihMi(v: unknown): boolean {
  if (v instanceof Date) return !Number.isNaN(v.getTime())
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(v) && !Number.isNaN(new Date(v).getTime())
}

function sayiya(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'string') { const n = Number(v.trim()); return v.trim() && Number.isFinite(n) ? n : null }
  if (typeof v === 'object' && typeof (v as { toNumber?: unknown }).toNumber === 'function') {
    const n = (v as { toNumber: () => number }).toNumber(); return Number.isFinite(n) ? n : null
  }
  return null
}

function tarihe(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (typeof v === 'string' && v.trim()) { const d = new Date(v.trim()); return Number.isNaN(d.getTime()) ? null : d }
  return null
}

const iki = (n: number) => String(n).padStart(2, '0')
export const tarihMetni = (d: Date) => `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}`
export const tarihSaatMetni = (d: Date) => `${tarihMetni(d)} ${iki(d.getHours())}:${iki(d.getMinutes())}`

/** Değeri verilen biçimle metne çevirir. Biçim yoksa tipe göre makul varsayılan. */
export function bicimle(v: unknown, bicim?: Bicim): string {
  if (v === null || v === undefined) return ''
  switch (bicim) {
    case '#.##0': { const n = sayiya(v); return n === null ? String(v) : NF['0'].format(n) }
    case '#.##0,00': { const n = sayiya(v); return n === null ? String(v) : NF['2'].format(n) }
    case '%0,0': { const n = sayiya(v); return n === null ? String(v) : `%${NF['1'].format(n)}` } // değer zaten yüzde
    case '%0,00': { const n = sayiya(v); return n === null ? String(v) : `%${NF['2'].format(n)}` }
    case 'gg.aa.yyyy': { const d = tarihe(v); return d ? tarihMetni(d) : String(v) }
    case 'gg.aa.yyyy ss:dd': { const d = tarihe(v); return d ? tarihSaatMetni(d) : String(v) }
    case 'metin': return v instanceof Date ? tarihMetni(v) : String(v)
    default: {
      if (typeof v === 'boolean') return v ? 'Evet' : 'Hayır'
      if (v instanceof Date) return tarihMetni(v)
      if (sayiMi(v)) return NF['auto'].format(sayiya(v) ?? 0)
      return String(v)
    }
  }
}
