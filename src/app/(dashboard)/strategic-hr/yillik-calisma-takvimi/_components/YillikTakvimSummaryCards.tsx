import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Flame,
  Hourglass,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { YillikTakvimSummaryItem } from './summary'

const SUMMARY_ICONS: Record<string, LucideIcon> = {
  toplam: ClipboardList,
  'bu-ay': CalendarDays,
  yaklasan: AlertTriangle,
  geciken: Clock,
  tamamlanan: CheckCircle2,
  'onay-bekleyen': Hourglass,
  kritik: Flame,
  iptal: XCircle,
}

export function YillikTakvimSummaryCards({ items }: { items: YillikTakvimSummaryItem[] }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
    {items.map(item => {
      const Icon = SUMMARY_ICONS[item.key] ?? ClipboardList
      return <div key={item.key} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${item.color}`}>
        <Icon aria-hidden="true" className={`h-6 w-6 shrink-0 ${item.text}`} />
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{item.label}</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${item.text}`}>{item.value}</p>
        </div>
      </div>
    })}
  </div>
}
