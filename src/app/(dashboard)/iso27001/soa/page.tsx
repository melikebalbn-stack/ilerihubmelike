"use client"

import { useState, useEffect, useMemo } from "react"
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
import { Progress } from "@/components/ui/progress"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Shield,
  Search,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
  Loader2,
  Building2,
  Users,
  Lock,
  Server,
  ExternalLink,
  Info,
  File,
  Image,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

// Kontrol kategorileri
const CATEGORIES = {
  "5": { name: "Organizasyonel Kontroller", icon: Building2, color: "text-blue-500", range: "5.1-5.37" },
  "6": { name: "Insan Kaynaklari Kontrolleri", icon: Users, color: "text-purple-500", range: "6.1-6.8" },
  "7": { name: "Fiziksel Kontroller", icon: Lock, color: "text-cyan-500", range: "7.1-7.14" },
  "8": { name: "Teknolojik Kontroller", icon: Server, color: "text-green-500", range: "8.1-8.34" },
}

// Uygulama durumları
const STATUS_OPTIONS = {
  IMPLEMENTED: { label: "Uygulanmis", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  PARTIALLY: { label: "Kismen", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  NOT_IMPLEMENTED: { label: "Uygulanmamis", color: "bg-red-100 text-red-700", icon: XCircle },
  NOT_APPLICABLE: { label: "Uygulanamaz", color: "bg-gray-100 text-gray-700", icon: AlertTriangle },
}

// Kanıt tipleri
const EVIDENCE_TYPES = [
  { value: "DOCUMENT", label: "Dokuman", icon: FileText },
  { value: "SCREENSHOT", label: "Ekran Goruntusu", icon: Image },
  { value: "LOG", label: "Log Kaydi", icon: File },
  { value: "REPORT", label: "Rapor", icon: FileText },
  { value: "CERTIFICATE", label: "Sertifika", icon: FileText },
  { value: "RECORD", label: "Kayit", icon: File },
  { value: "OTHER", label: "Diger", icon: File },
]

interface Control {
  id: string
  controlId: string
  title: string
  titleTr: string | null
  description: string
  descriptionTr: string | null
  category: string
  status: string
  applicability: boolean
  justification: string | null
  implementationNotes: string | null
  _count?: { documents: number; evidences: number }
}

export default function SoAPage() {
  const [controls, setControls] = useState<Control[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [applicableFilter, setApplicableFilter] = useState("all")

  // Kanıt görüntüleme state
  const [isEvidenceDialogOpen, setIsEvidenceDialogOpen] = useState(false)
  const [viewingControlId, setViewingControlId] = useState<string>("")
  const [viewingControlName, setViewingControlName] = useState<string>("")
  const [viewEvidences, setViewEvidences] = useState<{
    id: string
    title: string
    evidenceType: string
    fileName: string | null
    fileUrl: string | null
    evidenceDate: string
  }[]>([])
  const [loadingViewEvidences, setLoadingViewEvidences] = useState(false)

  useEffect(() => {
    fetchControls()
  }, [])

  const fetchControls = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/iso27001/controls?includeDocuments=true")
      if (res.ok) {
        const data = await res.json()
        setControls(data.controls || data)
      }
    } catch (error) {
      console.error("Kontroller alinamadi:", error)
      toast.error("Kontroller yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  // İstatistikler
  const stats = useMemo(() => {
    const applicable = controls.filter(c => c.applicability !== false)
    const notApplicable = controls.filter(c => c.applicability === false)
    const implemented = controls.filter(c => c.status === "IMPLEMENTED" && c.applicability !== false)
    const partial = controls.filter(c => c.status === "PARTIALLY" && c.applicability !== false)
    const notImplemented = controls.filter(c => (c.status === "NOT_IMPLEMENTED" || !c.status) && c.applicability !== false)

    const applicableCount = applicable.length
    const complianceRate = applicableCount > 0
      ? Math.round((implemented.length / applicableCount) * 100)
      : 0

    return {
      total: controls.length,
      applicable: applicableCount,
      notApplicable: notApplicable.length,
      implemented: implemented.length,
      partial: partial.length,
      notImplemented: notImplemented.length,
      complianceRate,
    }
  }, [controls])

  // Filtrelenmiş kontroller
  const filteredControls = useMemo(() => {
    return controls.filter(control => {
      // Arama filtresi
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        if (!control.controlId.toLowerCase().includes(search) &&
            !control.title.toLowerCase().includes(search) &&
            !control.titleTr?.toLowerCase().includes(search) &&
            !control.description?.toLowerCase().includes(search) &&
            !control.descriptionTr?.toLowerCase().includes(search)) {
          return false
        }
      }

      // Kategori filtresi (A.5.x format)
      if (categoryFilter !== "all" && !control.controlId.startsWith("A." + categoryFilter + ".")) {
        return false
      }

      // Durum filtresi
      if (statusFilter !== "all") {
        if (statusFilter === "NOT_IMPLEMENTED" && control.status && control.status !== "NOT_IMPLEMENTED") {
          return false
        } else if (statusFilter !== "NOT_IMPLEMENTED" && control.status !== statusFilter) {
          return false
        }
      }

      // Uygulanabilirlik filtresi
      if (applicableFilter !== "all") {
        if (applicableFilter === "applicable" && control.applicability === false) return false
        if (applicableFilter === "not_applicable" && control.applicability !== false) return false
      }

      return true
    })
  }, [controls, searchTerm, categoryFilter, statusFilter, applicableFilter])

  // SoA Raporu İndir
  const handleExportSoA = async () => {
    setExporting(true)
    try {
      const res = await fetch("/api/iso27001/soa/export")
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `ISO27001-SoA-${new Date().toISOString().split("T")[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
        toast.success("SoA raporu indirildi")
      } else {
        // Fallback: JSON olarak indir
        const jsonRes = await fetch("/api/iso27001/soa/export?format=json")
        if (jsonRes.ok) {
          const data = await jsonRes.json()
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `ISO27001-SoA-${new Date().toISOString().split("T")[0]}.json`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          a.remove()
          toast.success("SoA raporu indirildi (JSON)")
        }
      }
    } catch (error) {
      console.error("Export hatasi:", error)
      toast.error("Rapor indirilemedi")
    } finally {
      setExporting(false)
    }
  }

  // Kategori bazlı gruplama (A.5.1 -> "5")
  const getCategoryNumber = (controlId: string) => {
    const parts = controlId.split(".")
    return parts.length > 1 ? parts[1] : parts[0]
  }

  // Kanıtları görüntüle
  const handleViewEvidences = async (controlId: string, controlName: string) => {
    setViewingControlId(controlId)
    setViewingControlName(controlName)
    setIsEvidenceDialogOpen(true)
    setLoadingViewEvidences(true)
    try {
      const res = await fetch(`/api/iso27001/controls/${controlId}/evidences`)
      if (res.ok) {
        const data = await res.json()
        setViewEvidences(data.evidences || [])
      }
    } catch (error) {
      console.error("Kanitlar yuklenemedi:", error)
      setViewEvidences([])
    } finally {
      setLoadingViewEvidences(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Statement of Applicability (SoA)
          </h1>
          <p className="text-muted-foreground">
            ISO 27001:2022 Annex A - 93 Kontrol Uygulanabilirlik Beyani
          </p>
        </div>
        <Button onClick={handleExportSoA} disabled={exporting}>
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          SoA Raporu Indir
        </Button>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Toplam Kontrol</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Annex A kontrolleri</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Uygulanabilir</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.applicable}</div>
            <p className="text-xs text-muted-foreground">{stats.notApplicable} uygulanamaz</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Uygulanan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.implemented}</div>
            <p className="text-xs text-muted-foreground">{stats.partial} kismen</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bekleyen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.notImplemented}</div>
            <p className="text-xs text-muted-foreground">Uygulanmamis kontrol</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Uyumluluk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.complianceRate}%</div>
            <Progress value={stats.complianceRate} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Kategori Özeti */}
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(CATEGORIES).map(([key, cat]) => {
          // A.5.x, A.6.x, A.7.x, A.8.x formatını kontrol et
          const catControls = controls.filter(c => c.controlId.startsWith("A." + key + "."))
          const catImplemented = catControls.filter(c => c.status === "IMPLEMENTED" && c.applicability !== false)
          const catApplicable = catControls.filter(c => c.applicability !== false)
          const Icon = cat.icon

          return (
            <Card key={key} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${cat.color}`} />
                  {cat.name}
                </CardTitle>
                <CardDescription className="text-xs">{cat.range}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold">
                    {catImplemented.length}/{catApplicable.length}
                  </span>
                  <Badge variant="outline">
                    {catApplicable.length > 0
                      ? Math.round((catImplemented.length / catApplicable.length) * 100)
                      : 0}%
                  </Badge>
                </div>
                <Progress
                  value={catApplicable.length > 0
                    ? (catImplemented.length / catApplicable.length) * 100
                    : 0}
                  className="mt-2 h-2"
                />
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Filtreler */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtrele ve Ara
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Kontrol ara (ID, baslik veya aciklama)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Kategoriler</SelectItem>
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                  <SelectItem key={key} value={key}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Durumlar</SelectItem>
                {Object.entries(STATUS_OPTIONS).map(([key, opt]) => (
                  <SelectItem key={key} value={key}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={applicableFilter} onValueChange={setApplicableFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Uygulanabilirlik" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tumunu Goster</SelectItem>
                <SelectItem value="applicable">Uygulanabilir</SelectItem>
                <SelectItem value="not_applicable">Uygulanamaz</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Kontrol Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Kontrol Listesi ({filteredControls.length} kontrol)
          </CardTitle>
          <CardDescription>
            ISO 27001:2022 Annex A kontrollerinin uygulanabilirlik ve uygulama durumu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredControls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-20" />
              <p>Filtrelere uygun kontrol bulunamadi</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Kontrol ID</TableHead>
                    <TableHead className="min-w-[250px]">Kontrol Adi</TableHead>
                    <TableHead className="w-[120px]">Uygulanabilir</TableHead>
                    <TableHead className="w-[140px]">Uygulama Durumu</TableHead>
                    <TableHead className="min-w-[200px]">Gerekce / Notlar</TableHead>
                    <TableHead className="w-[100px]">Kanitlar</TableHead>
                    <TableHead className="w-[80px]">Detay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredControls.map((control) => {
                    const statusOpt = STATUS_OPTIONS[control.status as keyof typeof STATUS_OPTIONS] || STATUS_OPTIONS.NOT_IMPLEMENTED
                    const StatusIcon = statusOpt.icon
                    const catNum = getCategoryNumber(control.controlId)
                    const category = CATEGORIES[catNum as keyof typeof CATEGORIES]
                    const CatIcon = category?.icon || Shield

                    return (
                      <TableRow key={control.id} className={control.applicability === false ? "opacity-60 bg-gray-50" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <CatIcon className={`h-4 w-4 ${category?.color || "text-gray-500"}`} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{category?.name}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <span className="font-mono font-medium">{control.controlId}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{control.titleTr || control.title}</p>
                            {(control.descriptionTr || control.description) && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {control.descriptionTr || control.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {control.applicability === false ? (
                            <Badge variant="outline" className="bg-gray-100">
                              <XCircle className="h-3 w-3 mr-1" />
                              Hayir
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Evet
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusOpt.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusOpt.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {control.justification || control.implementationNotes || "-"}
                          </p>
                        </TableCell>
                        <TableCell>
                          {control._count && control._count.evidences > 0 ? (
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover:bg-primary/20"
                              onClick={() => handleViewEvidences(control.controlId, `${control.controlId} - ${control.titleTr || control.title}`)}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              {control._count.evidences} kanit
                            </Badge>
                          ) : control._count && control._count.documents > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline">
                                    <FileText className="h-3 w-3 mr-1" />
                                    {control._count.documents} dok
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{control._count.documents} dokuman bagli</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/iso27001/controls?id=${control.controlId}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Link>
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

      {/* Bilgi Notu */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Info className="h-6 w-6 text-blue-500 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900">Statement of Applicability (SoA) Nedir?</h3>
              <p className="text-sm text-blue-700 mt-1">
                SoA, ISO 27001:2022 standardinin zorunlu belgelerinden biridir. Annex A&apos;daki 93 kontrolun
                her birinin organizasyonunuz icin uygulanabilir olup olmadigini ve uygulama durumunu gosterir.
                Denetciler bu belgeyi BGYS&apos;nin kapsamini ve kontrol durumunu degerlendirmek icin kullanir.
              </p>
              <div className="flex gap-2 mt-3">
                <Badge variant="outline">ISO 27001:2022 Madde 6.1.3 d</Badge>
                <Badge variant="outline">Zorunlu Dokuman</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kanıt Görüntüleme Dialog */}
      <Dialog open={isEvidenceDialogOpen} onOpenChange={setIsEvidenceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Kanıtlar
            </DialogTitle>
            <DialogDescription>
              {viewingControlName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {loadingViewEvidences ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Kanıtlar yükleniyor...</p>
              </div>
            ) : viewEvidences.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Henüz kanıt eklenmemiş</p>
              </div>
            ) : (
              <div className="space-y-2">
                {viewEvidences.map((ev) => {
                  const evType = EVIDENCE_TYPES.find((t) => t.value === ev.evidenceType)
                  const EvIcon = evType?.icon || File
                  return (
                    <div
                      key={ev.id}
                      className={`flex items-center justify-between p-3 border rounded-lg bg-muted/30 ${ev.fileUrl ? "cursor-pointer hover:bg-muted/50" : ""}`}
                      onClick={() => ev.fileUrl && window.open(ev.fileUrl, "_blank")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-background">
                          <EvIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{ev.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {evType?.label || ev.evidenceType} • {new Date(ev.evidenceDate).toLocaleDateString("tr-TR")}
                          </p>
                        </div>
                      </div>
                      {ev.fileUrl ? (
                        <a
                          href={ev.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="h-4 w-4" />
                          İndir
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Dosya yok</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEvidenceDialogOpen(false)}>
              Kapat
            </Button>
            <Link href={`/iso27001/controls?id=${viewingControlId}`}>
              <Button>
                Kanıt Ekle
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
