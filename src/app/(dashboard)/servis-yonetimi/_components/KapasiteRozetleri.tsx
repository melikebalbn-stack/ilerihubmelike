'use client'

import { Badge } from '@/components/ui/badge'
import type { ServisKapasiteOzeti } from '@/lib/servis-yonetimi/kapasite'
import { cn } from '@/lib/utils'
import { dolulukCubugu, dolulukMetni, durumEtiketi } from '../_lib/kapasite-gosterim'

// Kapasite durum rozeti ve doluluk çubuğu — Servis Paneli ve Toplu Kapasite ekranı ORTAK.
// Sayılar motordan gelir; burada yalnız renk/etiket.

export function DurumRozeti({ ozet }: { ozet: ServisKapasiteOzeti }) {
  const etiket = durumEtiketi(ozet)
  if (ozet.durum === 'ASIM') return <Badge variant="destructive">{etiket}</Badge>
  if (ozet.durum === 'ARAC_YOK') return <Badge variant="outline">{etiket}</Badge>
  if (ozet.durum === 'DOLMAK_UZERE') return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{etiket}</Badge>
  return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{etiket}</Badge>
}

export function DolulukCubugu({ ozet }: { ozet: ServisKapasiteOzeti }) {
  const renk =
    ozet.durum === 'ASIM' ? 'bg-red-500' : ozet.durum === 'DOLMAK_UZERE' ? 'bg-amber-500' : 'bg-[#1B4F72]'
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-24 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Doluluk"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(dolulukCubugu(ozet.dolulukOrani))}
      >
        <div className={cn('h-full rounded-full', renk)} style={{ width: `${dolulukCubugu(ozet.dolulukOrani)}%` }} />
      </div>
      <span className="w-14 text-right tabular-nums">{dolulukMetni(ozet.dolulukOrani)}</span>
    </div>
  )
}

