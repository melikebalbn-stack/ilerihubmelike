"use client"

import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
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
  Edit,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldAlert,
  Loader2,
  Filter,
  FileWarning,
  Activity,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

// Olay kategorileri
const CATEGORIES = {
  MALWARE: { label: "Zararli Yazilim", color: "bg-red-100 text-red-700" },
  PHISHING: { label: "Oltalama", color: "bg-orange-100 text-orange-700" },
  UNAUTHORIZED_ACCESS: { label: "Yetkisiz Erisim", color: "bg-purple-100 text-purple-700" },
  DATA_BREACH: { label: "Veri Ihlali", color: "bg-red-100 text-red-700" },
  DATA_LOSS: { label: "Veri Kaybi", color: "bg-red-100 text-red-700" },
  DENIAL_OF_SERVICE: { label: "Hizmet Reddi", color: "bg-orange-100 text-orange-700" },
  SOCIAL_ENGINEERING: { label: "Sosyal Muhendislik", color: "bg-yellow-100 text-yellow-700" },
  PHYSICAL_SECURITY: { label: "Fiziksel Guvenlik", color: "bg-blue-100 text-blue-700" },
  POLICY_VIOLATION: { label: "Politika Ihlali", color: "bg-yellow-100 text-yellow-700" },
  SYSTEM_FAILURE: { label: "Sistem Arizasi", color: "bg-gray-100 text-gray-700" },
  HUMAN_ERROR: { label: "Insan Hatasi", color: "bg-yellow-100 text-yellow-700" },
  OTHER: { label: "Diger", color: "bg-gray-100 text-gray-700" },
}

const SEVERITIES = {
  CRITICAL: { label: "Kritik", color: "bg-red-600 text-white", icon: AlertTriangle },
  HIGH: { label: "Yuksek", color: "bg-orange-500 text-white", icon: AlertCircle },
  MEDIUM: { label: "Orta", color: "bg-yellow-500 text-white", icon: Clock },
  LOW: { label: "Dusuk", color: "bg-green-500 text-white", icon: CheckCircle2 },
}

const STATUSES = {
  REPORTED: { label: "Raporlandi", color: "bg-blue-100 text-blue-700" },
  ANALYZING: { label: "Inceleniyor", color: "bg-purple-100 text-purple-700" },
  CONTAINED: { label: "Kontrol Altinda", color: "bg-yellow-100 text-yellow-700" },
  RESOLVING: { label: "Cozuluyor", color: "bg-orange-100 text-orange-700" },
  RESOLVED: { label: "Cozuldu", color: "bg-green-100 text-green-700" },
  CLOSED: { label: "Kapatildi", color: "bg-gray-100 text-gray-700" },
}

