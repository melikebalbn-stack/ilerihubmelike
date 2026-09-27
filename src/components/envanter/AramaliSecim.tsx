'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { envanterAramaEslesir } from './EnvanterArama'

export type AramaliSecimSecenek = {
  id: string
  etiket: string
  /** Etikette GÖRÜNMEYEN ama aranabilir olması gereken alanlar (kategori, varyant özeti…). */
  aramaEk?: (string | null | undefined)[]
}

// Aranabilir seçim (combobox). Dış tıklamada kapanır. Yeniden kullanılabilir —
// page.tsx içine gömülmez. Elif'in sandbox'taki gömülü sürümünün ölü state'leri
// (personelArama/urunArama) buraya TAŞINMADI; arama bileşenin kendi iç state'i.
//
// 27.09.2026 — uzun listeler için iki ekleme: (a) klavye ile gezinme
// (↑/↓/Enter/Esc/Home/End, aria-activedescendant), (b) `aramaEk` ile etiket
// dışındaki alanlarda da arama. Eşleşme kuralı modüldeki TEK kural:
// envanterAramaEslesir (tr-TR yerel küçük harf; "İŞ" → "iş" tuzağı).
export function AramaliSecim({
  secenekler,
  deger,
  onChange,
  placeholder,
  aramaPlaceholder = 'Ara...',
  className = '',
}: {
  secenekler: AramaliSecimSecenek[]
  deger: string
  onChange: (id: string) => void
  placeholder: string
  aramaPlaceholder?: string
  className?: string
}) {
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')
  const [vurgu, setVurgu] = useState(0)
  const kutuRef = useRef<HTMLDivElement>(null)
  const listeRef = useRef<HTMLDivElement>(null)
  const tetikRef = useRef<HTMLButtonElement>(null)
  const listeId = useRef(`aramali-secim-${Math.random().toString(36).slice(2, 9)}`)

  useEffect(() => {
    function disTikla(e: MouseEvent) {
      if (kutuRef.current && !kutuRef.current.contains(e.target as Node)) {
        setAcik(false)
      }
    }
    document.addEventListener('mousedown', disTikla)
    return () => document.removeEventListener('mousedown', disTikla)
  }, [])

  const secili = secenekler.find((s) => s.id === deger)
  const filtreli = useMemo(
    () => secenekler.filter((s) => envanterAramaEslesir(arama, [s.etiket, ...(s.aramaEk ?? [])])),
    [secenekler, arama],
  )

  // Arama değişince vurgu başa döner; liste kısaldığında taşmasın diye de sıkıştırılır.
  useEffect(() => {
    setVurgu((v) => (v > filtreli.length - 1 ? 0 : v))
  }, [filtreli.length])

  // Vurgulanan satır görünür kalsın (uzun listede klavyeyle gezinme).
  useEffect(() => {
    if (!acik) return
    const el = listeRef.current?.querySelector<HTMLElement>(`[data-idx="${vurgu}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [vurgu, acik])

  function ac() {
    setAcik(true)
    // Seçili kayıt varsa onun üzerinden başla.
    const i = filtreli.findIndex((s) => s.id === deger)
    setVurgu(i >= 0 ? i : 0)
  }

  function sec(id: string) {
    onChange(id)
    setAcik(false)
    setArama('')
    tetikRef.current?.focus()
  }

  function aramaKlavye(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setVurgu((v) => Math.min(v + 1, filtreli.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setVurgu((v) => Math.max(v - 1, 0))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setVurgu(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setVurgu(Math.max(filtreli.length - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const s = filtreli[vurgu]
      if (s) sec(s.id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setAcik(false)
      setArama('')
      tetikRef.current?.focus()
    } else if (e.key === 'Tab') {
      setAcik(false)
    }
  }

  return (
    <div ref={kutuRef} className={`relative mt-1 ${className}`}>
      <button
        ref={tetikRef}
        type="button"
        role="combobox"
        aria-expanded={acik}
        aria-controls={listeId.current}
        aria-haspopup="listbox"
        onClick={() => (acik ? setAcik(false) : ac())}
        onKeyDown={(e) => {
          if (!acik && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            ac()
          }
        }}
        className="flex w-full items-center justify-between rounded-xl border p-2 text-left text-sm"
      >
        <span className={secili ? 'text-slate-900' : 'text-slate-400'}>
          {secili ? secili.etiket : placeholder}
        </span>
        <span className="text-slate-400">▾</span>
      </button>
      {acik && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg">
          <input
            autoFocus
            value={arama}
            onChange={(e) => {
              setArama(e.target.value)
              setVurgu(0)
            }}
            onKeyDown={aramaKlavye}
            placeholder={aramaPlaceholder}
            aria-controls={listeId.current}
            aria-activedescendant={filtreli[vurgu] ? `${listeId.current}-${vurgu}` : undefined}
            className="w-full border-b p-2 text-sm outline-none"
          />
          <div ref={listeRef} id={listeId.current} role="listbox" className="max-h-60 overflow-auto">
            {filtreli.length === 0 ? (
              <p className="p-2 text-sm text-slate-400">Sonuç yok</p>
            ) : (
              filtreli.map((s, i) => (
                <button
                  key={s.id}
                  id={`${listeId.current}-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={s.id === deger}
                  type="button"
                  // Fare ile gezinirken vurgu da imleci izlesin (Enter tutarlı olsun).
                  onMouseEnter={() => setVurgu(i)}
                  onClick={() => sec(s.id)}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    i === vurgu ? 'bg-slate-100' : ''
                  } ${s.id === deger ? 'bg-teal-50 font-medium text-teal-700' : 'text-slate-700'}`}
                >
                  {s.etiket}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
