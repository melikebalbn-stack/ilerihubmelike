"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  FileWarning, Plus, Search, MoreHorizontal, Eye, Edit, RefreshCw,
  AlertTriangle, Clock, CheckCircle, XCircle, HelpCircle, BookOpen,
  ArrowRight, Lightbulb, Settings, Target, Shield,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

const ncrSources = [
  { value: "INCOMING_INSPECTION", label: "Giriş Kontrolü" },
  { value: "PRODUCTION", label: "Üretim" },
  { value: "FINAL_INSPECTION", label: "Son Kontrol" },
  { value: "CUSTOMER_RETURN", label: "Müşteri İadesi" },
  { value: "INTERNAL_AUDIT", label: "İç Denetim" },
  { value: "SUPPLIER", label: "Tedarikçi" },
  { value: "PROCESS", label: "Proses" },
  { value: "OTHER", label: "Diğer" },
]

const ncrStatuses = [
  { value: "OPEN", label: "Açık", color: "bg-red-500" },
  { value: "UNDER_INVESTIGATION", label: "İncelemede", color: "bg-yellow-500" },
  { value: "DISPOSITION_PENDING", label: "Karar Bekliyor", color: "bg-orange-500" },
  { value: "IN_PROGRESS", label: "İşlemde", color: "bg-blue-500" },
  { value: "CLOSED", label: "Kapatıldı", color: "bg-green-500" },
]

const dispositions = [
  { value: "USE_AS_IS", label: "Olduğu Gibi Kullan" },
  { value: "REWORK", label: "Yeniden İşle" },
  { value: "REPAIR", label: "Tamir Et" },
  { value: "SCRAP", label: "Hurda" },
  { value: "RETURN_TO_SUPPLIER", label: "Tedarikçiye İade" },
  { value: "DOWNGRADE", label: "Alt Kaliteye Düşür" },
]

const severities = [
  { value: "MINOR", label: "Küçük", color: "bg-green-500" },
  { value: "MAJOR", label: "Büyük", color: "bg-orange-500" },
  { value: "CRITICAL", label: "Kritik", color: "bg-red-500" },
]

interface NCR {
  id: string
  ncrNumber: string
  title: string
  source: string
  status: string
  severity: string
  disposition: string | null
  quantity: number
  reportedBy: { id: string; name: string }
  department: { id: string; name: string } | null
  detectedDate: string
  createdAt: string
}

