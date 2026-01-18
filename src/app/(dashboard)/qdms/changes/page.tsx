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
  GitBranch, Plus, Search, MoreHorizontal, Eye, Edit, RefreshCw,
  Clock, CheckCircle, XCircle, AlertCircle, HelpCircle, BookOpen,
  ArrowRight, Lightbulb, Settings, Target, Shield,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

const changeTypes = [
  { value: "PROCESS", label: "Süreç Değişikliği" },
  { value: "PRODUCT", label: "Ürün Değişikliği" },
  { value: "DOCUMENT", label: "Doküman Değişikliği" },
  { value: "EQUIPMENT", label: "Ekipman Değişikliği" },
  { value: "SUPPLIER", label: "Tedarikçi Değişikliği" },
  { value: "MATERIAL", label: "Malzeme Değişikliği" },
  { value: "SOFTWARE", label: "Yazılım Değişikliği" },
  { value: "ORGANIZATION", label: "Organizasyon Değişikliği" },
]

const changeStatuses = [
  { value: "DRAFT", label: "Taslak", color: "bg-gray-500" },
  { value: "SUBMITTED", label: "Gönderildi", color: "bg-blue-500" },
  { value: "UNDER_REVIEW", label: "İncelemede", color: "bg-yellow-500" },
  { value: "APPROVED", label: "Onaylandı", color: "bg-green-500" },
  { value: "REJECTED", label: "Reddedildi", color: "bg-red-500" },
  { value: "IMPLEMENTED", label: "Uygulandı", color: "bg-purple-500" },
  { value: "CLOSED", label: "Kapatıldı", color: "bg-gray-700" },
]

const priorities = [
  { value: "LOW", label: "Düşük", color: "bg-green-500" },
  { value: "MEDIUM", label: "Orta", color: "bg-yellow-500" },
  { value: "HIGH", label: "Yüksek", color: "bg-orange-500" },
  { value: "CRITICAL", label: "Kritik", color: "bg-red-500" },
]

interface ChangeRequest {
  id: string
  changeNumber: string
  title: string
  type: string
  status: string
  priority: string
  description: string | null
  requestor: { id: string; name: string }
  department: { id: string; name: string } | null
  requestDate: string
  targetDate: string | null
  createdAt: string
}

