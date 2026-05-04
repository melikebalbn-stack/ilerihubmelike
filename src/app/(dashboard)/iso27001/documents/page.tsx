"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FileText,
  Plus,
  Search,
  Upload,
  MoreHorizontal,
  Eye,
  Download,
  PenTool,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  Filter,
  Calendar,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { ExcelViewerDialog } from "@/components/iso27001/excel-viewer-dialog"
import { NewVersionModal } from "@/components/iso27001/NewVersionModal"
import { useRouter } from "next/navigation"
import {
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { FileUp, Info } from "lucide-react"

const BGYS_ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "IT_MANAGER", "QUALITY_MANAGER"]
const BGYS_ALLOWED_EMAILS = [
  "melike.balaban@ilerigroup.com",
  "melih.dilben@ilerigroup.com",
]
const isBgysSorumlu = (email?: string | null, role?: string | null) => {
  if (!email) return false
  if (BGYS_ALLOWED_EMAILS.includes(email.toLowerCase())) return true
  return BGYS_ALLOWED_ROLES.includes(role ?? "")
}

// Kategori bilgileri
const CATEGORIES = [
  { value: "MANDATORY", label: "Zorunlu Dokümanlar", description: "Madde 4-10 kapsamındaki zorunlu dokümanlar" },
  { value: "RECORD", label: "Zorunlu Kayıtlar", description: "Eğitim, denetim, gözden geçirme kayıtları" },
  { value: "ANNEX_A", label: "Annex A Dokümanları", description: "93 kontrol ile ilgili dokümanlar" },
  { value: "POLICY", label: "Politikalar", description: "Bilgi güvenliği politikaları" },
  { value: "PROCEDURE", label: "Prosedürler", description: "İş süreçleri ve prosedürler" },
  { value: "GUIDELINE", label: "Kılavuzlar", description: "Uygulama kılavuzları" },
  { value: "FORM", label: "Formlar", description: "Standart formlar ve şablonlar" },
  { value: "OTHER", label: "Diğer", description: "Diğer dokümanlar" },
]

