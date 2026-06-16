'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from './StatusBadge'
import {
  PERSONNEL_TYPE_LABELS,
  STATUS_LABELS,
  type OffboardingPersonnelType,
  type OffboardingStatus,
} from './constants'

interface OffboardingRow {
  id: string
  formNo: string
  adSoyad: string
  sicilNo: string | null
  departman: string | null
  gorev: string | null
  ayrilisTarihi: string
  personelTuru: OffboardingPersonnelType
  status: OffboardingStatus
  beyanOnay: boolean
  createdAt: string
  _count: { assetItems: number; accessItems: number }
}

const PAGE_SIZE = 20

export function OffboardingListClient() {
  const router = useRouter()
  const [rows, setRows] = useState<OffboardingRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [status, setStatus] = useState<string>('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      if (q.trim()) params.set('q', q.trim())
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))
      const res = await fetch(`/api/offboarding?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setRows(json.data || [])
      setTotal(json.total || 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [status, q, page])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  function onStatusChange(v: string) {
    setStatus(v)
    setPage(1)
  }

  function clearFilters() {
    setStatus('all')
    setQ('')
    setPage(1)
  }

  const hasFilters = status !== 'all' || q.trim() !== ''

  return (
    <div className="space-y-4">
      {/* Filtre bar */}
      <div className="rounded-md border bg-white p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-slate-600">Durum</Label>
            <Select value={status} onValueChange={onStatusChange}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="DRAFT">{STATUS_LABELS.DRAFT}</SelectItem>
                <SelectItem value="IN_PROGRESS">{STATUS_LABELS.IN_PROGRESS}</SelectItem>
                <SelectItem value="COMPLETED">{STATUS_LABELS.COMPLETED}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs text-slate-600">Ara (Ad Soyad / Sicil / Form No)</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1)
                  fetchList()
                }
              }}
              placeholder="Örn: Ahmet, 12345, ZI-2026-00001"
              className="mt-1 h-9"
            />
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{total} sonuç</span>
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
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed bg-slate-50 p-12 text-center">
          <Search className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-slate-600">
            {hasFilters ? 'Filtrelere uyan kayıt bulunamadı' : 'Henüz ilişik kesme formu oluşturulmamış'}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form No</TableHead>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Departman</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Ayrılış Tarihi</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Oluşturma</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/offboarding/${r.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{r.formNo}</TableCell>
                    <TableCell className="font-medium">{r.adSoyad}</TableCell>
                    <TableCell className="text-sm">
                      {r.departman || <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{PERSONNEL_TYPE_LABELS[r.personelTuru]}</TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {new Date(r.ayrilisTarihi).toLocaleDateString('tr-TR')}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString('tr-TR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
