"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// MASTER Madde 46 — "Şikâyetçi" alanı: serbest Personel ID yerine arama/seçim.
// Desen src/app/(dashboard)/forms/toplu-kart-okutamama/_components/personnel-picker.tsx'ten
// örnek alındı (debounce 300ms, min 2 karakter, dropdown); o bileşen kendi
// endpoint'ine sabitlendiği için TAŞINMADI, aynı UX yeniden yazıldı.
//
// Sözleşme değişmez: dışarı iletilen tek şey seçilen personelin `id`'si
// (mevcut sikayetciPersonnelId alanını dolduran bir arayüz).

export interface SikayetciAday {
  id: string
  adSoyad: string
  sicilNo: string | null
  bolum: string | null
}

interface Props {
  value: string
  onChange: (personnelId: string, aday: SikayetciAday | null) => void
  zorunlu?: boolean
}

export function SikayetciSecici({ value, onChange, zorunlu }: Props) {
  const [query, setQuery] = useState("")
  const [secilen, setSecilen] = useState<SikayetciAday | null>(null)
  const [sonuclar, setSonuclar] = useState<SikayetciAday[]>([])
  const [acik, setAcik] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Dışarıdan `value` temizlenirse (form reset) yerel seçim de temizlenir.
  useEffect(() => {
    if (!value) setSecilen(null)
  }, [value])

  useEffect(() => {
    function disaTikla(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener("mousedown", disaTikla)
    return () => document.removeEventListener("mousedown", disaTikla)
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setSonuclar([])
      return
    }
    const zamanlayici = setTimeout(async () => {
      setYukleniyor(true)
      try {
        const res = await fetch(
          `/api/servis-yonetimi/sikayet/sikayetci-secici?arama=${encodeURIComponent(query)}`,
        )
        if (res.ok) setSonuclar(await res.json())
      } finally {
        setYukleniyor(false)
      }
    }, 300)
    return () => clearTimeout(zamanlayici)
  }, [query])

  return (
    <div ref={ref} className="relative">
      <Label htmlFor="f-sikayetci">Şikâyetçi {zorunlu ? "*" : "(opsiyonel)"}</Label>
      <Input
        id="f-sikayetci"
        value={secilen ? `${secilen.sicilNo ? secilen.sicilNo + " - " : ""}${secilen.adSoyad}` : query}
        placeholder="Sicil No veya Ad Soyad ile ara..."
        onChange={(e) => {
          setQuery(e.target.value)
          setSecilen(null)
          setAcik(true)
          onChange("", null)
        }}
        onFocus={() => {
          if (!secilen) setAcik(true)
        }}
      />
      {acik && !secilen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-56 overflow-y-auto">
          {yukleniyor && <div className="px-3 py-2 text-sm text-muted-foreground">Aranıyor...</div>}
          {!yukleniyor && query.trim().length >= 2 && sonuclar.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Sonuç bulunamadı</div>
          )}
          {!yukleniyor && query.trim().length < 2 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">En az 2 karakter yazın</div>
          )}
          {sonuclar.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault()
                setSecilen(p)
                setQuery("")
                setAcik(false)
                onChange(p.id, p)
              }}
            >
              <span className="font-medium">{p.sicilNo || "-"}</span> — {p.adSoyad}
              <span className="text-muted-foreground"> ({p.bolum || "-"})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
