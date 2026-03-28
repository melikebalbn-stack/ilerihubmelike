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
  ClipboardCheck, Plus, Search, MoreHorizontal, Eye, Edit, RefreshCw,
  Calendar, CheckCircle, Clock, Users, HelpCircle, BookOpen, ArrowRight,
  Lightbulb, Settings, Target, FileSearch, Shield, Upload, X, File, FileText,
  FileSpreadsheet, Presentation, FileImage, Loader2,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

const auditTypes = [
  { value: "INTERNAL", label: "İç Denetim" },
  { value: "EXTERNAL", label: "Dış Denetim" },
  { value: "SUPPLIER", label: "Tedarikçi Denetimi" },
  { value: "CUSTOMER", label: "Müşteri Denetimi" },
  { value: "CERTIFICATION", label: "Belgelendirme Denetimi" },
]

const auditStatuses = [
  { value: "PLANNED", label: "Planlandı", color: "bg-blue-500" },
  { value: "IN_PROGRESS", label: "Devam Ediyor", color: "bg-yellow-500" },
  { value: "COMPLETED", label: "Tamamlandı", color: "bg-green-500" },
  { value: "CANCELLED", label: "İptal", color: "bg-gray-500" },
]

interface Audit {
  id: string
  auditNumber: string
  title: string
  type: string
  standard: string | null
  plannedDate: string
  actualDate: string | null
  status: string
  leadAuditor: { id: string; name: string }
  department: { id: string; name: string } | null
  createdAt: string
}

interface Department {
  id: string
  name: string
}

// Standart seçenekleri
const standardOptions = [
  { value: "ISO 9001:2015", label: "ISO 9001:2015 - Kalite Yönetim Sistemi" },
  { value: "ISO 14001:2015", label: "ISO 14001:2015 - Çevre Yönetim Sistemi" },
  { value: "ISO 45001:2018", label: "ISO 45001:2018 - İSG Yönetim Sistemi" },
  { value: "ISO 27001:2022", label: "ISO 27001:2022 - Bilgi Güvenliği" },
  { value: "IATF 16949:2016", label: "IATF 16949:2016 - Otomotiv Kalite" },
  { value: "ISO 22000:2018", label: "ISO 22000:2018 - Gıda Güvenliği" },
  { value: "CUSTOM", label: "Diğer / Özel" },
]

