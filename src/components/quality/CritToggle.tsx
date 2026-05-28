'use client'

import { cn } from '@/lib/utils'

interface CritToggleProps {
  value: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

/**
 * Kritik karakteristik göstergesi — şartname Class A * (asterisk).
 * Aktifse amber bg + beyaz "*"; pasifse muted border + amber "*".
 */
export function CritToggle({ value, onChange, disabled }: CritToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      title={value ? 'Kritik karakteristik (tıkla: kaldır)' : 'Kritik olarak işaretle'}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm font-bold transition-colors',
        value
          ? 'bg-amber-500 border-amber-500 text-white shadow-sm hover:bg-amber-600'
          : 'border-slate-300 text-amber-600 hover:border-amber-400 hover:bg-amber-50',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      *
    </button>
  )
}
