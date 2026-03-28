"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import {
  Building2,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  ClipboardCheck,
  FileDown,
  Star,
  Shield,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react"

// --- Sabitler ---

const SERVICE_TYPES: Record<string, { label: string; color: string }> = {
  IT_SERVICES: { label: "BT Hizmetleri", color: "bg-blue-100 text-blue-700" },
  CLOUD_SERVICES: { label: "Bulut Hizmetleri", color: "bg-sky-100 text-sky-700" },
  SECURITY_SERVICES: { label: "Güvenlik Hizmetleri", color: "bg-red-100 text-red-700" },
  MAINTENANCE: { label: "Bakım Hizmetleri", color: "bg-gray-100 text-gray-700" },
  TELECOM: { label: "Telekomünikasyon", color: "bg-indigo-100 text-indigo-700" },
  CONSULTING: { label: "Danışmanlık", color: "bg-violet-100 text-violet-700" },
  CLEANING: { label: "Temizlik", color: "bg-lime-100 text-lime-700" },
  SECURITY_PHYSICAL: { label: "Fiziksel Güvenlik", color: "bg-orange-100 text-orange-700" },
  TRANSPORTATION: { label: "Taşımacılık", color: "bg-amber-100 text-amber-700" },
  TRAINING: { label: "Eğitim Hizmeti", color: "bg-teal-100 text-teal-700" },
  OTHER: { label: "Diğer", color: "bg-zinc-100 text-zinc-700" },
}

const GROUPS: Record<string, { label: string; color: string; description: string }> = {
  A_APPROVED: { label: "A Grubu", color: "bg-green-100 text-green-700", description: "Onaylı Tedarikçi" },
  B_CANDIDATE: { label: "B Grubu", color: "bg-yellow-100 text-yellow-700", description: "Aday Tedarikçi" },
  C_REJECTED: { label: "C Grubu", color: "bg-red-100 text-red-700", description: "Yetersiz" },
  PENDING: { label: "Beklemede", color: "bg-gray-100 text-gray-700", description: "Değerlendirilmedi" },
}

const STATUSES: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Aktif", color: "bg-green-100 text-green-700" },
  INACTIVE: { label: "Pasif", color: "bg-gray-100 text-gray-700" },
  SUSPENDED: { label: "Askıda", color: "bg-yellow-100 text-yellow-700" },
  BLACKLISTED: { label: "Kara Liste", color: "bg-red-100 text-red-700" },
}

const BG_RISKS: Record<string, { label: string; color: string }> = {
  LOW: { label: "Düşük", color: "bg-green-100 text-green-700" },
  MEDIUM: { label: "Orta", color: "bg-yellow-100 text-yellow-700" },
  HIGH: { label: "Yüksek", color: "bg-orange-100 text-orange-700" },
  CRITICAL: { label: "Kritik", color: "bg-red-100 text-red-700" },
}

// --- Yardımcı fonksiyonlar ---

function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600"
  if (score >= 50) return "text-yellow-600"
  return "text-red-600"
}

function getScoreBgColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700"
  if (score >= 50) return "bg-yellow-100 text-yellow-700"
  return "bg-red-100 text-red-700"
}

function determineGroup(score: number): string {
  if (score >= 70) return "A_APPROVED"
  if (score >= 50) return "B_CANDIDATE"
  return "C_REJECTED"
}

// --- Varsayılan form değerleri ---

const defaultSupplierForm = {
  companyName: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  taxNumber: "",
  serviceType: "IT_SERVICES",
  status: "ACTIVE",
  hasNDA: false,
  ndaDate: "",
  ndaExpiry: "",
  hasDataAccess: false,
  bgRiskLevel: "",
  notes: "",
}

const defaultEvalForm = {
  supplierId: "",
  evaluationDate: new Date().toISOString().split("T")[0],
  period: "",
  evaluatorTitle: "",
  generalNotes: "",
  improvements: "",
  scores: {} as Record<string, { score: number; notes: string }>,
}

// --- Ana bileşen ---