export default function ChangesPage() {
  const [changes, setChanges] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    type: "",
    priority: "MEDIUM",
    description: "",
    justification: "",
    targetDate: "",
  })

  const fetchChanges = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      if (typeFilter !== "all") params.append("type", typeFilter)
      if (statusFilter !== "all") params.append("status", statusFilter)

      const res = await fetch(`/api/qdms/changes?${params}`)
      if (res.ok) {
        const data = await res.json()
        setChanges(data)
      }
    } catch (error) {
      toast.error("Değişiklik talepleri yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChanges()
  }, [searchQuery, typeFilter, statusFilter])

  const handleCreate = async () => {
    if (!formData.title || !formData.type) {
      toast.error("Başlık ve tür zorunludur")
      return
    }

    try {
      const res = await fetch("/api/qdms/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Değişiklik talebi başarıyla oluşturuldu")
        setIsCreateDialogOpen(false)
        setFormData({ title: "", type: "", priority: "MEDIUM", description: "", justification: "", targetDate: "" })
        fetchChanges()
      } else {
        const data = await res.json()
        toast.error(data.message || "Hata oluştu")
      }
    } catch (error) {
      toast.error("Sunucu hatası")
    }
  }

  const getStatusBadge = (status: string) => {
    const info = changeStatuses.find(s => s.value === status)
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

  const getTypeLabel = (type: string) => changeTypes.find(t => t.value === type)?.label || type

  const stats = {
    total: changes.length,
    pending: changes.filter(c => ["DRAFT", "SUBMITTED", "UNDER_REVIEW"].includes(c.status)).length,
    approved: changes.filter(c => c.status === "APPROVED").length,
    implemented: changes.filter(c => c.status === "IMPLEMENTED").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Değişiklik Yönetimi</h1>
          <p className="text-muted-foreground">Değişiklik talepleri ve onay süreçleri</p>
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
            Yeni Değişiklik Talebi
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Talep</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bekleyen</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{stats.pending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onaylanan</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{stats.approved}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uygulanan</CardTitle>
            <AlertCircle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-purple-600">{stats.implemented}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Değişiklik ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tür" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Türler</SelectItem>
                {changeTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {changeStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchChanges}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Talep No</TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Öncelik</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Talep Eden</TableHead>
                <TableHead>Talep Tarihi</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : changes.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Henüz değişiklik talebi bulunmuyor</TableCell></TableRow>
              ) : (
                changes.map(change => (
                  <TableRow key={change.id}>
                    <TableCell className="font-mono">{change.changeNumber}</TableCell>
                    <TableCell><div className="max-w-[200px] truncate">{change.title}</div></TableCell>
                    <TableCell>{getTypeLabel(change.type)}</TableCell>
                    <TableCell>{getPriorityBadge(change.priority)}</TableCell>
                    <TableCell>{getStatusBadge(change.status)}</TableCell>
                    <TableCell>{change.requestor?.name || "-"}</TableCell>
                    <TableCell>{format(new Date(change.requestDate), "dd MMM yyyy", { locale: tr })}</TableCell>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Değişiklik Talebi</DialogTitle>
            <DialogDescription>Yeni bir değişiklik talebi oluşturun</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Başlık *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Değişiklik başlığı"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tür *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger><SelectValue placeholder="Tür seçin" /></SelectTrigger>
                  <SelectContent>
                    {changeTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Değişiklik açıklaması"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="justification">Gerekçe</Label>
              <Textarea
                id="justification"
                value={formData.justification}
                onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                placeholder="Değişiklik gerekçesi"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetDate">Hedef Tarih</Label>
              <Input
                id="targetDate"
                type="date"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
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
              Değişiklik Yönetimi Rehberi
            </DialogTitle>
            <DialogDescription>
              ISO 9001 değişiklik kontrolü hakkında bilgi edinin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Değişiklik Yönetimi Nedir */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-blue-600" />
                Değişiklik Yönetimi Nedir?
              </h3>
              <p className="text-muted-foreground">
                Değişiklik yönetimi, süreç, ürün veya sistemlerdeki değişikliklerin kontrollü
                bir şekilde planlanması, onaylanması ve uygulanmasını sağlayan sistematik bir süreçtir.
                ISO 9001:2015 standardının 8.5.6 maddesi kapsamında zorunludur.
              </p>
            </div>

            {/* Değişiklik Türleri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Değişiklik Türleri
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {changeTypes.map((type) => (
                  <div key={type.value} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <ArrowRight className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">{type.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Onay Süreci */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                Değişiklik Onay Süreci
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-gray-500 text-white flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <span className="font-medium">Taslak</span>
                    <p className="text-sm text-muted-foreground">Değişiklik talebi hazırlanır</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <span className="font-medium">Gönderildi</span>
                    <p className="text-sm text-muted-foreground">Talep onaya sunulur</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <span className="font-medium">İnceleme</span>
                    <p className="text-sm text-muted-foreground">Etki analizi ve risk değerlendirmesi yapılır</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">4</div>
                  <div>
                    <span className="font-medium">Onay/Red</span>
                    <p className="text-sm text-muted-foreground">Yetkili kişiler onay verir veya reddeder</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold">5</div>
                  <div>
                    <span className="font-medium">Uygulama</span>
                    <p className="text-sm text-muted-foreground">Değişiklik hayata geçirilir ve doğrulanır</p>
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
                  <span className="text-muted-foreground">Otomatik değişiklik numarası oluşturma</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Çok aşamalı onay akışı</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Etki analizi ve risk değerlendirmesi</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Değişiklik geçmişi ve izlenebilirlik</span>
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
                  <strong>İpucu:</strong> Değişiklik talebinde değişikliğin gerekçesini ve
                  potansiyel etkilerini açıkça belirtin. Bu, onay sürecini hızlandırır.
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
