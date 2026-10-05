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
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { InvoiceFormDialog, type EditableInvoice } from './_components/InvoiceFormDialog'
import { ImportDialog, downloadFile } from './_components/ImportDialog'

const NAVY = '#1B4F72'
// DİKKAT: departmentName'in GERÇEK veritabanı değeriyle harfiyen aynı olmalı (Personnel.bolum
// title-case üretiyor: "Sistem Geliştirme Müdürlüğü") — daha önce hardcode ALL-CAPS ("SİSTEM
// GELİŞTİRME MÜDÜRLÜĞÜ") idi, hiçbir zaman eşleşmiyordu, bu yüzden "Sistem Geliştirme Oranı"
// kartı sürekli %0 gösteriyordu (Toplam kartı yine de doğruydu çünkü o sadece toplama bakıyor).
const SG_LABEL = 'Sistem Geliştirme Müdürlüğü'
const GENEL_LABEL = 'Genel'
// Renk mantığı: bölüm sayısı kadar rastgele/rainbow renk yerine ilerihub'ın tüm sayfalarda
// zaten kullandığı TEK marka rengi (lacivert, NAVY) esas alınıyor — bu uygulamanın amacı zaten
// Sistem Geliştirme'yi öne çıkarmak. Genel (atanmamış) ve diğer gerçek bölümler iki ayrı ton
// gri — Genel daha açık, diğerleri biraz daha koyu. Hangi bölüm olduğu zaten satırın/çubuğun
// etiketinde yazıyor; renk burada kimlik değil vurgu taşıyor.
const OTHER_DEPT_COLOR = '#94A3B8'
const GENEL_COLOR = '#CBD5E1'

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