export default function AuditsPage() {
  const [audits, setAudits] = useState<Audit[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    type: "INTERNAL",
    standard: "ISO 9001:2015",
    plannedDate: "",
    scope: "",
    description: "",
    departmentId: "",
  })

  const fetchAudits = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      if (typeFilter !== "all") params.append("type", typeFilter)
      if (statusFilter !== "all") params.append("status", statusFilter)

      const res = await fetch(`/api/qdms/audits?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAudits(data)
      }
    } catch (error) {
      toast.error("Denetimler yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  // Departmanları getir
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
    fetchAudits()
    fetchDepartments()
  }, [searchQuery, typeFilter, statusFilter])

  // Form reset
  const resetForm = () => {
    setFormData({
      title: "",
      type: "INTERNAL",
      standard: "ISO 9001:2015",
      plannedDate: "",
      scope: "",
      description: "",
      departmentId: "",
    })
    setSelectedFile(null)
  }

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "image/jpeg",
        "image/png",
        "image/gif",
        "text/plain",
      ]
      if (!allowedTypes.includes(file.type)) {
        toast.error("Desteklenmeyen dosya tipi")
        return
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error("Dosya boyutu 20MB'ı aşamaz")
        return
      }
      setSelectedFile(file)
    }
  }

  // Dosya ikonu
  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-5 w-5" />
    if (mimeType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />
    if (mimeType.includes("word")) return <FileText className="h-5 w-5 text-blue-500" />
    if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return <FileSpreadsheet className="h-5 w-5 text-green-500" />
    if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return <Presentation className="h-5 w-5 text-orange-500" />
    if (mimeType.includes("image")) return <FileImage className="h-5 w-5 text-purple-500" />
    return <File className="h-5 w-5" />
  }

  // Dosya boyutu formatla
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Denetim oluştur
  const handleCreate = async () => {
    if (!formData.title || !formData.type || !formData.plannedDate) {
      toast.error("Başlık, tür ve planlanan tarih zorunludur")
      return
    }

    try {
      const res = await fetch("/api/qdms/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Denetim başarıyla oluşturuldu")
        setIsCreateDialogOpen(false)
        resetForm()
        fetchAudits()
      } else {
        const error = await res.json()
        toast.error(error.message || "Denetim oluşturulamadı")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    }
  }

  const getStatusBadge = (status: string) => {
    const info = auditStatuses.find(s => s.value === status)
    return <Badge className={`${info?.color} text-white`}>{info?.label || status}</Badge>
  }

  const getTypeLabel = (type: string) => auditTypes.find(t => t.value === type)?.label || type

  const stats = {
    total: audits.length,
    planned: audits.filter(a => a.status === "PLANNED").length,
    inProgress: audits.filter(a => a.status === "IN_PROGRESS").length,
    completed: audits.filter(a => a.status === "COMPLETED").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">İç Denetim Yönetimi</h1>
          <p className="text-muted-foreground">Denetim planlaması ve takibi</p>
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
            Yeni Denetim
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Denetim</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planlanan</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{stats.planned}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devam Eden</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tamamlanan</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{stats.completed}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Denetim ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Tür" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Türler</SelectItem>
                {auditTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {auditStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchAudits}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Denetim No</TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Standart</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Baş Denetçi</TableHead>
                <TableHead>Planlanan Tarih</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : audits.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Henüz denetim bulunmuyor</TableCell></TableRow>
              ) : (
                audits.map(audit => (
                  <TableRow key={audit.id}>
                    <TableCell className="font-mono">{audit.auditNumber}</TableCell>
                    <TableCell><div className="max-w-[200px] truncate">{audit.title}</div></TableCell>
                    <TableCell>{getTypeLabel(audit.type)}</TableCell>
                    <TableCell>{audit.standard || "-"}</TableCell>
                    <TableCell>{getStatusBadge(audit.status)}</TableCell>
                    <TableCell>{audit.leadAuditor?.name || "-"}</TableCell>
                    <TableCell>{format(new Date(audit.plannedDate), "dd MMM yyyy", { locale: tr })}</TableCell>
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
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Denetim Planla</DialogTitle>
            <DialogDescription>Yeni bir iç denetim kaydı oluşturun</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Denetim Türü *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tür seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {auditTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="standard">Standart</Label>
                <Select
                  value={formData.standard}
                  onValueChange={(value) => setFormData({ ...formData, standard: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Standart seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {standardOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Denetim Başlığı *</Label>
              <Input
                id="title"
                placeholder="Örn: ISO 9001 İç Denetim - Üretim Departmanı"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plannedDate">Planlanan Tarih *</Label>
                <Input
                  id="plannedDate"
                  type="date"
                  value={formData.plannedDate}
                  onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departmentId">Denetlenen Departman</Label>
                <Select
                  value={formData.departmentId || "none"}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Departman seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tüm Organizasyon</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope">Denetim Kapsamı</Label>
              <Textarea
                id="scope"
                placeholder="Denetimin kapsamını tanımlayın (hangi süreçler, alanlar, maddeler denetlenecek)"
                rows={3}
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Açıklama / Notlar</Label>
              <Textarea
                id="description"
                placeholder="Ek bilgiler, özel dikkat edilecek konular vb."
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Dosya Yükleme - Drag & Drop */}
            <div className="space-y-2">
              <Label>Denetim Planı / Ek Dosya (Opsiyonel)</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 transition-all duration-200 cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !selectedFile && document.getElementById("file-upload-audit")?.click()}
              >
                <input
                  type="file"
                  id="file-upload-audit"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setSelectedFile(file)
                    }
                  }}
                />
                {selectedFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getFileIcon(selectedFile.type)}
                      <div>
                        <p className="font-medium text-sm">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center pointer-events-none">
                    <Upload className={`h-10 w-10 mx-auto mb-3 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground/50"}`} />
                    <p className="font-medium text-sm mb-1">
                      {isDragging ? "Dosyayı buraya bırakın" : "Dosyayı sürükleyip bırakın"}
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">veya</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="pointer-events-auto"
                      onClick={(e) => { e.stopPropagation(); document.getElementById("file-upload-audit")?.click(); }}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Dosya Seç
                    </Button>
                    <p className="text-xs text-muted-foreground mt-3">
                      PDF, Word, Excel, PowerPoint, resim veya metin (maks. 20MB)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}>
              İptal
            </Button>
            <Button onClick={handleCreate}>
              Denetim Oluştur
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
              İç Denetim Yönetimi Rehberi
            </DialogTitle>
            <DialogDescription>
              ISO 9001 iç denetim süreçleri hakkında bilgi edinin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* İç Denetim Nedir */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
                İç Denetim Nedir?
              </h3>
              <p className="text-muted-foreground">
                İç denetim, organizasyonun kalite yönetim sisteminin etkinliğini ve uygunluğunu
                değerlendirmek için sistematik, bağımsız ve dokümante edilmiş bir süreçtir.
                ISO 9001:2015 standardının 9.2 maddesi gereği zorunludur.
              </p>
            </div>

            {/* Denetim Türleri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Denetim Türleri
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {auditTypes.map((type) => (
                  <div key={type.value} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <ArrowRight className="h-4 w-4 text-purple-500 mt-1" />
                    <div>
                      <span className="font-medium">{type.label}</span>
                      <p className="text-sm text-muted-foreground">
                        {type.value === "INTERNAL" && "Kuruluş içi personel tarafından gerçekleştirilen denetimler"}
                        {type.value === "EXTERNAL" && "Dış kuruluşlar tarafından gerçekleştirilen bağımsız denetimler"}
                        {type.value === "SUPPLIER" && "Tedarikçilerin kalite sistemlerinin değerlendirilmesi"}
                        {type.value === "CUSTOMER" && "Müşteriler tarafından talep edilen denetimler"}
                        {type.value === "CERTIFICATION" && "Belgelendirme kuruluşları tarafından yapılan resmi denetimler"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Denetim Süreci */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-indigo-600" />
                Denetim Süreci
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <span className="font-medium">Planlama</span>
                    <p className="text-sm text-muted-foreground">Yıllık denetim programı ve bireysel denetim planları</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <span className="font-medium">Hazırlık</span>
                    <p className="text-sm text-muted-foreground">Kontrol listeleri, doküman inceleme, denetçi atama</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <span className="font-medium">Uygulama</span>
                    <p className="text-sm text-muted-foreground">Açılış toplantısı, saha denetimi, bulguların kaydı</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm font-bold">4</div>
                  <div>
                    <span className="font-medium">Raporlama</span>
                    <p className="text-sm text-muted-foreground">Denetim raporu, bulgular, düzeltici faaliyet talepleri</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold">5</div>
                  <div>
                    <span className="font-medium">Takip</span>
                    <p className="text-sm text-muted-foreground">CAPA takibi, etkinlik doğrulaması, kapanış</p>
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
                  <span className="text-muted-foreground">Otomatik denetim numarası oluşturma</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Denetim takvimi ve planlama</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Baş denetçi ve denetim ekibi yönetimi</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Standart bazlı denetim (ISO 9001, ISO 14001, vb.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Bulgu ve CAPA entegrasyonu</span>
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
                  <strong>İpucu:</strong> Yıllık denetim programınızı oluştururken, risk bazlı yaklaşım
                  benimseyin. Kritik süreçler ve geçmişte sorun yaşanan alanlar daha sık denetlenmelidir.
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
