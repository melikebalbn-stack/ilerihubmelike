"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertTriangle,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Target,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Lightbulb,
  Settings,
  FileSearch,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

const capaTypes = [
  { value: "CORRECTIVE", label: "Düzeltici Faaliyet" },
  { value: "PREVENTIVE", label: "Önleyici Faaliyet" },
  { value: "BOTH", label: "Her İkisi" },
]

const capaPriorities = [
  { value: "LOW", label: "Düşük", color: "bg-gray-500" },
  { value: "MEDIUM", label: "Orta", color: "bg-yellow-500" },
  { value: "HIGH", label: "Yüksek", color: "bg-orange-500" },
  { value: "CRITICAL", label: "Kritik", color: "bg-red-500" },
]

const capaStatuses = [
  { value: "OPEN", label: "Açık", color: "bg-blue-500" },
  { value: "IN_PROGRESS", label: "Devam Ediyor", color: "bg-yellow-500" },
  { value: "PENDING_VERIFICATION", label: "Doğrulama Bekliyor", color: "bg-orange-500" },
  { value: "CLOSED", label: "Kapatıldı", color: "bg-green-500" },
  { value: "CANCELLED", label: "İptal", color: "bg-gray-500" },
]

const sourceTypes = [
  { value: "AUDIT", label: "İç Denetim" },
  { value: "CUSTOMER_COMPLAINT", label: "Müşteri Şikayeti" },
  { value: "NCR", label: "Uygunsuzluk" },
  { value: "SUPPLIER", label: "Tedarikçi" },
  { value: "MANAGEMENT_REVIEW", label: "Yönetim Gözden Geçirme" },
  { value: "RISK", label: "Risk Değerlendirme" },
  { value: "OTHER", label: "Diğer" },
]

interface Capa {
  id: string
  capaNumber: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  sourceType: string
  sourceReference: string | null
  rootCause: string | null
  dueDate: string | null
  completedDate: string | null
  initiator: { id: string; name: string }
  responsible: { id: string; name: string }
  department: { id: string; name: string } | null
  createdAt: string
}

interface User {
  id: string
  name: string
}

interface Department {
  id: string
  name: string
}