export default function NCRPage() {
  const [ncrs, setNcrs] = useState<NCR[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    source: "",
    severity: "MINOR",
    description: "",
    quantity: 1,
    productCode: "",
    lotNumber: "",
  })

  const fetchNCRs = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      if (sourceFilter !== "all") params.append("source", sourceFilter)
      if (statusFilter !== "all") params.append("status", statusFilter)

      const res = await fetch(`/api/qdms/ncr?${params}`)
      if (res.ok) {
        const data = await res.json()
        setNcrs(data)
      }
    } catch (error) {
      toast.error("Uygunsuzluklar yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNCRs()
  }, [searchQuery, sourceFilter, statusFilter])

  const handleCreate = async () => {
    if (!formData.title || !formData.source) {
      toast.error("Başlık ve kaynak zorunludur")
      return
    }

    try {
      const res = await fetch("/api/qdms/ncr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Uygunsuzluk raporu başarıyla oluşturuldu")
        setIsCreateDialogOpen(false)
        setFormData({ title: "", source: "", severity: "MINOR", description: "", quantity: 1, productCode: "", lotNumber: "" })
        fetchNCRs()
      } else {
        const data = await res.json()
        toast.error(data.message || "Hata oluştu")
      }
    } catch (error) {
      toast.error("Sunucu hatası")
    }
  }

  const getStatusBadge = (status: string) => {
    const info = ncrStatuses.find(s => s.value === status)
    return <Badge className={`${info?.color} text-white`}>{info?.label || status}</Badge>
  }

  const getSeverityBadge = (severity: string) => {
    const info = severities.find(s => s.value === severity)
    return <Badge className={`${info?.color} text-white`}>{info?.label || severity}</Badge>
  }

  const getSourceLabel = (source: string) => ncrSources.find(s => s.value === source)?.label || source

  const getDispositionLabel = (disposition: string | null) => {
    if (!disposition) return "-"
    return dispositions.find(d => d.value === disposition)?.label || disposition
  }

  const stats = {
    total: ncrs.length,
    open: ncrs.filter(n => n.status === "OPEN").length,
    inProgress: ncrs.filter(n => ["UNDER_INVESTIGATION", "IN_PROGRESS", "DISPOSITION_PENDING"].includes(n.status)).length,
    closed: ncrs.filter(n => n.status === "CLOSED").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Uygunsuzluk Yönetimi (NCR)</h1>
          <p className="text-muted-foreground">Uygunsuzluk raporları ve düzeltici faaliyetler</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
            onClick={() => setIsGuideOpen(true)}
          >
            <HelpCircle className="h-4 w-4" />
            Nasıl Kullanılır?
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Yeni NCR
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam NCR</CardTitle>
            <FileWarning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Açık</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{stats.open}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">İşlemde</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kapatılan</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{stats.closed}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="NCR ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Kaynak" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kaynaklar</SelectItem>
                {ncrSources.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {ncrStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchNCRs}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NCR No</TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead>Ciddiyet</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>Karar</TableHead>
                <TableHead>Tespit Tarihi</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : ncrs.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Henüz NCR bulunmuyor</TableCell></TableRow>
              ) : (
                ncrs.map(ncr => (
                  <TableRow key={ncr.id}>
                    <TableCell className="font-mono">{ncr.ncrNumber}</TableCell>
                    <TableCell><div className="max-w-[200px] truncate">{ncr.title}</div></TableCell>
                    <TableCell>{getSourceLabel(ncr.source)}</TableCell>
                    <TableCell>{getSeverityBadge(ncr.severity)}</TableCell>
                    <TableCell>{getStatusBadge(ncr.status)}</TableCell>
                    <TableCell>{ncr.quantity}</TableCell>
                    <TableCell>{getDispositionLabel(ncr.disposition)}</TableCell>
                    <TableCell>{format(new Date(ncr.detectedDate), "dd MMM yyyy", { locale: tr })}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />Görüntüle</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="mr-2 h-4 w-4" />Düzenle</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Uygunsuzluk Raporu</DialogTitle>
            <DialogDescription>Yeni bir NCR kaydı oluşturun</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Başlık *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Uygunsuzluk başlığı"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Kaynak *</Label>
                <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                  <SelectTrigger><SelectValue placeholder="Kaynak seçin" /></SelectTrigger>
                  <SelectContent>
                    {ncrSources.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">Ciddiyet</Label>
                <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {severities.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productCode">Ürün Kodu</Label>
                <Input
                  id="productCode"
                  value={formData.productCode}
                  onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                  placeholder="Ürün kodu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Miktar</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lotNumber">Lot/Parti No</Label>
              <Input
                id="lotNumber"
                value={formData.lotNumber}
                onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                placeholder="Lot numarası"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Uygunsuzluk detayları"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>İptal</Button>
            <Button onClick={handleCreate}>Oluştur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guide Dialog */}
      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-6 w-6 text-blue-600" />
              Uygunsuzluk Yönetimi (NCR) Rehberi
            </DialogTitle>
            <DialogDescription>
              ISO 9001 uygunsuzluk yönetimi hakkında bilgi edinin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Uygunsuzluk Nedir */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileWarning className="h-5 w-5 text-red-600" />
                Uygunsuzluk (NCR) Nedir?
              </h3>
              <p className="text-muted-foreground">
                Uygunsuzluk, belirlenen gereksinimlerin karşılanmaması durumudur.
                NCR (Non-Conformance Report), uygunsuzlukların tanımlanması, analizi ve
                düzeltilmesi için kullanılan temel dokümandır.
                ISO 9001:2015 standardının 8.7 ve 10.2 maddeleri kapsamında zorunludur.
              </p>
            </div>

            {/* Ciddiyet Seviyeleri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Ciddiyet Seviyeleri
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                  <div className="font-medium text-green-800">Küçük (Minor)</div>
                  <p className="text-xs text-green-700 mt-1">Kullanımı etkilemez</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 text-center">
                  <div className="font-medium text-orange-800">Büyük (Major)</div>
                  <p className="text-xs text-orange-700 mt-1">Fonksiyon etkilenir</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
                  <div className="font-medium text-red-800">Kritik (Critical)</div>
                  <p className="text-xs text-red-700 mt-1">Güvenlik riski</p>
                </div>
              </div>
            </div>

            {/* Uygunsuzluk Kaynakları */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Tespit Kaynakları
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ncrSources.map((source) => (
                  <div key={source.value} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <ArrowRight className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">{source.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Karar Seçenekleri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                Karar (Disposition) Seçenekleri
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {dispositions.map((disp) => (
                  <div key={disp.value} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <ArrowRight className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm">{disp.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* NCR Süreci */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                NCR İşlem Süreci
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <span className="font-medium">Tespit ve Kayıt</span>
                    <p className="text-sm text-muted-foreground">Uygunsuzluk tespit edilir ve NCR açılır</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <span className="font-medium">İnceleme</span>
                    <p className="text-sm text-muted-foreground">Kök neden analizi yapılır</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <span className="font-medium">Karar</span>
                    <p className="text-sm text-muted-foreground">Uygun disposition belirlenir</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">4</div>
                  <div>
                    <span className="font-medium">Uygulama</span>
                    <p className="text-sm text-muted-foreground">Düzeltici işlem uygulanır</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">5</div>
                  <div>
                    <span className="font-medium">Doğrulama ve Kapanış</span>
                    <p className="text-sm text-muted-foreground">İşlem doğrulanır ve NCR kapatılır</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sistem Özellikleri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-600" />
                Sistem Özellikleri
              </h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Otomatik NCR numarası oluşturma</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Ürün ve lot takibi</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">CAPA entegrasyonu</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Maliyetlendirme ve raporlama</span>
                </li>
              </ul>
            </div>

            {/* Hızlı Başlangıç */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-600" />
                Hızlı Başlangıç
              </h3>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>İpucu:</strong> NCR açarken ürün kodu ve lot numarasını mutlaka belirtin.
                  Bu, izlenebilirlik ve analiz için kritik öneme sahiptir.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsGuideOpen(false)}>
              Anladım
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
