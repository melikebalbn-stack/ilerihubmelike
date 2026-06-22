'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { SymbolGlyph } from './SymbolGlyph'

export interface SymbolOption {
  id: string
  key: string
  nameTr: string
  nameEn?: string | null
  svgContent: string
}

interface SymbolPickerProps {
  value: string | null
  onChange: (id: string | null) => void
  symbols: SymbolOption[]
  disabled?: boolean
  /** Trigger placeholder — sembol seçilmediğinde gözükür (default "Sembol") */
  placeholder?: string
  /** Trigger min-width — CharacterCell edit modu dar tutar; default 120px */
  triggerClassName?: string
}

/**
 * GD&T sembol seçici — mockup F18-8511 .symbol-dropdown paritesi.
 *
 * Trigger: 32h, slate-200 border / navy-100+navy-50 has-value, glyph + nameTr
 * label + chevron. Popover content: 280px wide, max-h 380px, navy-50 hover,
 * section header "GD&T Sembolleri (ISO 1101)" + flat list (glyph + nameTr +
 * nameEn) + footer-row "Sembolü Temizle".
 *
 * Hem KALITE-3 şablon builder'da (CharacterCell mode='edit') hem doğrudan
 * picker olarak reuse edilebilir.
 */
export function SymbolPicker({
  value,
  onChange,
  symbols,
  disabled,
  placeholder = 'Sembol',
  triggerClassName,
}: SymbolPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = value ? symbols.find((s) => s.id === value) : null
  const hasValue = !!selected

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'h-8 min-w-[120px] flex items-center gap-2 px-2 rounded-md border bg-white',
            'font-quality text-[11.5px] text-slate-700 text-left',
            'transition-colors',
            hasValue
              ? 'border-[#1B4F72]/30 bg-[#1B4F72]/[0.06]'
              : 'border-slate-200 hover:border-slate-300',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            triggerClassName,
          )}
        >
          {selected ? (
            <SymbolGlyph
              svg={selected.svgContent}
              className="h-[18px] w-[18px] flex-shrink-0 text-slate-700"
            />
          ) : (
            <span className="h-[18px] w-[18px] flex-shrink-0 inline-flex items-center justify-center text-slate-300">
              <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
                <rect
                  x="4"
                  y="4"
                  width="16"
                  height="16"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              </svg>
            </span>
          )}
          <span
            className={cn(
              'flex-1 min-w-0 truncate',
              !hasValue && 'text-slate-400',
            )}
          >
            {selected ? selected.nameTr : placeholder}
          </span>
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[280px] max-h-[380px] overflow-y-auto p-1.5 rounded-lg border border-slate-200 shadow-lg"
      >
        <div className="px-2.5 pt-2 pb-1 font-quality text-[10px] font-bold uppercase text-slate-500 tracking-[0.06em]">
          GD&amp;T Sembolleri (ISO 1101)
        </div>
        <div className="flex flex-col">
          {symbols.map((s) => {
            const isActive = s.id === value
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange(s.id)
                  setOpen(false)
                }}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors',
                  'hover:bg-[#1B4F72]/[0.06]',
                  isActive && 'bg-[#1B4F72]/[0.08]',
                )}
              >
                <SymbolGlyph
                  svg={s.svgContent}
                  className="h-5 w-5 flex-shrink-0 text-slate-700"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-quality text-[13px] font-medium text-slate-800 leading-tight truncate">
                    {s.nameTr}
                  </div>
                  {s.nameEn && (
                    <div className="font-quality text-[10.5px] text-slate-500 tracking-[0.02em] truncate mt-px">
                      {s.nameEn}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null)
            setOpen(false)
          }}
          className={cn(
            'mt-1 w-full flex items-center justify-center px-2 py-2 rounded-md',
            'border-t border-slate-100',
            'font-quality text-[11.5px] text-slate-500',
            'hover:bg-slate-50 hover:text-slate-700 transition-colors',
          )}
        >
          Sembolü Temizle
        </button>
      </PopoverContent>
    </Popover>
  )
}
