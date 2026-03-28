"use client"

import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  Plus,
  Search,
  Eye,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Loader2,
  Filter,
  FileWarning,
  Activity,
  Download,
  ArrowRight,
  Pause,
  Play,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

// Olay kategorileri (8 adet - CAT-01 ~ CAT-08)
const CATEGORIES: Record<string, { label: string; color: string }> = {
  CYBER_ATTACK: { label: "Siber Saldırı", color: "bg-red-100 text-red-700" },
  UNAUTHORIZED_ACCESS: { label: "Yetkisiz Erişim", color: "bg-purple-100 text-purple-700" },
  DATA_BREACH: { label: "Veri İhlali", color: "bg-red-100 text-red-700" },
  SYSTEM_FAILURE: { label: "Sistem Arızası", color: "bg-gray-100 text-gray-700" },
  PHYSICAL_SECURITY: { label: "Fiziksel Güvenlik", color: "bg-blue-100 text-blue-700" },
  HUMAN_ERROR: { label: "İnsan Hatası", color: "bg-yellow-100 text-yellow-700" },
  POLICY_VIOLATION: { label: "Politika İhlali", color: "bg-orange-100 text-orange-700" },
  SUPPLIER_RELATED: { label: "Tedarikçi Kaynaklı", color: "bg-cyan-100 text-cyan-700" },
}

const SEVERITIES: Record<string, { label: string; color: string; icon: any }> = {
  CRITICAL: { label: "Kritik", color: "bg-red-600 text-white", icon: AlertTriangle },
  HIGH: { label: "Yüksek", color: "bg-orange-500 text-white", icon: AlertCircle },
  MEDIUM: { label: "Orta", color: "bg-yellow-500 text-white", icon: Clock },
  LOW: { label: "Düşük", color: "bg-green-500 text-white", icon: CheckCircle2 },
}

const STATUSES: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Açık", color: "bg-blue-100 text-blue-700" },
  INVESTIGATING: { label: "İnceleniyor", color: "bg-purple-100 text-purple-700" },
  RESOLVED: { label: "Çözüldü", color: "bg-green-100 text-green-700" },
  CLOSED: { label: "Kapatıldı", color: "bg-gray-100 text-gray-700" },
  ON_HOLD: { label: "Beklemede", color: "bg-yellow-100 text-yellow-700" },
}

const DETECTION_METHODS = [
  "İzleme Sistemi",
  "Kullanıcı Bildirimi",
  "Denetim",
  "Otomatik Alarm",
  "Dış Bildirim",
]

