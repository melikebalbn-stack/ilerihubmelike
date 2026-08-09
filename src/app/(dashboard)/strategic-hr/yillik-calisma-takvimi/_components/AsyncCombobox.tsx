'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface AsyncComboboxOption {
  id: string
  label: string
  description?: string | null
}

interface Props {
  value: AsyncComboboxOption | null
  onChange: (value: AsyncComboboxOption | null) => void
  loadOptions: (query: string) => Promise<AsyncComboboxOption[]>
  placeholder: string
  searchPlaceholder: string
  minSearchLength?: number
}

export function AsyncCombobox({ value, onChange, loadOptions, placeholder, searchPlaceholder, minSearchLength = 0 }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<AsyncComboboxOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    if (!open || query.trim().length < minSearchLength) {
      setOptions([])
      return
    }
    const timeout = setTimeout(async () => {
      const id = ++requestId.current
      setLoading(true)
      setError(null)
      try {
        const next = await loadOptions(query.trim())
        if (id === requestId.current) setOptions(next)
      } catch (reason) {
        if (id === requestId.current) {
          setOptions([])
          setError(reason instanceof Error ? reason.message : 'Seçenekler alınamadı')
        }
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timeout)
  }, [loadOptions, minSearchLength, open, query])

  return <div className="relative">
    <Button type="button" variant="outline" className="w-full justify-between font-normal" onClick={() => setOpen(current => !current)}>
      <span className={value ? undefined : 'text-muted-foreground'}>{value?.label ?? placeholder}</span>
      {value ? <X className="h-4 w-4" onClick={event => { event.stopPropagation(); onChange(null) }} /> : <Search className="h-4 w-4" />}
    </Button>
    {open && <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-2 shadow-md">
      <Input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={searchPlaceholder} />
      <div className="mt-2 max-h-52 overflow-y-auto">
        {loading && <div className="flex justify-center p-3"><Loader2 className="h-4 w-4 animate-spin" /></div>}
        {!loading && error && <p className="p-2 text-xs text-red-600">{error}</p>}
        {!loading && query.trim().length < minSearchLength && <p className="p-2 text-xs text-muted-foreground">En az {minSearchLength} karakter yazın</p>}
        {!loading && !error && query.trim().length >= minSearchLength && options.length === 0 && <p className="p-2 text-xs text-muted-foreground">Sonuç bulunamadı</p>}
        {options.map(option => <button
          key={option.id}
          type="button"
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-accent"
          onClick={() => { onChange(option); setOpen(false); setQuery('') }}
        >
          <Check className={`h-4 w-4 ${value?.id === option.id ? 'opacity-100' : 'opacity-0'}`} />
          <span><span className="block">{option.label}</span>{option.description && <span className="block text-xs text-muted-foreground">{option.description}</span>}</span>
        </button>)}
      </div>
    </div>}
  </div>
}
