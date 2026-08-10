'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { normalizeTr } from '@/lib/normalize-tr'

export type HataKoduSecenek = {
  id: string
  kod: number
  ad: string
  tip: 'BOLUM' | 'KOD'
  ustKodId: string | null
  aktif: boolean
}

type Props = {
  value: string | null
  onChange: (id: string | null) => void
  /** Aday liste — çağıran tip'e göre ZATEN süzmüş olmalı. */
  secenekler: HataKoduSecenek[]
  /** Hata kodu satırlarında ait olduğu bölümü göstermek için (id → "100 Satış"). */
  bolumEtiketi?: (s: HataKoduSecenek) => string | null
  placeholder?: string
  disabled?: boolean
}

/**
 * Bölüm / hata kodu seçici — aranabilir açılır liste.
 *
 * Arama İSTEMCİDE: liste zaten tümüyle yüklü (~128 kayıt), sunucuya gitmeye gerek yok.
 * Görsel dil `UstKodSecici`/`MusteriSecici` ile aynı: Search ikonlu input, mutlak
 * konumlu liste, `onMouseDown` + preventDefault (blur seçimi yutmasın), dışarı tıkla-kapat.
 *
 * `UstKodSecici` yeniden kullanılMADI: oradaki metinler hata kodu ağacına özel
 * ("Üst yok (ana başlık)") ve burada ait olduğu bölümü de göstermek gerekiyor.
 */
export function HataKoduSecici({
  value,
  onChange,
  secenekler,
  bolumEtiketi,
  placeholder,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const secili = useMemo(
    () => (value ? (secenekler.find((s) => s.id === value) ?? null) : null),
    [value, secenekler],
  )

  const filtreli = useMemo(() => {
    const term = q.trim()
    if (!term) return secenekler
    const nq = normalizeTr(term)
    return secenekler.filter(
      (s) => String(s.kod).includes(term) || normalizeTr(s.ad).includes(nq),
    )
  }, [q, secenekler])

  if (secili && !open) {
    const bolum = bolumEtiketi?.(secili)
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md border bg-slate-50 px-3 py-2 text-sm min-w-0">
          <span className="font-quality-mono text-xs text-slate-500">{secili.kod}</span>
          {' — '}
          <span className="font-medium">{secili.ad}</span>
          {bolum && <span className="text-xs text-slate-400"> · {bolum}</span>}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setQ('')
            }}
            className="text-slate-400 hover:text-slate-700 shrink-0"
            aria-label="Seçimi kaldır"
            title="Seçimi kaldır"
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
          placeholder={placeholder ?? 'Kod veya ad ile ara…'}
          className="pl-8 h-9"
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-64 overflow-y-auto">
          <button
            type="button"
            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${
              value === null ? 'bg-slate-50 font-medium' : ''
            }`}
            onMouseDown={(e) => {
              e.preventDefault()
              onChange(null)
              setQ('')
              setOpen(false)
            }}
          >
            Seçilmedi
          </button>
          <div className="border-t" />
          {filtreli.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">Sonuç yok</div>
          ) : (
            filtreli.map((s) => {
              const bolum = bolumEtiketi?.(s)
              return (
                <button
                  key={s.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(s.id)
                    setQ('')
                    setOpen(false)
                  }}
                >
                  <span className="font-quality-mono text-xs text-slate-500">{s.kod}</span>
                  {' — '}
                  {s.ad}
                  {bolum && <span className="text-xs text-slate-400"> · {bolum}</span>}
                  {!s.aktif && <span className="ml-2 text-[11px] text-slate-400">(pasif)</span>}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
