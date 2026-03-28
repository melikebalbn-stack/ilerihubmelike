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
  MessageCircle, Plus, Search, MoreHorizontal, Eye, Edit, RefreshCw,
  AlertTriangle, Clock, CheckCircle, Users, HelpCircle, BookOpen,
  ArrowRight, Lightbulb, Settings, Target, Shield,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

const complaintCategories = [
  { value: "QUALITY", label: "Kalite" },
  { value: "DELIVERY", label: "Teslimat" },
  { value: "PACKAGING", label: "Ambalaj" },
  { value: "DOCUMENTATION", label: "Dokümantasyon" },
  { value: "COMMUNICATION", label: "İletişim" },
  { value: "SERVICE", label: "Servis" },
  { value: "PRICING", label: "Fiyatlandırma" },
  { value: "OTHER", label: "Diğer" },
]

const complaintStatuses = [
  { value: "NEW", label: "Yeni", color: "bg-blue-500" },
  { value: "ACKNOWLEDGED", label: "Alındı", color: "bg-purple-500" },
  { value: "UNDER_INVESTIGATION", label: "İncelemede", color: "bg-yellow-500" },
  { value: "RESOLVED", label: "Çözüldü", color: "bg-green-500" },
  { value: "CLOSED", label: "Kapatıldı", color: "bg-gray-500" },
]

const priorities = [
  { value: "LOW", label: "Düşük", color: "bg-green-500" },
  { value: "MEDIUM", label: "Orta", color: "bg-yellow-500" },
  { value: "HIGH", label: "Yüksek", color: "bg-orange-500" },
  { value: "CRITICAL", label: "Kritik", color: "bg-red-500" },
]

