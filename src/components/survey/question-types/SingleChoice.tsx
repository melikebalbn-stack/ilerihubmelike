'use client'

// PR-SURVEY-UI-REFACTOR: Tek seçim — her seçenek tıklanabilir kart.
// Mobile: 1 sütun, sm+: 2 sütun. Klavye erişilebilirliği için button.

import { Check } from 'lucide-react'

interface Option {
  id: string
  optionText: string
  sortOrder: number
}

interface Props {
  options: Option[]
  value: string | null
  onChange: (optionId: string) => void
  disabled?: boolean
}

export function SingleChoice({ options, value, onChange, disabled }: Props) {
  const sorted = [...options].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {sorted.map((opt) => {
        const selected = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={
              'group relative text-left p-3 rounded-xl border transition-all duration-150 ease-out active:scale-[0.99] ' +
              'flex items-center gap-3 min-h-[52px] ' +
              (selected
                ? 'border-[#1B4F72] bg-[#1B4F72]/[0.06] text-slate-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-[#1B4F72]/60 hover:bg-[#1B4F72]/[0.03]')
            }
          >
            <span
              className={
                'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ' +
                (selected ? 'border-[#1B4F72] bg-[#1B4F72]' : 'border-slate-300')
              }
            >
              {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className={'text-sm leading-snug ' + (selected ? 'font-medium' : '')}>
              {opt.optionText}
            </span>
          </button>
        )
      })}
    </div>
  )
}
