'use client'

import { useEffect, useRef, useState } from 'react'

// Aranabilir seçim (combobox). Dış tıklamada kapanır. Yeniden kullanılabilir —
// page.tsx içine gömülmez. Elif'in sandbox'taki gömülü sürümünün ölü state'leri
// (personelArama/urunArama) buraya TAŞINMADI; arama bileşenin kendi iç state'i.
export function AramaliSecim({
  secenekler,
  deger,
  onChange,
  placeholder,
}: {
  secenekler: { id: string; etiket: string }[]
  deger: string
  onChange: (id: string) => void
  placeholder: string
}) {
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')
  const kutuRef = useRef<HTMLDivElement>(null)

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
  const filtreli = secenekler.filter((s) => {
    const q = arama.toLocaleLowerCase('tr')
    if (!q) return true
    return s.etiket.toLocaleLowerCase('tr').includes(q)
  })

  return (
    <div ref={kutuRef} className="relative mt-1">
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
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
            onChange={(e) => setArama(e.target.value)}
            placeholder="Ara..."
            className="w-full border-b p-2 text-sm outline-none"
          />
          <div className="max-h-60 overflow-auto">
            {filtreli.length === 0 ? (
              <p className="p-2 text-sm text-slate-400">Sonuç yok</p>
            ) : (
              filtreli.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onChange(s.id)
                    setAcik(false)
                    setArama('')
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 ${
                    s.id === deger ? 'bg-teal-50 font-medium text-teal-700' : 'text-slate-700'
                  }`}
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