interface Incident {
  id: string
  incidentNumber: string
  title: string
  description: string
  category: keyof typeof CATEGORIES
  severity: keyof typeof SEVERITIES
  status: keyof typeof STATUSES
  detectedAt: string
  detectionMethod?: string | null
  reportedAt: string
  reportedBy?: { id: string; name: string; email: string } | null
  reportedByName?: string | null
  assignedTo?: { id: string; name: string; email: string } | null
  resolvedAt?: string | null
  closedAt?: string | null
  correctiveAction?: string | null
  preventiveAction?: string | null
  relatedRiskIds?: string[]
  actions: { id: string; status: string }[]
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [severityFilter, setSeverityFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    critical: 0,
    high: 0,
    resolved: 0,
    thisMonth: 0,
  })

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "CYBER_ATTACK",
    severity: "MEDIUM",
    detectedAt: new Date().toISOString().split("T")[0],
    detectionMethod: "",
    affectedSystems: "",
    affectedAssets: "",
    impactScope: "",
    immediateActions: "",
    correctiveAction: "",
    preventiveAction: "",
  })

  // Durum güncelleme dialog state
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [statusUpdate, setStatusUpdate] = useState({
    incidentId: "",
    newStatus: "",
    resolution: "",
    closureNotes: "",
    lessonsLearned: "",
  })

  useEffect(() => {
    fetchIncidents()
  }, [statusFilter, severityFilter, categoryFilter])

  const fetchIncidents = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (severityFilter !== "all") params.append("severity", severityFilter)
      if (categoryFilter !== "all") params.append("category", categoryFilter)

      const res = await fetch(`/api/iso27001/incidents?${params}`)
      if (res.ok) {
        const data = await res.json()
        setIncidents(data.incidents || [])
        setStats(data.stats || stats)
      }
    } catch (error) {
      console.error("Olaylar alınamadı:", error)
      toast.error("Olaylar yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.description) {
      toast.error("Lütfen zorunlu alanları doldurun")
      return
    }

    try {
      const res = await fetch("/api/iso27001/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Olay başarıyla raporlandı")
        setShowDialog(false)
        setFormData({
          title: "",
          description: "",
          category: "CYBER_ATTACK",
          severity: "MEDIUM",
          detectedAt: new Date().toISOString().split("T")[0],
          detectionMethod: "",
          affectedSystems: "",
          affectedAssets: "",
          impactScope: "",
          immediateActions: "",
          correctiveAction: "",
          preventiveAction: "",
        })
        fetchIncidents()
      } else {
        const data = await res.json()
        toast.error(data.error || "Olay raporlanamadı")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    }
  }

  const handleViewDetail = async (incident: Incident) => {
    try {
      setDetailLoading(true)
      setShowDetailDialog(true)
      setDetailData(null)
      const res = await fetch(`/api/iso27001/incidents/${incident.id}`)
      if (res.ok) {
        const data = await res.json()
        setDetailData(data)
      } else {
        toast.error("Olay detayı alınamadı")
        setShowDetailDialog(false)
      }
    } catch {
      toast.error("Bir hata oluştu")
      setShowDetailDialog(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Bu olayı silmek istediğinizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/iso27001/incidents/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Olay silindi")
        fetchIncidents()
      }
    } catch (error) {
      toast.error("Olay silinemedi!")
    }
  }

  const handleStatusChange = async () => {
    if (!statusUpdate.incidentId || !statusUpdate.newStatus) return

    try {
      const body: any = { status: statusUpdate.newStatus }
      if (statusUpdate.newStatus === "RESOLVED" && statusUpdate.resolution) {
        body.resolution = statusUpdate.resolution
      }
      if (statusUpdate.newStatus === "CLOSED") {
        if (statusUpdate.closureNotes) body.closureNotes = statusUpdate.closureNotes
        if (statusUpdate.lessonsLearned) body.lessonsLearned = statusUpdate.lessonsLearned
      }

      const res = await fetch(`/api/iso27001/incidents/${statusUpdate.incidentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success("Durum güncellendi")
        setShowStatusDialog(false)
        setStatusUpdate({ incidentId: "", newStatus: "", resolution: "", closureNotes: "", lessonsLearned: "" })
        fetchIncidents()
        // Detay dialog açıksa güncelle
        if (showDetailDialog && detailData?.id === statusUpdate.incidentId) {
          handleViewDetail({ id: statusUpdate.incidentId } as Incident)
        }
      } else {
        const data = await res.json()
        toast.error(data.error || "Durum güncellenemedi")
      }
    } catch {
      toast.error("Bir hata oluştu")
    }
  }

  const openStatusDialog = (incidentId: string, newStatus: string) => {
    setStatusUpdate({ incidentId, newStatus, resolution: "", closureNotes: "", lessonsLearned: "" })
    setShowStatusDialog(true)
  }

  const getNextStatuses = (currentStatus: string): { status: string; label: string; icon: any }[] => {
    switch (currentStatus) {
      case "OPEN":
        return [{ status: "INVESTIGATING", label: "İncelemeye Al", icon: ArrowRight }]
      case "INVESTIGATING":
        return [
          { status: "RESOLVED", label: "Çöz", icon: CheckCircle2 },
          { status: "ON_HOLD", label: "Beklet", icon: Pause },
        ]
      case "ON_HOLD":
        return [{ status: "INVESTIGATING", label: "Devam Et", icon: Play }]
      case "RESOLVED":
        return [{ status: "CLOSED", label: "Kapat", icon: CheckCircle2 }]
      default:
        return []
    }
  }

  const filteredIncidents = incidents.filter((incident) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      if (
        !incident.incidentNumber.toLowerCase().includes(search) &&
        !incident.title.toLowerCase().includes(search)
      ) {
        return false
      }
    }
    return true
  })

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-500" />
            Bilgi Güvenliği Olay Yönetimi
          </h1>
          <p className="text-muted-foreground">
            ISO 27001 A.5.24-26 - Güvenlik olaylarının kaydı ve yönetimi
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Olay Raporla
        </Button>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Toplam Olay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Açık Olay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.open}</div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Kritik</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Yüksek</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Çözülen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bu Ay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtreler */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtrele
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Olay ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {Object.entries(STATUSES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Şiddet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Şiddetler</SelectItem>
                {Object.entries(SEVERITIES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {Object.entries(CATEGORIES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Olay Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Olay Listesi ({filteredIncidents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileWarning className="h-12 w-12 mb-4 opacity-20" />
              <p>Henüz olay kaydedilmemiş</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                İlk Olayı Raporla
              </Button>
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Olay No</TableHead>
                    <TableHead>Başlık</TableHead>
                    <TableHead className="w-[130px]">Kategori</TableHead>
                    <TableHead className="w-[100px]">Şiddet</TableHead>
                    <TableHead className="w-[120px]">Durum</TableHead>
                    <TableHead className="w-[110px]">Tespit Tarihi</TableHead>
                    <TableHead className="w-[130px]">Tespit Yöntemi</TableHead>
                    <TableHead className="w-[140px]">Raporlayan</TableHead>
                    <TableHead className="w-[140px]">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.map((incident) => {
                    const category = CATEGORIES[incident.category] || { label: incident.category, color: "bg-gray-100 text-gray-700" }
                    const severity = SEVERITIES[incident.severity] || SEVERITIES.MEDIUM
                    const status = STATUSES[incident.status] || { label: incident.status, color: "bg-gray-100 text-gray-700" }
                    const SeverityIcon = severity.icon
                    const nextStatuses = getNextStatuses(incident.status)

                    return (
                      <TableRow key={incident.id}>
                        <TableCell className="font-mono font-medium">
                          {incident.incidentNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{incident.title}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={category.color}>{category.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={severity.color}>
                            <SeverityIcon className="h-3 w-3 mr-1" />
                            {severity.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={status.color}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(incident.detectedAt), "dd.MM.yyyy", { locale: tr })}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {incident.detectionMethod || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {incident.reportedBy?.name || incident.reportedByName || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(incident)}
                              title="Detay"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {nextStatuses.map((ns) => (
                              <Button
                                key={ns.status}
                                variant="ghost"
                                size="sm"
                                onClick={() => openStatusDialog(incident.id, ns.status)}
                                title={ns.label}
                              >
                                <ns.icon className="h-4 w-4 text-blue-500" />
                              </Button>
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(incident.id)}
                              title="Sil"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Yeni Olay Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Yeni Güvenlik Olayı Raporla
            </DialogTitle>
            <DialogDescription>
              Bilgi güvenliği olayını kaydedin. Kritik olaylar otomatik bildirilir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Olay Başlığı *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Örnek: Phishing e-posta saldırısı"
                />
              </div>
              <div className="space-y-2">
                <Label>Tespit Tarihi *</Label>
                <Input
                  type="date"
                  value={formData.detectedAt}
                  onChange={(e) => setFormData({ ...formData, detectedAt: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Olay Açıklaması *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Olayın detaylı açıklaması..."
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Kategori *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Şiddet Seviyesi *</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(v) => setFormData({ ...formData, severity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITIES).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tespit Yöntemi</Label>
                <Select
                  value={formData.detectionMethod}
                  onValueChange={(v) => setFormData({ ...formData, detectionMethod: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {DETECTION_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Etki Analizi</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Etkilenen Sistemler</Label>
                  <Input
                    value={formData.affectedSystems}
                    onChange={(e) => setFormData({ ...formData, affectedSystems: e.target.value })}
                    placeholder="Örnek: E-posta Sistemi, Active Directory"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Etki Alanı</Label>
                  <Select
                    value={formData.impactScope}
                    onValueChange={(v) => setFormData({ ...formData, impactScope: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bireysel">Bireysel</SelectItem>
                      <SelectItem value="Departman">Departman</SelectItem>
                      <SelectItem value="Şirket Geneli">Şirket Geneli</SelectItem>
                      <SelectItem value="Dış Paydaş">Dış Paydaş</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Alınan Acil Önlemler</Label>
              <Textarea
                value={formData.immediateActions}
                onChange={(e) => setFormData({ ...formData, immediateActions: e.target.value })}
                placeholder="Olay tespit edildiğinde alınan ilk önlemler..."
                rows={3}
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Düzeltici / Önleyici Faaliyetler</h4>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Düzeltici Faaliyet</Label>
                  <Textarea
                    value={formData.correctiveAction}
                    onChange={(e) => setFormData({ ...formData, correctiveAction: e.target.value })}
                    placeholder="Olayın tekrar yaşanmaması için alınan düzeltici önlemler..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Önleyici Faaliyet</Label>
                  <Textarea
                    value={formData.preventiveAction}
                    onChange={(e) => setFormData({ ...formData, preventiveAction: e.target.value })}
                    placeholder="Benzer olayların önlenmesi için alınan önlemler..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleSubmit}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Olayı Raporla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Durum Güncelleme Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Durum Güncelle</DialogTitle>
            <DialogDescription>
              Olay durumunu {STATUSES[statusUpdate.newStatus as keyof typeof STATUSES]?.label || ""} olarak güncelle
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {statusUpdate.newStatus === "RESOLVED" && (
              <div className="space-y-2">
                <Label>Çözüm Açıklaması</Label>
                <Textarea
                  value={statusUpdate.resolution}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, resolution: e.target.value })}
                  placeholder="Olayın nasıl çözüldüğünü açıklayın..."
                  rows={3}
                />
              </div>
            )}

            {statusUpdate.newStatus === "CLOSED" && (
              <>
                <div className="space-y-2">
                  <Label>Kapatma Notları</Label>
                  <Textarea
                    value={statusUpdate.closureNotes}
                    onChange={(e) => setStatusUpdate({ ...statusUpdate, closureNotes: e.target.value })}
                    placeholder="Kapatma ile ilgili notlar..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Öğrenilen Dersler</Label>
                  <Textarea
                    value={statusUpdate.lessonsLearned}
                    onChange={(e) => setStatusUpdate({ ...statusUpdate, lessonsLearned: e.target.value })}
                    placeholder="Bu olaydan çıkarılan dersler..."
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleStatusChange}>
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Olay Detay Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Olay Detayı - {detailData?.incidentNumber}
            </DialogTitle>
            <DialogDescription>{detailData?.title}</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : detailData ? (
            <div className="space-y-6">
              {/* Üst Bilgiler */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Olay No</p>
                  <p className="font-mono font-medium">{detailData.incidentNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kategori</p>
                  <Badge className={(CATEGORIES[detailData.category as keyof typeof CATEGORIES] || { color: "bg-gray-100 text-gray-700" }).color}>
                    {(CATEGORIES[detailData.category as keyof typeof CATEGORIES] || { label: detailData.category }).label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Şiddet</p>
                  <Badge className={(SEVERITIES[detailData.severity as keyof typeof SEVERITIES] || SEVERITIES.MEDIUM).color}>
                    {(SEVERITIES[detailData.severity as keyof typeof SEVERITIES] || SEVERITIES.MEDIUM).label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Durum</p>
                  <Badge className={(STATUSES[detailData.status as keyof typeof STATUSES] || { color: "bg-gray-100 text-gray-700" }).color}>
                    {(STATUSES[detailData.status as keyof typeof STATUSES] || { label: detailData.status }).label}
                  </Badge>
                </div>
              </div>

              {/* Açıklama */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Açıklama</p>
                <p className="text-sm whitespace-pre-wrap">{detailData.description || "-"}</p>
              </div>

              {/* Tespit Yöntemi */}
              {detailData.detectionMethod && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tespit Yöntemi</p>
                  <Badge variant="outline">{detailData.detectionMethod}</Badge>
                </div>
              )}

              {/* Tarihler */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tespit Tarihi</p>
                  <p className="text-sm font-medium">
                    {detailData.detectedAt ? format(new Date(detailData.detectedAt), "dd MMMM yyyy", { locale: tr }) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Raporlama Tarihi</p>
                  <p className="text-sm font-medium">
                    {detailData.reportedAt ? format(new Date(detailData.reportedAt), "dd MMMM yyyy", { locale: tr }) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kontrol Altına Alınma</p>
                  <p className="text-sm font-medium">
                    {detailData.containmentAt ? format(new Date(detailData.containmentAt), "dd MMMM yyyy", { locale: tr }) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Çözüm Tarihi</p>
                  <p className="text-sm font-medium">
                    {detailData.resolvedAt ? format(new Date(detailData.resolvedAt), "dd MMMM yyyy", { locale: tr }) : "-"}
                  </p>
                </div>
              </div>

              {/* Sorumlular */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Raporlayan</p>
                  <p className="text-sm font-medium">{detailData.reportedBy?.name || detailData.reportedByName || "-"}</p>
                  {detailData.reportedBy?.email && (
                    <p className="text-xs text-muted-foreground">{detailData.reportedBy.email}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Atanan Kişi</p>
                  <p className="text-sm font-medium">{detailData.assignedTo?.name || "-"}</p>
                  {detailData.assignedTo?.email && (
                    <p className="text-xs text-muted-foreground">{detailData.assignedTo.email}</p>
                  )}
                </div>
              </div>

              {/* Etkilenen Sistemler */}
              {(detailData.affectedSystems || detailData.impactScope) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {detailData.affectedSystems && (
                    <div>
                      <p className="text-sm text-muted-foreground">Etkilenen Sistemler</p>
                      <p className="text-sm">{detailData.affectedSystems}</p>
                    </div>
                  )}
                  {detailData.impactScope && (
                    <div>
                      <p className="text-sm text-muted-foreground">Etki Alanı</p>
                      <p className="text-sm">{detailData.impactScope}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Acil Önlemler */}
              {detailData.immediateActions && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Alınan Acil Önlemler</p>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">{detailData.immediateActions}</p>
                </div>
              )}

              {/* Kök Neden Analizi */}
              {detailData.rootCause && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Kök Neden Analizi</p>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">{detailData.rootCause}</p>
                  {detailData.rootCauseAnalyzedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Analiz Tarihi: {format(new Date(detailData.rootCauseAnalyzedAt), "dd MMMM yyyy", { locale: tr })}
                    </p>
                  )}
                </div>
              )}

              {/* Çözüm */}
              {detailData.resolution && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Çözüm</p>
                  <p className="text-sm whitespace-pre-wrap bg-green-50 p-3 rounded-md border border-green-200">{detailData.resolution}</p>
                </div>
              )}

              {/* Düzeltici / Önleyici Faaliyetler */}
              {(detailData.correctiveAction || detailData.preventiveAction) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {detailData.correctiveAction && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Düzeltici Faaliyet</p>
                      <p className="text-sm whitespace-pre-wrap bg-orange-50 p-3 rounded-md border border-orange-200">{detailData.correctiveAction}</p>
                    </div>
                  )}
                  {detailData.preventiveAction && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Önleyici Faaliyet</p>
                      <p className="text-sm whitespace-pre-wrap bg-blue-50 p-3 rounded-md border border-blue-200">{detailData.preventiveAction}</p>
                    </div>
                  )}
                </div>
              )}

              {/* İlişkili Riskler */}
              {detailData.relatedRiskIds && detailData.relatedRiskIds.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">İlişkili Riskler</p>
                  <div className="flex flex-wrap gap-2">
                    {detailData.relatedRiskIds.map((riskId: string) => (
                      <Badge key={riskId} variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
                        {riskId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Kapatma Notları & Öğrenilen Dersler */}
              {(detailData.closureNotes || detailData.lessonsLearned) && (
                <div className="grid grid-cols-1 gap-4">
                  {detailData.closureNotes && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Kapatma Notları</p>
                      <p className="text-sm whitespace-pre-wrap">{detailData.closureNotes}</p>
                    </div>
                  )}
                  {detailData.lessonsLearned && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Öğrenilen Dersler</p>
                      <p className="text-sm whitespace-pre-wrap bg-blue-50 p-3 rounded-md border border-blue-200">{detailData.lessonsLearned}</p>
                    </div>
                  )}
                </div>
              )}

              {/* İlişkili Kontroller */}
              {detailData.relatedControls && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">İlişkili Kontroller</p>
                  <div className="flex flex-wrap gap-2">
                    {detailData.relatedControls.split(",").map((ctrl: string) => (
                      <Badge key={ctrl.trim()} variant="outline">{ctrl.trim()}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Zaman Çizelgesi */}
              {detailData.timeline && detailData.timeline.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-3">Zaman Çizelgesi</p>
                  <div className="space-y-3">
                    {detailData.timeline.map((entry: any, idx: number) => (
                      <div key={entry.id || idx} className="flex gap-3 items-start">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{entry.action}</p>
                            <span className="text-xs text-muted-foreground">
                              {entry.performedAt ? format(new Date(entry.performedAt), "dd.MM.yyyy HH:mm", { locale: tr }) : ""}
                            </span>
                          </div>
                          {entry.description && (
                            <p className="text-xs text-muted-foreground">{entry.description}</p>
                          )}
                          {entry.performedByName && (
                            <p className="text-xs text-muted-foreground">- {entry.performedByName}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Kapatma Bilgisi */}
              {detailData.closedAt && (
                <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                  <p className="text-muted-foreground">
                    Kapatılma Tarihi: {format(new Date(detailData.closedAt), "dd MMMM yyyy HH:mm", { locale: tr })}
                  </p>
                </div>
              )}

              {/* Durum Güncelleme Butonları */}
              {getNextStatuses(detailData.status).length > 0 && (
                <div className="flex gap-2 pt-2 border-t">
                  {getNextStatuses(detailData.status).map((ns) => (
                    <Button
                      key={ns.status}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowDetailDialog(false)
                        openStatusDialog(detailData.id, ns.status)
                      }}
                    >
                      <ns.icon className="h-4 w-4 mr-2" />
                      {ns.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Kapat
            </Button>
            {detailData && (
              <Button
                onClick={() => {
                  window.open(`/api/iso27001/incidents/${detailData.id}/pdf`, "_blank")
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                PDF İndir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bilgi Notu */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Activity className="h-6 w-6 text-amber-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900">Olay Müdahale Süreci</h3>
              <p className="text-sm text-amber-700 mt-1">
                ISO 27001 A.5.24-26 gereği, tüm bilgi güvenliği olayları kayıt altına alınmalı,
                değerlendirilmeli ve uygun şekilde müdahale edilmelidir. Kritik ve yüksek şiddetli
                olaylar otomatik olarak IT yöneticilerine bildirilir.
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Badge variant="outline">A.5.24 - Planlama</Badge>
                <Badge variant="outline">A.5.25 - Değerlendirme</Badge>
                <Badge variant="outline">A.5.26 - Müdahale</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
