'use client'

import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DURUM_META, ONCELIK_META, PERIYOT_META } from './constants'
import type { YillikTakvimDurum, YillikTakvimOncelik, YillikTakvimPeriyot } from './types'

const TUMU = '__tumu__'

export interface YillikTakvimFilters {
  anaKonu: string | null
  sorumlu: string | null
  durum: YillikTakvimDurum | null
  periyot: YillikTakvimPeriyot | null
  oncelik: YillikTakvimOncelik | null
}

export const BOS_FILTRE: YillikTakvimFilters = {
  anaKonu: null,
  sorumlu: null,
  durum: null,
  periyot: null,
  oncelik: null,
}

interface YillikTakvimFilterBarProps {
  anaKonuSecenekleri: string[]
  sorumluSecenekleri: string[]
  onApply: (filters: YillikTakvimFilters) => void
}

export function YillikTakvimFilterBar({
  anaKonuSecenekleri,
  sorumluSecenekleri,
  onApply,
}: YillikTakvimFilterBarProps) {
  const [taslak, setTaslak] = useState<YillikTakvimFilters>(BOS_FILTRE)

  function handleTemizle() {
    setTaslak(BOS_FILTRE)
    onApply(BOS_FILTRE)
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
      <FilterSelect
        label="Ana Konu"
        value={taslak.anaKonu}
        options={anaKonuSecenekleri.map(value => ({ value, label: value }))}
        onChange={value => setTaslak(current => ({ ...current, anaKonu: value }))}
      />
      <FilterSelect
        label="Sorumlu"
        value={taslak.sorumlu}
        options={sorumluSecenekleri.map(value => ({ value, label: value }))}
        onChange={value => setTaslak(current => ({ ...current, sorumlu: value }))}
      />
      <FilterSelect
        label="Durum"
        value={taslak.durum}
        options={(Object.keys(DURUM_META) as YillikTakvimDurum[]).map(value => ({ value, label: DURUM_META[value].label }))}
        onChange={value => setTaslak(current => ({ ...current, durum: value as YillikTakvimDurum | null }))}
      />
      <FilterSelect
        label="Periyot"
        value={taslak.periyot}
        options={(Object.keys(PERIYOT_META) as YillikTakvimPeriyot[]).map(value => ({ value, label: PERIYOT_META[value].label }))}
        onChange={value => setTaslak(current => ({ ...current, periyot: value as YillikTakvimPeriyot | null }))}
      />
      <FilterSelect
        label="Öncelik"
        value={taslak.oncelik}
        options={(Object.keys(ONCELIK_META) as YillikTakvimOncelik[]).map(value => ({ value, label: ONCELIK_META[value].label }))}
        onChange={value => setTaslak(current => ({ ...current, oncelik: value as YillikTakvimOncelik | null }))}
      />

      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => onApply(taslak)}>
          <Filter className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Filtrele
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleTemizle}>
          <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Temizle
        </Button>
      </div>
    </div>
  )
}

interface FilterSelectProps {
  label: string
  value: string | null
  options: { value: string; label: string }[]
  onChange: (value: string | null) => void
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="min-w-36">
      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
      <Select value={value ?? TUMU} onValueChange={next => onChange(next === TUMU ? null : next)}>
        <SelectTrigger className="h-9" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TUMU}>Tümü</SelectItem>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