export default function SuppliersPage() {
  // Veri
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    aGroup: 0,
    bGroup: 0,
    cGroup: 0,
    pending: 0,
    lastMonthEvals: 0,
  })

  // Filtreler
  const [searchTerm, setSearchTerm] = useState("")
  const [groupFilter, setGroupFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all")

  // Dialoglar
  const [showSupplierDialog, setShowSupplierDialog] = useState(false)
  const [showEvalDialog, setShowEvalDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<any>(null)
  const [detailData, setDetailData] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Kriterler (değerlendirme formu için)
  const [criteria, setCriteria] = useState<any[]>([])

  // Tedarikçi formu
  const [supplierForm, setSupplierForm] = useState({ ...defaultSupplierForm })

  // Değerlendirme formu
  const [evalForm, setEvalForm] = useState({ ...defaultEvalForm })

  // Kaydetme durumu
  const [saving, setSaving] = useState(false)

  // --- Veri çekme ---

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (groupFilter !== "all") params.append("group", groupFilter)
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (serviceTypeFilter !== "all") params.append("serviceType", serviceTypeFilter)

      const res = await fetch(`/api/iso27001/suppliers?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data.suppliers || [])
        setStats(data.stats || stats)
      } else {
        toast.error("Tedarikçiler yüklenemedi")
      }
    } catch (error) {
      console.error("Tedarikçi listesi hatası:", error)
      toast.error("Tedarikçiler yüklenemedi")
    } finally {
      setLoading(false)
    }
  }, [groupFilter, statusFilter, serviceTypeFilter])

  const fetchCriteria = useCallback(async () => {
    try {
      const res = await fetch("/api/iso27001/suppliers/criteria")
      if (res.ok) {
        const data = await res.json()
        setCriteria(data.criteria || [])
      }
    } catch (error) {
      console.error("Kriter listesi hatası:", error)
    }
  }, [])

  const fetchDetail = useCallback(async (id: string) => {
    try {
      setDetailLoading(true)
      setShowDetailDialog(true)
      setDetailData(null)
      const res = await fetch(`/api/iso27001/suppliers/${id}`)
      if (res.ok) {
        const data = await res.json()
        setDetailData(data)
      } else {
        toast.error("Tedarikçi detayı alınamadı")
        setShowDetailDialog(false)
      }
    } catch {
      toast.error("Bir hata oluştu")
      setShowDetailDialog(false)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  useEffect(() => {
    fetchCriteria()
  }, [fetchCriteria])

  // --- Filtrelenmiş tedarikçiler ---

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return suppliers
    const search = searchTerm.toLowerCase()
    return suppliers.filter((s) =>
      s.companyName.toLowerCase().includes(search)
    )
  }, [suppliers, searchTerm])

  // --- Tedarikçi oluştur/güncelle ---

  const handleSupplierSubmit = async () => {
    if (!supplierForm.companyName.trim()) {
      toast.error("Firma adı zorunludur")
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        companyName: supplierForm.companyName,
        contactPerson: supplierForm.contactPerson || undefined,
        phone: supplierForm.phone || undefined,
        email: supplierForm.email || undefined,
        address: supplierForm.address || undefined,
        taxNumber: supplierForm.taxNumber || undefined,
        serviceType: supplierForm.serviceType,
        hasNDA: supplierForm.hasNDA,
        ndaDate: supplierForm.ndaDate || undefined,
        ndaExpiry: supplierForm.ndaExpiry || undefined,
        hasDataAccess: supplierForm.hasDataAccess,
        bgRiskLevel: supplierForm.bgRiskLevel || undefined,
        notes: supplierForm.notes || undefined,
      }

      if (editingSupplier) {
        payload.status = supplierForm.status
        const res = await fetch(`/api/iso27001/suppliers/${editingSupplier.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          toast.success("Tedarikçi başarıyla güncellendi")
          setShowSupplierDialog(false)
          resetSupplierForm()
          fetchSuppliers()
        } else {
          const data = await res.json()
          toast.error(data.error || "Tedarikçi güncellenemedi")
        }
      } else {
        const res = await fetch("/api/iso27001/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          toast.success("Tedarikçi başarıyla oluşturuldu")
          setShowSupplierDialog(false)
          resetSupplierForm()
          fetchSuppliers()
        } else {
          const data = await res.json()
          toast.error(data.error || "Tedarikçi oluşturulamadı")
        }
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  // --- Değerlendirme oluştur ---

  const handleEvalSubmit = async () => {
    if (!evalForm.supplierId) {
      toast.error("Lütfen bir tedarikçi seçin")
      return
    }
    if (!evalForm.evaluationDate) {
      toast.error("Değerlendirme tarihi zorunludur")
      return
    }

    const criteriaScores = Object.entries(evalForm.scores).map(
      ([criteriaId, { score, notes }]) => ({
        criteriaId,
        score: Number(score),
        notes: notes || undefined,
      })
    )

    if (criteriaScores.length === 0) {
      toast.error("Lütfen en az bir kriter puanlayın")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/iso27001/suppliers/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: evalForm.supplierId,
          evaluationDate: evalForm.evaluationDate,
          period: evalForm.period || undefined,
          evaluatorTitle: evalForm.evaluatorTitle || undefined,
          generalNotes: evalForm.generalNotes || undefined,
          improvements: evalForm.improvements || undefined,
          criteriaScores,
        }),
      })

      if (res.ok) {
        toast.success("Değerlendirme başarıyla kaydedildi")
        setShowEvalDialog(false)
        resetEvalForm()
        fetchSuppliers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Değerlendirme kaydedilemedi")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  // --- Tedarikçi sil ---

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm("Bu tedarikçiyi silmek istediğinize emin misiniz?")) return

    try {
      const res = await fetch(`/api/iso27001/suppliers/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success("Tedarikçi silindi")
        fetchSuppliers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Tedarikçi silinemedi")
      }
    } catch (error) {
      toast.error("Tedarikçi silinemedi")
    }
  }

  // --- Form sıfırlama ---

  const resetSupplierForm = () => {
    setSupplierForm({ ...defaultSupplierForm })
    setEditingSupplier(null)
  }

  const resetEvalForm = () => {
    setEvalForm({ ...defaultEvalForm })
  }

  // --- Dialog açma yardımcıları ---

  const openCreateDialog = () => {
    resetSupplierForm()
    setShowSupplierDialog(true)
  }

  const openEditDialog = (supplier: any) => {
    setEditingSupplier(supplier)
    setSupplierForm({
      companyName: supplier.companyName || "",
      contactPerson: supplier.contactPerson || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      taxNumber: supplier.taxNumber || "",
      serviceType: supplier.serviceType || "IT_SERVICES",
      status: supplier.status || "ACTIVE",
      hasNDA: supplier.hasNDA || false,
      ndaDate: supplier.ndaDate ? new Date(supplier.ndaDate).toISOString().split("T")[0] : "",
      ndaExpiry: supplier.ndaExpiry ? new Date(supplier.ndaExpiry).toISOString().split("T")[0] : "",
      hasDataAccess: supplier.hasDataAccess || false,
      bgRiskLevel: supplier.bgRiskLevel || "",
      notes: supplier.notes || "",
    })
    setShowSupplierDialog(true)
  }

  const openEvalDialog = (supplierId?: string) => {
    resetEvalForm()
    if (supplierId) {
      setEvalForm((prev) => ({ ...prev, supplierId }))
    }
    // Kriter puanlarını sıfırla
    if (criteria.length > 0) {
      const initialScores: Record<string, { score: number; notes: string }> = {}
      criteria.forEach((c) => {
        initialScores[c.id] = { score: 0, notes: "" }
      })
      setEvalForm((prev) => ({ ...prev, scores: initialScores, ...(supplierId ? { supplierId } : {}) }))
    }
    setShowEvalDialog(true)
  }

  // --- Değerlendirme hesaplama ---

  const evalTotal = useMemo(() => {
    return Object.values(evalForm.scores).reduce((sum, s) => sum + Number(s.score || 0), 0)
  }, [evalForm.scores])

  const evalMaxTotal = useMemo(() => {
    return criteria.reduce((sum, c) => sum + c.maxScore, 0)
  }, [criteria])

  const evalGroup = useMemo(() => {
    return determineGroup(evalTotal)
  }, [evalTotal])

  // --- Render ---

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-500" />
            Tedarikçi Değerlendirme
          </h1>
          <p className="text-muted-foreground">
            ISO 27001 A.5.19-21 - Tedarikçi ilişkilerinde bilgi güvenliği
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openEvalDialog()}>
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Yeni Değerlendirme
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Tedarikçi
          </Button>
        </div>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              Toplam Tedarikçi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700">
              <CheckCircle className="h-4 w-4 text-green-600" />
              A Grubu - Onaylı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.aGroup}</div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-700">
              <Clock className="h-4 w-4 text-yellow-600" />
              B Grubu - Aday
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.bGroup}</div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700">
              <XCircle className="h-4 w-4 text-red-600" />
              C Grubu - Yetersiz
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.cGroup}</div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-700">
              <Shield className="h-4 w-4 text-orange-600" />
              Değerlendirme Bekleyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-purple-700">
              <Star className="h-4 w-4 text-purple-600" />
              Son 30 Gün Değerlendirme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.lastMonthEvals}</div>
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
                  placeholder="Firma adı ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Grup" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Gruplar</SelectItem>
                {Object.entries(GROUPS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {Object.entries(STATUSES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Hizmet Türü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Hizmet Türleri</SelectItem>
                {Object.entries(SERVICE_TYPES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tedarikçi Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tedarikçi Listesi ({filteredSuppliers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Building2 className="h-12 w-12 mb-4 opacity-20" />
              <p>Tedarikçi bulunamadı</p>
              <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                İlk Tedarikçiyi Ekle
              </Button>
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firma Adı</TableHead>
                    <TableHead className="w-[150px]">Hizmet Türü</TableHead>
                    <TableHead className="w-[130px]">Son Değ. Tarihi</TableHead>
                    <TableHead className="w-[80px]">Puan</TableHead>
                    <TableHead className="w-[110px]">Grup</TableHead>
                    <TableHead className="w-[100px]">Durum</TableHead>
                    <TableHead className="w-[80px]">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => {
                    const serviceType = SERVICE_TYPES[supplier.serviceType] || {
                      label: supplier.serviceType,
                      color: "bg-gray-100 text-gray-700",
                    }
                    const group = GROUPS[supplier.group] || {
                      label: supplier.group,
                      color: "bg-gray-100 text-gray-700",
                    }
                    const status = STATUSES[supplier.status] || {
                      label: supplier.status,
                      color: "bg-gray-100 text-gray-700",
                    }

                    return (
                      <TableRow
                        key={supplier.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => fetchDetail(supplier.id)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{supplier.companyName}</p>
                            {supplier.contactPerson && (
                              <p className="text-xs text-muted-foreground">{supplier.contactPerson}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={serviceType.color}>{serviceType.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {supplier.lastEvalDate
                            ? format(new Date(supplier.lastEvalDate), "dd.MM.yyyy", { locale: tr })
                            : <span className="text-muted-foreground">-</span>
                          }
                        </TableCell>
                        <TableCell>
                          {supplier.lastScore !== null && supplier.lastScore !== undefined ? (
                            <span className={`font-bold ${getScoreColor(supplier.lastScore)}`}>
                              {supplier.lastScore}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={group.color}>{group.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={status.color}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  fetchDetail(supplier.id)
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Detay
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEvalDialog(supplier.id)
                                }}
                              >
                                <ClipboardCheck className="h-4 w-4 mr-2" />
                                Değerlendir
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEditDialog(supplier)
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Düzenle
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteSupplier(supplier.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Sil
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* ================================================ */}
      {/* Tedarikçi Oluştur / Düzenle Dialog              */}
      {/* ================================================ */}
      <Dialog
        open={showSupplierDialog}
        onOpenChange={(open) => {
          if (!open) {
            resetSupplierForm()
          }
          setShowSupplierDialog(open)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              {editingSupplier ? "Tedarikçi Düzenle" : "Yeni Tedarikçi Ekle"}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier
                ? "Tedarikçi bilgilerini güncelleyin."
                : "Yeni bir tedarikçi kaydı oluşturun."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Firma Bilgileri */}
            <div>
              <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">
                Firma Bilgileri
              </h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Firma Adı *</Label>
                  <Input
                    value={supplierForm.companyName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, companyName: e.target.value })}
                    placeholder="Örnek: ABC Bilişim A.Ş."
                  />
                </div>
                <div className="space-y-2">
                  <Label>İletişim Kişisi</Label>
                  <Input
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    placeholder="Ad Soyad"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    placeholder="0212 xxx xx xx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-posta</Label>
                  <Input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    placeholder="iletisim@firma.com"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Adres</Label>
                  <Input
                    value={supplierForm.address}
                    onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                    placeholder="Firma adresi"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vergi Numarası</Label>
                  <Input
                    value={supplierForm.taxNumber}
                    onChange={(e) => setSupplierForm({ ...supplierForm, taxNumber: e.target.value })}
                    placeholder="Vergi numarası"
                  />
                </div>
              </div>
            </div>

            {/* Sınıflandırma */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">
                Sınıflandırma
              </h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Hizmet Türü *</Label>
                  <Select
                    value={supplierForm.serviceType}
                    onValueChange={(v) => setSupplierForm({ ...supplierForm, serviceType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SERVICE_TYPES).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {editingSupplier && (
                  <div className="space-y-2">
                    <Label>Durum</Label>
                    <Select
                      value={supplierForm.status}
                      onValueChange={(v) => setSupplierForm({ ...supplierForm, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUSES).map(([key, val]) => (
                          <SelectItem key={key} value={key}>{val.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Bilgi Güvenliği */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">
                Bilgi Güvenliği
              </h4>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="hasNDA"
                    checked={supplierForm.hasNDA}
                    onCheckedChange={(checked) =>
                      setSupplierForm({ ...supplierForm, hasNDA: checked === true })
                    }
                  />
                  <Label htmlFor="hasNDA" className="cursor-pointer">
                    Gizlilik Sözleşmesi (NDA) imzalandı
                  </Label>
                </div>

                {supplierForm.hasNDA && (
                  <div className="grid gap-4 md:grid-cols-2 ml-7">
                    <div className="space-y-2">
                      <Label>NDA Tarihi</Label>
                      <Input
                        type="date"
                        value={supplierForm.ndaDate}
                        onChange={(e) => setSupplierForm({ ...supplierForm, ndaDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>NDA Bitiş Tarihi</Label>
                      <Input
                        type="date"
                        value={supplierForm.ndaExpiry}
                        onChange={(e) => setSupplierForm({ ...supplierForm, ndaExpiry: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="hasDataAccess"
                    checked={supplierForm.hasDataAccess}
                    onCheckedChange={(checked) =>
                      setSupplierForm({ ...supplierForm, hasDataAccess: checked === true })
                    }
                  />
                  <Label htmlFor="hasDataAccess" className="cursor-pointer">
                    Şirket verilerine erişimi var
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>BG Risk Seviyesi</Label>
                  <Select
                    value={supplierForm.bgRiskLevel}
                    onValueChange={(v) => setSupplierForm({ ...supplierForm, bgRiskLevel: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Risk seviyesi seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(BG_RISKS).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Notlar */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">
                Notlar
              </h4>
              <Textarea
                value={supplierForm.notes}
                onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                placeholder="Tedarikçi hakkında ek notlar..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSupplierDialog(false)
                resetSupplierForm()
              }}
            >
              İptal
            </Button>
            <Button onClick={handleSupplierSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSupplier ? "Güncelle" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================ */}
      {/* Değerlendirme Dialog                             */}
      {/* ================================================ */}
      <Dialog
        open={showEvalDialog}
        onOpenChange={(open) => {
          if (!open) {
            resetEvalForm()
          }
          setShowEvalDialog(open)
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-blue-500" />
              Tedarikçi Değerlendirme
            </DialogTitle>
            <DialogDescription>
              Tedarikçi performansını kriterlere göre puanlayın.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Üst bilgiler */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tedarikçi *</Label>
                <Select
                  value={evalForm.supplierId}
                  onValueChange={(v) => setEvalForm({ ...evalForm, supplierId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tedarikçi seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Değerlendirme Tarihi *</Label>
                <Input
                  type="date"
                  value={evalForm.evaluationDate}
                  onChange={(e) => setEvalForm({ ...evalForm, evaluationDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dönem</Label>
                <Input
                  value={evalForm.period}
                  onChange={(e) => setEvalForm({ ...evalForm, period: e.target.value })}
                  placeholder="Örnek: 2025 Yıllık"
                />
              </div>
              <div className="space-y-2">
                <Label>Değerlendiren Ünvan</Label>
                <Input
                  value={evalForm.evaluatorTitle}
                  onChange={(e) => setEvalForm({ ...evalForm, evaluatorTitle: e.target.value })}
                  placeholder="Örnek: BGYS Sorumlusu"
                />
              </div>
            </div>

            {/* Kriter Tablosu */}
            {criteria.length > 0 ? (
              <div>
                <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">
                  Değerlendirme Kriterleri
                </h4>
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Kod</TableHead>
                        <TableHead>Kriter</TableHead>
                        <TableHead className="w-[80px] text-center">Maks.</TableHead>
                        <TableHead className="w-[100px] text-center">Puan</TableHead>
                        <TableHead className="w-[200px]">Not</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {criteria.map((c) => {
                        const currentScore = evalForm.scores[c.id]?.score || 0
                        const currentNotes = evalForm.scores[c.id]?.notes || ""

                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-sm">{c.code}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{c.name}</p>
                                {c.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-medium">{c.maxScore}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                max={c.maxScore}
                                value={currentScore}
                                onChange={(e) => {
                                  const val = Math.min(
                                    Math.max(0, Number(e.target.value) || 0),
                                    c.maxScore
                                  )
                                  setEvalForm((prev) => ({
                                    ...prev,
                                    scores: {
                                      ...prev.scores,
                                      [c.id]: { ...prev.scores[c.id], score: val },
                                    },
                                  }))
                                }}
                                className="text-center h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={currentNotes}
                                onChange={(e) => {
                                  setEvalForm((prev) => ({
                                    ...prev,
                                    scores: {
                                      ...prev.scores,
                                      [c.id]: { ...prev.scores[c.id], notes: e.target.value },
                                    },
                                  }))
                                }}
                                placeholder="Not ekle..."
                                className="h-8 text-sm"
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Sonuç Önizlemesi */}
                <div className="mt-4 p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Toplam Puan</p>
                        <p className={`text-2xl font-bold ${getScoreColor(evalTotal)}`}>
                          {evalTotal} / {evalMaxTotal || 100}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Grup</p>
                        <Badge className={GROUPS[evalGroup]?.color || "bg-gray-100 text-gray-700"}>
                          {GROUPS[evalGroup]?.label || "Beklemede"}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Sonuç</p>
                        {evalTotal >= 50 ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Uygun
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700">
                            <XCircle className="h-3 w-3 mr-1" />
                            Uygun Değil
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>A Grubu (Onaylı): 70-100 puan</p>
                      <p>B Grubu (Aday): 50-69 puan</p>
                      <p>C Grubu (Yetersiz): 0-49 puan</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Değerlendirme kriterleri yüklenemedi.</p>
                <p className="text-sm">Lütfen önce değerlendirme kriterlerini tanımlayın.</p>
              </div>
            )}

            {/* Genel Notlar */}
            <div className="border-t pt-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Genel Notlar</Label>
                  <Textarea
                    value={evalForm.generalNotes}
                    onChange={(e) => setEvalForm({ ...evalForm, generalNotes: e.target.value })}
                    placeholder="Değerlendirmeye ilişkin genel notlar..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>İyileştirme Önerileri</Label>
                  <Textarea
                    value={evalForm.improvements}
                    onChange={(e) => setEvalForm({ ...evalForm, improvements: e.target.value })}
                    placeholder="Tedarikçiye önerilen iyileştirme faaliyetleri..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEvalDialog(false)
                resetEvalForm()
              }}
            >
              İptal
            </Button>
            <Button onClick={handleEvalSubmit} disabled={saving || criteria.length === 0}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Değerlendirmeyi Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================ */}
      {/* Tedarikçi Detay Dialog                           */}
      {/* ================================================ */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Tedarikçi Detayı
            </DialogTitle>
            <DialogDescription>
              {detailData?.companyName || "Yükleniyor..."}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : detailData ? (
            <div className="space-y-6">
              {/* Üst kısım: Firma Bilgileri + BG Bilgileri */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Sol: Firma Bilgileri */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                    Firma Bilgileri
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Firma Adı</p>
                      <p className="font-medium">{detailData.companyName}</p>
                    </div>

                    {detailData.contactPerson && (
                      <div>
                        <p className="text-sm text-muted-foreground">İletişim Kişisi</p>
                        <p className="text-sm">{detailData.contactPerson}</p>
                      </div>
                    )}

                    {detailData.phone && (
                      <div>
                        <p className="text-sm text-muted-foreground">Telefon</p>
                        <p className="text-sm">{detailData.phone}</p>
                      </div>
                    )}

                    {detailData.email && (
                      <div>
                        <p className="text-sm text-muted-foreground">E-posta</p>
                        <p className="text-sm">{detailData.email}</p>
                      </div>
                    )}

                    {detailData.address && (
                      <div>
                        <p className="text-sm text-muted-foreground">Adres</p>
                        <p className="text-sm">{detailData.address}</p>
                      </div>
                    )}

                    {detailData.taxNumber && (
                      <div>
                        <p className="text-sm text-muted-foreground">Vergi Numarası</p>
                        <p className="text-sm font-mono">{detailData.taxNumber}</p>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap pt-1">
                      <Badge className={SERVICE_TYPES[detailData.serviceType]?.color || "bg-gray-100 text-gray-700"}>
                        {SERVICE_TYPES[detailData.serviceType]?.label || detailData.serviceType}
                      </Badge>
                      <Badge className={STATUSES[detailData.status]?.color || "bg-gray-100 text-gray-700"}>
                        {STATUSES[detailData.status]?.label || detailData.status}
                      </Badge>
                    </div>

                    {/* Son Puan ve Grup */}
                    <div className="flex gap-4 pt-2">
                      {detailData.lastScore !== null && detailData.lastScore !== undefined && (
                        <div>
                          <p className="text-sm text-muted-foreground">Son Puan</p>
                          <p className={`text-xl font-bold ${getScoreColor(detailData.lastScore)}`}>
                            {detailData.lastScore}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-muted-foreground">Grup</p>
                        <Badge className={GROUPS[detailData.group]?.color || "bg-gray-100 text-gray-700"}>
                          {GROUPS[detailData.group]?.label || detailData.group}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sağ: BG Bilgileri */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                    Bilgi Güvenliği Bilgileri
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Gizlilik Sözleşmesi (NDA)</p>
                      {detailData.hasNDA ? (
                        <div>
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            İmzalı
                          </Badge>
                          {detailData.ndaDate && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Tarih: {format(new Date(detailData.ndaDate), "dd.MM.yyyy", { locale: tr })}
                            </p>
                          )}
                          {detailData.ndaExpiry && (
                            <p className="text-xs text-muted-foreground">
                              Bitiş: {format(new Date(detailData.ndaExpiry), "dd.MM.yyyy", { locale: tr })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Badge className="bg-red-100 text-red-700">
                          <XCircle className="h-3 w-3 mr-1" />
                          İmzalanmadı
                        </Badge>
                      )}
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Veri Erişimi</p>
                      {detailData.hasDataAccess ? (
                        <Badge className="bg-orange-100 text-orange-700">
                          <ShieldAlert className="h-3 w-3 mr-1" />
                          Erişimi Var
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-700">Erişimi Yok</Badge>
                      )}
                    </div>

                    {detailData.bgRiskLevel && (
                      <div>
                        <p className="text-sm text-muted-foreground">BG Risk Seviyesi</p>
                        <Badge className={BG_RISKS[detailData.bgRiskLevel]?.color || "bg-gray-100 text-gray-700"}>
                          {BG_RISKS[detailData.bgRiskLevel]?.label || detailData.bgRiskLevel}
                        </Badge>
                      </div>
                    )}

                    {detailData.notes && (
                      <div>
                        <p className="text-sm text-muted-foreground">Notlar</p>
                        <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md mt-1">
                          {detailData.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Alt kısım: Değerlendirme Geçmişi */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">
                  Değerlendirme Geçmişi
                </h4>

                {detailData.evaluations && detailData.evaluations.length > 0 ? (
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dönem</TableHead>
                          <TableHead className="w-[120px]">Değ. No</TableHead>
                          <TableHead className="w-[110px]">Tarih</TableHead>
                          <TableHead className="w-[80px]">Puan</TableHead>
                          <TableHead className="w-[110px]">Grup</TableHead>
                          <TableHead>Değerlendiren</TableHead>
                          <TableHead className="w-[80px]">İşlemler</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailData.evaluations.map((evaluation: any) => {
                          const evalGroupInfo = GROUPS[evaluation.resultGroup] || {
                            label: evaluation.resultGroup,
                            color: "bg-gray-100 text-gray-700",
                          }

                          return (
                            <TableRow key={evaluation.id}>
                              <TableCell>
                                <span className="text-sm">{evaluation.period || "-"}</span>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {evaluation.evaluationNo}
                              </TableCell>
                              <TableCell>
                                {format(new Date(evaluation.evaluationDate), "dd.MM.yyyy", { locale: tr })}
                              </TableCell>
                              <TableCell>
                                <span className={`font-bold ${getScoreColor(evaluation.totalScore)}`}>
                                  {evaluation.totalScore}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge className={evalGroupInfo.color}>{evalGroupInfo.label}</Badge>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="text-sm">{evaluation.evaluatorName}</p>
                                  {evaluation.evaluatorTitle && (
                                    <p className="text-xs text-muted-foreground">{evaluation.evaluatorTitle}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    window.open(
                                      `/api/iso27001/suppliers/evaluations/${evaluation.id}/pdf`,
                                      "_blank"
                                    )
                                  }}
                                  title="PDF İndir"
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Henüz değerlendirme yapılmamış</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Kapat
            </Button>
            {detailData && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDetailDialog(false)
                    openEvalDialog(detailData.id)
                  }}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Değerlendir
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDetailDialog(false)
                    openEditDialog(detailData)
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Düzenle
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bilgi Notu */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Shield className="h-6 w-6 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900">Tedarikçi Bilgi Güvenliği Yönetimi</h3>
              <p className="text-sm text-blue-700 mt-1">
                ISO 27001 A.5.19-21 gereği, bilgi güvenliğini etkileyen tüm tedarikçiler kayıt altına
                alınmalı, düzenli olarak değerlendirilmeli ve risk seviyeleri belirlenmelidir. A Grubu
                (70+ puan) onaylı, B Grubu (50-69 puan) aday, C Grubu (0-49 puan) yetersiz tedarikçi
                olarak sınıflandırılır.
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Badge variant="outline">A.5.19 - Tedarikçi İlişkileri Politikası</Badge>
                <Badge variant="outline">A.5.20 - Tedarikçi Sözleşmeleri</Badge>
                <Badge variant="outline">A.5.21 - Tedarik Zinciri BG Yönetimi</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
