import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, STATUS_BADGE_CLASS, type OffboardingStatus } from './constants'

/** Durum rozeti — status string'ini renkli Badge'e çevirir (DRAFT/IN_PROGRESS/COMPLETED). */
export function StatusBadge({ status }: { status: OffboardingStatus }) {
  return (
    <Badge variant="outline" className={cn('font-medium', STATUS_BADGE_CLASS[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
