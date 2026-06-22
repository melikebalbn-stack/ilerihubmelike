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
  Truck, Plus, Search, MoreHorizontal, Eye, Edit, RefreshCw,
  Building, Star, AlertCircle, CheckCircle2, HelpCircle, BookOpen,
  ArrowRight, Lightbulb, Settings, Target, CheckCircle, Shield,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

const supplierCategories = [
  { value: "RAW_MATERIAL", label: "Hammadde" },
  { value: "COMPONENT", label: "Parça/Komponent" },
  { value: "SERVICE", label: "Hizmet" },
  { value: "EQUIPMENT", label: "Ekipman" },
  { value: "PACKAGING", label: "Ambalaj" },
  { value: "LOGISTICS", label: "Lojistik" },
  { value: "CALIBRATION", label: "Kalibrasyon" },
  { value: "MAINTENANCE", label: "Bakım" },
  { value: "OTHER", label: "Diğer" },
]

const supplierStatuses = [
  { value: "PENDING", label: "Beklemede", color: "bg-yellow-500" },
  { value: "APPROVED", label: "Onaylı", color: "bg-green-500" },
  { value: "CONDITIONAL", label: "Şartlı Onay", color: "bg-orange-500" },
  { value: "SUSPENDED", label: "Askıya Alındı", color: "bg-red-500" },
  { value: "BLACKLISTED", label: "Kara Liste", color: "bg-gray-800" },
]

const ratingLevels = [
  { min: 4, label: "A", color: "text-green-600" },
  { min: 3, label: "B", color: "text-blue-600" },
  { min: 2, label: "C", color: "text-yellow-600" },
  { min: 0, label: "D", color: "text-red-600" },
]

