'use client'

/**
 * LokasyonSelect — Lokasyon dropdown'u doluluk badge'i ile.
 *
 * - %90 üstü doluluk: kırmızımsı badge
 * - %100 doluluk: item disabled (seçilemez), yeni ekleme yapılamaz
 * - Lokasyonlar parent'tan prop, fetch yok
 */

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

export type Lokasyon = {
  id: number
  depoNo: string
  rafKodu: string
  siraNo: number
  kapasite: number
  mevcutDoluluk: number
}

type Props = {
  value: number | null
  onChange: (lokasyonId: number) => void
  lokasyonlar: Lokasyon[]
  disabled?: boolean
  required?: boolean
}

function formatLokasyon(l: Lokasyon): string {
  return `${l.depoNo} / ${l.rafKodu} / ${l.siraNo}`
}

function dolulukRatio(l: Lokasyon): number {
  if (l.kapasite <= 0) return 0
  return l.mevcutDoluluk / l.kapasite
}

function dolulukBadgeClass(l: Lokasyon): string {
  const r = dolulukRatio(l)
  if (r >= 1) return 'bg-rose-100 text-rose-800'
  if (r >= 0.9) return 'bg-rose-50 text-rose-700'
  return 'bg-slate-100 text-slate-700'
}

export default function LokasyonSelect({
  value,
  onChange,
  lokasyonlar,
  disabled,
  required,
}: Props) {
  const selected = lokasyonlar.find((l) => l.id === value)

  return (
    <Select
      value={value !== null ? String(value) : ''}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger className="bg-white">
        <SelectValue placeholder="Lokasyon seçin">
          {selected && (
            <span className="flex items-center justify-between gap-2 w-full">
              <span>{formatLokasyon(selected)}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-medium ${dolulukBadgeClass(selected)}`}
              >
                {selected.mevcutDoluluk}/{selected.kapasite}
              </span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {lokasyonlar.map((l) => {
          const dolu = l.mevcutDoluluk >= l.kapasite
          return (
            <SelectItem
              key={l.id}
              value={String(l.id)}
              disabled={dolu && l.id !== value}
            >
              <span className="flex items-center justify-between gap-3 w-full">
                <span>{formatLokasyon(l)}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-xs font-medium ${dolulukBadgeClass(l)}`}
                >
                  {l.mevcutDoluluk}/{l.kapasite}
                  {dolu ? ' • DOLU' : ''}
                </span>
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
