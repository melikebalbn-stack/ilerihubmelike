'use client'

/**
 * BolumSelect — Arşiv bölümü dropdown'u.
 * Renkli dot + KOD — Ad formatı. disabled durumda görsel olarak readonly.
 * Bölüm listesi parent'tan prop olarak verilir (fetch yapmaz).
 */

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

type Bolum = { id: number; ad: string; kod: string; renkHex: string }

type Props = {
  value: number | null
  onChange: (bolumId: number) => void
  bolumler: Bolum[]
  disabled?: boolean
  required?: boolean
}

export default function BolumSelect({
  value,
  onChange,
  bolumler,
  disabled,
  required,
}: Props) {
  const selected = bolumler.find((b) => b.id === value)

  return (
    <Select
      value={value !== null ? String(value) : ''}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger
        className={
          disabled
            ? 'bg-slate-100 cursor-not-allowed text-slate-700'
            : 'bg-white'
        }
      >
        <SelectValue placeholder="Bölüm seçin">
          {selected && (
            <span className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: selected.renkHex }}
              />
              <span className="font-medium">{selected.kod}</span>
              <span className="text-slate-500">— {selected.ad}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {bolumler.map((b) => (
          <SelectItem key={b.id} value={String(b.id)}>
            <span className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: b.renkHex }}
              />
              <span className="font-medium">{b.kod}</span>
              <span className="text-slate-500">— {b.ad}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
