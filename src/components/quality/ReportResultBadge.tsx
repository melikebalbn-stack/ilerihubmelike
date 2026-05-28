'use client'

import { cn } from '@/lib/utils'

export type ReportResult = 'PENDING' | 'OK' | 'RED'

const styles: Record<ReportResult, string> = {
  PENDING: 'bg-slate-100 text-slate-500 border-slate-200',
  OK: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RED: 'bg-red-50 text-red-700 border-red-200',
}

const labels: Record<ReportResult, string> = {
  PENDING: 'Bekliyor',
  OK: 'OK',
  RED: 'RED',
}

export function ReportResultBadge({ result }: { result: ReportResult }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[60px] px-2 py-1 rounded text-[11px] font-bold tracking-wide border',
        styles[result],
      )}
    >
      {labels[result]}
    </span>
  )
}
