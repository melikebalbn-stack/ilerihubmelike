'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'

export interface MusteriOption {
  id: string
  code: string
  name: string
}

interface Props {
  value: MusteriOption | null
  onChange: (m: MusteriOption | null) => void
  disabled?: boolean
  placeholder?: string
  /** Arama ucu — {items:[{id,code,name}]} döner. Varsayılan müşteri; sorumlu için override. */
  searchUrl?: string
}

/** Sunucu-taraflı aranabilir seçici ({id,code,name}). Müşteri (740) + sorumlu (personel) için ortak. */
export function MusteriSecici({
  value,
  onChange,
  disabled,
  placeholder,
  searchUrl = '/api/quality/rma/musteri-ara',
}: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<MusteriOption[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Debounced sunucu araması
  useEffect(() => {
    if (!open) return
    const term = q.trim()
    if (term.length < 1) {
      setItems([])
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${searchUrl}?q=${encodeURIComponent(term)}`)
        const json = res.ok ? await res.json() : { items: [] }
        setItems(json.items ?? [])
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, open])

  // Seçili müşteri gösterimi (arama açık değilken)
  if (value && !open) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md border bg-slate-50 px-3 py-2 text-sm">
          <span className="font-mono text-xs text-slate-500">{value.code}</span>
          {' — '}
          <span className="font-medium">{value.name}</span>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setQ('')
              setOpen(true)
            }}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Müşteriyi değiştir"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={q}
          disabled={disabled}
          placeholder={placeholder ?? 'Müşteri adı veya kodu ile ara…'}
          className="pl-8"
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-64 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-3 text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Aranıyor…
            </div>
          ) : items.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">
              {q.trim() ? 'Sonuç yok' : 'Aramak için yazın…'}
            </div>
          ) : (
            items.map((m) => (
              <button
                key={m.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(m)
                  setOpen(false)
                  setQ('')
                }}
              >
                <span className="font-mono text-xs text-slate-500">{m.code}</span>
                {' — '}
                {m.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