export default function CapaPage() {
  const [capas, setCapas] = useState<Capa[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "CORRECTIVE",
    priority: "MEDIUM",
    sourceType: "OTHER",
    sourceReference: "",
    responsibleId: "",
    departmentId: "",
    dueDate: "",
  })

  const fetchCapas = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      if (typeFilter !== "all") params.append("type", typeFilter)
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (priorityFilter !== "all") params.append("priority", priorityFilter)

      const res = await fetch(`/api/qdms/capa?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCapas(data)
      }
    } catch (error) {
      console.error("CAPA listesi yüklenemedi:", error)
      toast.error("CAPA listesi yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users")
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (error) {
      console.error("Kullanıcılar yüklenemedi:", error)
    }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/departments")
      if (res.ok) {
        const data = await res.json()
        setDepartments(data)
      }
    } catch (error) {
      console.error("Departmanlar yüklenemedi:", error)
    }
  }

  useEffect(() => {
    fetchCapas()
    fetchUsers()
    fetchDepartments()
  }, [searchQuery, typeFilter, statusFilter, priorityFilter])

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/qdms/capa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("CAPA oluşturuldu")
        setIsCreateDialogOpen(false)
        resetForm()
        fetchCapas()
      } else {
        const error = await res.json()
        toast.error(error.message || "CAPA oluşturulamadı")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    }
  }

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      type: "CORRECTIVE",
      priority: "MEDIUM",
      sourceType: "OTHER",
      sourceReference: "",
      responsibleId: "",
      departmentId: "",
      dueDate: "",
    })
  }

  const getStatusBadge = (status: string) => {
    const statusInfo = capaStatuses.find(s => s.value === status)
    return (
      <Badge className={`${statusInfo?.color} text-white`}>
        {statusInfo?.label || status}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityInfo = capaPriorities.find(p => p.value === priority)
    const borderColors: Record<string, string> = {
      'LOW': 'border-green-500',
      'MEDIUM': 'border-yellow-500',
      'HIGH': 'border-orange-500',
      'CRITICAL': 'border-red-500',
    }
    return (
      <Badge variant="outline" className={`border-2 ${borderColors[priority] || 'border-gray-500'}`}>
        {priorityInfo?.label || priority}
      </Badge>
    )
  }

  const getTypeLabel = (type: string) => {
    return capaTypes.find(t => t.value === type)?.label || type
  }

  const getSourceLabel = (source: string) => {
    return sourceTypes.find(s => s.value === source)?.label || source
  }

  // Stats
  const stats = {
    total: capas.length,
    open: capas.filter(c => c.status === "OPEN" || c.status === "IN_PROGRESS").length,
    overdue: capas.filter(c => c.dueDate && new Date(c.dueDate) < new Date() && c.status !== "CLOSED").length,
    closed: capas.filter(c => c.status === "CLOSED").length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">CAPA Yönetimi</h1>
          <p className="text-muted-foreground">
            Düzeltici ve Önleyici Faaliyetleri yönetin
          </p>
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
            Yeni CAPA
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam CAPA</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Açık</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gecikmiş</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kapatılan</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.closed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="CAPA ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tür" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Türler</SelectItem>
                {capaTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {capaStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Öncelik" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Öncelikler</SelectItem>
                {capaPriorities.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    {priority.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchCapas}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CAPA No</TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead>Öncelik</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Sorumlu</TableHead>
                <TableHead>Hedef Tarih</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : capas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Henüz CAPA bulunmuyor
                  </TableCell>
                </TableRow>
              ) : (
                capas.map((capa) => (
                  <TableRow key={capa.id}>
                    <TableCell className="font-mono font-medium">
                      {capa.capaNumber}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={capa.title}>
                        {capa.title}
                      </div>
                    </TableCell>
                    <TableCell>{getTypeLabel(capa.type)}</TableCell>
                    <TableCell>{getSourceLabel(capa.sourceType)}</TableCell>
                    <TableCell>{getPriorityBadge(capa.priority)}</TableCell>
                    <TableCell>{getStatusBadge(capa.status)}</TableCell>
                    <TableCell>{capa.responsible?.name || "-"}</TableCell>
                    <TableCell>
                      {capa.dueDate ? (
                        <span className={new Date(capa.dueDate) < new Date() && capa.status !== "CLOSED" ? "text-red-600" : ""}>
                          {format(new Date(capa.dueDate), "dd MMM yyyy", { locale: tr })}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            Görüntüle
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Düzenle
                          </DropdownMenuItem>
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

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni CAPA Oluştur</DialogTitle>
            <DialogDescription>
              Düzeltici veya Önleyici Faaliyet kaydı oluşturun
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tür *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {capaTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Öncelik *</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {capaPriorities.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Başlık *</Label>
              <Input
                placeholder="CAPA başlığı"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Açıklama *</Label>
              <Textarea
                placeholder="Sorun veya potansiyel sorunun detaylı açıklaması"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kaynak Türü</Label>
                <Select
                  value={formData.sourceType}
                  onValueChange={(value) => setFormData({ ...formData, sourceType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceTypes.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kaynak Referansı</Label>
                <Input
                  placeholder="Örn: NCR-2024-001"
                  value={formData.sourceReference}
                  onChange={(e) => setFormData({ ...formData, sourceReference: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sorumlu *</Label>
                <Select
                  value={formData.responsibleId}
                  onValueChange={(value) => setFormData({ ...formData, responsibleId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sorumlu seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Departman</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Departman seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Hedef Tamamlanma Tarihi</Label>
              <Input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreate}>
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guide Dialog */}
      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-6 w-6 text-blue-600" />
              CAPA Yönetimi Rehberi
            </DialogTitle>
            <DialogDescription>
              Düzeltici ve Önleyici Faaliyetler hakkında bilgi edinin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* CAPA Nedir */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                CAPA Nedir?
              </h3>
              <p className="text-muted-foreground">
                CAPA (Corrective and Preventive Action), ISO 9001 kalite yönetim sisteminin
                temel araçlarından biridir. Sorunların kök nedenlerini analiz ederek
                tekrarını önlemeyi ve potansiyel sorunları proaktif olarak engellemeyi amaçlar.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <h4 className="font-medium text-orange-800 mb-2">Düzeltici Faaliyet (CA)</h4>
                  <p className="text-sm text-orange-700">
                    Mevcut bir uygunsuzluğun veya hatanın tekrarını önlemek için alınan aksiyonlardır.
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-800 mb-2">Önleyici Faaliyet (PA)</h4>
                  <p className="text-sm text-green-700">
                    Potansiyel bir uygunsuzluğun oluşmasını engellemek için alınan proaktif aksiyonlardır.
                  </p>
                </div>
              </div>
            </div>

            {/* PDCA Döngüsü */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-purple-600" />
                PDCA Döngüsü
              </h3>
              <p className="text-muted-foreground">
                CAPA süreçleri PDCA (Plan-Do-Check-Act) metodolojisine göre yönetilir:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">P</div>
                  <div>
                    <h4 className="font-medium text-blue-800">Planla</h4>
                    <p className="text-sm text-blue-700">Kök neden analizi yap, aksiyon planı oluştur</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="h-8 w-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">D</div>
                  <div>
                    <h4 className="font-medium text-green-800">Uygula</h4>
                    <p className="text-sm text-green-700">Planlanan aksiyonları hayata geçir</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="h-8 w-8 rounded-full bg-yellow-600 text-white flex items-center justify-center font-bold">C</div>
                  <div>
                    <h4 className="font-medium text-yellow-800">Kontrol Et</h4>
                    <p className="text-sm text-yellow-700">Aksiyonların etkinliğini doğrula</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                  <div className="h-8 w-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">A</div>
                  <div>
                    <h4 className="font-medium text-red-800">Önlem Al</h4>
                    <p className="text-sm text-red-700">Standartlaştır veya yeni döngü başlat</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Kaynak Türleri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-indigo-600" />
                CAPA Kaynakları
              </h3>
              <p className="text-muted-foreground">
                CAPA kayıtları farklı kaynaklardan tetiklenebilir:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                {sourceTypes.map((source) => (
                  <div key={source.value} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <ArrowRight className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm">{source.label}</span>
                  </div>
                ))}
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
                  <span className="text-muted-foreground">Otomatik CAPA numarası oluşturma</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Öncelik ve durum bazlı takip</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Hedef tarih ve gecikme takibi</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Sorumlu atama ve departman ilişkilendirme</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Kaynak referansı ile izlenebilirlik</span>
                </li>
              </ul>
            </div>

            {/* Hızlı Başlangıç */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-600" />
                Hızlı Başlangıç
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
                  <span>"Yeni CAPA" butonuna tıklayın</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">2</div>
                  <span>CAPA türünü seçin (Düzeltici/Önleyici)</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">3</div>
                  <span>Sorunu/potansiyel sorunu tanımlayın</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">4</div>
                  <span>Sorumlu atayın ve hedef tarih belirleyin</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">5</div>
                  <span>Aksiyonları takip edin ve etkinliği doğrulayın</span>
                </div>
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
