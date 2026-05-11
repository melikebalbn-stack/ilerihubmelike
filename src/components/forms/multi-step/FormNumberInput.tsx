'use client'

// PR-JOBAPP-RENDERER: Sayısal input (tabular-nums). Boş string nullable kabul edilir.

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  min?: number
  max?: number
  step?: number
}

export function FormNumberInput({ value, onChange, placeholder, disabled, min, max, step }: Props) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#1B4F72] focus:ring-0 outline-none transition-colors tabular-nums"
    />
  )
}
