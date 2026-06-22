'use client'

/**
 * EvrakTuruSelect — Combobox + Inline create.
 *
 * - Tek input (toggle yok). Kullanıcı yazınca filtre.
 * - Tam eşleşme yoksa "+ '...' yeni evrak türü olarak ekle" satırı.
 * - Mini popup: ad + saklama yılı + (opsiyonel) yasal dayanak.
 * - Pending'ler form state'inde tutulur, DB'ye yazılmaz.
 * - Bolum değişince mevcut listeyi cache memory'den çeker.
 *
 * Props pattern: "controlled" — pending listesi parent (yeni-koli-form)
 * tarafından yönetilir; bu component sadece create-pending callback'i çağırır.
 */

import { useEffect, useState, useRef } from 'react'
import { Search, Plus, Check, X } from 'lucide-react'

export type EvrakTuruOption =
  | {
      kind: 'existing'
      id: number
      ad: string
      varsayilanSaklamaYili: number
    }
  | {
      kind: 'pending'
      tempId: string
      ad: string
      varsayilanSaklamaYili: number
      yasalDayanak?: string | null
    }

type ExistingItem = {
  id: number
  ad: string
  varsayilanSaklamaYili: number
}

type PendingItem = {
  tempId: string
  ad: string
  varsayilanSaklamaYili: number
  yasalDayanak?: string | null
}

type Props = {
  value: EvrakTuruOption | null
  onChange: (opt: EvrakTuruOption | null) => void
  bolumId: number | null
  pendingEvrakTurleri?: PendingItem[]
  onCreatePending?: (data: {
    ad: string
    varsayilanSaklamaYili: number
    yasalDayanak?: string
  }) => string
  disabled?: boolean
  required?: boolean
}

const cache = new Map<number, ExistingItem[]>()

export { EvrakTuruSelect }

