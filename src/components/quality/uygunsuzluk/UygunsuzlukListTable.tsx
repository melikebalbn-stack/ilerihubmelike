'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Loader2, Search, Upload, X } from 'lucide-react'
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
import { redOrani, formatOran } from '@/lib/quality/uygunsuzluk-labels'
import { UygunsuzlukImportDialog } from './UygunsuzlukImportDialog'

type BolumSecenek = { id: string; kod: number; ad: string }

type UygunsuzlukRow = {
  id: string
  no: number
  tarih: string
  mamulUrunKodu: string
  isEmriNo: string
  isEmriAdeti: number | null
  tespitEdenBolum: { id: string; kod: number; ad: string } | null
  satirSayisi: number
  toplamRedAdeti: number
  durum: 'ACIK' | 'KAPALI'
  sorumluAd: string | null
}

const PAGE_SIZE = 20

export function UygunsuzlukListTable({ canManage = false }: { canManage?: boolean }) {
  const [items, setItems] = useState<UygunsuzlukRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [bolumler, setBolumler] = useState<BolumSecenek[]>([])

  const [isEmriNo, setIsEmriNo] = useState('')
  const [mamulUrunKodu, setMamulUrunKodu] = useState('')
  const [bolumId, setBolumId] = useState('all')
  const [durum, setDurum] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [importOpen, setImportOpen] = useState(false)

  // Tespit eden bölüm filtresi için yalnız tip=BOLUM kayıtları
  useEffect(() => {
    fetch('/api/quality/hata-kodu?duz=1')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => {
        const rows: { id: string; kod: number; ad: string; tip: string }[] = j.items ?? []
        setBolumler(
          rows
            .filter((r) => r.tip === 'BOLUM')
            .map((r) => ({ id: r.id, kod: r.kod, ad: r.ad }))
            .sort((a, b) => a.kod - b.kod),
        )
      })
      .catch(() => setBolumler([]))
  }, [])

  const buildFilterParams = useCallback(() => {
    const p = new URLSearchParams()
    if (isEmriNo.trim()) p.set('isEmriNo', isEmriNo.trim())
    if (mamulUrunKodu.trim()) p.set('mamulUrunKodu', mamulUrunKodu.trim())
    if (bolumId !== 'all') p.set('tespitEdenBolumId', bolumId)
    if (durum !== 'all') p.set('durum', durum)
    if (from) p.set('from', new Date(from).toISOString())
    if (to) {
      const e = new Date(to)
      e.setHours(23, 59, 59, 999)
      p.set('to', e.toISOString())
    }
    if (q.trim()) p.set('q', q.trim())
    return p
  }, [isEmriNo, mamulUrunKodu, bolumId, durum, from, to, q])

  const fetchList = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const p = buildFilterParams()
      p.set('page', String(page))
      p.set('pageSize', String(PAGE_SIZE))
      const res = await fetch(`/api/quality/uygunsuzluk?${p.toString()}`)
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

  useEffect(() => {
    fetchList()
  }, [fetchList])

  /** Export ucu liste ile AYNI filtreyi alır (sunucuda da aynı buildUygunsuzlukWhere). */
  function handleExport() {
    const qs = buildFilterParams().toString()
    window.location.href = `/api/quality/uygunsuzluk/export${qs ? `?${qs}` : ''}`
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters =
    isEmriNo !== '' ||
    mamulUrunKodu !== '' ||
    bolumId !== 'all' ||
    durum !== 'all' ||
    from !== '' ||
    to !== '' ||
    q.trim() !== ''

  function reset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPage(1)
    }
  }
  function clearFilters() {
    setIsEmriNo('')
    setMamulUrunKodu('')
    setBolumId('all')
    setDurum('all')
    setFrom('')
    setTo('')
    setQ('')
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Araç çubuğu — Excel aktar/yükle */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0">
          <Download className="h-4 w-4 mr-1 shrink-0" />
          Excel&apos;e Aktar
        </Button>
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

      {canManage && (
        <UygunsuzlukImportDialog
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
            <Label className="text-xs text-slate-600">İş emri no</Label>
            <Input
              value={isEmriNo}
              onChange={(e) => reset(setIsEmriNo)(e.target.value)}
              placeholder="IE-2026-…"
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Mamul ürün kodu</Label>
            <Input
              value={mamulUrunKodu}
              onChange={(e) => reset(setMamulUrunKodu)(e.target.value)}
              placeholder="ABC-12…"
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Tespit eden bölüm</Label>
            <Select value={bolumId} onValueChange={reset(setBolumId)}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {bolumler.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.kod} — {b.ad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Durum</Label>
            <Select value={durum} onValueChange={reset(setDurum)}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="acik">Açık</SelectItem>
                <SelectItem value="kapali">Kapalı</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Tarih (başlangıç)</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => reset(setFrom)(e.target.value)}
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Tarih (bitiş)</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => reset(setTo)(e.target.value)}
              className="mt-1 h-9"
            />
          </div>
          <div className="lg:col-span-3">
            <Label className="text-xs text-slate-600">Ara (no / iş emri / mamul kodu)</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1)
                  fetchList()
                }
              }}
              placeholder="12 / IE-2026-45 / ABC-12…"
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
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          Hata: {err}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed bg-slate-50 p-12 text-center">
          <Search className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-slate-600">
            {hasFilters ? 'Filtrelere uyan kayıt yok' : 'Henüz kayıt yok'}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-white overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[1080px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {[
                    'No',
                    'Tarih',
                    'Mamul Kodu',
                    'İş Emri No',
                    'Tespit Eden Bölüm',
                    'Satır',
                    'Toplam Red',
                    'Red Oranı',
                    'Durum',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const oran = redOrani(r.toplamRedAdeti, r.isEmriAdeti)
                  const href = `/kalite/uygunsuzluk/${r.id}`
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="px-3 py-2 font-quality-mono">
                        <Link href={href} className="block text-[#1B4F72] font-semibold">
                          {r.no}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        <Link href={href} className="block">
                          {new Date(r.tarih).toLocaleDateString('tr-TR')}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <Link href={href} className="block">
                          {r.mamulUrunKodu}
                        </Link>
                      </td>
                      <td className="px-3 py-2 font-quality-mono text-xs">
                        <Link href={href} className="block">
                          {r.isEmriNo}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <Link href={href} className="block">
                          {r.tespitEdenBolum ? (
                            <>
                              <span className="font-quality-mono text-slate-500">
                                {r.tespitEdenBolum.kod}
                              </span>{' '}
                              {r.tespitEdenBolum.ad}
                            </>
                          ) : (
                            '—'
                          )}
                        </Link>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        <Link href={href} className="block">
                          {r.satirSayisi}
                        </Link>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        <Link href={href} className="block">
                          {r.toplamRedAdeti}
                        </Link>
                      </td>
                      {/* Red oranı: isEmriAdeti boş/0 ise HİÇBİR ŞEY gösterme */}
                      <td className="px-3 py-2 tabular-nums">
                        <Link href={href} className="block">
                          {oran === null ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            formatOran(oran)
                          )}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <Link href={href} className="block">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              r.durum === 'ACIK'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {r.durum === 'ACIK' ? 'Açık' : 'Kapalı'}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>
                Sayfa {page} / {totalPages} ({total} kayıt)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Önceki
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
