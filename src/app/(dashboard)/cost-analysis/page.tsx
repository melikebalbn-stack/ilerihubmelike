"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NativeSelect as Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Plus,
  Search,
  Calculator,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  FileEdit,
  Archive,
  ChevronRight,
  Info,
  Settings,
  Upload,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

type CostAnalysis = {
  id: string
  code: string
  name: string
  description: string | null
  revision: string
  finishedWeight: number
  currency: string
  status: string
  materialCost: number
  laborCost: number
  externalCost: number
  otherCost: number
  totalCost: number
  salesPrice: number
  profitRate: number
  pricePerKg: number
  createdAt: string
  category: { id: string; name: string; color: string } | null
  customer: { id: string; name: string } | null
  _count: {
    materials: number
    laborItems: number
    externalServices: number
    otherCosts: number
  }
}

type Category = {
  id: string
  name: string
  code: string
  color: string
}

type Customer = {
  id: string
  name: string
  code: string
}

type ParsedItem = {
  valid: boolean
  errors: string[]
  [key: string]: unknown
}

type ImportData = {
  materials: ParsedItem[]
  laborItems: ParsedItem[]
  externalServices: ParsedItem[]
  otherCosts: ParsedItem[]
  summary: {
    totalItems: number
    errorCount: number
    materialCount: number
    laborCount: number
    externalServiceCount: number
    otherCostCount: number
    sheetsFound: string[]
  }
}

