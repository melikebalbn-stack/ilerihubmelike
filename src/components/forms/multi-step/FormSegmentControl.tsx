'use client'

// PR-JOBAPP-RENDERER: Segmented button group — tek seçim, {value,label} dizisi.
// PR-JOBAPP-UX-FIXES: grid yerine flex-wrap + whitespace-nowrap — "Çok İyi"
// gibi uzun label'lar artık satır içinde kırılmadan dolar; dar parent
// container'larda butonlar 1-2-3 sütun arasında doğal wrap eder.

interface OptionLike {
  value: string
  label: string
}

interface Props {
  options: ReadonlyArray<OptionLike>
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
  /** Backward-compat: 1 ise flex-col (her opsiyon tam satır), aksi halde wrap. */
  mobileColumns?: 1 | 2
}

export function FormSegmentControl({ options, value, onChange, disabled, mobileColumns = 2 }: Props) {
  const containerCls = mobileColumns === 1 ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2'
  return (
    <div className={containerCls}>
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={
              'px-3 py-2 text-sm rounded-lg border transition-all duration-150 active:scale-[0.98] text-center whitespace-nowrap min-w-[60px] ' +
              (mobileColumns === 1 ? 'w-full ' : 'flex-1 ') +
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
