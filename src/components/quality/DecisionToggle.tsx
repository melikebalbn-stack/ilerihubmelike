'use client'

import { cn } from '@/lib/utils'

export type Decision = 'ok' | 'red' | null

interface Props {
  value: Decision
  onChange: (next: Exclude<Decision, null>) => void
  disabled?: boolean
  className?: string
}

/**
 * Büyük OK / RED kararı toggle — mockup .decision-toggle paritesi.
 *
 * - 2 buton, 56h, border-2 slate-200, rounded-8, sol nokta + label
 * - active: ok→green-50/border-green; red→red-50/border-red
 * - tıklanan buton seçilir; deselect için harici bir aksiyon (finalize öncesi
 *   karar boş olabilir, finalize sonrası bu component disabled prop ile read-only)
 */
export function DecisionToggle({
  value,
  onChange,
  disabled,
  className,
}: Props) {
  const okActive = value === 'ok'
  const redActive = value === 'red'

  return (
    <div className={cn('flex gap-2.5', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('ok')}
        className={cn(
          'flex-1 h-14 rounded-[8px] border-2 font-quality font-bold text-[16px] tracking-[0.08em]',
          'flex items-center justify-center gap-2.5 transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-60',
          okActive
            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
        )}
      >
        <span
          className={cn(
            'w-2.5 h-2.5 rounded-full transition-colors',
            okActive ? 'bg-emerald-500' : 'bg-slate-300',
          )}
        />
        OK
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('red')}
        className={cn(
          'flex-1 h-14 rounded-[8px] border-2 font-quality font-bold text-[16px] tracking-[0.08em]',
          'flex items-center justify-center gap-2.5 transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-60',
          redActive
            ? 'border-red-500 bg-red-50 text-red-700'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
        )}
      >
        <span
          className={cn(
            'w-2.5 h-2.5 rounded-full transition-colors',
            redActive ? 'bg-red-500' : 'bg-slate-300',
          )}
        />
        RED
      </button>
    </div>
  )
}
