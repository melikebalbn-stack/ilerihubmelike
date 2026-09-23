'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSandboxBySlug, canAccessSandbox } from '@/lib/sandbox-config'
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
import { Plus, Search, AlertCircle, Trash2, Pencil, FileSpreadsheet, Download, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { InvoiceFormDialog, type EditableInvoice } from './_components/InvoiceFormDialog'
import { ImportDialog, downloadFile } from './_components/ImportDialog'

const NAVY = '#1B4F72'
const SG_LABEL = 'SİSTEM GELİŞTİRME MÜDÜRLÜĞÜ'
const GENEL_LABEL = 'Genel'
// "Genel" en büyük payı aldığı için önceden en canlı rengi (lacivert) kapıp diğer bölümleri
// eziyordu — artık her zaman nötr gri: dikkat çekmesin, asıl ilgi alanı olan bölümler öne çıksın.
const GENEL_COLOR = '#9CA3AF'
// Doğrulanmış kategorik palet — pembe ve turuncu tamamen çıkarıldı ("ileri hub'a uygun,
// pembe turuncu asla istemiyorum"), sadece lacivert/yeşil/petrol/kırmızı/mor (kurumsal,
// NAVY ile uyumlu) kaldı. Renk körlüğü güvenli, sabit sıra — bu sıralamayla
// validate_palette.js: tüm kontroller PASS (en yakın komşu çift CVD ΔE 15.5, normal görüş ΔE 19.3).
const PALETTE = ['#2a78d6', '#008300', '#0e93a8', '#e34948', '#4a3aa7']

type Currency = 'TRY' | 'USD' | 'EUR'

interface Department {
  id: string
  name: string
}

interface Allocation {
  departmentOrgUnitId: string
  departmentName: string
  percentage: string
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
  note: string | null
  allocations: Allocation[]
}

interface DepartmentTotal {
  label: string
  eur: number
  tl: number
}

interface MonthSummary {
  key: string
  genel: number
  sistemGelistirme: number
  toplamTRY: number
  toplamEUR: number
  genelTRY: number
  sistemGelistirmeTRY: number
  departments: DepartmentTotal[]
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
function formatPercent(n: number) {
  if (n === 0) return '%0'
  const abs = Math.abs(n)
  // Fatura toplamı ciroya kıyasla çok küçük olabiliyor (binde/on binde bir) —
  // sabit 1-2 ondalık her şeyi "%0.0"a yuvarlayıp bilgisiz hale getiriyordu.
  if (abs >= 1) return `%${n.toFixed(1)}`
  if (abs >= 0.01) return `%${n.toFixed(2)}`
  return `%${n.toFixed(4)}`
}
function formatThousands(digits: string) {
  if (!digits) return ''
  return new Intl.NumberFormat('tr-TR').format(Number(digits))
}
function parseThousands(formatted: string) {
  return Number(formatted.replace(/\./g, '')) || 0
}
function formatMonthLabel(key: string) {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('tr-TR', { year: '2-digit', month: 'short' })
}
function formatDateTR(dateStr: string) {
  const [y, m, d] = dateStr.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

type SortKey = 'date' | 'company' | 'invoiceNumber' | 'amountEUR' | 'department'
type SortDir = 'asc' | 'desc'

function invoiceDepartmentLabel(inv: Invoice): string {
  if (inv.allocations.length > 0) {
    return inv.allocations.map((a) => a.departmentName).join(', ')
  }
  return inv.departmentName ?? 'Genel'
}

export default function FaturaTakipPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [revenues, setRevenues] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<EditableInvoice | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [filter, setFilter] = useState('ALL') // 'ALL' | 'GENEL' | <orgUnitId>
  const [search, setSearch] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])

  // Kartlar / Bölüme göre dağılım için ortak kapsam: belirli bir ay ya da tüm zamanlar (kümülatif)
  const [scopeMode, setScopeMode] = useState<'MONTH' | 'ALL'>('MONTH')
  const [scopeMonth, setScopeMonth] = useState('')

  // Fatura listesi: ay filtresi + sıralama
  const [listMonthFilter, setListMonthFilter] = useState('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.email) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    const userRole = (session.user as any).role || 'EMPLOYEE'
    if (!canAccessSandbox('melike', session.user.email, userRole)) {
      router.push('/')
      return
    }
    setAuthorized(true)
  }, [session, status, router])

  const loadInvoices = useCallback(async () => {
    const params = new URLSearchParams()
    if (filter !== 'ALL') params.set('department', filter)
    if (search.trim()) params.set('search', search.trim())
    const res = await fetch(`/api/sandbox/melike/faturalar?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      setInvoices(data.invoices ?? [])
    }
  }, [filter, search])

  const loadSummary = useCallback(async () => {
    const res = await fetch('/api/sandbox/melike/faturalar/summary')
    if (res.ok) setSummary(await res.json())
  }, [])

  const loadRevenues = useCallback(async () => {
    const res = await fetch('/api/sandbox/melike/faturalar/revenue')
    if (res.ok) {
      const data = await res.json()
      const map: Record<string, number> = {}
      for (const r of data.revenues ?? []) map[r.month] = r.revenueEUR
      setRevenues(map)
    }
  }, [])

  const loadDepartments = useCallback(async () => {
    const res = await fetch('/api/sandbox/melike/faturalar/departments')
    if (res.ok) {
      const data = await res.json()
      setDepartments(data.departments ?? [])
    }
  }, [])

  useEffect(() => {
    if (!authorized) return
    setLoading(true)
    Promise.all([loadInvoices(), loadSummary(), loadRevenues(), loadDepartments()]).finally(() => setLoading(false))
  }, [authorized, loadInvoices, loadSummary, loadRevenues, loadDepartments])

  // Filtre/arama değiştiğinde sadece liste yenilensin (özet/ciro sabit kalır)
  useEffect(() => {
    if (!authorized || loading) return
    loadInvoices()
  }, [filter, search])

  // Ay seçilmemişse (ilk yükleme) en son ayı varsayılan yap
  useEffect(() => {
    if (!scopeMonth && summary?.months.length) {
      setScopeMonth(summary.months[summary.months.length - 1].key)
    }
  }, [summary, scopeMonth])

  async function handleDelete(id: string) {
    if (!confirm('Bu fatura kaydını silmek istediğine emin misin?')) return
    const res = await fetch(`/api/sandbox/melike/faturalar/${id}`, { method: 'DELETE' })
    if (res.ok) {
      loadInvoices()
      loadSummary()
    }
  }

  async function handleDepartmentChange(invoiceId: string, departmentOrgUnitId: string) {
    const res = await fetch(`/api/sandbox/melike/faturalar/${invoiceId}`, {
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
    setRevenues((prev) => ({ ...prev, [monthKey]: parseThousands(value) }))
  }

  async function handleRevenueBlur(monthKey: string) {
    const value = revenues[monthKey] ?? 0
    await fetch('/api/sandbox/melike/faturalar/revenue', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: monthKey, revenueEUR: value }),
    })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // Renk atama: "Genel" her zaman nötr gri (payı en büyük olduğu için canlı renk alırsa
  // diğer bölümleri ezip grafiği okunaksız yapıyordu). Gerçek bölümler alfabetik SABİT sırayla
  // doğrulanmış paletten renk alır (tutara göre sıralarsak veri değiştikçe renkler kayar).
  // 8 palet renginden fazlası varsa fazlalar "Diğer" altında toplanır.
  const departmentColor = useMemo(() => {
    const map = new Map<string, string>()
    map.set(GENEL_LABEL, GENEL_COLOR)
    const real = (summary?.departments ?? [])
      .filter((d) => d.label !== GENEL_LABEL)
      .map((d) => d.label)
      .sort((a, b) => a.localeCompare(b, 'tr'))
    real.slice(0, PALETTE.length).forEach((label, i) => map.set(label, PALETTE[i]))
    map.set('Diğer', '#78716C')
    return map
  }, [summary])

  // Grafikte gösterilecek seri sırası: Genel (atanmamış faturalar) BURADA YOK — o gerçek bir
  // bölüm değil, kartlarda olduğu gibi burada da karşılaştırmaya girerse (tek başına toplamın
  // %80+'i) gerçek bölümleri görünmez sliverlere eziyordu. Genel'in kendi ay bazında trendini
  // görmek isteyen alttaki açılır listeden "Genel"i seçip izole edebilir. Gerçek bölümler
  // alfabetik sırayla (en fazla 8 — palet kadar), taşanlar "Diğer" altında toplanır.
  const chartSeries = useMemo(() => {
    if (!summary) return []
    const real = summary.departments
      .map((d) => d.label)
      .filter((l) => l !== GENEL_LABEL)
      .sort((a, b) => a.localeCompare(b, 'tr'))
    const shown = real.slice(0, PALETTE.length)
    const overflow = real.length > PALETTE.length
    return [...shown, ...(overflow ? ['Diğer'] : [])]
  }, [summary])

  // Grafik üstteki "Aylık / Tüm Zamanlar" seçimini takip eder — ayrı bir grafik-bölüm
  // seçici YOKTU aslında burada, ama üstteki ay seçimiyle bağlantısız kaldığı için ay
  // değiştirince grafik değişmiyor, kafa karıştırıyordu. Artık tek kaynak üstteki seçim:
  // "Aylık" modunda seçili tek ayın bölüm kırılımı, "Tüm Zamanlar" modunda ayara göre trend.
  const chartData = useMemo(() => {
    if (!summary) return []
    if (scopeMode === 'ALL') {
      const shownSet = new Set(chartSeries)
      return summary.months.map((m) => {
        const row: Record<string, string | number> = { ay: formatMonthLabel(m.key) }
        for (const label of chartSeries) row[label] = 0
        for (const d of m.departments) {
          if (d.label === GENEL_LABEL) continue // atanmamış — bu karşılaştırmada yok
          const key = shownSet.has(d.label) ? d.label : 'Diğer'
          row[key] = (Number(row[key]) || 0) + d.eur
        }
        return row
      })
    }
    const m = summary.months.find((mm) => mm.key === scopeMonth)
    if (!m) return []
    return m.departments
      .filter((d) => d.label !== GENEL_LABEL)
      .sort((a, b) => b.eur - a.eur)
  }, [summary, scopeMode, scopeMonth, chartSeries])

  const totalCiro = useMemo(() => Object.values(revenues).reduce((s, v) => s + v, 0), [revenues])

  const scopedMonthSummary = summary?.months.find((m) => m.key === scopeMonth) ?? null

  const cardTotals = useMemo(() => {
    if (scopeMode === 'MONTH' && scopedMonthSummary) {
      const genel = scopedMonthSummary.genel
      const sistemGelistirme = scopedMonthSummary.sistemGelistirme
      const toplam = genel + sistemGelistirme
      return { genel, sistemGelistirme, toplam, oran: toplam > 0 ? (sistemGelistirme / toplam) * 100 : 0 }
    }
    return summary?.totals ?? { genel: 0, sistemGelistirme: 0, toplam: 0, oran: 0 }
  }, [scopeMode, scopedMonthSummary, summary])

  const scopedDepartments = scopeMode === 'MONTH' && scopedMonthSummary ? scopedMonthSummary.departments : summary?.departments ?? []
  const scopedCiro = scopeMode === 'MONTH' ? revenues[scopeMonth] ?? 0 : totalCiro

  const listMonths = useMemo(() => summary?.months.map((m) => m.key) ?? [], [summary])

  const displayedInvoices = useMemo(() => {
    let rows = invoices
    if (listMonthFilter !== 'ALL') {
      rows = rows.filter((inv) => inv.invoiceDate.slice(0, 7) === listMonthFilter)
    }
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date') cmp = a.invoiceDate.localeCompare(b.invoiceDate)
      else if (sortKey === 'company') cmp = a.companyName.localeCompare(b.companyName, 'tr')
      else if (sortKey === 'invoiceNumber') cmp = a.invoiceNumber.localeCompare(b.invoiceNumber, 'tr')
      else if (sortKey === 'amountEUR') cmp = Number(a.amountEUR) - Number(b.amountEUR)
      else if (sortKey === 'department') cmp = invoiceDepartmentLabel(a).localeCompare(invoiceDepartmentLabel(b), 'tr')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [invoices, listMonthFilter, sortKey, sortDir])

  if (status === 'loading' || !authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    )
  }

  const sandboxModule = getSandboxBySlug('melike')
  if (!sandboxModule) return null

  function SortHead({ label, sortKeyName, className }: { label: string; sortKeyName: SortKey; className?: string }) {
    const active = sortKey === sortKeyName
    return (
      <TableHead className={className}>
        <button
          onClick={() => toggleSort(sortKeyName)}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          {label}
          {active ? (
            sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
      </TableHead>
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
          <Button
            style={{ backgroundColor: NAVY }}
            onClick={() => {
              setEditingInvoice(null)
              setShowForm(true)
            }}
          >
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border p-0.5 text-xs">
          <button
            onClick={() => setScopeMode('MONTH')}
            className="rounded px-3 py-1.5 font-medium transition-colors"
            style={scopeMode === 'MONTH' ? { backgroundColor: NAVY, color: 'white' } : { color: '#5F5E5A' }}
          >
            Aylık
          </button>
          <button
            onClick={() => setScopeMode('ALL')}
            className="rounded px-3 py-1.5 font-medium transition-colors"
            style={scopeMode === 'ALL' ? { backgroundColor: NAVY, color: 'white' } : { color: '#5F5E5A' }}
          >
            Tüm Zamanlar (Kümülatif)
          </button>
        </div>
        {scopeMode === 'MONTH' && summary?.months.length ? (
          <Select value={scopeMonth} onValueChange={setScopeMonth}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {summary.months.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {formatMonthLabel(m.key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {/* Sadece Toplam ve Sistem Geliştirme Oranı — "Sistem Geliştirme" ve "Genel" kartları kaldırıldı:
          "Genel" burada aslında Sistem Geliştirme dışındaki TÜM gerçek bölümleri (Mühendislik, Kalite vb.)
          kapsıyordu, "atanmamış" değil — yanıltıcıydı. Doğru, bölüm bazlı kırılım aşağıdaki tabloda. */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Toplam (€)" value={formatEur(cardTotals.toplam)} color={NAVY} />
        <SummaryCard label="Sistem Geliştirme Oranı" value={`${cardTotals.oran.toFixed(1)}%`} color="#993C1D" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-muted-foreground">
              {scopeMode === 'MONTH' && scopedMonthSummary
                ? `${formatMonthLabel(scopedMonthSummary.key)} — bölüme göre dağılım`
                : 'Aylık € dağılımı — gerçek bölümler'}
            </div>
          </div>
          <p className="mb-3 text-xs text-muted-foreground/80">
            "Genel" (bölüm atanmamış faturalar) burada yok — tek başına toplamın çoğunu kapladığı için
            gerçek bölümleri görünmez kılıyordu; toplamı üstteki "Toplam (€)" kartında. Üstteki
            "Aylık / Tüm Zamanlar" ve ay seçimine göre değişir.
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                <XAxis
                  dataKey={scopeMode === 'ALL' ? 'ay' : 'label'}
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={scopeMode === 'ALL' ? 0 : -25}
                  textAnchor={scopeMode === 'ALL' ? 'middle' : 'end'}
                  height={scopeMode === 'ALL' ? 30 : 60}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatEur(v)} />
                {scopeMode === 'ALL' && <Legend wrapperStyle={{ fontSize: 11 }} />}
                {scopeMode === 'ALL'
                  ? chartSeries.map((label, i) => (
                      <Bar
                        key={label}
                        dataKey={label}
                        stackId="a"
                        fill={departmentColor.get(label) ?? PALETTE[i % PALETTE.length]}
                        stroke="#fff"
                        strokeWidth={2}
                        radius={i === chartSeries.length - 1 ? [4, 4, 0, 0] : undefined}
                      />
                    ))
                  : (
                      <Bar dataKey="eur" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry: any, i: number) => (
                          <Cell key={entry.label} fill={departmentColor.get(entry.label) ?? PALETTE[i % PALETTE.length]} />
                        ))}
                      </Bar>
                    )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-sm font-semibold text-muted-foreground">Ciro karşılaştırması</div>
          <p className="mb-3 text-xs text-muted-foreground/80">
            {scopeMode === 'MONTH'
              ? 'Seçili ayın cirosunu € olarak gir (üstteki ay seçici ile aynı ay).'
              : 'Tüm zamanlar kapsamındasın — girilen tüm ayların ciro toplamı kullanılıyor.'}
          </p>
          {!summary?.months.length ? (
            <p className="py-2 text-sm text-muted-foreground">Henüz fatura kaydı yok.</p>
          ) : scopeMode === 'ALL' ? (
            <div className="text-sm">
              Tüm ayların ciro toplamı: <span className="font-semibold">{formatEur(totalCiro)}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                (aylık girmek için üstten "Aylık" moduna geç)
              </span>
            </div>
          ) : (
            (() => {
              const m = scopedMonthSummary ?? summary.months[summary.months.length - 1]
              const monthCiro = revenues[m.key] ?? 0
              const monthOran = monthCiro > 0 ? (m.toplamEUR / monthCiro) * 100 : null
              return (
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Fatura Toplamı (€)</label>
                    <div className="flex h-9 items-center text-sm font-semibold">{formatEur(m.toplamEUR)}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Ciro (€)</label>
                    <Input
                      value={monthCiro > 0 ? formatThousands(String(monthCiro)) : ''}
                      onChange={(e) => handleRevenueChange(m.key, e.target.value.replace(/\D/g, ''))}
                      onBlur={() => handleRevenueBlur(m.key)}
                      placeholder="ciro gir"
                      inputMode="numeric"
                      className="h-9 w-40 text-right"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Oran</label>
                    <div
                      className="flex h-9 items-center text-sm font-semibold"
                      style={{ color: monthOran == null ? '#BBB' : NAVY }}
                    >
                      {monthOran == null ? '—' : formatPercent(monthOran)}
                    </div>
                  </div>
                </div>
              )
            })()
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-muted-foreground">
              Bölüme göre dağılım {scopeMode === 'MONTH' && scopedMonthSummary ? `— ${formatMonthLabel(scopedMonthSummary.key)}` : '— Tüm Zamanlar'}
            </div>
            <button
              onClick={() => downloadFile('/api/sandbox/melike/faturalar/export?type=summary')}
              className="flex items-center gap-1 text-xs font-medium text-[#1B4F72] hover:underline"
              title="Bu tablonun sayısal, yuvarlanmamış Excel çıktısı — KPI dosyana çekmek için"
            >
              <Download className="h-3 w-3" /> KPI Özet İndir
            </button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground/80">
            Üstteki "Aylık / Tüm Zamanlar" seçimine göre değişir. Cironun Oranı da aynı kapsamdaki ciroya göre.
          </p>
          {!scopedDepartments.length ? (
            <p className="py-2 text-sm text-muted-foreground">Bu kapsamda fatura kaydı yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bölüm</TableHead>
                  <TableHead className="text-right">Toplam (₺)</TableHead>
                  <TableHead className="text-right">Toplam (€)</TableHead>
                  <TableHead className="text-right">Cironun Oranı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scopedDepartments.map((d) => {
                  const deptCiroOran = scopedCiro > 0 ? (d.eur / scopedCiro) * 100 : null
                  return (
                    <TableRow key={d.label}>
                      <TableCell style={{ color: d.label === SG_LABEL ? NAVY : undefined }}>{d.label}</TableCell>
                      <TableCell className="text-right">{formatTL(d.tl)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatEur(d.eur)}</TableCell>
                      <TableCell className="text-right" style={{ color: deptCiroOran == null ? '#BBB' : NAVY }}>
                        {deptCiroOran == null ? '—' : formatPercent(deptCiroOran)}
                      </TableCell>
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
            <SelectItem value="ALL">Tüm Bölümler</SelectItem>
            <SelectItem value="GENEL">Genel</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={listMonthFilter} onValueChange={setListMonthFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tüm Aylar</SelectItem>
            {listMonths.map((key) => (
              <SelectItem key={key} value={key}>
                {formatMonthLabel(key)}
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
              <SortHead label="Tarih" sortKeyName="date" />
              <SortHead label="Firma" sortKeyName="company" />
              <SortHead label="Fatura No" sortKeyName="invoiceNumber" />
              <TableHead className="text-right">Tutar</TableHead>
              <SortHead label="€ Karşılığı" sortKeyName="amountEUR" className="text-right" />
              <SortHead label="Bölüm" sortKeyName="department" />
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
            ) : displayedInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Kayıt yok
                </TableCell>
              </TableRow>
            ) : (
              displayedInvoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{formatDateTR(inv.invoiceDate)}</TableCell>
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
                    {inv.allocations.length > 0 ? (
                      <div className="text-xs" title="Birden fazla bölüme bölünmüş — düzeltmek için Yeni Fatura'daki gibi silip yeniden ekle">
                        {inv.allocations.map((a) => (
                          <div key={a.departmentOrgUnitId} style={{ color: NAVY }}>
                            {a.departmentName} <span className="text-muted-foreground">%{Number(a.percentage)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
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
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingInvoice({
                            id: inv.id,
                            invoiceDate: inv.invoiceDate,
                            companyName: inv.companyName,
                            invoiceNumber: inv.invoiceNumber,
                            amount: inv.amount,
                            currency: inv.currency,
                            departmentOrgUnitId: inv.departmentOrgUnitId,
                            note: inv.note,
                            allocations: inv.allocations.map((a) => ({
                              departmentOrgUnitId: a.departmentOrgUnitId,
                              percentage: a.percentage,
                            })),
                          })
                          setShowForm(true)
                        }}
                        className="text-muted-foreground hover:text-[#1B4F72]"
                        title="Düzenle"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <InvoiceFormDialog
        open={showForm}
        onOpenChange={(v) => {
          setShowForm(v)
          if (!v) setEditingInvoice(null)
        }}
        invoice={editingInvoice}
        onSaved={() => {
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
