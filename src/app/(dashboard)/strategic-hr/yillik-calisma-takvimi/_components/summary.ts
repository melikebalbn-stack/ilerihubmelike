import { getKayitTarihi, type YillikTakvimKaydiRow } from './types'

export interface YillikTakvimSummaryItem { key: string; label: string; value: number; color: string; text: string }

export function calculateYillikTakvimSummary(rows: YillikTakvimKaydiRow[], yil: number, now = new Date()): YillikTakvimSummaryItem[] {
  const istanbul = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: 'numeric' }).formatToParts(now)
  const currentYear = Number(istanbul.find(part => part.type === 'year')?.value)
  const currentMonth = Number(istanbul.find(part => part.type === 'month')?.value) - 1
  const buAy = rows.filter(row => {
    const date = getKayitTarihi(row)
    return yil === currentYear && date?.getUTCFullYear() === yil && date.getUTCMonth() === currentMonth
  }).length
  return [
    { key: 'toplam', label: 'Toplam Plan', value: rows.length, color: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40', text: 'text-slate-700 dark:text-slate-300' },
    { key: 'bu-ay', label: 'Bu Ay', value: buAy, color: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400' },
    { key: 'yaklasan', label: 'Yaklaşan', value: rows.filter(row => row.durum === 'YAKLASIYOR').length, color: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40', text: 'text-orange-600 dark:text-orange-400' },
    { key: 'geciken', label: 'Geciken', value: rows.filter(row => row.durum === 'GECIKTI').length, color: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40', text: 'text-red-600 dark:text-red-400' },
    { key: 'tamamlanan', label: 'Tamamlanan', value: rows.filter(row => row.durum === 'TAMAMLANDI').length, color: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'onay-bekleyen', label: 'Onay Bekleyen', value: rows.filter(row => row.durum === 'TAMAMLANDI_ONAY_BEKLIYOR').length, color: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40', text: 'text-orange-600 dark:text-orange-400' },
    { key: 'kritik', label: 'Kritik', value: rows.filter(row => row.oncelik === 'KRITIK').length, color: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40', text: 'text-red-600 dark:text-red-400' },
    { key: 'iptal', label: 'İptal', value: rows.filter(row => row.iptalMi).length, color: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40', text: 'text-slate-500 dark:text-slate-400' },
  ]
}