interface Incident {
  id: string
  incidentNumber: string
  title: string
  description: string
  category: keyof typeof CATEGORIES
  severity: keyof typeof SEVERITIES
  status: keyof typeof STATUSES
  detectedAt: string
  reportedAt: string
  reportedBy: { id: string; name: string; email: string }
  assignedTo?: { id: string; name: string; email: string }
  resolvedAt?: string
  closedAt?: string
  actions: { id: string; status: string }[]
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [severityFilter, setSeverityFilter] = useState("all")
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
    category: "OTHER",
    severity: "MEDIUM",
    detectedAt: new Date().toISOString().split("T")[0],
    affectedSystems: "",
    affectedAssets: "",
    impactScope: "",
    immediateActions: "",
  })

  useEffect(() => {
    fetchIncidents()
  }, [statusFilter, severityFilter])

  const fetchIncidents = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (severityFilter !== "all") params.append("severity", severityFilter)

      const res = await fetch(`/api/iso27001/incidents?${params}`)
      if (res.ok) {
        const data = await res.json()
        setIncidents(data.incidents || [])
        setStats(data.stats || stats)
      }
    } catch (error) {
      console.error("Olaylar alinamadi:", error)
      toast.error("Olaylar yuklenemedi")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.description) {
      toast.error("Lutfen zorunlu alanlari doldurun")
      return
    }

    try {
      const res = await fetch("/api/iso27001/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Olay basariyla raporlandi")
        setShowDialog(false)
        setFormData({
          title: "",
          description: "",
          category: "OTHER",
          severity: "MEDIUM",
          detectedAt: new Date().toISOString().split("T")[0],
          affectedSystems: "",
          affectedAssets: "",
          impactScope: "",
          immediateActions: "",
        })
        fetchIncidents()
      } else {
        const data = await res.json()
        toast.error(data.error || "Olay raporlanamadi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Bu olayi silmek istediginizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/iso27001/incidents/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Olay silindi")
        fetchIncidents()
      }
    } catch (error) {
      toast.error("Olay silinemedi")
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-500" />
            Bilgi Guvenligi Olay Yonetimi
          </h1>
          <p className="text-muted-foreground">
            ISO 27001 A.5.24-26 - Guvenlik olaylarinin kaydi ve yonetimi
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
            <CardTitle className="text-sm font-medium">Acik Olay</CardTitle>
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
            <CardTitle className="text-sm font-medium text-orange-700">Yuksek</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cozulen</CardTitle>
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
            <div className="flex-1 min-w-[200px]">
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
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Durumlar</SelectItem>
                {Object.entries(STATUSES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Siddet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Siddetler</SelectItem>
                {Object.entries(SEVERITIES).map(([key, val]) => (
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
              <p>Henuz olay kaydedilmemis</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ilk Olayi Raporla
              </Button>
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Olay No</TableHead>
                    <TableHead>Baslik</TableHead>
                    <TableHead className="w-[120px]">Kategori</TableHead>
                    <TableHead className="w-[100px]">Siddet</TableHead>
                    <TableHead className="w-[120px]">Durum</TableHead>
                    <TableHead className="w-[120px]">Tespit Tarihi</TableHead>
                    <TableHead className="w-[140px]">Raporlayan</TableHead>
                    <TableHead className="w-[100px]">Islemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.map((incident) => {
                    const category = CATEGORIES[incident.category]
                    const severity = SEVERITIES[incident.severity]
                    const status = STATUSES[incident.status]
                    const SeverityIcon = severity.icon

                    return (
                      <TableRow key={incident.id}>
                        <TableCell className="font-mono font-medium">
                          {incident.incidentNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{incident.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {incident.description}
                            </p>
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
                        <TableCell>{incident.reportedBy.name}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedIncident(incident)
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(incident.id)}
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
              Yeni Guvenlik Olayi Raporla
            </DialogTitle>
            <DialogDescription>
              Bilgi guvenligi olayini kaydedin. Kritik olaylar otomatik bildirilir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Olay Basligi *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ornek: Oltalama e-postasi tespit edildi"
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
              <Label>Olay Aciklamasi *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Olayin detayli aciklamasi..."
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
                <Label>Siddet Seviyesi *</Label>
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
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Etki Analizi</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Etkilenen Sistemler</Label>
                  <Input
                    value={formData.affectedSystems}
                    onChange={(e) => setFormData({ ...formData, affectedSystems: e.target.value })}
                    placeholder="Ornek: E-posta sunucusu, AD"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Etki Alani</Label>
                  <Select
                    value={formData.impactScope}
                    onValueChange={(v) => setFormData({ ...formData, impactScope: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Secin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Bireysel</SelectItem>
                      <SelectItem value="department">Departman</SelectItem>
                      <SelectItem value="company">Sirket Geneli</SelectItem>
                      <SelectItem value="external">Dis Paydas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Alinan Acil Onlemler</Label>
              <Textarea
                value={formData.immediateActions}
                onChange={(e) => setFormData({ ...formData, immediateActions: e.target.value })}
                placeholder="Olay tespit edildiginde alinan ilk onlemler..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Iptal
            </Button>
            <Button onClick={handleSubmit}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Olayi Raporla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bilgi Notu */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Activity className="h-6 w-6 text-amber-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900">Olay Mudahale Sureci</h3>
              <p className="text-sm text-amber-700 mt-1">
                ISO 27001 A.5.24-26 geregi, tum bilgi guvenligi olaylari kayit altina alinmali,
                degerlendirilmeli ve uygun sekilde mudahale edilmelidir. Kritik ve yuksek siddetli
                olaylar otomatik olarak IT yoneticilerine bildirilir.
              </p>
              <div className="flex gap-2 mt-3">
                <Badge variant="outline">A.5.24 - Planlama</Badge>
                <Badge variant="outline">A.5.25 - Degerlendirme</Badge>
                <Badge variant="outline">A.5.26 - Mudahale</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
