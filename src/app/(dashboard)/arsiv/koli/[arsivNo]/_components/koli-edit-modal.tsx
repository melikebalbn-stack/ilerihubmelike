'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Lokasyon = {
  id: number
  depoNo: string
  rafKodu: string
  siraNo: number
  kapasite: number
  mevcutDoluluk: number
}

type Props = {
  koli: {
    arsivNo: string
    durum: 'Aktif' | 'Arsivde' | 'ImhaYaklasti' | 'ImhaEdildi'
    aciklama: string | null
    lokasyonId: number | null
  }
  lokasyonlar: Lokasyon[]
  onClose: () => void
  /** Save success'inde çağrılır. Parent kapatma + refresh tetikler. */
  onSaved?: () => void
}

const DURUM_OPTIONS = [
  { value: 'Aktif', label: 'Aktif' },
  { value: 'Arsivde', label: 'Arşivde' },
  { value: 'ImhaYaklasti', label: 'İmha Yaklaştı' },
  { value: 'ImhaEdildi', label: 'İmha Edildi' },
]

export default function KoliEditModal({ koli, lokasyonlar, onClose, onSaved }: Props) {
  const router = useRouter()
  const [aciklama, setAciklama] = useState(koli.aciklama ?? '')
  const [durum, setDurum] = useState(koli.durum)
  const [lokasyonId, setLokasyonId] = useState<string>(
    koli.lokasyonId?.toString() ?? ''
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setSubmitting(true)

    const body: Record<string, unknown> = {}
    if (aciklama !== (koli.aciklama ?? '')) {
      body.aciklama = aciklama.trim() === '' ? null : aciklama
    }
    if (durum !== koli.durum) body.durum = durum
    const newLokId = lokasyonId === '' ? null : Number(lokasyonId)
    if (newLokId !== koli.lokasyonId) body.lokasyonId = newLokId

    if (Object.keys(body).length === 0) {
      onClose()
      return
    }

    try {
      const res = await fetch(`/api/arsiv/koli/${koli.arsivNo}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `Hata: ${res.status}`)
        setSubmitting(false)
        return
      }
      // Save başarılı: parent'a haber ver (parent close + refresh tetikler).
      // onSaved verilmemişse fallback olarak self-close + router.refresh.
      if (onSaved) {
        onSaved()
      } else {
        onClose()
        router.refresh()
      }
    } catch (e) {
      setError(`Bağlantı hatası: ${(e as Error).message}`)
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-lg font-semibold">Koliyi Düzenle</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">{koli.arsivNo}</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Durum</label>
            <select
              value={durum}
              onChange={(e) => setDurum(e.target.value as typeof durum)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
              disabled={submitting}
            >
              {DURUM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Lokasyon</label>
            <select
              value={lokasyonId}
              onChange={(e) => setLokasyonId(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
              disabled={submitting}
            >
              <option value="">Lokasyonsuz</option>
              {lokasyonlar.map((l) => {
                const dolu = l.mevcutDoluluk >= l.kapasite
                return (
                  <option
                    key={l.id}
                    value={l.id}
                    disabled={dolu && l.id !== koli.lokasyonId}
                  >
                    {l.depoNo}/{l.rafKodu}/{l.siraNo} ({l.mevcutDoluluk}/{l.kapasite})
                    {dolu && l.id !== koli.lokasyonId ? ' — DOLU' : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Açıklama</label>
            <textarea
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              disabled={submitting}
            />
            <p className="text-xs text-slate-500 mt-1">{aciklama.length}/500</p>
          </div>
          {error && (
            <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
              {error}
            </div>
          )}
        </div>
        <div className="p-5 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            İptal
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}
