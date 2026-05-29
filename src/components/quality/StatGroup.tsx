import { cn } from '@/lib/utils'

export type StatTone = 'neutral' | 'ok' | 'red' | 'pending'

export interface StatEntry {
  label: string
  value: number | string
  tone?: StatTone
}

interface Props {
  stats: StatEntry[]
  className?: string
}

const toneClass: Record<StatTone, string> = {
  neutral: 'text-slate-900',
  ok: 'text-emerald-700',
  red: 'text-red-700',
  pending: 'text-slate-400',
}

/**
 * 4'lü stat satırı (Karakter / OK / RED / Bekleyen) — mockup
 * .result-summary-row + .summary-stat paritesi.
 *
 * - sayı: font-quality-mono 22px bold, tone'a göre renk
 * - label: font-quality 10.5px uppercase slate-500
 */
export function StatGroup({ stats, className }: Props) {
  return (
    <div className={cn('flex gap-5 items-center', className)}>
      {stats.map((s, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <div
            className={cn(
              'font-quality-mono text-[22px] font-bold leading-none tabular-nums',
              toneClass[s.tone ?? 'neutral'],
            )}
          >
            {s.value}
          </div>
          <div className="font-quality text-[10.5px] text-slate-500 uppercase tracking-[0.04em] font-medium">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  )
}
