import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { DURUM_META } from './constants'
import type { YillikTakvimDurum } from './types'

interface DurumBadgeProps {
  durum: YillikTakvimDurum
  muted?: boolean
  className?: string
}

/** Durumu ikon ve metinle gösterir; bilgi yalnız renge bağlı değildir. */
export function DurumBadge({ durum, muted, className }: DurumBadgeProps) {
  const meta = DURUM_META[durum]
  const Icon = meta.Icon

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 whitespace-nowrap font-medium',
        meta.colorClass,
        muted && 'opacity-50',
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </Badge>
  )
}
