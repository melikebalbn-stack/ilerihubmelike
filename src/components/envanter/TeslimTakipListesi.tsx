'use client'

import { useEffect, useState } from 'react'
import { Download, SlidersHorizontal } from 'lucide-react'
import * as XLSX from 'xlsx'
import type { TeslimHucre, TeslimListesiSonuc } from '@/lib/envanter/teslim-listesi'

// IV / Envanter — Personel bazında KKD teslim takip matrisi.
// Fetch yolu /api/envanter/* (sandbox yolu SIZDIRILMAZ). Tablo fontu text-xs.

export function TeslimTakipListesi() {
  const [veri, setVeri] = useState<TeslimListesiSonuc | null>(null)
  const [loading, setLoading] = useState(true)
  const [bolum, setBolum] = useState('')
  const [arama, setArama] = useState('')
  const [kolonPanelAcik, setKolonPanelAcik] = useState(false)
  const [gizliKolonlar, setGizliKolonlar] = useState<Set<string>>(new Set())

  const BEDEN_KOLONLARI = ['Üst Beden', 'Alt Beden', 'Ayakkabı No', 'Eldiven No']

  function kolonAcik(key: string) {
    return !gizliKolonlar.has(key)
  }
  function kolonTogle(key: string) {
    setGizliKolonlar((prev) => {
      const y = new Set(prev)
      if (y.has(key)) y.delete(key)
      else y.add(key)
      return y
    })
  }
  function tumKolonlar(): string[] {
    return [...BEDEN_KOLONLARI, ...(veri?.gruplar ?? [])]
  }
  function tumunuSec() {
    setGizliKolonlar(new Set())
  }
  function tumunuKaldir() {
    setGizliKolonlar(new Set(tumKolonlar()))
  }

  useEffect(() => {
    loadListe(bolum || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bolum])

  async function loadListe(b?: string) {
    setLoading(true)
    try {
      const url = b
        ? `/api/envanter/teslim-listesi?bolum=${encodeURIComponent(b)}`
        : '/api/envanter/teslim-listesi'
      const res = await fetch(url)
      const json = await res.json()
      if (json.ok) setVeri(json.data)
    } finally {
      setLoading(false)
    }
  }

  function fmtTarih(t: string | null) {
    if (!t) return ''
    const [y, m, g] = t.split('-')
    return `${g}.${m}.${y}`
  }

  function hucreMetni(h: TeslimHucre | undefined) {
    if (!h) return ''
    const tarih = fmtTarih(h.sonTarih)
    return h.adet > 1 ? `${tarih} (${h.adet}×)` : tarih
  }

  // Yenileme durumuna göre renk: periyodu geçmiş kırmızı, yaklaşan amber,
  // periyodu olmayan (eskiyince/gerektiğinde) nötr.
  function hucreRenk(grup: string, h: TeslimHucre | undefined) {
    if (!h || !h.sonTarih) return ''
    const periyotAy = veri?.grupPeriyotlari?.[grup]
    if (!periyotAy) return '' // süresiz grup — renk yok
    const son = new Date(h.sonTarih)
    const gecenGun = (Date.now() - son.getTime()) / (1000 * 60 * 60 * 24)
    const periyotGun = periyotAy * 30
    if (gecenGun >= periyotGun) return 'bg-rose-50 text-rose-700'
    if (gecenGun >= periyotGun * 0.8) return 'bg-amber-50 text-amber-700'
    return ''
  }

  const satirlar = (veri?.satirlar ?? []).filter((s) => {
    if (!arama.trim()) return true
    const q = arama.toLocaleLowerCase('tr')
    return (
      s.adSoyad.toLocaleLowerCase('tr').includes(q) ||
      (s.sicilNo ?? '').toLocaleLowerCase('tr').includes(q)
    )
  })

  function handleExcelAktar() {
    if (!veri) return
    const gruplar = veri.gruplar.filter((g) => kolonAcik(g))
    const bedenBasliklari = BEDEN_KOLONLARI.filter((k) => kolonAcik(k))
    const basliklar = ['Sicil', 'Ad Soyad', 'Sınıf', 'Bölüm', ...bedenBasliklari, ...gruplar]
    const satirVerileri = satirlar.map((s) => {
      const row: Record<string, string> = {
        Sicil: s.sicilNo || '',
        'Ad Soyad': s.adSoyad,
        Sınıf: s.sinif || '',
        Bölüm: s.bolum,
      }
      if (kolonAcik('Üst Beden')) row['Üst Beden'] = s.ustBeden || ''
      if (kolonAcik('Alt Beden')) row['Alt Beden'] = s.altBeden || ''
      if (kolonAcik('Ayakkabı No')) row['Ayakkabı No'] = s.ayakkabiNo || ''
      if (kolonAcik('Eldiven No')) row['Eldiven No'] = s.eldivenNo || ''
      for (const g of gruplar) row[g] = hucreMetni(s.hucreler[g])
      return row
    })
    const ws = XLSX.utils.json_to_sheet(satirVerileri, { header: basliklar })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Teslim Takip')
    const bugun = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `KKD_Teslim_Takip_${bugun}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Teslim Takip Listesi</h2>
        <p className="mt-2 text-sm text-slate-500">
          Personel bazında KKD teslim durumu. Her hücre, o gruptaki son verilme tarihini ve
          toplam teslim adedini gösterir.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="text-sm font-medium">Bölüm</label>
            <select
              value={bolum}
              onChange={(e) => setBolum(e.target.value)}
              className="mt-1 w-full min-w-48 rounded-xl border p-2 text-sm"
            >
              <option value="">Tüm bölümler</option>
              {(veri?.bolumler ?? []).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium">Ara (ad / sicil)</label>
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Ara..."
              className="mt-1 w-full max-w-xs rounded-xl border p-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-3 pb-2">
            <span className="text-sm text-slate-500">
              {loading ? 'Yükleniyor...' : `${satirlar.length} personel`}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setKolonPanelAcik((v) => !v)}
                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Kolonlar
              </button>
              {kolonPanelAcik && (
                <div className="absolute right-0 z-20 mt-2 max-h-80 w-64 overflow-y-auto rounded-xl border bg-white p-3 shadow-lg">
                  <div className="mb-2 flex items-center justify-between border-b pb-2">
                    <button
                      type="button"
                      onClick={tumunuSec}
                      className="text-xs font-medium text-teal-700 hover:underline"
                    >
                      Tümünü seç
                    </button>
                    <button
                      type="button"
                      onClick={tumunuKaldir}
                      className="text-xs font-medium text-slate-500 hover:underline"
                    >
                      Tümünü kaldır
                    </button>
                  </div>
                  <div className="mb-1 text-xs font-semibold uppercase text-slate-400">Beden</div>
                  {BEDEN_KOLONLARI.map((k) => (
                    <label
                      key={k}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-slate-50"
                    >
                      <input type="checkbox" checked={kolonAcik(k)} onChange={() => kolonTogle(k)} />
                      {k}
                    </label>
                  ))}
                  <div className="mb-1 mt-2 text-xs font-semibold uppercase text-slate-400">
                    KKD Grupları
                  </div>
                  {(veri?.gruplar ?? []).map((g) => (
                    <label
                      key={g}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-slate-50"
                    >
                      <input type="checkbox" checked={kolonAcik(g)} onChange={() => kolonTogle(g)} />
                      {g}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleExcelAktar}
              disabled={loading || satirlar.length === 0}
              className="flex items-center gap-2 rounded-xl border border-teal-700 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Excel&apos;e Aktar
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-2 shadow-sm">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Yükleniyor...</p>
        ) : !veri || satirlar.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Kayıt bulunamadı.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-left font-semibold text-slate-600">
                  <th className="sticky left-0 z-10 whitespace-nowrap bg-slate-50 px-2 py-2">Sicil</th>
                  <th className="whitespace-nowrap px-2 py-2">Ad Soyad</th>
                  <th className="whitespace-nowrap px-2 py-2">Sınıf</th>
                  <th className="whitespace-nowrap px-2 py-2">Bölüm</th>
                  {kolonAcik('Üst Beden') && <th className="whitespace-nowrap px-2 py-2">Üst</th>}
                  {kolonAcik('Alt Beden') && <th className="whitespace-nowrap px-2 py-2">Alt</th>}
                  {kolonAcik('Ayakkabı No') && <th className="whitespace-nowrap px-2 py-2">Ayk</th>}
                  {kolonAcik('Eldiven No') && <th className="whitespace-nowrap px-2 py-2">Eld</th>}
                  {veri.gruplar
                    .filter((g) => kolonAcik(g))
                    .map((g) => (
                      <th key={g} className="whitespace-nowrap px-2 py-2 text-center">
                        {g}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr key={s.personnelId} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1.5 font-medium">
                      {s.sicilNo || '-'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">{s.adSoyad}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">{s.sinif || '-'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-slate-500">{s.bolum}</td>
                    {kolonAcik('Üst Beden') && (
                      <td className="whitespace-nowrap px-2 py-1.5">{s.ustBeden || '-'}</td>
                    )}
                    {kolonAcik('Alt Beden') && (
                      <td className="whitespace-nowrap px-2 py-1.5">{s.altBeden || '-'}</td>
                    )}
                    {kolonAcik('Ayakkabı No') && (
                      <td className="whitespace-nowrap px-2 py-1.5">{s.ayakkabiNo || '-'}</td>
                    )}
                    {kolonAcik('Eldiven No') && (
                      <td className="whitespace-nowrap px-2 py-1.5">{s.eldivenNo || '-'}</td>
                    )}
                    {veri.gruplar
                      .filter((g) => kolonAcik(g))
                      .map((g) => {
                        const h = s.hucreler[g]
                        const renk = hucreRenk(g, h)
                        return (
                          <td key={g} className="whitespace-nowrap px-2 py-1.5 text-center">
                            {h ? (
                              <span className={`rounded px-1.5 py-0.5 ${renk || 'text-slate-700'}`}>
                                {fmtTarih(h.sonTarih)}
                                {h.adet > 1 && <span className="opacity-60"> ({h.adet}×)</span>}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        )
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
