'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, X } from 'lucide-react'
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
import { ReportResultBadge, type ReportResult } from './ReportResultBadge'

interface TemplateOption {
  id: string
  partName: string
  drawingNo: string
  revision: string
}

interface ReportRow {
  id: string
  reportNo: string
  templateId: string
  formNo: string
  partName: string
  drawingNo: string
  revision: string
  lotNo: string | null
  operatorNo: string | null
  machine: string | null
  measurementDate: string
  result: ReportResult
  finalizedAt: string | null
  createdAt: string
  _count: { characteristics: number }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Props {
  templates: TemplateOption[]
}

const PAGE_SIZE = 20

export function ReportsListTable({ templates }: Props) {
  const [items, setItems] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  })

  // Filters
  const [templateId, setTemplateId] = useState<string>('all')
  const [lotNo, setLotNo] = useState('')
  const [result, setResult] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (templateId !== 'all') params.set('templateId', templateId)
      if (lotNo.trim()) params.set('lotNo', lotNo.trim())
      if (result !== 'all') params.set('result', result)
      if (dateFrom) params.set('from', new Date(dateFrom).toISOString())
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        params.set('to', end.toISOString())
      }
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))

      const res = await fetch(`/api/quality/reports?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setItems(json.items || [])
      setPagination(json.pagination)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [templateId, lotNo, result, dateFrom, dateTo, page])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  // Filter changes reset to page 1
  function setFilter<T>(setter: (v: T) => void): (v: T) => void {
    return (v) => {
      setter(v)
      setPage(1)
    }
  }

  function clearFilters() {
    setTemplateId('all')
    setLotNo('')
    setResult('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const hasFilters =
    templateId !== 'all' || lotNo.trim() !== '' || result !== 'all' || dateFrom !== '' || dateTo !== ''

  return (
    <div className="space-y-4">
      {/* Filtre bar */}
      <div className="rounded-md border bg-white p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs text-slate-600">Şablon</Label>
            <Select value={templateId} onValueChange={setFilter(setTemplateId)}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.partName} ({t.drawingNo}-{t.revision})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-slate-600">Lot No</Label>
            <Input
              value={lotNo}
              onChange={(e) => setLotNo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1)
                  fetchReports()
                }
              }}
              placeholder="LOT-001"
              className="mt-1 h-9"
            />
          </div>

          <div>
            <Label className="text-xs text-slate-600">Durum</Label>
            <Select value={result} onValueChange={setFilter(setResult)}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="PENDING">Bekleyen</SelectItem>
                <SelectItem value="OK">OK</SelectItem>
                <SelectItem value="RED">RED</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-slate-600">Tarih (başlangıç)</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setFilter(setDateFrom)(e.target.value)}
              className="mt-1 h-9"
            />
          </div>

          <div>
            <Label className="text-xs text-slate-600">Tarih (bitiş)</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setFilter(setDateTo)(e.target.value)}
              className="mt-1 h-9"
            />
          </div>
        </div>

        {hasFilters && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{pagination.total} sonuç</span>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" />
              Filtreleri Temizle
            </Button>
          </div>
        )}
      </div>

      {/* Tablo */}
      {loading ? (
        <div className="rounded-md border bg-white p-12 text-center text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Yükleniyor...
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          Hata: {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed bg-slate-50 p-12 text-center">
          <Search className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-slate-600">
            {hasFilters
              ? 'Filtrelere uyan rapor bulunamadı'
              : 'Henüz rapor oluşturulmamış'}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-white overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[1000px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Rapor No
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Parça
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Resim No
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Lot
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Operatör
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Ölçüm Tarihi
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Karakter
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Sonuç
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Eylem
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">{r.reportNo}</td>
                    <td className="px-3 py-2 font-medium">{r.partName}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.drawingNo}
                      <span className="text-slate-400">-{r.revision}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.lotNo ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.operatorNo ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {new Date(r.measurementDate).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r._count.characteristics}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ReportResultBadge result={r.result} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/kalite/raporlar/${r.id}`}>Görüntüle</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>
                Sayfa {pagination.page} / {pagination.totalPages} ({pagination.total} kayıt)
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
                  disabled={page >= pagination.totalPages}
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
