'use client'

// PR-JOBAPP-UX-FIXES: onlyDigits + inputMode + maxLength props eklendi.
// TC Kimlik / telefon gibi rakam-only alanlar için.

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  /** Mobile klavye türü (numeric/tel/email). */
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal' | 'url' | 'search'
  /** true ise non-digit karakterler reddedilir (paste dahil). */
  onlyDigits?: boolean
}

export function FormShortText({
  value,
  onChange,
  placeholder,
  disabled,
  maxLength,
  inputMode,
  onlyDigits,
}: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let next = e.target.value
    if (onlyDigits) next = next.replace(/\D/g, '')
    if (maxLength != null) next = next.slice(0, maxLength)
    onChange(next)
  }

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder ?? 'Yanıtınızı yazın...'}
      disabled={disabled}
      maxLength={maxLength ?? 300}
      inputMode={inputMode}
      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#1B4F72] focus:ring-0 outline-none transition-colors"
    />
  )
}
