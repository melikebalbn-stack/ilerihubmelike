'use client'

/**
 * SorumluKullaniciSelect — Search dropdown autocomplete.
 *
 * - 300ms debounce, min 2 karakter
 * - GET /api/arsiv/users/search?q=...&limit=20
 * - Avatar + name + email
 * - Klavye nav: ↑↓ Enter Esc
 * - Outside click → kapanır
 * - X ile temizleme
 */

import { useState, useRef, useEffect, useCallback } from 'react'

export type SorumluUser = {
  id: string
  name: string | null
  email: string
  image: string | null
}

type Props = {
  value: SorumluUser | null
  onChange: (user: SorumluUser | null) => void
  disabled?: boolean
  required?: boolean
  placeholder?: string
}

function getInitials(name: string | null, email: string): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function Avatar({ user, size = 28 }: { user: SorumluUser; size?: number }) {
  if (user.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={user.image}
        alt={user.name ?? user.email}
        width={size}
        height={size}
        className="rounded-full flex-shrink-0 object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {getInitials(user.name, user.email)}
    </span>
  )
}

export default function SorumluKullaniciSelect({
  value,
  onChange,
  disabled,
  required,
  placeholder = 'Kullanıcı arayın (ad veya email)',
}: Props) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SorumluUser[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqIdRef = useRef(0)

  const performSearch = useCallback((q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setItems([])
      setLoading(false)
      return
    }
    const reqId = ++reqIdRef.current
    setLoading(true)
    fetch(`/api/arsiv/users/search?q=${encodeURIComponent(trimmed)}&limit=20`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((body) => {
        if (reqId !== reqIdRef.current) return
        setItems(body.items ?? [])
        setLoading(false)
        setActiveIdx(-1)
      })
      .catch(() => {
        if (reqId !== reqIdRef.current) return
        setItems([])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => performSearch(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, performSearch])

  // Outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSelect(user: SorumluUser) {
    onChange(user)
    setQuery('')
    setOpen(false)
    setActiveIdx(-1)
    inputRef.current?.blur()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setActiveIdx((i) => Math.min(items.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      if (open && activeIdx >= 0 && items[activeIdx]) {
        e.preventDefault()
        handleSelect(items[activeIdx])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  if (value && !open) {
    // Compact display (selected user)
    return (
      <div
        ref={containerRef}
        className={
          'flex items-center justify-between gap-2 rounded-md border border-input bg-white px-3 py-2 ' +
          (disabled ? 'opacity-60 cursor-not-allowed' : '')
        }
      >
        <button
          type="button"
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          onClick={() => {
            if (disabled) return
            setOpen(true)
            setQuery('')
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
          disabled={disabled}
        >
          <Avatar user={value} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-slate-900 truncate">
              {value.name ?? value.email}
            </span>
            <span className="block text-xs text-slate-500 truncate">
              {value.email}
            </span>
          </span>
        </button>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Temizle"
            className="text-slate-400 hover:text-slate-700 px-1"
          >
            ×
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        required={required && !value}
        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-72 overflow-y-auto">
          {loading && (
            <div className="p-3 text-center text-sm text-slate-500">
              Aranıyor...
            </div>
          )}
          {!loading && query.trim().length < 2 && (
            <div className="p-3 text-center text-xs text-slate-500">
              En az 2 karakter girin
            </div>
          )}
          {!loading && query.trim().length >= 2 && items.length === 0 && (
            <div className="p-3 text-center text-sm text-slate-500">Sonuç yok</div>
          )}
          {!loading &&
            items.map((u, i) => (
              <button
                key={u.id}
                type="button"
                className={
                  'w-full flex items-center gap-2 px-3 py-2 text-left transition ' +
                  (i === activeIdx
                    ? 'bg-slate-100'
                    : 'hover:bg-slate-50')
                }
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(u)
                }}
              >
                <Avatar user={u} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-slate-900 truncate">
                    {u.name ?? u.email}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">
                    {u.email}
                  </span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
