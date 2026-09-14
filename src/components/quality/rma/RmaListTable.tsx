'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart3, Download, Loader2, Search, Upload, UserCheck, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MusteriSecici, type MusteriOption } from './MusteriSecici'
import { RmaImportDialog } from './RmaImportDialog'
import { RmaKpiDialog } from './RmaKpiDialog'
import { RMA_TIP_LABELS, RMA_IADE_TURU_LABELS } from '@/lib/quality/rma-labels'

interface RmaRow {
  id: string
  no: number
  tip: 'RMA' | 'SMA'
  irsaliyeTarihi: string | null
  iadeTuru: keyof typeof RMA_IADE_TURU_LABELS | null
  durum: 'ACIK' | 'KAPALI'
  satirSayisi: number
  toplamMiktar: number
  sorumluAd: string | null
  musteri: { id: string; name: string; code: string } | null
}

const PAGE_SIZE = 20

export function RmaListTable({ canManage = false }: { canManage?: boolean }) {
  const [items, setItems] = useState<RmaRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [kpiOpen, setKpiOpen] = useState(false)

  const [tip, setTip] = useState('all')
  const [musteri, setMusteri] = useState<MusteriOption | null>(null)
  const [durum, setDurum] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  // "Bana atananlar": sorumluId = oturumun personnelId'si. Eşleştirme SUNUCUDA
  // yapılır (session'da personnelId yok); personel bağlantısı yoksa sonuç boş döner.
  const [sadeceBana, setSadeceBana] = useState(false)
  const [page, setPage] = useState(1)

  // Liste ucu + Excel export AYNI filtre string'ini kullansın (ıraksamasın).
  const buildFilterParams = useCallback(() => {
    const p = new URLSearchParams()
    if (tip !== 'all') p.set('tip', tip)
    if (musteri) p.set('musteriId', musteri.id)
    if (durum !== 'all') p.set('durum', durum)
    if (from) p.set('from', new Date(from).toISOString())
    if (to) {
      const e = new Date(to)
      e.setHours(23, 59, 59, 999)
      p.set('to', e.toISOString())
    }
    if (q.trim()) p.set('q', q.trim())
    if (sadeceBana) p.set('sadeceBana', '1')
    return p
  }, [tip, musteri, durum, from, to, q, sadeceBana])

  const fetchList = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const p = buildFilterParams()
      p.set('page', String(page))
      p.set('pageSize', String(PAGE_SIZE))
      const res = await fetch(`/api/quality/rma?${p.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setItems(json.items ?? [])
      setTotal(json.total ?? 0)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [buildFilterParams, page])

  function handleExport() {
    const p = buildFilterParams()
    const qs = p.toString()
    window.location.href = `/api/quality/rma/export${qs ? `?${qs}` : ''}`
  }

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters =
    tip !== 'all' || musteri !== null || durum !== 'all' || from !== '' || to !== '' || q.trim() !== '' || sadeceBana

  function reset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPage(1)
    }
  }
  function clearFilters() {
    setTip('all')
    setMusteri(null)
    setDurum('all')
    setFrom('')
    setTo('')
    setQ('')
    setSadeceBana(false)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Araç çubuğu — bana atananlar · Excel aktar/yükle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant={sadeceBana ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setSadeceBana((v) => !v); setPage(1) }}
          aria-pressed={sadeceBana}
          className={sadeceBana ? 'bg-[#1B4F72] hover:bg-[#1B4F72]/90 shrink-0' : 'shrink-0'}
        >
          <UserCheck className="h-4 w-4 mr-1 shrink-0" />
          Bana atananlar
        </Button>
        <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setKpiOpen(true)} className="shrink-0">
          <BarChart3 className="h-4 w-4 mr-1 shrink-0" />
          KPI
        </Button>
        {/* Uçla AYNI kural (rma/export): tüm kayıtlar yalnız canManage; "Sadece Bana"
            açıkken herkes kendi kayıtlarını indirebilir (sorumlu kipi). */}
        {(canManage || sadeceBana) && (
          <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0">
            <Download className="h-4 w-4 mr-1 shrink-0" />
            Excel&apos;e Aktar
          </Button>
        )}
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="shrink-0"
          >
            <Upload className="h-4 w-4 mr-1 shrink-0" />
            Excel&apos;den Yükle
          </Button>
        )}
        </div>
      </div>

      {/* KPI modalı: listedeki AKTİF filtre aynen geçer (buildFilterParams TEK KAYNAK). */}
      <RmaKpiDialog
        open={kpiOpen}
        onOpenChange={setKpiOpen}
        filtreParams={buildFilterParams().toString()}
      />

      {canManage && (
        <RmaImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={() => {
            setPage(1)
            fetchList()
          }}
        />
      )}

      {/* Filtre bar */}
      <div className="rounded-md border bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-slate-600">Tip</Label>
            <Select value={tip} onValueChange={reset(setTip)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="RMA">RMA</SelectItem>
                <SelectItem value="SMA">SMA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Durum</Label>
            <Select value={durum} onValueChange={reset(setDurum)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="acik">Açık</SelectItem>
                <SelectItem value="kapali">Kapalı</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Müşteri</Label>
            <div className="mt-1">
              <MusteriSecici value={musteri} onChange={reset(setMusteri)} placeholder="Müşteri ara…" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-600">İrsaliye (başlangıç)</Label>
            <Input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className="mt-1 h-9" />
          </div>
          <div>
            <Label className="text-xs text-slate-600">İrsaliye (bitiş)</Label>
            <Input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} className="mt-1 h-9" />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Ara (no / ürün kodu / müşteri)</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchList() } }}
              placeholder="3623 / ABC-12 / TÜRK…"
              className="mt-1 h-9"
            />
          </div>
        </div>
        {hasFilters && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{total} sonuç</span>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" /> Filtreleri Temizle
            </Button>
          </div>
        )}
      </div>

      {/* Tablo */}
      {loading ? (
        <div className="rounded-md border bg-white p-12 text-center text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Yükleniyor...
        </div>
      ) : err ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">Hata: {err}</div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed bg-slate-50 p-12 text-center">
          <Search className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-slate-600">{hasFilters ? 'Filtrelere uyan kayıt yok' : 'Henüz kayıt yok'}</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-white overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[980px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['No', 'Tip', 'İrsaliye Tarihi', 'Müşteri', 'İade Türü', 'Satır', 'Toplam Miktar', 'Durum', 'Sorumlu'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                    <td className="px-3 py-2 font-mono">
                      <Link href={`/kalite/rma/${r.id}`} className="block text-[#1B4F72] font-semibold">{r.no}</Link>
                    </td>
                    <td className="px-3 py-2"><Link href={`/kalite/rma/${r.id}`} className="block">{RMA_TIP_LABELS[r.tip]}</Link></td>
                    <td className="px-3 py-2 text-xs text-slate-600"><Link href={`/kalite/rma/${r.id}`} className="block">{r.irsaliyeTarihi ? new Date(r.irsaliyeTarihi).toLocaleDateString('tr-TR') : '—'}</Link></td>
                    <td className="px-3 py-2"><Link href={`/kalite/rma/${r.id}`} className="block"><span className="font-mono text-xs text-slate-500">{r.musteri?.code}</span> {r.musteri?.name}</Link></td>
                    <td className="px-3 py-2 text-xs"><Link href={`/kalite/rma/${r.id}`} className="block">{r.iadeTuru ? RMA_IADE_TURU_LABELS[r.iadeTuru] : '—'}</Link></td>
                    <td className="px-3 py-2 tabular-nums"><Link href={`/kalite/rma/${r.id}`} className="block">{r.satirSayisi}</Link></td>
                    <td className="px-3 py-2 tabular-nums"><Link href={`/kalite/rma/${r.id}`} className="block">{r.toplamMiktar}</Link></td>
                    <td className="px-3 py-2"><Link href={`/kalite/rma/${r.id}`} className="block">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.durum === 'ACIK' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                        {r.durum === 'ACIK' ? 'Açık' : 'Kapalı'}
                      </span>
                    </Link></td>
                    <td className="px-3 py-2 text-xs text-slate-600"><Link href={`/kalite/rma/${r.id}`} className="block">{r.sorumluAd ?? '—'}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Sayfa {page} / {totalPages} ({total} kayıt)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Önceki</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sonraki</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
