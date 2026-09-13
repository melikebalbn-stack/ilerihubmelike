'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type FifRow = {
  id: string
  kayitNo: string
  tur: 'DUZELTICI' | 'ONLEYICI'
  tarih: string
  durum: string
  sorumluBolum: { id: string; name: string } | null
  uygunsuzlukTanimi: string | null
  faaliyetSayisi: number
}

const DURUM_ETIKET: Record<string, string> = {
  TASLAK: 'Taslak', ONAY_BEKLIYOR: 'Onay Bekliyor', FAALIYET: 'Faaliyet',
  KAPATMA_BEKLIYOR: 'Kapatma Bekliyor', ETKINLIK: 'Etkinlik', KAPANDI: 'Kapandı', IPTAL: 'İptal',
}
const DURUM_RENK: Record<string, string> = {
  TASLAK: 'bg-slate-100 text-slate-700', ONAY_BEKLIYOR: 'bg-amber-100 text-amber-800',
  FAALIYET: 'bg-blue-100 text-blue-800', KAPATMA_BEKLIYOR: 'bg-amber-100 text-amber-800',
  ETKINLIK: 'bg-indigo-100 text-indigo-800', KAPANDI: 'bg-green-100 text-green-800',
  IPTAL: 'bg-red-100 text-red-700',
}

export function FifListTable() {
  const [durum, setDurum] = useState('all')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<FifRow[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (durum !== 'all') p.set('durum', durum)
    if (q.trim()) p.set('q', q.trim())
    p.set('pageSize', '100')
    return p.toString()
  }, [durum, q])

  useEffect(() => {
    let iptal = false
    setYukleniyor(true)
    fetch(`/api/kalite/fif?${qs}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (!iptal) setRows(d.items ?? []) })
      .catch(() => { if (!iptal) setRows([]) })
      .finally(() => { if (!iptal) setYukleniyor(false) })
    return () => { iptal = true }
  }, [qs])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-56">
          <label className="text-xs text-slate-500">Durum</label>
          <Select value={durum} onValueChange={setDurum}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {Object.entries(DURUM_ETIKET).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs text-slate-500">Ara (kayıt no / bölüm)</label>
          <Input className="mt-1 h-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="FIF-2026-… veya bölüm adı" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Kayıt No</th>
              <th className="text-left px-3 py-2">Tür</th>
              <th className="text-left px-3 py-2">Tarih</th>
              <th className="text-left px-3 py-2">Sorumlu Bölüm</th>
              <th className="text-left px-3 py-2">Tespit</th>
              <th className="text-center px-3 py-2">Faaliyet</th>
              <th className="text-left px-3 py-2">Durum</th>
            </tr>
          </thead>
          <tbody>
            {yukleniyor ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Yükleniyor…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Kayıt yok</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/kalite/fif/${r.id}`} className="font-medium text-[#1B4F72] hover:underline">{r.kayitNo}</Link>
                </td>
                <td className="px-3 py-2">{r.tur === 'DUZELTICI' ? 'Düzeltici' : 'Önleyici'}</td>
                <td className="px-3 py-2">{new Date(r.tarih).toLocaleDateString('tr-TR')}</td>
                <td className="px-3 py-2">{r.sorumluBolum?.name ?? '—'}</td>
                <td className="px-3 py-2 max-w-[280px] truncate" title={r.uygunsuzlukTanimi ?? ''}>{r.uygunsuzlukTanimi ?? '—'}</td>
                <td className="px-3 py-2 text-center">{r.faaliyetSayisi}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${DURUM_RENK[r.durum] ?? 'bg-slate-100 text-slate-700'}`}>
                    {DURUM_ETIKET[r.durum] ?? r.durum}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