// Durum bilgileri
const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: "Taslak", color: "bg-gray-100 text-gray-800", icon: FileText },
  PENDING_APPROVAL: { label: "Onay Bekliyor", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  APPROVED: { label: "Onaylı", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  PUBLISHED: { label: "Yayında", color: "bg-blue-100 text-blue-800", icon: FileCheck },
  UNDER_REVIEW: { label: "Gözden Geçiriliyor", color: "bg-purple-100 text-purple-800", icon: Eye },
  OBSOLETE: { label: "Geçersiz", color: "bg-red-100 text-red-800", icon: AlertCircle },
  ARCHIVED: { label: "Arşivlenmiş", color: "bg-gray-100 text-gray-500", icon: FileText },
}

// Sortable column header component
type SortDir = "asc" | "desc"
function SortableTh({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  className = "",
}: {
  label: string
  sortKey: string
  currentSort: string | null
  currentDir: SortDir
  onSort: (key: string) => void
  className?: string
}) {
  const isActive = currentSort === sortKey
  return (
    <TableHead
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer hover:bg-slate-50 select-none ${className}`}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <span className="inline-flex flex-col text-[9px] leading-[9px] opacity-60">
          <span className={isActive && currentDir === "asc" ? "text-blue-600 font-bold" : ""}>▲</span>
          <span className={isActive && currentDir === "desc" ? "text-blue-600 font-bold" : ""}>▼</span>
        </span>
      </div>
    </TableHead>
  )
}

interface Document {
  id: string
  documentNumber: string
  title: string
  description: string | null
  category: string
  clause: string | null
  controlId: string | null
  fileName: string
  fileUrl: string
  fileType: string
  fileSize: number | null
  version: string
  status: string
  ownerName: string
  ownerEmail: string
  approvedByName: string | null
  approvedAt: string | null
  nextReviewDate: string | null
  createdAt: string
  _count: {
    signatures: number
    versions: number
  }
}

export default function Iso27001DocumentsPage() {
  const { data: session } = useSession()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Form state
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    title: "",
    description: "",
    category: "",
    clause: "",
    controlId: "",
    reviewFrequency: "365",
  })

  // Excel viewer state
  const [excelViewerOpen, setExcelViewerOpen] = useState(false)
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null)

  // Yeni Versiyon Modal state
  const [newVersionModalOpen, setNewVersionModalOpen] = useState(false)
  const [versionTargetDoc, setVersionTargetDoc] = useState<Document | null>(null)

  const router = useRouter()
  const currentUser = session?.user as
    | { email?: string | null; role?: string | null; id?: string }
    | undefined
  const canManageVersions = (doc: Document) =>
    isBgysSorumlu(currentUser?.email, currentUser?.role) ||
    currentUser?.email === doc.ownerEmail

  // İmza state
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false)
  const [isSignaturesDialogOpen, setIsSignaturesDialogOpen] = useState(false)
  const [signingDocId, setSigningDocId] = useState<string>("")
  const [signingDocTitle, setSigningDocTitle] = useState<string>("")
  const [signing, setSigning] = useState(false)
  const [signatureType, setSignatureType] = useState<string>("APPROVAL")
  const [signatureNotes, setSignatureNotes] = useState<string>("")
  const [signatures, setSignatures] = useState<any[]>([])
  const [loadingSignatures, setLoadingSignatures] = useState(false)

  // Dokümanları yükle
  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedCategory !== "all") params.append("category", selectedCategory)
      if (selectedStatus !== "all") params.append("status", selectedStatus)
      if (searchQuery) params.append("search", searchQuery)

      const res = await fetch(`/api/iso27001/documents?${params}`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
      }
    } catch (error) {
      console.error("Dokümanlar yüklenemedi:", error)
      toast.error("Dokümanlar yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [selectedCategory, selectedStatus])

  // Arama
  const handleSearch = () => {
    fetchDocuments()
  }

  // Sortable columns
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sortedDocuments = useMemo(() => {
    if (!sortKey) return documents
    const arr = [...documents]
    arr.sort((a, b) => {
      // Date sıralaması
      if (sortKey === "nextReviewDate" || sortKey === "createdAt") {
        const aT = a[sortKey as "nextReviewDate" | "createdAt"]
          ? new Date(a[sortKey as "nextReviewDate" | "createdAt"]!).getTime()
          : 0
        const bT = b[sortKey as "nextReviewDate" | "createdAt"]
          ? new Date(b[sortKey as "nextReviewDate" | "createdAt"]!).getTime()
          : 0
        return sortDir === "asc" ? aT - bT : bT - aT
      }
      // Category & status: label-bazlı sıralama (kullanıcının gördüğü TR metin)
      if (sortKey === "category") {
        const aL = CATEGORIES.find((c) => c.value === a.category)?.label ?? a.category
        const bL = CATEGORIES.find((c) => c.value === b.category)?.label ?? b.category
        return sortDir === "asc" ? aL.localeCompare(bL, "tr") : bL.localeCompare(aL, "tr")
      }
      if (sortKey === "status") {
        const aL = STATUS_MAP[a.status]?.label ?? a.status
        const bL = STATUS_MAP[b.status]?.label ?? b.status
        return sortDir === "asc" ? aL.localeCompare(bL, "tr") : bL.localeCompare(aL, "tr")
      }
      // String alanlar (documentNumber, title, version, ownerName)
      const av = (a[sortKey as keyof Document] ?? "") as string | number
      const bv = (b[sortKey as keyof Document] ?? "") as string | number
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), "tr")
        : String(bv).localeCompare(String(av), "tr")
    })
    return arr
  }, [documents, sortKey, sortDir])

  // Dosya seçimi
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadForm(prev => ({
        ...prev,
        file,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
      }))
    }
  }

  // Doküman yükleme
  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.title || !uploadForm.category) {
      toast.error("Dosya, başlık ve kategori zorunludur")
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append("file", uploadForm.file)
      formData.append("title", uploadForm.title)
      formData.append("description", uploadForm.description)
      formData.append("category", uploadForm.category)
      formData.append("clause", uploadForm.clause)
      formData.append("controlId", uploadForm.controlId)
      formData.append("reviewFrequency", uploadForm.reviewFrequency)

      const res = await fetch("/api/iso27001/documents", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        toast.success("Doküman başarıyla yüklendi")
        setIsUploadDialogOpen(false)
        setUploadForm({
          file: null,
          title: "",
          description: "",
          category: "",
          clause: "",
          controlId: "",
          reviewFrequency: "365",
        })
        fetchDocuments()
      } else {
        const error = await res.json()
        toast.error(error.error || "Yükleme başarısız")
      }
    } catch (error) {
      console.error("Yükleme hatası:", error)
      toast.error("Yükleme sırasında hata oluştu")
    } finally {
      setUploading(false)
    }
  }

  // Doküman onaylama
  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/iso27001/documents/${id}/approve`, {
        method: "POST",
      })

      if (res.ok) {
        toast.success("Doküman onaylandı")
        fetchDocuments()
      } else {
        const error = await res.json()
        toast.error(error.error || "Onaylama başarısız")
      }
    } catch (error) {
      console.error("Onaylama hatası:", error)
      toast.error("Onaylama sırasında hata oluştu")
    }
  }

  // Doküman yayınlama (APPROVED → PUBLISHED)
  const handlePublish = async (id: string) => {
    try {
      const res = await fetch(`/api/iso27001/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      })

      if (res.ok) {
        toast.success("Doküman yayına alındı")
        fetchDocuments()
      } else {
        const error = await res.json()
        toast.error(error.error || "Yayınlama başarısız")
      }
    } catch (error) {
      console.error("Yayınlama hatası:", error)
      toast.error("Yayınlama sırasında hata oluştu")
    }
  }

  // Doküman silme
  const handleDelete = async (id: string) => {
    if (!confirm("Bu dokümanı silmek istediğinizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/iso27001/documents/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Doküman silindi")
        fetchDocuments()
      } else {
        const error = await res.json()
        toast.error(error.error || "Silme başarısız")
      }
    } catch (error) {
      console.error("Silme hatası:", error)
      toast.error("Silme sırasında hata oluştu")
    }
  }

  // İmza dialogunu aç
  const handleSign = (docId: string, docTitle: string) => {
    setSigningDocId(docId)
    setSigningDocTitle(docTitle)
    setSignatureType("APPROVAL")
    setSignatureNotes("")
    setIsSignDialogOpen(true)
  }

  // Dokümanı imzala
  const handleSubmitSign = async () => {
    try {
      setSigning(true)
      const res = await fetch(`/api/iso27001/documents/${signingDocId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureType,
          notes: signatureNotes,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success(
          <div>
            <p className="font-medium">Doküman imzalandı!</p>
            <p className="text-sm">İmza Kodu: <span className="font-mono">{data.signature.signatureCode}</span></p>
          </div>
        )
        setIsSignDialogOpen(false)
        fetchDocuments()
      } else {
        toast.error(data.error || "İmzalama başarısız")
      }
    } catch (error) {
      console.error("İmzalama hatası:", error)
      toast.error("İmzalama sırasında hata oluştu")
    } finally {
      setSigning(false)
    }
  }

  // İmzaları görüntüle
  const handleViewSignatures = async (docId: string, docTitle: string) => {
    setSigningDocId(docId)
    setSigningDocTitle(docTitle)
    setIsSignaturesDialogOpen(true)
    setLoadingSignatures(true)

    try {
      const res = await fetch(`/api/iso27001/documents/${docId}/sign`)
      if (res.ok) {
        const data = await res.json()
        setSignatures(data)
      }
    } catch (error) {
      console.error("İmzalar alınamadı:", error)
      toast.error("İmzalar alınamadı")
    } finally {
      setLoadingSignatures(false)
    }
  }

  // Görüntüle: Excel ise tablo viewer, diğerlerinde yeni sekmede aç
  const isExcelDoc = (doc: Document) => {
    const ft = (doc.fileType || "").toLowerCase()
    const fn = (doc.fileName || "").toLowerCase()
    return (
      ft === "xlsx" ||
      ft === "xls" ||
      fn.endsWith(".xlsx") ||
      fn.endsWith(".xls")
    )
  }

  const handleView = (doc: Document) => {
    if (isExcelDoc(doc)) {
      setViewingDoc(doc)
      setExcelViewerOpen(true)
      return
    }
    const url = doc.fileUrl.startsWith("/api/") ? doc.fileUrl : `/api/files${doc.fileUrl}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  // Dosya indirme (programmatik - sayfa navigasyonu tetiklemez)
  const handleDownload = async (doc: Document) => {
    try {
      const url = doc.fileUrl.startsWith("/api/") ? doc.fileUrl : `/api/files${doc.fileUrl}`
      const res = await fetch(url)
      if (!res.ok) throw new Error("Dosya indirilemedi")
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = doc.fileName || "dosya"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("İndirme hatası:", error)
      toast.error("Dosya indirilemedi")
    }
  }

  // Dosya boyutu formatla
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Kategoriye göre grupla
  const groupedDocuments = CATEGORIES.reduce((acc, cat) => {
    acc[cat.value] = documents.filter(d => d.category === cat.value)
    return acc
  }, {} as Record<string, Document[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-primary" />
            Doküman Yönetimi
          </h1>
          <p className="text-muted-foreground">
            ISO 27001 zorunlu dokümanlar ve kayıtlar
          </p>
        </div>
        <Button onClick={() => setIsUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Doküman Yükle
        </Button>
      </div>

      {/* Filtreler */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Doküman ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {Object.entries(STATUS_MAP).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleSearch}>
              <Filter className="h-4 w-4 mr-2" />
              Filtrele
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* İstatistikler */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{documents.length}</div>
            <p className="text-sm text-muted-foreground">Toplam Doküman</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {documents.filter(d => d.status === "APPROVED" || d.status === "PUBLISHED").length}
            </div>
            <p className="text-sm text-muted-foreground">Onaylı</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">
              {documents.filter(d => d.status === "PENDING_APPROVAL").length}
            </div>
            <p className="text-sm text-muted-foreground">Onay Bekleyen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {documents.filter(d => {
                if (!d.nextReviewDate) return false
                const reviewDate = new Date(d.nextReviewDate)
                const today = new Date()
                const diffDays = Math.ceil((reviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                return diffDays <= 30 && diffDays > 0
              }).length}
            </div>
            <p className="text-sm text-muted-foreground">Gözden Geçirme Yaklaşan</p>
          </CardContent>
        </Card>
      </div>

      {/* Doküman Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle>Dokümanlar</CardTitle>
          <CardDescription>
            Tüm ISO 27001 dokümanları ve kayıtları
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Henüz doküman bulunmuyor. Yeni doküman yüklemek için yukarıdaki butonu kullanın.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTh label="Doküman No" sortKey="documentNumber" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Başlık" sortKey="title" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Kategori" sortKey="category" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Versiyon" sortKey="version" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Durum" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Sahip" sortKey="ownerName" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableTh label="Gözden Geçirme" sortKey="nextReviewDate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDocuments.map((doc) => {
                  const status = STATUS_MAP[doc.status] || STATUS_MAP.DRAFT
                  const StatusIcon = status.icon
                  const isReviewSoon = doc.nextReviewDate &&
                    Math.ceil((new Date(doc.nextReviewDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 30

                  return (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/iso27001/documents/${doc.id}`)}
                    >
                      <TableCell className="font-mono text-sm">{doc.documentNumber}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{doc.title}</div>
                          {doc.clause && (
                            <div className="text-xs text-muted-foreground">Madde: {doc.clause}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CATEGORIES.find(c => c.value === doc.category)?.label || doc.category}
                        </Badge>
                      </TableCell>
                      <TableCell>{doc.version}</TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{doc.ownerName}</TableCell>
                      <TableCell>
                        {doc.nextReviewDate ? (
                          <div className={isReviewSoon ? "text-red-600 font-medium" : ""}>
                            {format(new Date(doc.nextReviewDate), "dd MMM yyyy", { locale: tr })}
                            {isReviewSoon && <AlertCircle className="h-3 w-3 inline ml-1" />}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/iso27001/documents/${doc.id}`)}
                            >
                              <Info className="h-4 w-4 mr-2" />
                              Detay
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleView(doc)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Görüntüle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(doc)}>
                              <Download className="h-4 w-4 mr-2" />
                              İndir
                            </DropdownMenuItem>
                            {(doc.status === "DRAFT" || doc.status === "PENDING_APPROVAL") && (
                              <DropdownMenuItem onClick={() => handleApprove(doc.id)}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Onayla
                              </DropdownMenuItem>
                            )}
                            {doc.status === "APPROVED" && (
                              <DropdownMenuItem onClick={() => handlePublish(doc.id)}>
                                <FileCheck className="h-4 w-4 mr-2" />
                                Yayınla
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleSign(doc.id, doc.title)}>
                              <PenTool className="h-4 w-4 mr-2" />
                              İmzala
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewSignatures(doc.id, doc.title)}>
                              <FileCheck className="h-4 w-4 mr-2" />
                              İmzaları Gör ({doc._count?.signatures || 0})
                            </DropdownMenuItem>
                            {canManageVersions(doc) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setVersionTargetDoc(doc)
                                    setNewVersionModalOpen(true)
                                  }}
                                >
                                  <FileUp className="h-4 w-4 mr-2" />
                                  Yeni Versiyon Yükle
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDelete(doc.id)}
                              className="text-red-600"
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

      {/* Yükleme Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Doküman Yükle</DialogTitle>
            <DialogDescription>
              ISO 27001 kapsamında yeni bir doküman yükleyin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Dosya Seçimi */}
            <div className="space-y-2">
              <Label>Dosya *</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                {uploadForm.file ? (
                  <div className="flex items-center gap-3 text-left">
                    <FileText className="h-8 w-8 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" title={uploadForm.file.name}>
                        {uploadForm.file.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(uploadForm.file.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setUploadForm(prev => ({ ...prev, file: null }))}
                    >
                      Değiştir
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Dosya seçmek için tıklayın veya sürükleyin
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, Word, Excel (Max 50MB)
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      onChange={handleFileSelect}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Başlık */}
            <div className="space-y-2">
              <Label htmlFor="title">Başlık *</Label>
              <Input
                id="title"
                value={uploadForm.title}
                onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Doküman başlığı"
              />
            </div>

            {/* Açıklama */}
            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                value={uploadForm.description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Doküman hakkında kısa açıklama"
                rows={3}
              />
            </div>

            {/* Kategori ve Madde */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategori *</Label>
                <Select
                  value={uploadForm.category}
                  onValueChange={(value) => setUploadForm(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kategori seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clause">İlgili Madde</Label>
                <Input
                  id="clause"
                  value={uploadForm.clause}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, clause: e.target.value }))}
                  placeholder="Örnek: 6.1.2, A.5.1"
                />
              </div>
            </div>

            {/* Gözden Geçirme Süresi */}
            <div className="space-y-2">
              <Label>Gözden Geçirme Periyodu</Label>
              <Select
                value={uploadForm.reviewFrequency}
                onValueChange={(value) => setUploadForm(prev => ({ ...prev, reviewFrequency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90">3 Ay</SelectItem>
                  <SelectItem value="180">6 Ay</SelectItem>
                  <SelectItem value="365">1 Yıl</SelectItem>
                  <SelectItem value="730">2 Yıl</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? "Yükleniyor..." : "Yükle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* İmza Atma Dialog */}
      <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Doküman İmzala
            </DialogTitle>
            <DialogDescription>
              {signingDocTitle}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>İmza Türü</Label>
              <Select value={signatureType} onValueChange={setSignatureType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVAL">Onay İmzası</SelectItem>
                  <SelectItem value="REVIEW">Gözden Geçirme İmzası</SelectItem>
                  <SelectItem value="ACKNOWLEDGEMENT">Bilgi Alma İmzası</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notlar (Opsiyonel)</Label>
              <Textarea
                value={signatureNotes}
                onChange={(e) => setSignatureNotes(e.target.value)}
                placeholder="İmza ile ilgili notlarınız..."
                rows={3}
              />
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Dikkat:</strong> Bu işlemi gerçekleştirdiğinizde, dijital imzanız oluşturulacak
                ve benzersiz bir imza kodu atanacaktır. İmzanız, IP adresiniz ve tarih bilgisi ile birlikte kaydedilecektir.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSignDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSubmitSign} disabled={signing}>
              {signing ? "İmzalanıyor..." : "İmzala"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* İmzalar Görüntüleme Dialog */}
      <Dialog open={isSignaturesDialogOpen} onOpenChange={setIsSignaturesDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Doküman İmzaları
            </DialogTitle>
            <DialogDescription>
              {signingDocTitle}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto">
            {loadingSignatures ? (
              <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
            ) : signatures.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Bu dokümanda henüz imza bulunmuyor.
              </div>
            ) : (
              <div className="space-y-4">
                {signatures.map((sig) => (
                  <div key={sig.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-medium">{sig.signerName}</span>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">
                        {sig.signatureCode}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>
                        <span className="text-muted-foreground">Ünvan:</span> {sig.signerTitle || "-"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Departman:</span> {sig.signerDepartment || "-"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">İmza Türü:</span>{" "}
                        {sig.signatureType === "APPROVAL" ? "Onay" :
                         sig.signatureType === "REVIEW" ? "Gözden Geçirme" : "Bilgi Alma"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tarih:</span>{" "}
                        {format(new Date(sig.signedAt), "dd MMM yyyy HH:mm", { locale: tr })}
                      </div>
                    </div>
                    {sig.notes && (
                      <div className="text-sm mt-2 p-2 bg-muted rounded">
                        <span className="text-muted-foreground">Not:</span> {sig.notes}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      {sig.isVerified ? "Doğrulanmış İmza" : "İmza Bekleniyor"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSignaturesDialogOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Yeni Versiyon Modal */}
      <NewVersionModal
        open={newVersionModalOpen}
        onClose={() => {
          setNewVersionModalOpen(false)
          setVersionTargetDoc(null)
        }}
        document={
          versionTargetDoc
            ? {
                id: versionTargetDoc.id,
                documentNumber: versionTargetDoc.documentNumber,
                title: versionTargetDoc.title,
                version: versionTargetDoc.version,
                fileName: versionTargetDoc.fileName,
              }
            : null
        }
        onSuccess={fetchDocuments}
      />

      {/* Excel Viewer Dialog */}
      {viewingDoc && (
        <ExcelViewerDialog
          open={excelViewerOpen}
          onOpenChange={(open) => {
            setExcelViewerOpen(open)
            if (!open) setViewingDoc(null)
          }}
          documentId={viewingDoc.id}
          documentTitle={viewingDoc.title}
          fileUrl={viewingDoc.fileUrl}
          fileName={viewingDoc.fileName}
          canEdit={viewingDoc.status === "DRAFT" || viewingDoc.status === "PUBLISHED" || viewingDoc.status === "APPROVED"}
          onVersionUploaded={fetchDocuments}
        />
      )}
    </div>
  )
}