export default function CostAnalysisPage() {
  const [analyses, setAnalyses] = useState<CostAnalysis[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [customerFilter, setCustomerFilter] = useState("all")
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showAllRevisions, setShowAllRevisions] = useState(false)

  // Import state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importStep, setImportStep] = useState<1 | 2>(1)
  const [importLoading, setImportLoading] = useState(false)
  const [importSaving, setImportSaving] = useState(false)
  const [importData, setImportData] = useState<ImportData | null>(null)
  const [importPreviewTab, setImportPreviewTab] = useState("materials")
  const [importForm, setImportForm] = useState({
    code: "",
    name: "",
    description: "",
    finishedWeight: "",
    currency: "EUR",
    categoryId: "",
    customerId: "",
    overheadRate: "25",
    profitRate: "20",
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  // New analysis form
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    revision: "Rev.00",
    finishedWeight: "",
    currency: "EUR",
    categoryId: "",
    customerId: "",
    overheadRate: "25",
    profitRate: "20",
  })

  // Load data
  const loadData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      })

      if (searchTerm) params.append("search", searchTerm)
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (categoryFilter !== "all") params.append("categoryId", categoryFilter)
      if (customerFilter !== "all") params.append("customerId", customerFilter)
      if (showAllRevisions) params.append("showAllRevisions", "true")

      const res = await fetch(`/api/cost-analysis?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAnalyses(data.data)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error("Veri yükleme hatası:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadDropdownData = async () => {
    try {
      const [catRes, custRes] = await Promise.all([
        fetch("/api/cost-analysis/categories?activeOnly=true"),
        fetch("/api/cost-analysis/customers?activeOnly=true"),
      ])

      if (catRes.ok) {
        const data = await catRes.json()
        setCategories(data)
      }

      if (custRes.ok) {
        const data = await custRes.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error("Dropdown verileri yüklenirken hata:", error)
    }
  }

  useEffect(() => {
    loadData()
    loadDropdownData()
  }, [currentPage, statusFilter, categoryFilter, customerFilter, showAllRevisions])

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      loadData()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Onaylı
          </Badge>
        )
      case "PENDING_REVIEW":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <Clock className="mr-1 h-3 w-3" />
            İnceleme
          </Badge>
        )
      case "DRAFT":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <FileEdit className="mr-1 h-3 w-3" />
            Taslak
          </Badge>
        )
      case "ARCHIVED":
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            <Archive className="mr-1 h-3 w-3" />
            Arşiv
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatCurrency = (amount: number | string, currency: string = "EUR") => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(Number(amount) || 0)
  }

  const formatPercent = (value: number | string) => {
    return `%${(Number(value) || 0).toFixed(1)}`
  }

  const handleCreateAnalysis = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("/api/cost-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success("Maliyet analizi oluşturuldu!")
        setIsNewDialogOpen(false)
        setFormData({
          code: "",
          name: "",
          description: "",
          revision: "Rev.00",
          finishedWeight: "",
          currency: "EUR",
          categoryId: "",
          customerId: "",
          overheadRate: "25",
          profitRate: "20",
        })
        // Redirect to detail page
        window.location.href = `/cost-analysis/${data.id}`
      } else {
        const error = await res.json()
        toast.error(error.error || "Bir hata oluştu")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    }
  }

  // Import handlers
  const handleImportFileUpload = async (file: File) => {
    try {
      setImportLoading(true)
      const fd = new FormData()
      fd.append("file", file)

      const res = await fetch("/api/cost-analysis/import", {
        method: "POST",
        body: fd,
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Dosya işlenirken hata oluştu")
        return
      }

      setImportData(data)
      setImportStep(2)
      toast.success(`${data.summary.totalItems} kalem bulundu${data.summary.errorCount > 0 ? `, ${data.summary.errorCount} hatalı satır var` : ""}`)
    } catch (error) {
      console.error("Import hatası:", error)
      toast.error("Dosya yüklenirken hata oluştu")
    } finally {
      setImportLoading(false)
    }
  }

  const handleImportSave = async () => {
    if (!importData) return

    if (!importForm.code.trim() || !importForm.name.trim()) {
      toast.error("Ürün kodu ve adı zorunludur")
      return
    }

    try {
      setImportSaving(true)
      const res = await fetch("/api/cost-analysis/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...importForm,
          materials: importData.materials,
          laborItems: importData.laborItems,
          externalServices: importData.externalServices,
          otherCosts: importData.otherCosts,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Kaydetme sırasında hata oluştu")
        return
      }

      toast.success("Maliyet analizi başarıyla içe aktarıldı!")
      setIsImportDialogOpen(false)
      resetImportState()
      window.location.href = `/cost-analysis/${data.id}`
    } catch (error) {
      console.error("Import kaydetme hatası:", error)
      toast.error("Kaydetme sırasında hata oluştu")
    } finally {
      setImportSaving(false)
    }
  }

  const resetImportState = () => {
    setImportStep(1)
    setImportData(null)
    setImportPreviewTab("materials")
    setImportForm({
      code: "",
      name: "",
      description: "",
      finishedWeight: "",
      currency: "EUR",
      categoryId: "",
      customerId: "",
      overheadRate: "25",
      profitRate: "20",
    })
  }

  // Stats
  const stats = {
    total: total,
    approved: analyses.filter((a) => a.status === "APPROVED").length,
    draft: analyses.filter((a) => a.status === "DRAFT").length,
    pending: analyses.filter((a) => a.status === "PENDING_REVIEW").length,
  }

  if (loading && analyses.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight">Maliyet Analizi</h1>
          <p className="text-muted-foreground">
            Ürün maliyetlerinin detaylı takibi ve Should-Cost analizi
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowGuide(true)}>
            <Info className="mr-2 h-4 w-4" />
            Maliyet Kılavuzu
          </Button>
          <Link href="/cost-analysis/settings">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Ayarlar
            </Button>
          </Link>
          <Button variant="outline" onClick={() => { resetImportState(); setIsImportDialogOpen(true) }}>
            <Upload className="mr-2 h-4 w-4" />
            Excel&apos;den İçe Aktar
          </Button>
          <Button onClick={() => setIsNewDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Yeni Analiz
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Analiz</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onaylı</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taslak</CardTitle>
            <FileEdit className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.draft}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">İncelemede</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis List */}
      <Card>
        <CardHeader>
          <CardTitle>Maliyet Analizleri</CardTitle>
          <CardDescription>Tüm ürün maliyet analizleri listesi</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Kod veya ürün adı ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-40"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="DRAFT">Taslak</option>
              <option value="PENDING_REVIEW">İncelemede</option>
              <option value="APPROVED">Onaylı</option>
              <option value="ARCHIVED">Arşiv</option>
            </Select>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-40"
            >
              <option value="all">Tüm Kategoriler</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
            <Select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full sm:w-40"
            >
              <option value="all">Tüm Müşteriler</option>
              {customers.map((cust) => (
                <option key={cust.id} value={cust.id}>
                  {cust.name}
                </option>
              ))}
            </Select>
            <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={showAllRevisions}
                onChange={(e) => {
                  setShowAllRevisions(e.target.checked)
                  setCurrentPage(1)
                }}
                className="rounded border-gray-300"
              />
              <span>Tüm Revizyonlar</span>
            </label>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Ürün Adı</TableHead>
                  <TableHead>Müşteri</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Maliyet</TableHead>
                  <TableHead className="text-right">Satış Fiyatı</TableHead>
                  <TableHead className="text-center">Kar %</TableHead>
                  <TableHead className="text-center">Durum</TableHead>
                  <TableHead className="text-right">Detay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {searchTerm ? "Arama sonucu bulunamadı" : "Henüz analiz eklenmemiş"}
                    </TableCell>
                  </TableRow>
                ) : (
                  analyses.map((analysis) => (
                    <TableRow
                      key={analysis.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => (window.location.href = `/cost-analysis/${analysis.id}`)}
                    >
                      <TableCell>
                        <span className="font-mono font-medium text-teal-600">
                          {analysis.code}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{analysis.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {analysis.revision} · {analysis.finishedWeight} kg
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {analysis.customer?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {analysis.category ? (
                          <Badge
                            style={{
                              backgroundColor: `${analysis.category.color}20`,
                              color: analysis.category.color,
                            }}
                          >
                            {analysis.category.name}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(analysis.totalCost, analysis.currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-teal-600">
                        {formatCurrency(analysis.salesPrice, analysis.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-teal-600">
                          {formatPercent(analysis.profitRate)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(analysis.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Toplam {total} analiz - Sayfa {currentPage} / {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Önceki
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Analysis Dialog */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateAnalysis}>
            <DialogHeader>
              <DialogTitle>Yeni Maliyet Analizi</DialogTitle>
              <DialogDescription>
                Yeni bir ürün maliyet analizi oluşturun
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Ürün Kodu *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="2910"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revision">Revizyon</Label>
                  <Input
                    id="revision"
                    value={formData.revision}
                    onChange={(e) => setFormData({ ...formData, revision: e.target.value })}
                    placeholder="A"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Ürün Adı *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="2'li TG"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Açıklama</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ürün açıklaması..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="finishedWeight">Bitmiş Ağırlık (kg) <span className="text-gray-400 text-xs">(sonra girilebilir)</span></Label>
                  <Input
                    id="finishedWeight"
                    type="number"
                    step="0.01"
                    value={formData.finishedWeight}
                    onChange={(e) => setFormData({ ...formData, finishedWeight: e.target.value })}
                    placeholder="Boş bırakabilirsiniz"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Para Birimi</Label>
                  <Select
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="TRY">TRY (₺)</option>
                    <option value="GBP">GBP (£)</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Kategori</Label>
                  <Select
                    id="categoryId"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  >
                    <option value="">Seçiniz</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerId">Müşteri</Label>
                  <Select
                    id="customerId"
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  >
                    <option value="">Seçiniz</option>
                    {customers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="overheadRate">İşletme Gideri (%)</Label>
                  <Input
                    id="overheadRate"
                    type="number"
                    step="0.1"
                    value={formData.overheadRate}
                    onChange={(e) => setFormData({ ...formData, overheadRate: e.target.value })}
                    placeholder="25"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profitRate">Kar Oranı (%)</Label>
                  <Input
                    id="profitRate"
                    type="number"
                    step="0.1"
                    value={formData.profitRate}
                    onChange={(e) => setFormData({ ...formData, profitRate: e.target.value })}
                    placeholder="20"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewDialogOpen(false)}
              >
                İptal
              </Button>
              <Button type="submit">Oluştur</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Guide Modal */}
      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Maliyet Kılavuzu - Should-Cost Analizi</DialogTitle>
            <DialogDescription>
              Should-Cost analizi ve maliyet hesaplama metodolojisi hakkında kapsamlı bilgi
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Should-Cost */}
            <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
              <h3 className="font-semibold text-blue-800 mb-2">Should-Cost Nedir?</h3>
              <p className="text-blue-700 text-sm">
                Should-Cost analizi, bir ürünün &quot;olması gereken&quot; maliyetini belirlemek için
                kullanılan sistematik bir yaklaşımdır. ABD Savunma Bakanlığı tarafından
                geliştirilmiş olup, tedarikçi fiyatlarını değerlendirmek ve müzakere etmek
                için kullanılır.
              </p>
            </div>

            {/* Temel Prensipler */}
            <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
              <h3 className="font-semibold text-green-800 mb-2">Temel Prensipler</h3>
              <ul className="text-green-700 text-sm space-y-1">
                <li>• Malzeme maliyetlerini pazar fiyatlarıyla karşılaştır</li>
                <li>• İşçilik sürelerini standartlarla doğrula</li>
                <li>• Genel gider oranlarını sektör ortalamasıyla kıyasla</li>
                <li>• Kar marjını makul seviyede tut</li>
              </ul>
            </div>

            {/* 7 Muda */}
            <div className="bg-orange-50 rounded-lg p-4 border-l-4 border-orange-500">
              <h3 className="font-semibold text-orange-800 mb-2">7 Muda (İsraf Türleri)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-orange-700">
                <div>1. Aşırı Üretim</div>
                <div>2. Bekleme</div>
                <div>3. Taşıma</div>
                <div>4. İşleme</div>
                <div>5. Stok</div>
                <div>6. Hareket</div>
                <div>7. Hata</div>
              </div>
            </div>

            {/* PDCA */}
            <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-500">
              <h3 className="font-semibold text-purple-800 mb-2">PDCA Döngüsü</h3>
              <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="bg-white bg-opacity-60 p-2 rounded">
                  <span className="font-medium text-purple-800">Plan:</span>
                  <span className="text-purple-700"> Hedef belirle</span>
                </div>
                <div className="bg-white bg-opacity-60 p-2 rounded">
                  <span className="font-medium text-purple-800">Do:</span>
                  <span className="text-purple-700"> Uygula</span>
                </div>
                <div className="bg-white bg-opacity-60 p-2 rounded">
                  <span className="font-medium text-purple-800">Check:</span>
                  <span className="text-purple-700"> Kontrol et</span>
                </div>
                <div className="bg-white bg-opacity-60 p-2 rounded">
                  <span className="font-medium text-purple-800">Act:</span>
                  <span className="text-purple-700"> Önlem al</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowGuide(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => { if (!open) resetImportState(); setIsImportDialogOpen(open) }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Excel&apos;den İçe Aktar
              {importStep === 2 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">- Adım 2: Bilgiler ve Onay</span>
              )}
            </DialogTitle>
            <DialogDescription>
              {importStep === 1
                ? "Maliyet analizi verilerini Excel dosyasından içe aktarın. Dosyada Malzemeler, İşçilik, Dış Hizmetler ve Diğer Maliyetler sayfaları olmalıdır."
                : "Verileri kontrol edin, analiz bilgilerini doldurun ve içe aktarın."}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: File Upload */}
          {importStep === 1 && (
            <div className="py-6">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-teal-400 transition-colors cursor-pointer"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-teal-400", "bg-teal-50/30") }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-teal-400", "bg-teal-50/30") }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.classList.remove("border-teal-400", "bg-teal-50/30")
                  const file = e.dataTransfer.files[0]
                  if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
                    handleImportFileUpload(file)
                  } else {
                    toast.error("Sadece .xlsx ve .xls dosyaları kabul edilir")
                  }
                }}
                onClick={() => {
                  const input = document.createElement("input")
                  input.type = "file"
                  input.accept = ".xlsx,.xls"
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) handleImportFileUpload(file)
                  }
                  input.click()
                }}
              >
                {importLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-12 w-12 text-teal-500 animate-spin" />
                    <p className="text-sm text-muted-foreground">Dosya işleniyor...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="h-12 w-12 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Dosyayı sürükleyip bırakın veya tıklayın
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        .xlsx veya .xls formatı (maks. 10MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400">
                <h4 className="text-sm font-medium text-blue-800 mb-1">Excel Dosya Formatı</h4>
                <p className="text-xs text-blue-700">
                  Dosya sayfaları: <strong>Malzemeler</strong>, <strong>İşçilik</strong>, <strong>Dış Hizmetler</strong>, <strong>Diğer Maliyetler</strong>.
                  Mevcut bir analizin &quot;Excel&apos;e Aktar&quot; ile indirdiğiniz dosyayı doğrudan kullanabilirsiniz.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Info + Preview */}
          {importStep === 2 && importData && (
            <div className="py-4 space-y-4">
              {/* Summary bar */}
              <div className="flex flex-wrap gap-2">
                {importData.summary.sheetsFound.map((sheet) => (
                  <Badge key={sheet} className="bg-teal-100 text-teal-800">{sheet}</Badge>
                ))}
                <Badge variant="outline">{importData.summary.totalItems} kalem</Badge>
                {importData.summary.errorCount > 0 && (
                  <Badge className="bg-red-100 text-red-800">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    {importData.summary.errorCount} hata
                  </Badge>
                )}
              </div>

              {/* Analysis Info Form */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">Analiz Bilgileri</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Ürün Kodu *</Label>
                    <Input
                      value={importForm.code}
                      onChange={(e) => setImportForm({ ...importForm, code: e.target.value })}
                      placeholder="2910"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ürün Adı *</Label>
                    <Input
                      value={importForm.name}
                      onChange={(e) => setImportForm({ ...importForm, name: e.target.value })}
                      placeholder="Ürün adı"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Müşteri</Label>
                    <Select
                      value={importForm.customerId}
                      onChange={(e) => setImportForm({ ...importForm, customerId: e.target.value })}
                      className="h-8 text-sm"
                    >
                      <option value="">Seçiniz</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kategori</Label>
                    <Select
                      value={importForm.categoryId}
                      onChange={(e) => setImportForm({ ...importForm, categoryId: e.target.value })}
                      className="h-8 text-sm"
                    >
                      <option value="">Seçiniz</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Para Birimi</Label>
                    <Select
                      value={importForm.currency}
                      onChange={(e) => setImportForm({ ...importForm, currency: e.target.value })}
                      className="h-8 text-sm"
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="TRY">TRY</option>
                      <option value="GBP">GBP</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Bitmiş Ağırlık (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={importForm.finishedWeight}
                      onChange={(e) => setImportForm({ ...importForm, finishedWeight: e.target.value })}
                      placeholder="0"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">İşletme Gideri (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={importForm.overheadRate}
                      onChange={(e) => setImportForm({ ...importForm, overheadRate: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kar Oranı (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={importForm.profitRate}
                      onChange={(e) => setImportForm({ ...importForm, profitRate: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Preview Tabs */}
              <div>
                <div className="flex border-b">
                  {[
                    { key: "materials", label: "Malzemeler", count: importData.summary.materialCount },
                    { key: "labor", label: "İşçilik", count: importData.summary.laborCount },
                    { key: "external", label: "Dış Hizmetler", count: importData.summary.externalServiceCount },
                    { key: "other", label: "Diğer", count: importData.summary.otherCostCount },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                        importPreviewTab === tab.key
                          ? "border-teal-500 text-teal-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      } ${tab.count === 0 ? "opacity-50" : ""}`}
                      onClick={() => setImportPreviewTab(tab.key)}
                      disabled={tab.count === 0}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                <div className="mt-3 max-h-[300px] overflow-auto rounded border">
                  {/* Materials Preview */}
                  {importPreviewTab === "materials" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-8">#</TableHead>
                          <TableHead className="text-xs">Kod</TableHead>
                          <TableHead className="text-xs">Malzeme Adı</TableHead>
                          <TableHead className="text-xs">Kategori</TableHead>
                          <TableHead className="text-xs text-right">Brüt Miktar</TableHead>
                          <TableHead className="text-xs text-right">Fire %</TableHead>
                          <TableHead className="text-xs text-right">Birim Fiyat</TableHead>
                          <TableHead className="text-xs w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importData.materials.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-4">Malzeme verisi bulunamadı</TableCell></TableRow>
                        ) : importData.materials.map((m, i) => (
                          <TableRow key={i} className={!m.valid ? "bg-red-50" : ""}>
                            <TableCell className="text-xs">{i + 1}</TableCell>
                            <TableCell className="text-xs font-mono">{String(m.materialCode || "-")}</TableCell>
                            <TableCell className="text-xs">{String(m.name)}</TableCell>
                            <TableCell className="text-xs">{String(m.category)}</TableCell>
                            <TableCell className="text-xs text-right">{Number(m.grossQuantity).toFixed(3)}</TableCell>
                            <TableCell className="text-xs text-right">{Number(m.wasteRate).toFixed(1)}</TableCell>
                            <TableCell className="text-xs text-right">{Number(m.unitPrice).toFixed(2)}</TableCell>
                            <TableCell className="text-xs">
                              {!m.valid && (
                                <span title={m.errors.join(", ")} className="cursor-help">
                                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Labor Preview */}
                  {importPreviewTab === "labor" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-8">#</TableHead>
                          <TableHead className="text-xs">Kod</TableHead>
                          <TableHead className="text-xs">Operasyon</TableHead>
                          <TableHead className="text-xs">Tip</TableHead>
                          <TableHead className="text-xs text-right">Hazırlık (sa)</TableHead>
                          <TableHead className="text-xs text-right">İşlem (sa)</TableHead>
                          <TableHead className="text-xs text-right">Saat Ücreti</TableHead>
                          <TableHead className="text-xs w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importData.laborItems.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-4">İşçilik verisi bulunamadı</TableCell></TableRow>
                        ) : importData.laborItems.map((l, i) => (
                          <TableRow key={i} className={!l.valid ? "bg-red-50" : ""}>
                            <TableCell className="text-xs">{i + 1}</TableCell>
                            <TableCell className="text-xs font-mono">{String(l.operationCode || "-")}</TableCell>
                            <TableCell className="text-xs">{String(l.operationName)}</TableCell>
                            <TableCell className="text-xs">{String(l.laborType)}</TableCell>
                            <TableCell className="text-xs text-right">{Number(l.setupTime).toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-right">{Number(l.processTime).toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-right">{Number(l.hourlyRate).toFixed(2)}</TableCell>
                            <TableCell className="text-xs">
                              {!l.valid && (
                                <span title={l.errors.join(", ")} className="cursor-help">
                                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* External Services Preview */}
                  {importPreviewTab === "external" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-8">#</TableHead>
                          <TableHead className="text-xs">Kod</TableHead>
                          <TableHead className="text-xs">Hizmet Adı</TableHead>
                          <TableHead className="text-xs">Tip</TableHead>
                          <TableHead className="text-xs text-right">Miktar</TableHead>
                          <TableHead className="text-xs text-right">Birim Fiyat</TableHead>
                          <TableHead className="text-xs w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importData.externalServices.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-4">Dış hizmet verisi bulunamadı</TableCell></TableRow>
                        ) : importData.externalServices.map((s, i) => (
                          <TableRow key={i} className={!s.valid ? "bg-red-50" : ""}>
                            <TableCell className="text-xs">{i + 1}</TableCell>
                            <TableCell className="text-xs font-mono">{String(s.serviceCode || "-")}</TableCell>
                            <TableCell className="text-xs">{String(s.serviceName)}</TableCell>
                            <TableCell className="text-xs">{String(s.serviceType)}</TableCell>
                            <TableCell className="text-xs text-right">{Number(s.quantity).toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-right">{Number(s.unitPrice).toFixed(2)}</TableCell>
                            <TableCell className="text-xs">
                              {!s.valid && (
                                <span title={s.errors.join(", ")} className="cursor-help">
                                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Other Costs Preview */}
                  {importPreviewTab === "other" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-8">#</TableHead>
                          <TableHead className="text-xs">Kalem Adı</TableHead>
                          <TableHead className="text-xs">Kategori</TableHead>
                          <TableHead className="text-xs text-right">Miktar</TableHead>
                          <TableHead className="text-xs text-right">Birim Fiyat</TableHead>
                          <TableHead className="text-xs w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importData.otherCosts.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-4">Diğer maliyet verisi bulunamadı</TableCell></TableRow>
                        ) : importData.otherCosts.map((o, i) => (
                          <TableRow key={i} className={!o.valid ? "bg-red-50" : ""}>
                            <TableCell className="text-xs">{i + 1}</TableCell>
                            <TableCell className="text-xs">{String(o.name)}</TableCell>
                            <TableCell className="text-xs">{String(o.category)}</TableCell>
                            <TableCell className="text-xs text-right">{Number(o.quantity).toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-right">{Number(o.unitPrice).toFixed(2)}</TableCell>
                            <TableCell className="text-xs">
                              {!o.valid && (
                                <span title={o.errors.join(", ")} className="cursor-help">
                                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>

              {/* Error warning */}
              {importData.summary.errorCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    {importData.summary.errorCount} hatalı satır bulundu. Hatalı satırlar kırmızı ile işaretlenmiştir ve
                    içe aktarılmayacaktır. Sadece geçerli satırlar kaydedilecektir.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {importStep === 2 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => { setImportStep(1); setImportData(null) }}
              >
                Geri
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => { resetImportState(); setIsImportDialogOpen(false) }}
            >
              İptal
            </Button>
            {importStep === 2 && (
              <Button
                onClick={handleImportSave}
                disabled={importSaving || !importForm.code.trim() || !importForm.name.trim()}
              >
                {importSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Kaydediliyor...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    İçe Aktar
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
