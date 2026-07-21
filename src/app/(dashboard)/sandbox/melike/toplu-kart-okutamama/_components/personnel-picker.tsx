"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"

export interface PickedPersonnel {
  id: string
  sicilNo: string | null
  adSoyad: string
  bolum: string
}

interface Props {
  value: PickedPersonnel | null
  onSelect: (personnel: PickedPersonnel) => void
  placeholder?: string
}

/**
 * Sicil No / Ad Soyad seçimi — SADECE Personel Yönetimi (İV) listesinden
 * seçim yapılabilir, elle serbest metin girişi kabul edilmez. Kullanıcı
 * yazdıkça arama yapılır ama dışarıya iletilen değer (onSelect) sadece
 * listeden bir satıra tıklandığında güncellenir.
 */
export function PersonnelPicker({ value, onSelect, placeholder }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PickedPersonnel[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/sandbox/melike/toplu-kart-okutamama/personnel-search?search=${encodeURIComponent(query)}`
        )
        if (res.ok) {
          setResults(await res.json())
        }
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div ref={ref} className="relative">
      <Input
        value={value ? `${value.sicilNo ? value.sicilNo + " - " : ""}${value.adSoyad}` : query}
        placeholder={placeholder || "Sicil No veya Ad Soyad ile ara..."}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setQuery("")
          setOpen(true)
        }}
        readOnly={false}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-56 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-sm text-muted-foreground">Aranıyor...</div>}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Sonuç bulunamadı</div>
          )}
          {!loading && query.trim().length < 2 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">En az 2 karakter yazın</div>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(p)
                setQuery("")
                setOpen(false)
              }}
            >
              <span className="font-medium">{p.sicilNo || "-"}</span> — {p.adSoyad}
              <span className="text-muted-foreground"> ({p.bolum})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
