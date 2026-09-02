"use client"

import { useState, useRef, useEffect } from "react"
import { AlertTriangle, X } from "lucide-react"
import { Input } from "@/components/ui/input"

interface Props {
  value: string
  onChange: (value: string) => void
  personnel: string[]
  id?: string
  placeholder?: string
}

export function PersonnelAutocomplete({ value, onChange, personnel, id, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const q = inputValue.toLowerCase()
  const filtered = q.length > 0
    ? personnel.filter((p) => p.toLowerCase().includes(q)).slice(0, 10)
    : []

  return (
    <div ref={ref} className="relative">
      <Input
        id={id}
        value={inputValue}
        placeholder={placeholder}
        onChange={(e) => {
          setInputValue(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => { if (inputValue) setOpen(true) }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((name) => (
            <button
              key={name}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault()
                setInputValue(name)
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

/** Seçici adayı — `/api/personnel/secici` yanıtının alanları. */
export interface PersonelSecenegi {
  id: string
  adSoyad: string
  sicilNo?: string | null
}

interface IdProps {
  /** Metin alanının değeri (Personnel.birimSorumlusu vb. — METİN olarak yazılmaya devam eder). */
  value: string
  /** Seçili adayın Personnel.id'si; elle yazılmışsa null. */
  valueId?: string | null
  /** Listeden seçimde (ad, id); elle yazımda (metin, null). */
  onChange: (ad: string, id: string | null) => void
  personnel: PersonelSecenegi[]
  id?: string
  placeholder?: string
  yukleniyor?: boolean
}

/**
 * `PersonnelAutocomplete`in id döndüren varyantı — dept-org-dialog.tsx içindeki
 * `PersonnelIdPicker` deseninin ortak sürümü.
 *
 * NEDEN: ad-string sürümü serbest metne izin verdiği için yanlış yazılmış sorumlu
 * adları (`ELİF KASAR`, `KORAY İLERİ` …) veriye giriyordu; sunucu adı FK'ya
 * çeviremeyince FK sessizce null kalıyordu. Listeden seçim artık Personnel.id'yi
 * de taşır. Elle yazım ENGELLENMEZ (Excel/Azure/işe alım aynı alanları serbest
 * metinle doldurmaya devam ediyor) — yalnız görünür uyarı verilir.
 */
export function PersonnelIdAutocomplete({
  value,
  valueId,
  onChange,
  personnel,
  id,
  placeholder,
  yukleniyor,
}: IdProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const q = inputValue.toLowerCase()
  const filtered = q.length > 0
    ? personnel
        .filter((p) => p.adSoyad.toLowerCase().includes(q) || (p.sicilNo ?? "").toLowerCase().includes(q))
        .slice(0, 10)
    : []

  const girilen = inputValue.trim()
  // Uyarı ölçütü: dolu bir değer var ama listede o adda aktif personel yok.
  // Liste yüklenmeden uyarı gösterilmez (yanlış alarm).
  const listedeVar = girilen === "" || personnel.some((p) => p.adSoyad === girilen)
  const uyari = !listedeVar && !yukleniyor && personnel.length > 0

  return (
    <div ref={ref} className="relative space-y-1">
      <div className="flex items-center gap-1">
        <Input
          id={id}
          value={inputValue}
          placeholder={placeholder}
          onChange={(e) => {
            setInputValue(e.target.value)
            onChange(e.target.value, null) // elle yazım → FK adayı düşer
            setOpen(true)
          }}
          onFocus={() => { if (inputValue) setOpen(true) }}
        />
        {(girilen !== "" || valueId) && (
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            title="Temizle"
            onClick={() => { setInputValue(""); onChange("", null); setOpen(false) }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {uyari && (
        <div className="flex items-start gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>Bu ad aktif personel listesinde yok. Değer korunur, kayıt engellenmez.</span>
        </div>
      )}

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault()
                setInputValue(p.adSoyad)
                onChange(p.adSoyad, p.id)
                setOpen(false)
              }}
            >
              {p.adSoyad}
              {p.sicilNo ? <span className="text-muted-foreground"> · {p.sicilNo}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
