'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Coffee,
  type LucideIcon,
  Package,
  Repeat,
  Sparkles,
  UserX,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DURUS_SEBEPLERI,
  type TerminalIsEmri,
} from '@/lib/uretim/terminal-mock'
import { OperatorBadge, TERMINAL_ACCENT } from '../../../../_shared'

interface Props {
  operatorName: string
  isEmri: TerminalIsEmri | null
}

const ICONS: Record<string, LucideIcon> = {
  CAY: Coffee,
  YEMEK: UtensilsCrossed,
  KALIP: Repeat,
  TEMIZLIK: Sparkles,
  ARIZA: AlertTriangle,
  MALZEME: Package,
  TAKIM: Wrench,
  OPERATOR: UserX,
}

export function DurusBildirClient({ operatorName, isEmri }: Props) {
  const router = useRouter()
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
  const secilen = DURUS_SEBEPLERI.find((s) => s.kod === selected) ?? null
  const planli = DURUS_SEBEPLERI.filter((s) => s.tur === 'PLANLI')
  const plansiz = DURUS_SEBEPLERI.filter((s) => s.tur === 'PLANSIZ')

  const renderGrup = (
    baslik: string,
    liste: typeof DURUS_SEBEPLERI,
    plansizTonu: boolean,
  ) => (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{baslik}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {liste.map((s) => {
          const Icon = ICONS[s.kod] ?? AlertTriangle
          const isSel = selected === s.kod
          return (
            <button
              key={s.kod}
              type="button"
              onClick={() => setSelected(s.kod)}
              style={
                isSel && !plansizTonu
                  ? { borderColor: TERMINAL_ACCENT, color: TERMINAL_ACCENT }
                  : undefined
              }
              className={cn(
                'flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center text-sm font-medium transition-colors active:translate-y-px',
                !isSel && 'bg-card hover:bg-muted',
                isSel && plansizTonu && 'border-red-400 bg-red-50 text-red-700',
                isSel && !plansizTonu && 'bg-[#1B4F72]/5',
              )}
            >
              <Icon className="h-7 w-7" />
              {s.ad}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
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
            <span className="text-base font-semibold">Duruş Bildir</span>
            <span className="text-xs text-muted-foreground">
              {isEmri.isEmriNo} / Op {isEmri.operasyonNo} · duruş sebebini seç
            </span>
          </div>
        </div>
        <OperatorBadge name={operatorName} />
      </div>

      {renderGrup('Planlı Duruşlar', planli, false)}
      {renderGrup('Plansız Duruşlar', plansiz, true)}

      {/* Aksiyon */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!secilen}
          onClick={() => {
            // TODO: IFS/PLC duruş başlatma entegrasyonu (T3 sonrası)
            router.push(canliHref)
          }}
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-lg font-semibold text-white shadow-sm transition-all hover:bg-amber-600 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        >
          Duruşu Başlat{secilen ? ` — ${secilen.ad}` : ''}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Duruş bitince canlı ekrandaki “Duruşu Bitir” butonuyla kapatılır
        </p>
      </div>
    </div>
  )
}
