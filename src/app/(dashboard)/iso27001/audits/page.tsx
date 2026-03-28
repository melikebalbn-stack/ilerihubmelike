"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ClipboardCheck,
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Eye,
  PlayCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Loader2,
  Download,
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"

// Tipler
interface FindingCounts {
  MAJOR_NC: number
  MINOR_NC: number
  OBSERVATION: number
  OPPORTUNITY: number
  POSITIVE: number
}

interface Audit {
  id: string
  auditNumber: string
  title: string
  description: string | null
  auditType: string
  plannedDate: string
  startDate: string | null
  endDate: string | null
  leadAuditorName: string
  leadAuditorEmail: string
  auditeeName: string | null
  auditeeDepartment: string | null
  status: string
  createdAt: string
  _count: {
    teamMembers: number
    findings: number
  }
  findingCounts?: FindingCounts
}

interface Finding {
  id: string
  findingNumber: string
  findingType: string
  title: string
  description: string
  severity: string
  status: string
  controlId: string | null
  clause: string | null
  responsibleName: string | null
  dueDate: string | null
  completedDate: string | null
  createdAt: string
}

// Sabitler
const AUDIT_TYPES = [
  { value: "INTERNAL", label: "Ic Denetim" },
  { value: "EXTERNAL", label: "Dis Denetim" },
  { value: "SURVEILLANCE", label: "Gozetim Denetimi" },
  { value: "CERTIFICATION", label: "Belgelendirme Denetimi" },
  { value: "SUPPLIER", label: "Tedarikci Denetimi" },
]

const AUDIT_STATUSES = [
  { value: "PLANNED", label: "Planlandi", color: "bg-blue-100 text-blue-800" },
  { value: "IN_PROGRESS", label: "Devam Ediyor", color: "bg-yellow-100 text-yellow-800" },
  { value: "COMPLETED", label: "Tamamlandi", color: "bg-green-100 text-green-800" },
  { value: "CANCELLED", label: "Iptal Edildi", color: "bg-gray-100 text-gray-800" },
]

const FINDING_TYPES = [
  { value: "MAJOR_NC", label: "Major Uygunsuzluk", color: "bg-red-100 text-red-800" },
  { value: "MINOR_NC", label: "Minor Uygunsuzluk", color: "bg-orange-100 text-orange-800" },
  { value: "OBSERVATION", label: "Gozlem", color: "bg-yellow-100 text-yellow-800" },
  { value: "OPPORTUNITY", label: "Iyilestirme Firsati", color: "bg-blue-100 text-blue-800" },
  { value: "POSITIVE", label: "Olumlu Bulgu", color: "bg-green-100 text-green-800" },
]

const FINDING_STATUSES = [
  { value: "OPEN", label: "Acik", color: "bg-red-100 text-red-800" },
  { value: "IN_PROGRESS", label: "Devam Ediyor", color: "bg-yellow-100 text-yellow-800" },
  { value: "CLOSED", label: "Kapali", color: "bg-green-100 text-green-800" },
  { value: "VERIFIED", label: "Dogrulandi", color: "bg-blue-100 text-blue-800" },
]

const SEVERITY_LEVELS = [
  { value: "CRITICAL", label: "Kritik", color: "bg-red-500 text-white" },
  { value: "MAJOR", label: "Major", color: "bg-red-100 text-red-800" },
  { value: "MINOR", label: "Minor", color: "bg-yellow-100 text-yellow-800" },
  { value: "TRIVIAL", label: "Onemsiz", color: "bg-gray-100 text-gray-800" },
]

