'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type ReportResult = 'PENDING' | 'OK' | 'RED'

// Semantik renk class'ları — shadcn variant="outline" üzerine yazılır.
// (Badge default border + text-foreground çıkar, semantik renkleri ekleriz.)
const colorClass: Record<ReportResult, string> = {
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
    <Badge
      variant="outline"
      className={cn(
        // Custom <span> formatına birebir parite: sabit min genişlik,
        // padding, text-size, ağırlık. Badge default'larını override eder.
        'min-w-[60px] justify-center px-2 py-1 rounded text-[11px] font-bold tracking-wide',
        colorClass[result],
      )}
    >
      {labels[result]}
    </Badge>
  )
}
