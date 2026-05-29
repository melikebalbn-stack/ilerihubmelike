'use client'

import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  svgContent: string
}

interface SymbolPickerProps {
  value: string | null
  onChange: (id: string | null) => void
  symbols: SymbolOption[]
  disabled?: boolean
}

export function SymbolPicker({ value, onChange, symbols, disabled }: SymbolPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = value ? symbols.find((s) => s.id === value) : null

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            'h-9 min-w-[120px] justify-between gap-2 font-normal',
            !selected && 'text-muted-foreground',
          )}
        >
          {selected ? (
            <span className="flex items-center gap-1.5 truncate">
              <SymbolGlyph svg={selected.svgContent} className="h-4 w-4 shrink-0" />
              <span className="truncate text-xs">{selected.nameTr}</span>
            </span>
          ) : (
            <span className="text-xs">Sembol</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="flex items-center justify-between border-b pb-2 mb-2">
          <span className="text-xs font-semibold text-muted-foreground">GD&T Sembolü</span>
          {selected && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Temizle
            </Button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
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
                  'flex flex-col items-center justify-center gap-1 rounded-md border p-2 transition-colors',
                  isActive
                    ? 'border-[#1B4F72] bg-[#1B4F72]/5 text-[#1B4F72]'
                    : 'border-transparent hover:border-slate-300 hover:bg-slate-50 text-slate-700',
                )}
                title={s.nameTr}
              >
                <SymbolGlyph svg={s.svgContent} className="h-6 w-6" />
                <span className="text-[10px] leading-tight text-center">{s.nameTr}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
