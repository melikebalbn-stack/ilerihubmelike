'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

type Bolum = { id: number; ad: string; kod: string; renkHex: string }
type Lokasyon = { id: number; depoNo: string; rafKodu: string; siraNo: number }

const DURUM_OPTIONS = [
  { value: '', label: 'Tümü' },
  { value: 'Aktif', label: 'Aktif' },
  { value: 'Arsivde', label: 'Arşivde' },
  { value: 'ImhaYaklasti', label: 'İmha Yaklaştı' },
  { value: 'ImhaEdildi', label: 'İmha Edildi' },
]

export default function KoliFilters({
  bolumler,
  lokasyonlar,
  isSuperAdmin,
  currentParams,
}: {
  bolumler: Bolum[]
  lokasyonlar: Lokasyon[]
  isSuperAdmin: boolean
  currentParams: Record<string, string | undefined>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [bolumId, setBolumId] = useState(currentParams.bolumId ?? '')
  const [durum, setDurum] = useState(currentParams.durum ?? '')
  const [lokasyonId, setLokasyonId] = useState(currentParams.lokasyonId ?? '')
  const [yil, setYil] = useState(currentParams.yil ?? '')

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString())
    if (bolumId) params.set('bolumId', bolumId)
    else params.delete('bolumId')
    if (durum) params.set('durum', durum)
    else params.delete('durum')
    if (lokasyonId) params.set('lokasyonId', lokasyonId)
    else params.delete('lokasyonId')
    if (yil) params.set('yil', yil)
    else params.delete('yil')
    params.delete('page')
    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }

  function reset() {
    setBolumId('')
    setDurum('')
    setLokasyonId('')
    setYil('')
    startTransition(() => {
      router.push('/arsiv/koli')
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {isSuperAdmin && (
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Bölüm</label>
            <select
              value={bolumId}
              onChange={(e) => setBolumId(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
            >
              <option value="">Tümü</option>
              {bolumler.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.kod} — {b.ad}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">Durum</label>
          <select
            value={durum}
            onChange={(e) => setDurum(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
          >
            {DURUM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">Lokasyon</label>
          <select
            value={lokasyonId}
            onChange={(e) => setLokasyonId(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
          >
            <option value="">Tümü</option>
            <option value="null">Lokasyonsuz</option>
            {lokasyonlar.map((l) => (
              <option key={l.id} value={l.id}>
                {l.depoNo}/{l.rafKodu}/{l.siraNo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">Arşiv Yılı</label>
          <input
            type="number"
            min="2000"
            max="2100"
            placeholder="2026"
            value={yil}
            onChange={(e) => setYil(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={applyFilters}
            disabled={isPending}
            className="flex-1 rounded bg-slate-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? '...' : 'Uygula'}
          </button>
          <button
            onClick={reset}
            disabled={isPending}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Sıfırla
          </button>
        </div>
      </div>
    </div>
  )
}