export default function EvrakTuruSelect({
  value,
  onChange,
  bolumId,
  pendingEvrakTurleri = [],
  onCreatePending,
  disabled,
  required,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ExistingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastFetchedBolumId = useRef<number | null>(null)

  // Bolum değişince fetch (cached)
  useEffect(() => {
    if (bolumId === null) {
      setItems([])
      return
    }
    const cached = cache.get(bolumId)
    if (cached) {
      setItems(cached)
      return
    }
    if (lastFetchedBolumId.current === bolumId) return
    lastFetchedBolumId.current = bolumId

    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/arsiv/evrak-turu?bolumId=${bolumId}&aktif=true`, {
      credentials: 'include',
    })
      .then((r) => r.json().then((j) => ({ status: r.status, body: j })))
      .then(({ status, body }) => {
        if (cancelled) return
        if (status !== 200) {
          setError(body.error || `Hata: ${status}`)
          setItems([])
          return
        }
        const list: ExistingItem[] = body.items ?? []
        cache.set(bolumId, list)
        setItems(list)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(`Bağlantı: ${(e as Error).message}`)
          setItems([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [bolumId])

  // Outside click — close
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const normalized = query.trim().toLocaleLowerCase('tr')
  const allOptions: EvrakTuruOption[] = [
    ...items.map(
      (i) =>
        ({
          kind: 'existing' as const,
          id: i.id,
          ad: i.ad,
          varsayilanSaklamaYili: i.varsayilanSaklamaYili,
        }) satisfies EvrakTuruOption
    ),
    ...pendingEvrakTurleri.map(
      (p) =>
        ({
          kind: 'pending' as const,
          tempId: p.tempId,
          ad: p.ad,
          varsayilanSaklamaYili: p.varsayilanSaklamaYili,
          yasalDayanak: p.yasalDayanak,
        }) satisfies EvrakTuruOption
    ),
  ]
  const filtered =
    normalized === ''
      ? allOptions
      : allOptions.filter((o) =>
          o.ad.toLocaleLowerCase('tr').includes(normalized)
        )
  const exactMatch = filtered.some(
    (o) => o.ad.toLocaleLowerCase('tr') === normalized
  )
  const showCreateOption =
    normalized.length >= 2 &&
    !exactMatch &&
    bolumId !== null &&
    !!onCreatePending

  function handleSelect(opt: EvrakTuruOption) {
    onChange(opt)
    setQuery('')
    setOpen(false)
  }

  function handleCreatedPending(data: {
    ad: string
    varsayilanSaklamaYili: number
    yasalDayanak?: string
  }) {
    if (!onCreatePending) return
    const tempId = onCreatePending(data)
    onChange({
      kind: 'pending',
      tempId,
      ad: data.ad,
      varsayilanSaklamaYili: data.varsayilanSaklamaYili,
      yasalDayanak: data.yasalDayanak,
    })
    setShowCreateModal(false)
    setQuery('')
    setOpen(false)
  }

  function clearValue() {
    onChange(null)
  }

  // Seçili modunda göster (compact)
  if (value && !open) {
    return (
      <div ref={containerRef} className="relative">
        <div
          className={
            'w-full flex items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 ' +
            (disabled ? 'opacity-60 cursor-not-allowed' : '')
          }
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen(true)}
            className="flex-1 min-w-0 text-left flex items-center gap-2"
          >
            <span className="truncate text-sm">
              {value.ad}{' '}
              <span className="text-slate-500">
                ({value.varsayilanSaklamaYili} yıl)
              </span>
            </span>
            {value.kind === 'pending' && (
              <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded flex-shrink-0">
                Yeni
              </span>
            )}
          </button>
          {!disabled && (
            <button
              type="button"
              onClick={clearValue}
              className="text-slate-400 hover:text-slate-600 flex-shrink-0"
              aria-label="Temizle"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="text"
          disabled={disabled || bolumId === null}
          placeholder={
            bolumId === null
              ? 'Önce bölüm seçin'
              : 'Evrak türü ara veya yeni ekle'
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          required={required && !value}
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {open && bolumId !== null && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-72 overflow-y-auto">
          {loading && (
            <div className="p-3 text-sm text-slate-500">Yükleniyor...</div>
          )}
          {!loading && error && (
            <div className="p-3 text-sm text-rose-700">{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && !showCreateOption && (
            <div className="p-3 text-sm text-slate-500">Sonuç yok</div>
          )}
          {!loading &&
            !error &&
            filtered.map((opt) => {
              const isSelected =
                value &&
                value.kind === opt.kind &&
                ((value.kind === 'existing' &&
                  opt.kind === 'existing' &&
                  value.id === opt.id) ||
                  (value.kind === 'pending' &&
                    opt.kind === 'pending' &&
                    value.tempId === opt.tempId))
              return (
                <button
                  key={
                    opt.kind === 'existing' ? `e-${opt.id}` : `p-${opt.tempId}`
                  }
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(opt)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2"
                >
                  <span className="truncate text-sm">
                    {opt.ad}{' '}
                    <span className="text-slate-500">
                      ({opt.varsayilanSaklamaYili} yıl)
                    </span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    {opt.kind === 'pending' && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                        Yeni
                      </span>
                    )}
                    {isSelected && (
                      <Check size={14} className="text-emerald-600" />
                    )}
                  </span>
                </button>
              )
            })}
          {showCreateOption && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                setShowCreateModal(true)
              }}
              className="w-full text-left px-3 py-2 border-t border-slate-100 bg-amber-50 hover:bg-amber-100 text-amber-900 flex items-center gap-2 text-sm"
            >
              <Plus size={14} />
              <span>
                &quot;<strong>{query.trim()}</strong>&quot; olarak ekle
              </span>
            </button>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateEvrakTuruModal
          initialAd={query.trim()}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreatedPending}
        />
      )}
    </div>
  )
}

function CreateEvrakTuruModal({
  initialAd,
  onClose,
  onSubmit,
}: {
  initialAd: string
  onClose: () => void
  onSubmit: (data: {
    ad: string
    varsayilanSaklamaYili: number
    yasalDayanak?: string
  }) => void
}) {
  const [ad, setAd] = useState(initialAd)
  const [saklama, setSaklama] = useState(10)
  const [yasalDayanak, setYasalDayanak] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (ad.trim().length < 3) {
      setError('Ad en az 3 karakter olmalı')
      return
    }
    if (ad.length > 150) {
      setError('Ad 150 karakteri geçemez')
      return
    }
    if (!Number.isInteger(saklama) || saklama < 1 || saklama > 100) {
      setError('Saklama süresi 1-100 yıl arası olmalı')
      return
    }
    if (yasalDayanak.length > 250) {
      setError('Yasal dayanak 250 karakteri geçemez')
      return
    }
    onSubmit({
      ad: ad.trim(),
      varsayilanSaklamaYili: saklama,
      yasalDayanak: yasalDayanak.trim() || undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4"
      >
        <div>
          <h3 className="text-lg font-semibold">Yeni Evrak Türü</h3>
          <p className="text-sm text-slate-500 mt-1">
            Bu evrak türü, koli oluşturulduğunda kalıcı olarak eklenecektir.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Evrak Türü Adı <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            value={ad}
            onChange={(e) => setAd(e.target.value)}
            maxLength={150}
            autoFocus
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Varsayılan Saklama Süresi (yıl){' '}
            <span className="text-rose-600">*</span>
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={saklama}
            onChange={(e) => setSaklama(Number(e.target.value))}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">
            1-100 yıl arası. ISO 27001, TTK ve VUK gerekliliklerine göre belirleyin.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Yasal Dayanak{' '}
            <span className="text-slate-400 text-xs">(opsiyonel)</span>
          </label>
          <input
            type="text"
            value={yasalDayanak}
            onChange={(e) => setYasalDayanak(e.target.value)}
            maxLength={250}
            placeholder="Örn: TTK Md. 82, VUK Md. 253"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </div>

        {error && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-md text-sm hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800"
          >
            Ekle
          </button>
        </div>
      </form>
    </div>
  )
}
