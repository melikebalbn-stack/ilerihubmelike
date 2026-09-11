'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

interface Props {
  value: string
  onChange: (value: string) => void
  id?: string
  placeholder?: string
}

export function CompanyAutocomplete({ value, onChange, id, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (value.trim().length < 3) {
      setSuggestions([])
      return
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sandbox/melike/faturalar/companies?q=${encodeURIComponent(value.trim())}`)
        if (!res.ok) return
        const data = await res.json()
        setSuggestions(data.companies ?? [])
      } catch {
        // sessizce yut, öneri opsiyonel
      }
    }, 250)
    return () => clearTimeout(timeout)
  }, [value])

  return (
    <div ref={ref} className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(name)
                setOpen(false)
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
