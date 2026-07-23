'use client'

import { Badge } from '@/components/ui/badge'
import { getZimmetDurumRozeti } from '@/lib/zimmet/constants'

type ZimmetDurumInput = {
  durum: string
  imzaModu: string | null
  zimmetSahibiImzaTarihi: string | null
  islakImzaDosyasi: string | null
}

const RENK_CLASSNAMES: Record<string, string> = {
  gri: 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100',
  amber: 'bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100',
  yesil: 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
  kirmizi: 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-100',
}

export function ZimmetDurumBadge({ zimmet }: { zimmet: ZimmetDurumInput }) {
  const rozet = getZimmetDurumRozeti(zimmet)
  return (
    <Badge className={`whitespace-nowrap ${RENK_CLASSNAMES[rozet.renk]}`}>
      {rozet.label}
    </Badge>
  )
}
