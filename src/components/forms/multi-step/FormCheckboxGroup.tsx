'use client'

// PR-JOBAPP-RENDERER: Bağımsız checkbox grubu (her checkbox kendi boolean'ı).
// Yalnızca bir grup metin altında işaretlenebilir — tek seçim için
// SegmentControl, çoklu seçim için MultiChoice tercih edilir.
// Bu component "preferredContactGsm + preferredContactEmail" gibi
// bağımsız booleanları aynı görsel grupta toplamak için.

import { Check } from 'lucide-react'

interface Item {
  key: string
  label: string
}

interface Props {
  items: ReadonlyArray<Item>
  value: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
  disabled?: boolean
}

export function FormCheckboxGroup({ items, value, onChange, disabled }: Props) {
  const toggle = (key: string) => {
    onChange({ ...value, [key]: !value[key] })
  }
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const checked = !!value[item.key]
        return (
          <button
            key={item.key}
            type="button"
            disabled={disabled}
            onClick={() => toggle(item.key)}
            className={
              'w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-150 active:scale-[0.99] text-left ' +
              (checked
                ? 'border-[#1B4F72] bg-[#1B4F72]/[0.06]'
                : 'border-slate-200 bg-white hover:border-[#1B4F72]/60')
            }
          >
            <span
              className={
                'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ' +
                (checked ? 'border-[#1B4F72] bg-[#1B4F72]' : 'border-slate-300')
              }
            >
              {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className={'text-sm ' + (checked ? 'font-medium text-slate-900' : 'text-slate-700')}>
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
