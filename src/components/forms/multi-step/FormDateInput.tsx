'use client'

// PR-JOBAPP-RENDERER: Tek tarih input'u. ISO YYYY-MM-DD format (HTML date input).

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  min?: string
  max?: string
}

export function FormDateInput({ value, onChange, disabled, min, max }: Props) {
  return (
    <input
      type="date"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      min={min}
      max={max}
      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#1B4F72] focus:ring-0 outline-none transition-colors"
    />
  )
}
