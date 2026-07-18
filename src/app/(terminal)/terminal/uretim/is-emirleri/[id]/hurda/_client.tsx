'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Box,
  Info,
  type LucideIcon,
  Minus,
  Plus,
  Ruler,
  Settings,
  UserX,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  HURDA_SEBEPLERI,
  type TerminalIsEmri,
} from '@/lib/uretim/terminal-mock'
import { OperatorBadge } from '../../../../_shared'

interface Props {
  operatorName: string
  isEmri: TerminalIsEmri | null
}

const ICONS: Record<string, LucideIcon> = {
  MAKINE: Settings,
  OPERATOR: UserX,
  MALZEME: Box,
  OLCU: Ruler,
}

export function HurdaBildirClient({ operatorName, isEmri }: Props) {
  const router = useRouter()
  const [adet, setAdet] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  if (!isEmri) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 p-10 text-center">
        <p className="text-base font-medium">İş emri bulunamadı</p>
        <Link
          href="/terminal/uretim/is-emirleri"
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors hover:bg-muted active:bg-muted/70"
        >
          <ArrowLeft className="h-4 w-4" />
          İş emri listesine dön
        </Link>
      </div>
    )
  }

  const canliHref = `/terminal/uretim/is-emirleri/${isEmri.id}/canli`
  const maxAdet = Math.max(1, isEmri.kalanMiktar)
  const secilen = HURDA_SEBEPLERI.find((s) => s.kod === selected) ?? null
  const step = (delta: number) =>
    setAdet((a) => Math.min(maxAdet, Math.max(1, a + delta)))

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      {/* Üst bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={canliHref}
            aria-label="Canlı ekrana dön"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors hover:bg-muted active:bg-muted/70"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold">Hurda Bildir</span>
            <span className="text-xs text-muted-foreground">
              {isEmri.isEmriNo} / Op {isEmri.operasyonNo} · {isEmri.stokKodu}{' '}
              {isEmri.stokAdi}
            </span>
          </div>
        </div>
        <OperatorBadge name={operatorName} />
      </div>

      {/* Hurda adedi */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Hurda Adedi
        </h2>
        <div className="flex items-center justify-center gap-6 rounded-2xl border bg-card p-6">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={adet <= 1}
            aria-label="Azalt"
            className="flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors hover:bg-muted active:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-7 w-7" />
          </button>
          <div className="min-w-24 text-center text-6xl font-semibold tabular-nums text-red-600">
            {adet}
          </div>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={adet >= maxAdet}
            aria-label="Artır"
            className="flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors hover:bg-muted active:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-7 w-7" />
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          En fazla {maxAdet} (kalan miktar)
        </p>
      </div>

      {/* Hurda sebebi */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Hurda Sebebi
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {HURDA_SEBEPLERI.map((s) => {
            const Icon = ICONS[s.kod] ?? Box
            const isSel = selected === s.kod
            return (
              <button
                key={s.kod}
                type="button"
                onClick={() => setSelected(s.kod)}
                className={cn(
                  'flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center text-sm font-medium transition-colors active:translate-y-px',
                  isSel
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'bg-card hover:bg-muted',
                )}
              >
                <Icon className="h-7 w-7" />
                {s.ad}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bilgi kutusu */}
      <div className="flex items-start gap-3 rounded-2xl border bg-muted/30 p-4 text-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <p>
          <span className="font-semibold text-red-600">{adet} adet</span> hurda,
          “{secilen?.ad ?? 'sebep seçilmedi'}” sebebiyle kaydedilecek. Kalan
          miktar buna göre güncellenir.
        </p>
      </div>

      {/* Aksiyon */}
      <button
        type="button"
        disabled={!secilen}
        onClick={() => {
          // TODO: ReportQuantityScrap entegrasyonu (nested payload) — T3 sonrası
          router.push(canliHref)
        }}
        className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-500 text-lg font-semibold text-red-600 transition-colors hover:bg-red-50 active:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Hurdayı Kaydet
      </button>
    </div>
  )
}
