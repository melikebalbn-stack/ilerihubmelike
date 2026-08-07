'use client'

import { useEffect, useMemo, useState } from 'react'
import type { TumStokSatiri } from '@/lib/envanter/tum-stoklar'

// IV / Envanter — Stok Yönetimi altındaki "Tüm Stoklar" tablosu.
// Fetch yolu /api/envanter/* (sandbox yolu SIZDIRILMAZ). Tablo fontu text-xs —
// modülün diğer tablolarıyla aynı.

export function TumStoklarTablosu({ onUrunSec }: { onUrunSec: (urunId: string) => void }) {
  const [stoklar, setStoklar] = useState<TumStokSatiri[]>([])
  const [loading, setLoading] = useState(true)
  const [arama, setArama] = useState('')
  const [kategoriFiltre, setKategoriFiltre] = useState('')
  const [durumFiltre, setDurumFiltre] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/envanter/tum-stoklar')
        const json = await res.json()
        if (json.ok) setStoklar(json.data)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const kategoriler = useMemo(
    () =>
      Array.from(new Set(stoklar.map((s) => s.kategori).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'tr'),
      ),
    [stoklar],
  )

  const filtreli = stoklar.filter((s) => {
    if (kategoriFiltre && s.kategori !== kategoriFiltre) return false
    if (durumFiltre && s.durum !== durumFiltre) return false
    if (arama.trim()) {
      const q = arama.toLocaleLowerCase('tr')
      if (![s.urunKodu, s.urunAdi, s.kategori].join(' ').toLocaleLowerCase('tr').includes(q)) return false
    }
    return true
  })

  function durumRenk(d: string) {
    if (d === 'KRITIK') return 'bg-rose-50 text-rose-700'
    if (d === 'MINIMUM') return 'bg-amber-50 text-amber-700'
    if (d === 'EKSIK') return 'bg-slate-100 text-slate-500'
    return 'bg-emerald-50 text-emerald-700'
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Tüm Stoklar</h3>
        <span className="text-sm text-slate-500">
          {loading ? 'Yükleniyor...' : `${filtreli.length} kayıt`}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row">
        <input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Ürün adı / kodu ara..."
          className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <select
          value={kategoriFiltre}
          onChange={(e) => setKategoriFiltre(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        >
          <option value="">Tüm Kategoriler</option>
          {kategoriler.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select
          value={durumFiltre}
          onChange={(e) => setDurumFiltre(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
        >
          <option value="">Tüm Durumlar</option>
          <option value="NORMAL">Normal</option>
          <option value="MINIMUM">Minimum</option>
          <option value="KRITIK">Kritik</option>
          <option value="EKSIK">Eksik</option>
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">Kod</th>
              <th className="px-3 py-3">Ürün</th>
              <th className="px-3 py-3">Kategori</th>
              <th className="px-3 py-3">Varyant</th>
              <th className="px-3 py-3 text-right">Mevcut</th>
              <th className="px-3 py-3 text-right">Min</th>
              <th className="px-3 py-3 text-right">Kritik</th>
              <th className="px-3 py-3">Depo</th>
              <th className="px-3 py-3">Durum</th>
              <th className="px-3 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtreli.map((s) => (
              <tr key={s.stokId} className="hover:bg-slate-50">
                <td className="px-3 py-2.5 font-medium text-slate-700">{s.urunKodu}</td>
                <td className="px-3 py-2.5">{s.urunAdi}</td>
                <td className="px-3 py-2.5 text-slate-600">{s.kategori}</td>
                <td className="px-3 py-2.5">{s.varyantAdi || 'Ana Ürün'}</td>
                <td className="px-3 py-2.5 text-right font-medium">{s.mevcut}</td>
                <td className="px-3 py-2.5 text-right">{s.minStok ?? '-'}</td>
                <td className="px-3 py-2.5 text-right">{s.kritikStok ?? '-'}</td>
                <td className="px-3 py-2.5 text-slate-600">{s.depo || '-'}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${durumRenk(s.durum)}`}>
                    {s.durum}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onUrunSec(s.urunId)}
                    className="rounded-lg border px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    İşle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtreli.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-500">Kayıt bulunamadı.</div>
        )}
      </div>
    </div>
  )
}
