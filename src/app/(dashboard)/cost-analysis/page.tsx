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
    revision: "A",
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
  }, [currentPage, statusFilter, categoryFilter, customerFilter])

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
          revision: "A",
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maliyet Analizi</h1>
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
            <div className="relative flex-1 min-w-[200px]">
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
              className="w-40"
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
              className="w-40"
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
              className="w-40"
            >
              <option value="all">Tüm Müşteriler</option>
              {customers.map((cust) => (
                <option key={cust.id} value={cust.id}>
                  {cust.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
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
                          Rev. {analysis.revision} · {analysis.finishedWeight} kg
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
        <DialogContent className="max-w-lg">
          <form onSubmit={handleCreateAnalysis}>
            <DialogHeader>
              <DialogTitle>Yeni Maliyet Analizi</DialogTitle>
              <DialogDescription>
                Yeni bir ürün maliyet analizi oluşturun
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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
                Should-Cost analizi, bir ürünün "olması gereken" maliyetini belirlemek için
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
              <div className="grid grid-cols-2 gap-2 text-sm text-orange-700">
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
              <div className="grid grid-cols-2 gap-2 text-sm">
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
    </div>
  )
}
