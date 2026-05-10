'use client'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  rows?: number
}

export function LongText({ value, onChange, placeholder, disabled, maxLength = 1000, rows = 4 }: Props) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Yanıtınızı yazın...'}
        disabled={disabled}
        maxLength={maxLength}
        rows={rows}
        className="w-full px-4 py-3 text-base bg-white border border-slate-200 rounded-xl focus:border-[#1B4F72] focus:ring-0 outline-none transition-colors resize-y"
      />
      <div className="mt-1 text-right text-xs text-slate-400 tabular-nums">
        {value.length} / {maxLength}
      </div>
    </div>
  )
}
