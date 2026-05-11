'use client'

// PR-JOBAPP-REDESIGN: Generic 1-N skala (formerly LikertScale).
// RATING / SCALE soruları için, değer string olarak yönetilir.

interface Props {
  min?: number
  max?: number
  value: string
  onChange: (value: string) => void
  minLabel?: string
  maxLabel?: string
  disabled?: boolean
}

export function FormLikertScale({
  min = 1,
  max = 5,
  value,
  onChange,
  minLabel,
  maxLabel,
  disabled,
}: Props) {
  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        {items.map((n) => {
          const selected = value === String(n)
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(String(n))}
              className={
                'flex-1 min-w-[44px] h-12 rounded-xl border text-base font-medium transition-all duration-150 active:scale-[0.97] tabular-nums ' +
                (selected
                  ? 'border-[#1B4F72] bg-[#1B4F72] text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-[#1B4F72]/60')
              }
            >
              {n}
            </button>
          )
        })}
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-xs text-slate-400">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  )
}