interface Supplier {
  id: string
  supplierCode: string
  name: string
  category: string
  status: string
  contactPerson: string | null
  email: string | null
  phone: string | null
  rating: number | null
  qualityScore: number | null
  deliveryScore: number | null
  approvalDate: string | null
  lastEvaluationDate: string | null
  createdAt: string
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
  })

  const fetchSuppliers = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      if (categoryFilter !== "all") params.append("category", categoryFilter)
      if (statusFilter !== "all") params.append("status", statusFilter)

      const res = await fetch(`/api/qdms/suppliers?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data)
      }
    } catch (error) {
      toast.error("Tedarikçiler yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuppliers()
  }, [searchQuery, categoryFilter, statusFilter])

  const handleCreate = async () => {
    if (!formData.name || !formData.category) {
      toast.error("Tedarikçi adı ve kategori zorunludur")
      return
    }

    try {
      const res = await fetch("/api/qdms/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Tedarikçi başarıyla oluşturuldu")
        setIsCreateDialogOpen(false)
        setFormData({ name: "", category: "", contactPerson: "", email: "", phone: "", address: "" })
        fetchSuppliers()
      } else {
        const data = await res.json()
        toast.error(data.message || "Hata oluştu")
      }
    } catch (error) {
      toast.error("Sunucu hatası")
    }
  }

  const getStatusBadge = (status: string) => {
    const info = supplierStatuses.find(s => s.value === status)
    return <Badge className={`${info?.color} text-white`}>{info?.label || status}</Badge>
  }

  const getCategoryLabel = (category: string) => supplierCategories.find(c => c.value === category)?.label || category

  const getRatingBadge = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground">-</span>
    const level = ratingLevels.find(l => rating >= l.min)
    return <span className={`font-bold ${level?.color}`}>{level?.label} ({rating.toFixed(1)})</span>
  }

  const stats = {
    total: suppliers.length,
    approved: suppliers.filter(s => s.status === "APPROVED").length,
    conditional: suppliers.filter(s => s.status === "CONDITIONAL").length,
    suspended: suppliers.filter(s => s.status === "SUSPENDED").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tedarikçi Yönetimi</h1>
          <p className="text-muted-foreground">Tedarikçi değerlendirme ve takip</p>
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
            Yeni Tedarikçi
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Tedarikçi</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onaylı</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{stats.approved}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Şartlı Onay</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-600">{stats.conditional}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Askıda</CardTitle>
            <Star className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{stats.suspended}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Tedarikçi ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {supplierCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {supplierStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchSuppliers}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Tedarikçi Adı</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>İletişim</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Kalite</TableHead>
                <TableHead>Teslimat</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : suppliers.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Henüz tedarikçi bulunmuyor</TableCell></TableRow>
              ) : (
                suppliers.map(supplier => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-mono">{supplier.supplierCode}</TableCell>
                    <TableCell><div className="max-w-[200px] truncate font-medium">{supplier.name}</div></TableCell>
                    <TableCell>{getCategoryLabel(supplier.category)}</TableCell>
                    <TableCell>{getStatusBadge(supplier.status)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {supplier.contactPerson && <div>{supplier.contactPerson}</div>}
                        {supplier.email && <div className="text-muted-foreground">{supplier.email}</div>}
                      </div>
                    </TableCell>
                    <TableCell>{getRatingBadge(supplier.rating)}</TableCell>
                    <TableCell>{supplier.qualityScore ? `${supplier.qualityScore}%` : "-"}</TableCell>
                    <TableCell>{supplier.deliveryScore ? `${supplier.deliveryScore}%` : "-"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />Görüntüle</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="mr-2 h-4 w-4" />Düzenle</DropdownMenuItem>
                          <DropdownMenuItem><Star className="mr-2 h-4 w-4" />Değerlendir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Tedarikçi Ekle</DialogTitle>
            <DialogDescription>Yeni bir tedarikçi kaydı oluşturun</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tedarikçi Adı *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Tedarikçi adı"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Kategori *</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                <SelectContent>
                  {supplierCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPerson">İletişim Kişisi</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="Ad Soyad"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ornek@firma.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+90 XXX XXX XX XX"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adres</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Adres"
                rows={2}
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
              Tedarikçi Yönetimi Rehberi
            </DialogTitle>
            <DialogDescription>
              ISO 9001 tedarikçi değerlendirme ve kontrol süreçleri hakkında bilgi edinin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Tedarikçi Yönetimi Nedir */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                Tedarikçi Yönetimi Nedir?
              </h3>
              <p className="text-muted-foreground">
                Tedarikçi yönetimi, dış kaynaklardan temin edilen ürün ve hizmetlerin
                kalite gereksinimlerini karşılamasını sağlamak için uygulanan kontrol sürecidir.
                ISO 9001:2015 standardının 8.4 maddesi kapsamında zorunludur.
              </p>
            </div>

            {/* Tedarikçi Kategorileri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Building className="h-5 w-5 text-purple-600" />
                Tedarikçi Kategorileri
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {supplierCategories.slice(0, 8).map((cat) => (
                  <div key={cat.value} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <ArrowRight className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">{cat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Onay Durumları */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                Tedarikçi Onay Durumları
              </h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="h-3 w-3 rounded-full bg-yellow-500 mt-1.5" />
                  <div>
                    <span className="font-medium text-yellow-800">Beklemede</span>
                    <p className="text-sm text-yellow-700">Değerlendirme sürecinde olan yeni tedarikçiler</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="h-3 w-3 rounded-full bg-green-500 mt-1.5" />
                  <div>
                    <span className="font-medium text-green-800">Onaylı</span>
                    <p className="text-sm text-green-700">Tüm kriterleri karşılayan tedarikçiler</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                  <div className="h-3 w-3 rounded-full bg-orange-500 mt-1.5" />
                  <div>
                    <span className="font-medium text-orange-800">Şartlı Onay</span>
                    <p className="text-sm text-orange-700">Belirli koşullarla kullanılabilen tedarikçiler</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                  <div className="h-3 w-3 rounded-full bg-red-500 mt-1.5" />
                  <div>
                    <span className="font-medium text-red-800">Askıya Alındı</span>
                    <p className="text-sm text-red-700">Geçici olarak devre dışı bırakılan tedarikçiler</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Değerlendirme Kriterleri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-600" />
                Değerlendirme Kriterleri
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-medium text-blue-800">Kalite Skoru</div>
                  <p className="text-sm text-blue-700">Ürün/hizmet kalitesi değerlendirmesi</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-medium text-green-800">Teslimat Skoru</div>
                  <p className="text-sm text-green-700">Zamanında teslimat performansı</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="font-medium text-purple-800">Fiyat Performansı</div>
                  <p className="text-sm text-purple-700">Rekabetçi fiyatlandırma</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-medium text-orange-800">İletişim</div>
                  <p className="text-sm text-orange-700">Sorun çözme ve yanıt süresi</p>
                </div>
              </div>
            </div>

            {/* Rating Sistemi */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                Rating Sistemi
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">A</div>
                  <p className="text-xs text-green-700">4.0 - 5.0</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">B</div>
                  <p className="text-xs text-blue-700">3.0 - 3.9</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-yellow-600">C</div>
                  <p className="text-xs text-yellow-700">2.0 - 2.9</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-600">D</div>
                  <p className="text-xs text-red-700">0 - 1.9</p>
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
                  <span className="text-muted-foreground">Otomatik tedarikçi kodu oluşturma</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Periyodik değerlendirme takibi</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Kalite ve teslimat performans izleme</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Onaylı tedarikçi listesi yönetimi</span>
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
                  <strong>İpucu:</strong> Yeni tedarikçi eklerken önce "Beklemede" durumunda kaydedin.
                  İlk değerlendirme sonucuna göre onay durumunu güncelleyin.
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