export default function AuditsPage() {
  const { data: session } = useSession()
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedYear, setSelectedYear] = useState<string>("all")

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [findingDialogOpen, setFindingDialogOpen] = useState(false)
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [loadingFindings, setLoadingFindings] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    auditType: "INTERNAL",
    scope: "",
    plannedDate: "",
    leadAuditorName: "",
    leadAuditorEmail: "",
    auditeeName: "",
    auditeeEmail: "",
    auditeeDepartment: "",
  })

  const [findingFormData, setFindingFormData] = useState({
    findingType: "MINOR_NC",
    title: "",
    description: "",
    evidence: "",
    severity: "MINOR",
    clause: "",
    correctiveAction: "",
    responsibleName: "",
    dueDate: "",
  })

  // Denetimleri getir
  const fetchAudits = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedStatus !== "all") params.append("status", selectedStatus)
      if (selectedType !== "all") params.append("type", selectedType)
      if (selectedYear !== "all") params.append("year", selectedYear)
      if (searchQuery) params.append("search", searchQuery)

      const res = await fetch(`/api/iso27001/audits?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAudits(data)
      }
    } catch (error) {
      console.error("Denetim listesi hatasi:", error)
      toast.error("Denetimler yuklenemedi")
    } finally {
      setLoading(false)
    }
  }, [selectedStatus, selectedType, selectedYear, searchQuery])

  useEffect(() => {
    fetchAudits()
  }, [fetchAudits])

  // İstatistikler
  const stats = useMemo(() => {
    const fc = { major: 0, minor: 0, positive: 0, observation: 0, opportunity: 0, total: 0 }
    for (const a of audits) {
      if (a.findingCounts) {
        fc.major += a.findingCounts.MAJOR_NC || 0
        fc.minor += a.findingCounts.MINOR_NC || 0
        fc.positive += a.findingCounts.POSITIVE || 0
        fc.observation += a.findingCounts.OBSERVATION || 0
        fc.opportunity += a.findingCounts.OPPORTUNITY || 0
      }
      fc.total += a._count.findings
    }
    return {
      total: audits.length,
      planned: audits.filter(a => a.status === "PLANNED").length,
      inProgress: audits.filter(a => a.status === "IN_PROGRESS").length,
      completed: audits.filter(a => a.status === "COMPLETED").length,
      totalFindings: fc.total,
      majorFindings: fc.major,
      minorFindings: fc.minor,
      positiveFindings: fc.positive,
      observationFindings: fc.observation,
      opportunityFindings: fc.opportunity,
    }
  }, [audits])

  // Yıllar listesi
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => currentYear - i)
  }, [])

  // Denetim oluştur
  const handleCreateAudit = async () => {
    if (!formData.title || !formData.plannedDate || !formData.leadAuditorName || !formData.leadAuditorEmail) {
      toast.error("Zorunlu alanlari doldurun")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/iso27001/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Denetim olusturuldu")
        setCreateDialogOpen(false)
        setFormData({
          title: "",
          description: "",
          auditType: "INTERNAL",
          scope: "",
          plannedDate: "",
          leadAuditorName: "",
          leadAuditorEmail: "",
          auditeeName: "",
          auditeeEmail: "",
          auditeeDepartment: "",
        })
        fetchAudits()
      } else {
        const data = await res.json()
        toast.error(data.error || "Denetim olusturulamadi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    } finally {
      setSaving(false)
    }
  }

  // Denetim detaylarını göster
  const handleViewAudit = async (audit: Audit) => {
    setSelectedAudit(audit)
    setDetailDialogOpen(true)
    setLoadingFindings(true)

    try {
      const res = await fetch(`/api/iso27001/audits/${audit.id}/findings`)
      if (res.ok) {
        const data = await res.json()
        setFindings(data)
      }
    } catch (error) {
      console.error("Bulgu listesi hatasi:", error)
    } finally {
      setLoadingFindings(false)
    }
  }

  // Denetim durumunu güncelle
  const handleUpdateStatus = async (auditId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/iso27001/audits/${auditId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === "IN_PROGRESS" && { startDate: new Date().toISOString() }),
          ...(newStatus === "COMPLETED" && { endDate: new Date().toISOString() }),
        }),
      })

      if (res.ok) {
        toast.success("Denetim durumu guncellendi")
        fetchAudits()
        if (selectedAudit?.id === auditId) {
          setSelectedAudit(prev => prev ? { ...prev, status: newStatus } : null)
        }
      } else {
        toast.error("Durum guncellenemedi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    }
  }

  // Denetim sil
  const handleDeleteAudit = async (auditId: string) => {
    if (!confirm("Bu denetimi silmek istediginize emin misiniz?")) return

    try {
      const res = await fetch(`/api/iso27001/audits/${auditId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Denetim silindi")
        fetchAudits()
        if (detailDialogOpen) {
          setDetailDialogOpen(false)
        }
      } else {
        toast.error("Denetim silinemedi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    }
  }

  // PDF indir
  const handleDownloadPDF = async (auditId: string, auditNumber: string) => {
    try {
      toast.info("PDF hazırlanıyor...")
      const res = await fetch(`/api/iso27001/audits/${auditId}/pdf`)
      if (!res.ok) {
        toast.error("PDF oluşturulamadı")
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Ic_Denetim_Raporu_${auditNumber.replace(/[/\\?%*:|"<>]/g, '-')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success("PDF indirildi")
    } catch (error) {
      toast.error("PDF indirme hatası")
    }
  }

  // Bulgu oluştur
  const handleCreateFinding = async () => {
    if (!selectedAudit || !findingFormData.title || !findingFormData.description) {
      toast.error("Zorunlu alanlari doldurun")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/iso27001/audits/${selectedAudit.id}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(findingFormData),
      })

      if (res.ok) {
        toast.success("Bulgu olusturuldu")
        setFindingDialogOpen(false)
        setFindingFormData({
          findingType: "MINOR_NC",
          title: "",
          description: "",
          evidence: "",
          severity: "MINOR",
          clause: "",
          correctiveAction: "",
          responsibleName: "",
          dueDate: "",
        })
        // Bulguları yenile
        const findingsRes = await fetch(`/api/iso27001/audits/${selectedAudit.id}/findings`)
        if (findingsRes.ok) {
          const data = await findingsRes.json()
          setFindings(data)
          // Audit listesindeki bulgu sayısını güncelle
          setAudits(prev => prev.map(a =>
            a.id === selectedAudit.id
              ? { ...a, _count: { ...a._count, findings: data.length } }
              : a
          ))
        }
      } else {
        const data = await res.json()
        toast.error(data.error || "Bulgu olusturulamadi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    } finally {
      setSaving(false)
    }
  }

  // Bulgu durumunu güncelle
  const handleUpdateFindingStatus = async (findingId: string, newStatus: string) => {
    if (!selectedAudit) return

    try {
      const res = await fetch(`/api/iso27001/audits/${selectedAudit.id}/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        toast.success("Bulgu durumu guncellendi")
        const findingsRes = await fetch(`/api/iso27001/audits/${selectedAudit.id}/findings`)
        if (findingsRes.ok) {
          const data = await findingsRes.json()
          setFindings(data)
        }
      } else {
        toast.error("Durum guncellenemedi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    }
  }

  // Badge render helpers
  const getStatusBadge = (status: string) => {
    const statusInfo = AUDIT_STATUSES.find(s => s.value === status)
    return (
      <Badge className={statusInfo?.color || "bg-gray-100"}>
        {statusInfo?.label || status}
      </Badge>
    )
  }

  const getTypeBadge = (type: string) => {
    const typeInfo = AUDIT_TYPES.find(t => t.value === type)
    return (
      <Badge variant="outline">
        {typeInfo?.label || type}
      </Badge>
    )
  }

  const getFindingTypeBadge = (type: string) => {
    const typeInfo = FINDING_TYPES.find(t => t.value === type)
    return (
      <Badge className={typeInfo?.color || "bg-gray-100"}>
        {typeInfo?.label || type}
      </Badge>
    )
  }

  const getFindingStatusBadge = (status: string) => {
    const statusInfo = FINDING_STATUSES.find(s => s.value === status)
    return (
      <Badge className={statusInfo?.color || "bg-gray-100"}>
        {statusInfo?.label || status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Ic Denetim Yonetimi
          </h1>
          <p className="text-muted-foreground">
            ISO 27001 ic ve dis denetim planlama ve takibi
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Denetim
        </Button>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Toplam Denetim</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
              <span>{stats.planned} planlanan</span>
              <span>{stats.inProgress} devam eden</span>
              <span>{stats.completed} tamamlanan</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Olumlu Bulgu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.positiveFindings}</div>
            <p className="text-xs text-muted-foreground mt-1">Toplam {stats.totalFindings} bulgu icinden</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">Minor Bulgu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.minorFindings}</div>
            {stats.observationFindings > 0 && (
              <p className="text-xs text-muted-foreground mt-1">+{stats.observationFindings} gozlem</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Major Bulgu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.majorFindings}</div>
            {stats.opportunityFindings > 0 && (
              <p className="text-xs text-muted-foreground mt-1">+{stats.opportunityFindings} iyilestirme firsati</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtreler */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Denetim ara..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Durumlar</SelectItem>
                {AUDIT_STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tip" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Tipler</SelectItem>
                {AUDIT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Yil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Yillar</SelectItem>
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Denetim Listesi */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : audits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Henuz denetim bulunmuyor</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ilk Denetimi Olustur
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Denetim No</TableHead>
                  <TableHead>Baslik</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Planlanan Tarih</TableHead>
                  <TableHead>Lider Denetci</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Bulgular</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.map((audit) => (
                  <TableRow key={audit.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono text-sm" onClick={() => handleViewAudit(audit)}>
                      {audit.auditNumber}
                    </TableCell>
                    <TableCell onClick={() => handleViewAudit(audit)}>
                      <div className="font-medium">{audit.title}</div>
                      {audit.auditeeDepartment && (
                        <div className="text-sm text-muted-foreground">{audit.auditeeDepartment}</div>
                      )}
                    </TableCell>
                    <TableCell onClick={() => handleViewAudit(audit)}>
                      {getTypeBadge(audit.auditType)}
                    </TableCell>
                    <TableCell onClick={() => handleViewAudit(audit)}>
                      {format(new Date(audit.plannedDate), "d MMM yyyy", { locale: tr })}
                    </TableCell>
                    <TableCell onClick={() => handleViewAudit(audit)}>
                      {audit.leadAuditorName}
                    </TableCell>
                    <TableCell onClick={() => handleViewAudit(audit)}>
                      {getStatusBadge(audit.status)}
                    </TableCell>
                    <TableCell onClick={() => handleViewAudit(audit)}>
                      <div className="flex items-center gap-1">
                        {audit.findingCounts && audit.findingCounts.POSITIVE > 0 && (
                          <Badge className="bg-green-100 text-green-800 text-xs px-1.5">
                            {audit.findingCounts.POSITIVE}
                          </Badge>
                        )}
                        {audit.findingCounts && audit.findingCounts.MINOR_NC > 0 && (
                          <Badge className="bg-orange-100 text-orange-800 text-xs px-1.5">
                            {audit.findingCounts.MINOR_NC}
                          </Badge>
                        )}
                        {audit.findingCounts && audit.findingCounts.MAJOR_NC > 0 && (
                          <Badge className="bg-red-100 text-red-800 text-xs px-1.5">
                            {audit.findingCounts.MAJOR_NC}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-1">
                          {audit._count.findings} bulgu
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewAudit(audit)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Detay
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadPDF(audit.id, audit.auditNumber)}>
                            <Download className="h-4 w-4 mr-2" />
                            PDF İndir
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {audit.status === "PLANNED" && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(audit.id, "IN_PROGRESS")}>
                              <PlayCircle className="h-4 w-4 mr-2" />
                              Baslat
                            </DropdownMenuItem>
                          )}
                          {audit.status === "IN_PROGRESS" && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(audit.id, "COMPLETED")}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Tamamla
                            </DropdownMenuItem>
                          )}
                          {audit.status !== "CANCELLED" && audit.status !== "COMPLETED" && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(audit.id, "CANCELLED")}>
                              <XCircle className="h-4 w-4 mr-2" />
                              Iptal Et
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteAudit(audit.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Denetim Oluşturma Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Denetim Olustur</DialogTitle>
            <DialogDescription>
              ISO 27001 ic veya dis denetim plani olusturun
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Denetim Basligi *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ornegin: 2025 Q1 Ic Denetim"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auditType">Denetim Tipi *</Label>
                <Select
                  value={formData.auditType}
                  onValueChange={(v) => setFormData({ ...formData, auditType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Aciklama</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Denetim aciklamasi..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope">Kapsam</Label>
              <Textarea
                id="scope"
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                placeholder="Denetim kapsami..."
                rows={2}
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
                <Label htmlFor="auditeeDepartment">Denetlenen Departman</Label>
                <Input
                  id="auditeeDepartment"
                  value={formData.auditeeDepartment}
                  onChange={(e) => setFormData({ ...formData, auditeeDepartment: e.target.value })}
                  placeholder="Departman adi"
                />
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Lider Denetci Bilgileri *</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leadAuditorName">Ad Soyad</Label>
                  <Input
                    id="leadAuditorName"
                    value={formData.leadAuditorName}
                    onChange={(e) => setFormData({ ...formData, leadAuditorName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leadAuditorEmail">E-posta</Label>
                  <Input
                    id="leadAuditorEmail"
                    type="email"
                    value={formData.leadAuditorEmail}
                    onChange={(e) => setFormData({ ...formData, leadAuditorEmail: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Denetlenen Kisi (Opsiyonel)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="auditeeName">Ad Soyad</Label>
                  <Input
                    id="auditeeName"
                    value={formData.auditeeName}
                    onChange={(e) => setFormData({ ...formData, auditeeName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auditeeEmail">E-posta</Label>
                  <Input
                    id="auditeeEmail"
                    type="email"
                    value={formData.auditeeEmail}
                    onChange={(e) => setFormData({ ...formData, auditeeEmail: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Iptal
            </Button>
            <Button onClick={handleCreateAudit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Olustur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Denetim Detay Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedAudit && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="flex items-center gap-2">
                      {selectedAudit.auditNumber}
                      {getStatusBadge(selectedAudit.status)}
                    </DialogTitle>
                    <DialogDescription>{selectedAudit.title}</DialogDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadPDF(selectedAudit.id, selectedAudit.auditNumber)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF İndir
                    </Button>
                    {selectedAudit.status === "PLANNED" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(selectedAudit.id, "IN_PROGRESS")}
                      >
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Baslat
                      </Button>
                    )}
                    {selectedAudit.status === "IN_PROGRESS" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(selectedAudit.id, "COMPLETED")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Tamamla
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-4">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="details">Detaylar</TabsTrigger>
                  <TabsTrigger value="findings">
                    Bulgular ({findings.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Denetim Tipi</Label>
                      <p className="font-medium">{getTypeBadge(selectedAudit.auditType)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Planlanan Tarih</Label>
                      <p className="font-medium">
                        {format(new Date(selectedAudit.plannedDate), "d MMMM yyyy", { locale: tr })}
                      </p>
                    </div>
                    {selectedAudit.startDate && (
                      <div>
                        <Label className="text-muted-foreground">Baslama Tarihi</Label>
                        <p className="font-medium">
                          {format(new Date(selectedAudit.startDate), "d MMMM yyyy", { locale: tr })}
                        </p>
                      </div>
                    )}
                    {selectedAudit.endDate && (
                      <div>
                        <Label className="text-muted-foreground">Bitis Tarihi</Label>
                        <p className="font-medium">
                          {format(new Date(selectedAudit.endDate), "d MMMM yyyy", { locale: tr })}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedAudit.description && (
                    <div>
                      <Label className="text-muted-foreground">Aciklama</Label>
                      <p className="mt-1">{selectedAudit.description}</p>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Denetim Ekibi
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Lider Denetci</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="font-medium">{selectedAudit.leadAuditorName}</p>
                          <p className="text-sm text-muted-foreground">{selectedAudit.leadAuditorEmail}</p>
                        </CardContent>
                      </Card>
                      {(selectedAudit.auditeeName || selectedAudit.auditeeDepartment) && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Denetlenen</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {selectedAudit.auditeeName && (
                              <p className="font-medium">{selectedAudit.auditeeName}</p>
                            )}
                            {selectedAudit.auditeeDepartment && (
                              <p className="text-sm text-muted-foreground">{selectedAudit.auditeeDepartment}</p>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>

                </TabsContent>

                <TabsContent value="findings" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Denetim Bulgulari</h4>
                    {(selectedAudit.status === "IN_PROGRESS" || selectedAudit.status === "PLANNED") && (
                      <Button size="sm" onClick={() => setFindingDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Bulgu Ekle
                      </Button>
                    )}
                  </div>

                  {loadingFindings ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : findings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                      <p>Henuz bulgu eklenmemis</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {findings.map((finding) => (
                        <Card key={finding.id}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono text-sm text-muted-foreground">
                                    {finding.findingNumber}
                                  </span>
                                  {getFindingTypeBadge(finding.findingType)}
                                  {getFindingStatusBadge(finding.status)}
                                </div>
                                <h5 className="font-medium">{finding.title}</h5>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {finding.description}
                                </p>
                                <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                                  {finding.responsibleName && (
                                    <span>Sorumlu: {finding.responsibleName}</span>
                                  )}
                                  {finding.dueDate && (
                                    <span>
                                      Termin: {format(new Date(finding.dueDate), "d MMM yyyy", { locale: tr })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {finding.status === "OPEN" && (
                                    <DropdownMenuItem
                                      onClick={() => handleUpdateFindingStatus(finding.id, "IN_PROGRESS")}
                                    >
                                      <PlayCircle className="h-4 w-4 mr-2" />
                                      Calisma Baslat
                                    </DropdownMenuItem>
                                  )}
                                  {finding.status === "IN_PROGRESS" && (
                                    <DropdownMenuItem
                                      onClick={() => handleUpdateFindingStatus(finding.id, "CLOSED")}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Kapat
                                    </DropdownMenuItem>
                                  )}
                                  {finding.status === "CLOSED" && (
                                    <DropdownMenuItem
                                      onClick={() => handleUpdateFindingStatus(finding.id, "VERIFIED")}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Dogrula
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulgu Oluşturma Dialog */}
      <Dialog open={findingDialogOpen} onOpenChange={setFindingDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Bulgu Ekle</DialogTitle>
            <DialogDescription>
              {selectedAudit?.auditNumber} icin bulgu olusturun
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="findingType">Bulgu Tipi *</Label>
                <Select
                  value={findingFormData.findingType}
                  onValueChange={(v) => setFindingFormData({ ...findingFormData, findingType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINDING_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">Ciddiyet</Label>
                <Select
                  value={findingFormData.severity}
                  onValueChange={(v) => setFindingFormData({ ...findingFormData, severity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_LEVELS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="findingTitle">Bulgu Basligi *</Label>
              <Input
                id="findingTitle"
                value={findingFormData.title}
                onChange={(e) => setFindingFormData({ ...findingFormData, title: e.target.value })}
                placeholder="Bulgu basligi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="findingDescription">Aciklama *</Label>
              <Textarea
                id="findingDescription"
                value={findingFormData.description}
                onChange={(e) => setFindingFormData({ ...findingFormData, description: e.target.value })}
                placeholder="Bulgu detayli aciklamasi..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence">Kanit</Label>
              <Textarea
                id="evidence"
                value={findingFormData.evidence}
                onChange={(e) => setFindingFormData({ ...findingFormData, evidence: e.target.value })}
                placeholder="Bulunan kanitlar..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clause">Ilgili Madde/Kontrol</Label>
              <Input
                id="clause"
                value={findingFormData.clause}
                onChange={(e) => setFindingFormData({ ...findingFormData, clause: e.target.value })}
                placeholder="Ornegin: A.5.1 veya Madde 7.2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correctiveAction">Duzeltici Faaliyet</Label>
              <Textarea
                id="correctiveAction"
                value={findingFormData.correctiveAction}
                onChange={(e) => setFindingFormData({ ...findingFormData, correctiveAction: e.target.value })}
                placeholder="Onerilen duzeltici faaliyet..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="responsibleName">Sorumlu Kisi</Label>
                <Input
                  id="responsibleName"
                  value={findingFormData.responsibleName}
                  onChange={(e) => setFindingFormData({ ...findingFormData, responsibleName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="findingDueDate">Termin Tarihi</Label>
                <Input
                  id="findingDueDate"
                  type="date"
                  value={findingFormData.dueDate}
                  onChange={(e) => setFindingFormData({ ...findingFormData, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFindingDialogOpen(false)}>
              Iptal
            </Button>
            <Button onClick={handleCreateFinding} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
