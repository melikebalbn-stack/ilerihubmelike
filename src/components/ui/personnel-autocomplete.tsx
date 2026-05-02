"use client"

import { useState, useRef, useEffect } from "react"
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
