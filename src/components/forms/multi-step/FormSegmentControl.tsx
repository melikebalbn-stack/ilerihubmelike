'use client'

// PR-JOBAPP-RENDERER: Segmented button group — tek seçim, {value,label} dizisi.
// Mobile: wrap edip 2 sütuna düşer. SingleChoice'tan farkı: SurveyOption (id,
// optionText) yerine ham {value,label} alır, kart yerine daha kompakt buton.

interface OptionLike {
  value: string
  label: string
}

interface Props {
  options: ReadonlyArray<OptionLike>
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
  /** Mobile'da kaç sütun (default 2) */
  mobileColumns?: 1 | 2
}

export function FormSegmentControl({ options, value, onChange, disabled, mobileColumns = 2 }: Props) {
  const gridCls = mobileColumns === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'
  return (
    <div className={`grid ${gridCls} gap-2`}>
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={
              'px-3 py-2 text-sm rounded-lg border transition-all duration-150 active:scale-[0.98] text-center ' +
              (selected
                ? 'border-[#1B4F72] bg-[#1B4F72] text-white font-medium'
                : 'border-slate-200 bg-white text-slate-700 hover:border-[#1B4F72]/60')
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