interface Complaint {
  id: string
  complaintNumber: string
  title: string
  category: string
  status: string
  priority: string
  customerName: string
  customerContact: string | null
  receivedDate: string
  dueDate: string | null
  assignedTo: { id: string; name: string } | null
  createdAt: string
}

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    priority: "MEDIUM",
    customerName: "",
    customerContact: "",
    customerEmail: "",
    description: "",
    productCode: "",
  })

  const fetchComplaints = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      if (categoryFilter !== "all") params.append("category", categoryFilter)
      if (statusFilter !== "all") params.append("status", statusFilter)

      const res = await fetch(`/api/qdms/complaints?${params}`)
      if (res.ok) {
        const data = await res.json()
        setComplaints(data)
      }
    } catch (error) {
      toast.error("Şikayetler yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComplaints()
  }, [searchQuery, categoryFilter, statusFilter])

  const handleCreate = async () => {
    if (!formData.title || !formData.category || !formData.customerName) {
      toast.error("Başlık, kategori ve müşteri adı zorunludur")
      return
    }

    try {
      const res = await fetch("/api/qdms/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Şikayet başarıyla kaydedildi")
        setIsCreateDialogOpen(false)
        setFormData({ title: "", category: "", priority: "MEDIUM", customerName: "", customerContact: "", customerEmail: "", description: "", productCode: "" })
        fetchComplaints()
      } else {
        const data = await res.json()
        toast.error(data.message || "Hata oluştu")
      }
    } catch (error) {
      toast.error("Sunucu hatası")
    }
  }

  const getStatusBadge = (status: string) => {
    const info = complaintStatuses.find(s => s.value === status)
    return <Badge className={`${info?.color} text-white`}>{info?.label || status}</Badge>
  }

  const getPriorityBadge = (priority: string) => {
    const info = priorities.find(p => p.value === priority)
    const borderColors: Record<string, string> = {
      'LOW': 'border-green-500',
      'MEDIUM': 'border-yellow-500',
      'HIGH': 'border-orange-500',
      'CRITICAL': 'border-red-500',
    }
    return <Badge variant="outline" className={`border-2 ${borderColors[priority] || 'border-gray-500'}`}>{info?.label || priority}</Badge>
  }

  const getCategoryLabel = (category: string) => complaintCategories.find(c => c.value === category)?.label || category

  const stats = {
    total: complaints.length,
    new: complaints.filter(c => c.status === "NEW").length,
    inProgress: complaints.filter(c => ["ACKNOWLEDGED", "UNDER_INVESTIGATION"].includes(c.status)).length,
    resolved: complaints.filter(c => ["RESOLVED", "CLOSED"].includes(c.status)).length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Müşteri Şikayetleri</h1>
          <p className="text-muted-foreground">Şikayet takibi ve çözüm süreçleri</p>
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
            Yeni Şikayet
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Şikayet</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yeni</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{stats.new}</div></CardContent>
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
            <CardTitle className="text-sm font-medium">Çözülen</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{stats.resolved}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Şikayet ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {complaintCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {complaintStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchComplaints}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Şikayet No</TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Öncelik</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Atanan</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : complaints.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Henüz şikayet bulunmuyor</TableCell></TableRow>
              ) : (
                complaints.map(complaint => (
                  <TableRow key={complaint.id}>
                    <TableCell className="font-mono">{complaint.complaintNumber}</TableCell>
                    <TableCell><div className="max-w-[200px] truncate">{complaint.title}</div></TableCell>
                    <TableCell>{complaint.customerName}</TableCell>
                    <TableCell>{getCategoryLabel(complaint.category)}</TableCell>
                    <TableCell>{getPriorityBadge(complaint.priority)}</TableCell>
                    <TableCell>{getStatusBadge(complaint.status)}</TableCell>
                    <TableCell>{complaint.assignedTo?.name || "-"}</TableCell>
                    <TableCell>{format(new Date(complaint.receivedDate), "dd MMM yyyy", { locale: tr })}</TableCell>
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
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Müşteri Şikayeti</DialogTitle>
            <DialogDescription>Yeni bir şikayet kaydı oluşturun</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Başlık *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Şikayet başlığı"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Kategori *</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                  <SelectContent>
                    {complaintCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Öncelik</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerName">Müşteri Adı *</Label>
              <Input
                id="customerName"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="Müşteri / Firma adı"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerContact">İletişim Kişisi</Label>
                <Input
                  id="customerContact"
                  value={formData.customerContact}
                  onChange={(e) => setFormData({ ...formData, customerContact: e.target.value })}
                  placeholder="Ad Soyad"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerEmail">E-posta</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  placeholder="E-posta"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="productCode">Ürün Kodu</Label>
              <Input
                id="productCode"
                value={formData.productCode}
                onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                placeholder="İlgili ürün kodu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Şikayet Detayı</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Şikayet detayları"
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
              Müşteri Şikayetleri Rehberi
            </DialogTitle>
            <DialogDescription>
              ISO 9001 müşteri şikayet yönetimi hakkında bilgi edinin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Müşteri Şikayeti Nedir */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                Müşteri Şikayeti Nedir?
              </h3>
              <p className="text-muted-foreground">
                Müşteri şikayeti, ürün veya hizmet hakkında müşteri memnuniyetsizliğinin
                ifadesidir. ISO 9001:2015 standardının 9.1.2 maddesi gereği, müşteri geri
                bildirimleri sistematik olarak izlenmeli ve değerlendirilmelidir.
              </p>
            </div>

            {/* Şikayet Kategorileri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Şikayet Kategorileri
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {complaintCategories.map((cat) => (
                  <div key={cat.value} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <ArrowRight className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">{cat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Öncelik Seviyeleri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Öncelik Seviyeleri
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-3 rounded-lg text-center bg-green-100 text-green-800">
                  <div className="font-medium">Düşük</div>
                </div>
                <div className="p-3 rounded-lg text-center bg-yellow-100 text-yellow-800">
                  <div className="font-medium">Orta</div>
                </div>
                <div className="p-3 rounded-lg text-center bg-orange-100 text-orange-800">
                  <div className="font-medium">Yüksek</div>
                </div>
                <div className="p-3 rounded-lg text-center bg-red-100 text-red-800">
                  <div className="font-medium">Kritik</div>
                </div>
              </div>
            </div>

            {/* Şikayet Yönetim Süreci */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                Şikayet Yönetim Süreci
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <span className="font-medium">Kayıt</span>
                    <p className="text-sm text-muted-foreground">Şikayet alınır ve sisteme kaydedilir</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <span className="font-medium">Kabul</span>
                    <p className="text-sm text-muted-foreground">Şikayet alındı bilgisi müşteriye iletilir</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <span className="font-medium">İnceleme</span>
                    <p className="text-sm text-muted-foreground">Şikayet analiz edilir, kök neden araştırılır</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">4</div>
                  <div>
                    <span className="font-medium">Çözüm</span>
                    <p className="text-sm text-muted-foreground">Uygun çözüm belirlenir ve uygulanır</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-gray-600 text-white flex items-center justify-center text-sm font-bold">5</div>
                  <div>
                    <span className="font-medium">Kapanış</span>
                    <p className="text-sm text-muted-foreground">Müşteri memnuniyeti doğrulanır</p>
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
                  <span className="text-muted-foreground">Otomatik şikayet numarası oluşturma</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Müşteri bilgileri ve iletişim takibi</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Öncelik bazlı yönetim</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">CAPA ve NCR entegrasyonu</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Trend analizi ve raporlama</span>
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
                  <strong>İpucu:</strong> Şikayetleri hızlı yanıtlayın. İlk 24 saat içinde
                  müşteriye alındı bildirimi gönderin. Bu, müşteri güvenini artırır.
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
