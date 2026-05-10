'use client'

// PR-SURVEY-UI-REFACTOR: Çoklu seçim — checkbox kart + dinamik "Diğer" inputları.
// "Diğer" değerleri submit'te `other:<text>` prefix'iyle gönderilir
// (mevcut /api/public/survey/[id]/submit kontratı).

import { Check, Plus, X } from 'lucide-react'

interface Option {
  id: string
  optionText: string
  sortOrder: number
}

interface Props {
  options: Option[]
  selected: string[]
  onToggle: (optionId: string) => void
  others: string[]
  onAddOther: () => void
  onUpdateOther: (index: number, value: string) => void
  onRemoveOther: (index: number) => void
  disabled?: boolean
}

export function MultiChoice({
  options,
  selected,
  onToggle,
  others,
  onAddOther,
  onUpdateOther,
  onRemoveOther,
  disabled,
}: Props) {
  const sorted = [...options].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sorted.map((opt) => {
          const isSelected = selected.includes(opt.id)
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(opt.id)}
              className={
                'text-left p-3 rounded-xl border transition-all duration-150 ease-out active:scale-[0.99] ' +
                'flex items-center gap-3 min-h-[52px] ' +
                (isSelected
                  ? 'border-[#1B4F72] bg-[#1B4F72]/[0.06] text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-[#1B4F72]/60 hover:bg-[#1B4F72]/[0.03]')
              }
            >
              <span
                className={
                  'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ' +
                  (isSelected ? 'border-[#1B4F72] bg-[#1B4F72]' : 'border-slate-300')
                }
              >
                {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </span>
              <span className={'text-sm leading-snug ' + (isSelected ? 'font-medium' : '')}>
                {opt.optionText}
              </span>
            </button>
          )
        })}
      </div>

      <div className="pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Diğer (belirtiniz)
          </span>
          <button
            type="button"
            onClick={onAddOther}
            disabled={disabled}
            className="flex items-center gap-1 text-sm text-[#1B4F72] hover:text-[#1B4F72]/80 font-medium"
          >
            <Plus className="w-4 h-4" />
            Ekle
          </button>
        </div>
        {others.map((value, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={value}
              onChange={(e) => onUpdateOther(idx, e.target.value)}
              placeholder="Yazınız..."
              disabled={disabled}
              className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#1B4F72] focus:ring-0 outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => onRemoveOther(idx)}
              disabled={disabled}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
              aria-label="Sil"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
