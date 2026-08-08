import type { YillikTakvimDurum } from '@/generated/prisma'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { DURUM_META } from './constants'

export function DurumBadge({ durum }: { durum: YillikTakvimDurum }) {
  const meta = DURUM_META[durum]
  return <Badge variant="outline" className={cn('whitespace-nowrap', meta.className)}>{meta.label}</Badge>
}
