'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Plus, Search, AlertCircle, Trash2, FileSpreadsheet } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { InvoiceFormDialog } from './InvoiceFormDialog'
import { ImportDialog } from './ImportDialog'

const NAVY = '#1B4F72'

type Currency = 'TRY' | 'USD' | 'EUR'

interface Department {
  id: string
  name: string
}

interface Invoice {
  id: string
  invoiceDate: string
  companyName: string
  invoiceNumber: string
  amount: string
  currency: Currency
  amountTRY: string
  amountEUR: string
  departmentOrgUnitId: string | null
  departmentName: string | null
}

interface MonthSummary {
  key: string
  genel: number
  sistemGelistirme: number
  toplamTRY: number
  genelTRY: number
  sistemGelistirmeTRY: number
}

interface DepartmentTotal {
  label: string
  eur: number
  tl: number
}

interface Summary {
  totals: { genel: number; sistemGelistirme: number; toplam: number; oran: number }
  months: MonthSummary[]
  departments: DepartmentTotal[]
}

function formatEur(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
}
function formatTL(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n || 0)
}
function formatMonthLabel(key: string) {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('tr-TR', { year: '2-digit', month: 'short' })
}

export default function FaturalarClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [revenues, setRevenues] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [filter, setFilter] = useState('ALL') // 'ALL' | 'GENEL' | <orgUnitId>
  const [search, setSearch] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])

  const loadInvoices = useCallback(async () => {
    const params = new URLSearchParams()
    if (filter !== 'ALL') params.set('department', filter)
    if (search.trim()) params.set('search', search.trim())
    const res = await fetch(`/api/finans/faturalar?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      setInvoices(data.invoices ?? [])
    }
  }, [filter, search])

  const loadSummary = useCallback(async () => {
    const res = await fetch('/api/finans/faturalar/summary')
    if (res.ok) setSummary(await res.json())
  }, [])

  const loadRevenues = useCallback(async () => {
    const res = await fetch('/api/finans/faturalar/revenue')
    if (res.ok) {
      const data = await res.json()
      const map: Record<string, number> = {}
      for (const r of data.revenues ?? []) map[r.month] = r.revenueTRY
      setRevenues(map)
    }
  }, [])

  const loadDepartments = useCallback(async () => {
    const res = await fetch('/api/finans/faturalar/departments')
    if (res.ok) {
      const data = await res.json()
      setDepartments(data.departments ?? [])
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadInvoices(), loadSummary(), loadRevenues(), loadDepartments()]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filtre/arama değiştiğinde sadece liste yenilensin (özet/ciro sabit kalır)
  useEffect(() => {
    loadInvoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search])

  async function handleDelete(id: string) {
    if (!confirm('Bu fatura kaydını silmek istediğine emin misin?')) return
    const res = await fetch(`/api/finans/faturalar/${id}`, { method: 'DELETE' })
    if (res.ok) {
      loadInvoices()
      loadSummary()
    }
  }

  async function handleDepartmentChange(invoiceId: string, departmentOrgUnitId: string) {
    const res = await fetch(`/api/finans/faturalar/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ departmentOrgUnitId: departmentOrgUnitId === 'GENEL' ? null : departmentOrgUnitId }),
    })
    if (res.ok) {
      loadInvoices()
      loadSummary()
    }
  }

  async function handleRevenueChange(monthKey: string, value: string) {
    setRevenues((prev) => ({ ...prev, [monthKey]: Number(value) || 0 }))
  }

  async function handleRevenueBlur(monthKey: string) {
    const value = revenues[monthKey] ?? 0
    await fetch('/api/finans/faturalar/revenue', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: monthKey, revenueTRY: value }),
    })
  }

  const chartData = useMemo(
    () =>
      (summary?.months ?? []).map((m) => ({
        ay: formatMonthLabel(m.key),
        Genel: m.genel,
        'Sistem Geliştirme': m.sistemGelistirme,
      })),
    [summary]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: NAVY }}>
            Fatura Takip
          </h1>
          <p className="text-sm text-muted-foreground">
            Genel / Sistem Geliştirme ayrımı · TCMB € dönüşümü · aylık ciro kıyası
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel İçe/Dışa Aktar
          </Button>
          <Button style={{ backgroundColor: NAVY }} onClick={() => setShowForm(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Yeni Fatura Ekle
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>
          EUR dönüşümü fatura tarihine göre <strong>TCMB Döviz Alış</strong> kurundan hesaplanır (sunucuda canlı
          çekilir ve önbelleğe alınır). TCMB'nin yayın yapmadığı günlerde (hafta sonu/tatil) en yakın önceki iş
          gününün kuru kullanılır.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Toplam (€)" value={formatEur(summary?.totals.toplam ?? 0)} color={NAVY} />
        <SummaryCard
          label="Sistem Geliştirme (€)"
          value={formatEur(summary?.totals.sistemGelistirme ?? 0)}
          color="#0F6E56"
        />
        <SummaryCard label="Genel (€)" value={formatEur(summary?.totals.genel ?? 0)} color="#888780" />
        <SummaryCard
          label="Sistem Geliştirme Oranı"
          value={`${(summary?.totals.oran ?? 0).toFixed(1)}%`}
          color="#993C1D"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 text-sm font-semibold text-muted-foreground">Aylık € dağılımı</div>
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                <XAxis dataKey="ay" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatEur(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Genel" stackId="a" fill="#B4B2A9" />
                <Bar dataKey="Sistem Geliştirme" stackId="a" fill={NAVY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-sm font-semibold text-muted-foreground">Aylık ciro karşılaştırması</div>
          <p className="mb-3 text-xs text-muted-foreground/80">
            Her ay için ciroyu elle gir, oran otomatik hesaplansın.
          </p>
          {!summary?.months.length ? (
            <p className="py-2 text-sm text-muted-foreground">Henüz fatura kaydı yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ay</TableHead>
                  <TableHead className="text-right">Fatura Toplamı (₺)</TableHead>
                  <TableHead className="text-right">Genel (₺)</TableHead>
                  <TableHead className="text-right">Sistem Geliştirme (₺)</TableHead>
                  <TableHead className="text-right w-40">Ciro (₺)</TableHead>
                  <TableHead className="text-right">Toplam Oran</TableHead>
                  <TableHead className="text-right">Sist. Gel. Oranı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.months.map((m) => {
                  const ciroVal = revenues[m.key] ?? 0
                  const oran = ciroVal > 0 ? (m.toplamTRY / ciroVal) * 100 : null
                  const oranSG = ciroVal > 0 ? (m.sistemGelistirmeTRY / ciroVal) * 100 : null
                  return (
                    <TableRow key={m.key}>
                      <TableCell>{formatMonthLabel(m.key)}</TableCell>
                      <TableCell className="text-right">{formatTL(m.toplamTRY)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatTL(m.genelTRY)}</TableCell>
                      <TableCell className="text-right" style={{ color: NAVY }}>
                        {formatTL(m.sistemGelistirmeTRY)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          value={revenues[m.key] ?? ''}
                          onChange={(e) => handleRevenueChange(m.key, e.target.value)}
                          onBlur={() => handleRevenueBlur(m.key)}
                          placeholder="ciro gir"
                          inputMode="decimal"
                          className="h-8 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold" style={{ color: oran == null ? '#BBB' : NAVY }}>
                        {oran == null ? '—' : `${oran.toFixed(2)}%`}
                      </TableCell>
                      <TableCell className="text-right font-semibold" style={{ color: oranSG == null ? '#BBB' : '#993C1D' }}>
                        {oranSG == null ? '—' : `${oranSG.toFixed(2)}%`}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-sm font-semibold text-muted-foreground">Bölüme göre dağılım</div>
          <p className="mb-3 text-xs text-muted-foreground/80">
            Tüm zamanlar toplamı, bölüm bazında (organizasyon şemasındaki Müdürlükler + Genel).
          </p>
          {!summary?.departments.length ? (
            <p className="py-2 text-sm text-muted-foreground">Henüz fatura kaydı yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bölüm</TableHead>
                  <TableHead className="text-right">Toplam (₺)</TableHead>
                  <TableHead className="text-right">Toplam (€)</TableHead>
                  <TableHead className="text-right">Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.departments.map((d) => {
                  const pay = summary.totals.toplam > 0 ? (d.eur / summary.totals.toplam) * 100 : 0
                  return (
                    <TableRow key={d.label}>
                      <TableCell style={{ color: d.label === 'Sistem Geliştirme Müdürlüğü' ? NAVY : undefined }}>
                        {d.label}
                      </TableCell>
                      <TableCell className="text-right">{formatTL(d.tl)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatEur(d.eur)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{pay.toFixed(1)}%</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tümü</SelectItem>
            <SelectItem value="GENEL">Genel</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative ml-auto min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Firma veya fatura no ara"
            className="pl-8 h-9"
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Firma</TableHead>
              <TableHead>Fatura No</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead className="text-right">€ Karşılığı</TableHead>
              <TableHead>Bölüm</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Yükleniyor...
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Kayıt yok
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.invoiceDate.slice(0, 10)}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={inv.companyName}>
                    {inv.companyName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Number(inv.amount))}{' '}
                    {inv.currency}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatEur(Number(inv.amountEUR))}</TableCell>
                  <TableCell>
                    <Select
                      value={inv.departmentOrgUnitId || 'GENEL'}
                      onValueChange={(v) => handleDepartmentChange(inv.id, v)}
                    >
                      <SelectTrigger className="h-7 w-44 text-xs" style={{ color: inv.departmentOrgUnitId ? NAVY : '#5F5E5A' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENEL">Genel</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleDelete(inv.id)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Sil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <InvoiceFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onCreated={() => {
          loadInvoices()
          loadSummary()
        }}
      />

      <ImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImported={() => {
          loadInvoices()
          loadSummary()
        }}
      />
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
        <div className="text-xl font-bold" style={{ color }}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
