'use client'

import type { YillikTakvimDurum, YillikTakvimOncelik, YillikTakvimPeriyot } from '@/generated/prisma'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DURUM_META, ONCELIK_META, PERIYOT_META } from './constants'

const TUMU = '__tumu__'
export interface YillikTakvimFilters {
  anaKonu: string | null
  sorumlu: string | null
  durum: YillikTakvimDurum | null
  periyot: YillikTakvimPeriyot | null
  oncelik: YillikTakvimOncelik | null
}
export const BOS_FILTRE: YillikTakvimFilters = { anaKonu: null, sorumlu: null, durum: null, periyot: null, oncelik: null }

interface Props {
  value: YillikTakvimFilters
  anaKonular: string[]
  sorumlular: string[]
  onChange: (filters: YillikTakvimFilters) => void
}

export function YillikTakvimFilterBar({ value, anaKonular, sorumlular, onChange }: Props) {
  const fields = [
    { key: 'anaKonu', label: 'Ana Konu', options: anaKonular.map(v => [v, v]) },
    { key: 'sorumlu', label: 'Sorumlu', options: sorumlular.map(v => [v, v]) },
    { key: 'durum', label: 'Durum', options: Object.entries(DURUM_META).map(([k, v]) => [k, v.label]) },
    { key: 'periyot', label: 'Periyot', options: Object.entries(PERIYOT_META) },
    { key: 'oncelik', label: 'Öncelik', options: Object.entries(ONCELIK_META) },
  ] as const
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-slate-50/50 p-3 dark:bg-slate-900/50">
      {fields.map(field => (
        <div key={field.key} className="min-w-36">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{field.label}</label>
          <Select
            value={value[field.key] ?? TUMU}
            onValueChange={next => onChange({ ...value, [field.key]: next === TUMU ? null : next })}
          >
            <SelectTrigger className="h-9" aria-label={field.label}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TUMU}>Tümü</SelectItem>
              {field.options.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange(BOS_FILTRE)}>Temizle</Button>
    </div>
  )
}
