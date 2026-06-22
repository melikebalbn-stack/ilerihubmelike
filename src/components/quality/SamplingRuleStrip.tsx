import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  /** Etiket — default "Örnekleme" */
  label?: string
  /** Kural metni (mockup default: "Numune Adet: 0–500 → N = %2 · ...") */
  children: ReactNode
  className?: string
}

/**
 * Ölçüm tablosunun altındaki örnekleme kuralı şeridi —
 * mockup .sampling-rule paritesi.
 *
 * - slate-50 bg + slate-200 üst kenar
 * - label: Manrope 10.5px bold uppercase slate-700
 * - kural metni: mono 11px slate-500
 */
export function SamplingRuleStrip({
  label = 'Örnekleme',
  children,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'px-4 py-2.5 bg-slate-50 border-t border-slate-200 font-quality-mono text-[11px] text-slate-500',
        className,
      )}
    >
      <span className="font-quality font-bold text-[10.5px] text-slate-700 uppercase tracking-[0.04em] mr-2">
        {label}
      </span>
      {children}
    </div>
  )
}
