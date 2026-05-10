'use client'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  maxLength?: number
}

export function ShortText({ value, onChange, placeholder, disabled, maxLength }: Props) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Yanıtınızı yazın...'}
      disabled={disabled}
      maxLength={maxLength ?? 300}
      className="w-full px-4 py-3 text-base bg-white border border-slate-200 rounded-xl focus:border-[#1B4F72] focus:ring-0 outline-none transition-colors"
    />
  )
}