// Kuruş her zaman gösterilir (ör. tam sayıysa "...,00" ile biter) — bazen 2 ondalık
// basılıp bazen yuvarlanması tutarsız/eksik görünüyordu.
function formatEur(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}
function formatTL(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}
function formatPercent(n: number) {
  if (n === 0) return '%0'
  const abs = Math.abs(n)
  // Fatura toplamı ciroya kıyasla çok küçük olabiliyor (binde/on binde bir) —
  // sabit 1-2 ondalık her şeyi "%0,0"a yuvarlayıp bilgisiz hale getiriyordu.
  // tr-TR locale: ondalık AYRACI VİRGÜL — € / ₺ sütunlarındaki "." (binlik) ile
  // karışmasın diye toFixed() (hep nokta kullanır) yerine Intl.NumberFormat.
  const digits = abs >= 1 ? 1 : abs >= 0.01 ? 2 : 4
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
  return `%${formatted}`
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

  function getDeptColor(label: string) {
    if (label === SG_LABEL) return NAVY
    if (label === GENEL_LABEL) return GENEL_COLOR
    return OTHER_DEPT_COLOR
  }

  const OTHER_LABEL = 'Diğer bölümler'

  // "Tüm Zamanlar" grafiğindeki seriler: Genel (varsa, en altta — en büyük pay genelde bu),
  // Sistem Geliştirme, ve geri kalan tüm gerçek bölümlerin toplamı tek "Diğer bölümler"
  // serisi olarak. Genel bazı aylarda toplamın çoğunu kaplıyor — bu yüzden her segmentin
  // ucunda tam € değeri yazıyor (LabelList), sadece çubuk yüksekliğine güvenmiyoruz.
  const chartSeries = useMemo(() => {
    if (!summary) return []
    const labels = summary.departments.map((d) => d.label)
    const hasGenel = labels.includes(GENEL_LABEL)
    const hasSG = labels.includes(SG_LABEL)
    const hasOther = labels.some((l) => l !== GENEL_LABEL && l !== SG_LABEL)
    return [...(hasGenel ? [GENEL_LABEL] : []), ...(hasSG ? [SG_LABEL] : []), ...(hasOther ? [OTHER_LABEL] : [])]
  }, [summary])

  // Grafik üstteki "Aylık / Tüm Zamanlar" seçimini takip eder — ayrı bir grafik-bölüm
  // seçici YOKTU aslında burada, ama üstteki ay seçimiyle bağlantısız kaldığı için ay
  // değiştirince grafik değişmiyor, kafa karıştırıyordu. Artık tek kaynak üstteki seçim:
  // "Aylık" modunda seçili tek ayın bölüm kırılımı, "Tüm Zamanlar" modunda ayara göre trend.
  const chartData = useMemo(() => {
    if (!summary) return []
    if (scopeMode === 'ALL') {
      return summary.months.map((m) => {
        const row: Record<string, string | number> = {
          ay: formatMonthLabel(m.key),
          [GENEL_LABEL]: 0,
          [SG_LABEL]: 0,
          [OTHER_LABEL]: 0,
        }
        for (const d of m.departments) {
          const key = d.label === GENEL_LABEL ? GENEL_LABEL : d.label === SG_LABEL ? SG_LABEL : OTHER_LABEL
          row[key] = (Number(row[key]) || 0) + d.eur
        }
        return row
      })
    }
    const m = summary.months.find((mm) => mm.key === scopeMonth)
    if (!m) return []
    // Burada (tek ay, yatay çubuk) Genel de gösteriliyor — stacked grafikteki gibi "ezme"
    // sorunu yok çünkü her bölüm kendi satırında; değer etiketleri de var (LabelList),
    // o yüzden küçük bölümlerin tam tutarı yine okunabiliyor.
    return [...m.departments].sort((a, b) => b.eur - a.eur)
  }, [summary, scopeMode, scopeMonth])

  const totalCiro = useMemo(() => Object.values(revenues).reduce((s, v) => s + v, 0), [revenues])

  const scopedMonthSummary = summary?.months.find((m) => m.key === scopeMonth) ?? null

  // "Oran" bu sayfada TEK bir anlama gelir: € tutarının CİRO'ya bölünmesi — tablodaki
  // "Ciro İçindeki Payı" sütunuyla aynı hesap, aynı payda. Daha önce kart farklı bir şey
  // ölçüyordu (SG'nin toplam fatura içindeki payı, ciro hiç yoktu) — kafa karıştırıyordu.
  const cardTotals = useMemo(() => {
    if (scopeMode === 'MONTH' && scopedMonthSummary) {
      return { toplam: scopedMonthSummary.genel + scopedMonthSummary.sistemGelistirme, sistemGelistirme: scopedMonthSummary.sistemGelistirme }
    }
    return { toplam: summary?.totals.toplam ?? 0, sistemGelistirme: summary?.totals.sistemGelistirme ?? 0 }
  }, [scopeMode, scopedMonthSummary, summary])

  const scopedDepartments = scopeMode === 'MONTH' && scopedMonthSummary ? scopedMonthSummary.departments : summary?.departments ?? []
  const scopedCiro = scopeMode === 'MONTH' ? revenues[scopeMonth] ?? 0 : totalCiro
  const sgCiroOran = scopedCiro > 0 ? (cardTotals.sistemGelistirme / scopedCiro) * 100 : null

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

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
        <span>€ karşılığı, fatura tarihindeki TCMB Döviz Alış kurundan otomatik hesaplanır.</span>
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
        <SummaryCard
          label="Sistem Geliştirme — Ciro İçindeki Payı"
          value={sgCiroOran == null ? '—' : formatPercent(sgCiroOran)}
          color="#993C1D"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-muted-foreground">
              Bölüme göre dağılım {scopeMode === 'MONTH' && scopedMonthSummary ? `— ${formatMonthLabel(scopedMonthSummary.key)}` : '— Tüm Zamanlar'}
            </div>
            <button
              onClick={() => downloadFile('/api/sandbox/melike/faturalar/export?type=summary')}
              className="ml-auto flex items-center gap-1 text-xs font-medium text-[#1B4F72] hover:underline"
              title="Bu tablonun sayısal, yuvarlanmamış Excel çıktısı — KPI dosyana çekmek için"
            >
              <Download className="h-3 w-3" /> KPI Özet İndir
            </button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground/80">
            "Genel" (bölüm atanmamış faturalar) burada da var — bazı aylarda toplamın çoğunu
            kaplıyor, o yüzden her segmentin/çubuğun ucunda tam € değeri de yazıyor.
          </p>
          {scopeMode === 'ALL' ? (
            <div className="mb-4 h-64 w-full">
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                  <XAxis dataKey="ay" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatEur(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {chartSeries.map((label, i) => (
                    <Bar
                      key={label}
                      dataKey={label}
                      stackId="a"
                      fill={getDeptColor(label)}
                      stroke="#fff"
                      strokeWidth={2}
                      radius={i === chartSeries.length - 1 ? [4, 4, 0, 0] : undefined}
                    >
                      <LabelList
                        dataKey={label}
                        position="center"
                        formatter={(v: number) => (v > 0 ? formatEur(v) : '')}
                        style={{ fontSize: 9, fill: label === SG_LABEL ? '#fff' : '#334155' }}
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            // Bölüm adları uzun (ör. "İnsan Varlıkları Müdürlüğü") — dikey çubuk + eğik yazı
            // kırpılıyordu (kart kenarından taşıp kesiliyordu). Yatay çubuğa çevrildi: isimler
            // düz yazılıyor, kırpılma yok. dataviz skill'in de önerdiği şekil: uzun isimli
            // kategoriler için yatay çubuk.
            <div className="mb-4 w-full" style={{ height: Math.max(160, chartData.length * 48) }}>
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 70, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEE" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={190} />
                  <Tooltip formatter={(v: number) => formatEur(v)} />
                  <Bar dataKey="eur" radius={[0, 4, 4, 0]} barSize={28}>
                    {chartData.map((entry: any) => (
                      <Cell key={entry.label} fill={getDeptColor(entry.label)} />
                    ))}
                    {/* Genel'in tutarı diğerlerinden çok büyük olabiliyor, çubuk boyu küçük
                        bölümleri görsel olarak eziyor — bu yüzden değer her çubuğun ucunda
                        yazılı, sadece çubuk uzunluğuna güvenmiyoruz. */}
                    <LabelList dataKey="eur" position="right" formatter={(v: number) => formatEur(v)} style={{ fontSize: 11, fill: '#52514E' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {!scopedDepartments.length ? (
            <p className="py-2 text-sm text-muted-foreground">Bu kapsamda fatura kaydı yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bölüm</TableHead>
                  <TableHead className="text-right">Toplam (₺)</TableHead>
                  <TableHead className="text-right">Toplam (€)</TableHead>
                  <TableHead className="text-right">Ciro İçindeki Payı</TableHead>
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

      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 text-sm font-semibold text-muted-foreground">Ciro karşılaştırması</div>
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
