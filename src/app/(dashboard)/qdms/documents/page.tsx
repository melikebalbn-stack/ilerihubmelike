"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  FileText,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Download,
  History,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  FileCheck,
  FilePlus,
  Archive,
  RefreshCw,
  HelpCircle,
  BookOpen,
  FileSignature,
  Users,
  Shield,
  ArrowRight,
  Upload,
  File,
  FileImage,
  FileSpreadsheet,
  Presentation,
  Loader2,
  X,
  GitBranch,
  CalendarDays,
  User,
  QrCode,
  ShieldCheck,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

// Doküman kategorileri
const documentCategories = [
  { value: "PROCEDURE", label: "Prosedür" },
  { value: "INSTRUCTION", label: "Talimat" },
  { value: "FORM", label: "Form" },
  { value: "SPECIFICATION", label: "Şartname" },
  { value: "MANUAL", label: "El Kitabı" },
  { value: "POLICY", label: "Politika" },
  { value: "RECORD", label: "Kayıt" },
  { value: "EXTERNAL", label: "Dış Kaynaklı" },
  { value: "TEMPLATE", label: "Şablon" },
  { value: "OTHER", label: "Diğer" },
]

// Doküman durumları
const documentStatuses = [
  { value: "DRAFT", label: "Taslak", color: "bg-gray-500" },
  { value: "PENDING_REVIEW", label: "İnceleme Bekliyor", color: "bg-yellow-500" },
  { value: "PENDING_APPROVAL", label: "Onay Bekliyor", color: "bg-orange-500" },
  { value: "APPROVED", label: "Onaylandı", color: "bg-blue-500" },
  { value: "PUBLISHED", label: "Yayınlandı", color: "bg-green-500" },
  { value: "OBSOLETE", label: "Geçersiz", color: "bg-red-500" },
  { value: "ARCHIVED", label: "Arşivlendi", color: "bg-purple-500" },
]

interface DocumentApproval {
  id: string
  stepName: string
  status: string
  actionDate: string | null
  signatureTimestamp: string | null
  signatureHash: string | null
  verificationCode: string | null
  approver: {
    id: string
    name: string
    email: string
  }
}

interface Document {
  id: string
  documentNumber: string
  title: string
  description: string | null
  category: string
  version: string
  revisionNumber: number
  status: string
  effectiveDate: string | null
  reviewDate: string | null
  fileName: string | null
  fileUrl: string | null
  fileSize: number | null
  mimeType: string | null
  owner: {
    id: string
    name: string
  }
  department: {
    id: string
    name: string
  } | null
  approvals?: DocumentApproval[]
  createdAt: string
  updatedAt: string
}

interface Revision {
  id: string
  version: string
  revisionNumber: number
  changeDescription: string
  fileName: string | null
  fileUrl: string | null
  fileSize: number | null
  revisedBy: {
    id: string
    name: string
  }
  createdAt: string
}

interface Department {
  id: string
  name: string
}

export default function DocumentsPage() {
  const { data: session } = useSession()
  const [documents, setDocuments] = useState<Document[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isRevisionDialogOpen, setIsRevisionDialogOpen] = useState(false)
  const [isNewRevisionDialogOpen, setIsNewRevisionDialogOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Revision states
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [revisionsLoading, setRevisionsLoading] = useState(false)
  const [newRevisionDescription, setNewRevisionDescription] = useState("")

  // Approval states (for Quality Managers)
  const [pendingApprovals, setPendingApprovals] = useState<Document[]>([])
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve")
  const [approvalComments, setApprovalComments] = useState("")
  const [approving, setApproving] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    documentNumber: "",
    title: "",
    description: "",
    category: "PROCEDURE",
    departmentId: "",
    reviewPeriodMonths: 12,
  })

  // Fetch documents
  const fetchDocuments = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      if (categoryFilter !== "all") params.append("category", categoryFilter)
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (departmentFilter !== "all") params.append("departmentId", departmentFilter)

      const res = await fetch(`/api/qdms/documents?${params}`)
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

  // Fetch departments
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

  // Fetch user role
  const fetchUserRole = async () => {
    try {
      const res = await fetch("/api/auth/me")
      if (res.ok) {
        const data = await res.json()
        setUserRole(data.role)
      }
    } catch (error) {
      console.error("Kullanıcı rolü alınamadı:", error)
    }
  }

  // Fetch pending approvals (for Quality Managers)
  const fetchPendingApprovals = async () => {
    try {
      const res = await fetch("/api/qdms/documents/pending-approvals")
      if (res.ok) {
        const data = await res.json()
        setPendingApprovals(data.documents || [])
      }
    } catch (error) {
      // Yetki yoksa sessizce geç
      console.error("Onay bekleyen dokümanlar alınamadı:", error)
    }
  }

  useEffect(() => {
    fetchDocuments()
    fetchDepartments()
    fetchUserRole()
  }, [searchQuery, categoryFilter, statusFilter, departmentFilter])

  // Kalite müdürüyse onay bekleyenleri de getir
  useEffect(() => {
    if (userRole && ["QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(userRole)) {
      fetchPendingApprovals()
    }
  }, [userRole])

  // Create document
  const handleCreate = async () => {
    try {
      const res = await fetch("/api/qdms/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        const createdDoc = await res.json()

        // Eğer dosya seçildiyse yükle
        if (selectedFile) {
          const uploadFormData = new FormData()
          uploadFormData.append("file", selectedFile)
          uploadFormData.append("documentId", createdDoc.id)

          const uploadRes = await fetch("/api/qdms/documents/upload", {
            method: "POST",
            body: uploadFormData,
          })

          if (uploadRes.ok) {
            toast.success("Doküman ve dosya oluşturuldu")
          } else {
            toast.success("Doküman oluşturuldu ancak dosya yüklenemedi")
          }
        } else {
          toast.success("Doküman oluşturuldu")
        }

        setIsCreateDialogOpen(false)
        resetForm()
        fetchDocuments()
      } else {
        const error = await res.json()
        toast.error(error.message || "Doküman oluşturulamadı")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    }
  }

  // Update document
  const handleUpdate = async () => {
    if (!selectedDocument) return

    try {
      const res = await fetch(`/api/qdms/documents/${selectedDocument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Doküman güncellendi")
        setIsEditDialogOpen(false)
        resetForm()
        fetchDocuments()
      } else {
        const error = await res.json()
        toast.error(error.message || "Doküman güncellenemedi")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    }
  }

  // Delete document
  const handleDelete = async () => {
    if (!selectedDocument) return

    try {
      const res = await fetch(`/api/qdms/documents/${selectedDocument.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Doküman silindi")
        setIsDeleteDialogOpen(false)
        setSelectedDocument(null)
        fetchDocuments()
      } else {
        const error = await res.json()
        toast.error(error.message || "Doküman silinemedi")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    }
  }

  // Submit for approval
  const handleSubmitForApproval = async (doc: Document) => {
    try {
      const res = await fetch(`/api/qdms/documents/${doc.id}/submit`, {
        method: "POST",
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || "Doküman onaya gönderildi")
        fetchDocuments()
      } else {
        const error = await res.json()
        toast.error(error.message || "Onaya gönderilemedi")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    }
  }

  // Approve or Reject document (for Quality Managers)
  const handleApproval = async () => {
    if (!selectedDocument) return

    setApproving(true)
    try {
      const res = await fetch(`/api/qdms/documents/${selectedDocument.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: approvalAction,
          comments: approvalComments,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(data.message)
        setIsApprovalDialogOpen(false)
        setApprovalComments("")
        setSelectedDocument(null)
        fetchDocuments()
        fetchPendingApprovals()
      } else {
        const error = await res.json()
        toast.error(error.message || "İşlem başarısız")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    } finally {
      setApproving(false)
    }
  }

  // Open approval dialog
  const openApprovalDialog = (doc: Document, action: "approve" | "reject") => {
    setSelectedDocument(doc)
    setApprovalAction(action)
    setApprovalComments("")
    setIsApprovalDialogOpen(true)
  }

  // Check if user is quality manager
  const isQualityManager = userRole && ["QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(userRole)

  const resetForm = () => {
    setFormData({
      documentNumber: "",
      title: "",
      description: "",
      category: "PROCEDURE",
      departmentId: "",
      reviewPeriodMonths: 12,
    })
    setSelectedDocument(null)
    setSelectedFile(null)
  }

  // Dosya yükleme
  const handleFileUpload = async (documentId: string) => {
    if (!selectedFile) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("documentId", documentId)

      const res = await fetch("/api/qdms/documents/upload", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        toast.success("Dosya başarıyla yüklendi")
        setSelectedFile(null)
        fetchDocuments()
      } else {
        const error = await res.json()
        toast.error(error.message || "Dosya yüklenemedi")
      }
    } catch (error) {
      toast.error("Dosya yüklenirken hata oluştu")
    } finally {
      setUploading(false)
    }
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

  // Revizyon geçmişini getir
  const fetchRevisions = async (documentId: string) => {
    setRevisionsLoading(true)
    try {
      const res = await fetch(`/api/qdms/documents/${documentId}/revisions`)
      if (res.ok) {
        const data = await res.json()
        setRevisions(data.revisions || [])
      }
    } catch (error) {
      console.error("Revizyon geçmişi yüklenemedi:", error)
      toast.error("Revizyon geçmişi yüklenemedi")
    } finally {
      setRevisionsLoading(false)
    }
  }

  // Yeni revizyon oluştur
  const handleCreateRevision = async () => {
    if (!selectedDocument || !newRevisionDescription) {
      toast.error("Değişiklik açıklaması zorunludur")
      return
    }

    try {
      const res = await fetch(`/api/qdms/documents/${selectedDocument.id}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeDescription: newRevisionDescription }),
      })

      if (res.ok) {
        toast.success("Revizyon oluşturuldu - doküman taslak durumuna geçti")
        setIsNewRevisionDialogOpen(false)
        setNewRevisionDescription("")
        fetchDocuments()
      } else {
        const error = await res.json()
        toast.error(error.message || "Revizyon oluşturulamadı")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
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

  const openEditDialog = (doc: Document) => {
    setSelectedDocument(doc)
    setFormData({
      documentNumber: doc.documentNumber,
      title: doc.title,
      description: doc.description || "",
      category: doc.category,
      departmentId: doc.department?.id || "",
      reviewPeriodMonths: 12,
    })
    setIsEditDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    const statusInfo = documentStatuses.find(s => s.value === status)
    return (
      <Badge className={`${statusInfo?.color} text-white`}>
        {statusInfo?.label || status}
      </Badge>
    )
  }

  const getCategoryLabel = (category: string) => {
    return documentCategories.find(c => c.value === category)?.label || category
  }

  // Stats
  const stats = {
    total: documents.length,
    published: documents.filter(d => d.status === "PUBLISHED").length,
    pendingApproval: documents.filter(d => d.status === "PENDING_APPROVAL" || d.status === "PENDING_REVIEW").length,
    draft: documents.filter(d => d.status === "DRAFT").length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Doküman Kontrolü</h1>
          <p className="text-muted-foreground">
            Kalite yönetim sistemi dokümanlarını yönetin
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
            Yeni Doküman
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Doküman</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yayınlanan</CardTitle>
            <FileCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.published}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onay Bekleyen</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingApproval}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taslak</CardTitle>
            <FilePlus className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals Section - Only for Quality Managers */}
      {isQualityManager && pendingApprovals.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertCircle className="h-5 w-5" />
              Onay Bekleyen Dokümanlar ({pendingApprovals.length})
            </CardTitle>
            <CardDescription>
              Aşağıdaki dokümanlar sizin onayınızı bekliyor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingApprovals.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                      <FileText className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium">{doc.title}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{doc.documentNumber}</span>
                        <span>•</span>
                        <span>{getCategoryLabel(doc.category)}</span>
                        <span>•</span>
                        <span>Gönderen: {doc.owner?.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDocument(doc)
                        setIsViewDialogOpen(true)
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      İncele
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => openApprovalDialog(doc, "approve")}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Onayla
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openApprovalDialog(doc, "reject")}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Reddet
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Doküman ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {documentCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {documentStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Departman" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Departmanlar</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchDocuments}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doküman No</TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Versiyon</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Departman</TableHead>
                <TableHead>Sahip</TableHead>
                <TableHead>Son Güncelleme</TableHead>
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
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Henüz doküman bulunmuyor
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-mono font-medium">
                      {doc.documentNumber}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[250px] truncate" title={doc.title}>
                        {doc.title}
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryLabel(doc.category)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">v{doc.version}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(doc.status)}</TableCell>
                    <TableCell>{doc.department?.name || "-"}</TableCell>
                    <TableCell>{doc.owner?.name || "-"}</TableCell>
                    <TableCell>
                      {format(new Date(doc.updatedAt), "dd MMM yyyy", { locale: tr })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedDocument(doc)
                            setIsViewDialogOpen(true)
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            Görüntüle
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(doc)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedDocument(doc)
                            fetchRevisions(doc.id)
                            setIsRevisionDialogOpen(true)
                          }}>
                            <History className="mr-2 h-4 w-4" />
                            Revizyon Geçmişi
                          </DropdownMenuItem>
                          {doc.fileName && (
                            <DropdownMenuItem onClick={() => {
                              window.open(`/api/qdms/documents/download/${doc.id}?download=true`, "_blank")
                            }}>
                              <Download className="mr-2 h-4 w-4" />
                              İndir
                            </DropdownMenuItem>
                          )}
                          {doc.status === "DRAFT" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSubmitForApproval(doc)}>
                                <Send className="mr-2 h-4 w-4" />
                                Onaya Gönder
                              </DropdownMenuItem>
                            </>
                          )}
                          {doc.status === "PUBLISHED" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                setSelectedDocument(doc)
                                setIsNewRevisionDialogOpen(true)
                              }}>
                                <GitBranch className="mr-2 h-4 w-4" />
                                Yeni Revizyon
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setSelectedDocument(doc)
                              setIsDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Sil
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Yeni Doküman Oluştur</DialogTitle>
            <DialogDescription>
              Yeni bir kalite yönetim sistemi dokümanı oluşturun
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="documentNumber">Doküman No *</Label>
                <Input
                  id="documentNumber"
                  placeholder="PR-QMS-001"
                  value={formData.documentNumber}
                  onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Kategori *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {documentCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Başlık *</Label>
              <Input
                id="title"
                placeholder="Doküman başlığı"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                placeholder="Doküman açıklaması"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="departmentId">Departman</Label>
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
              <div className="space-y-2">
                <Label htmlFor="reviewPeriodMonths">Gözden Geçirme Periyodu (ay)</Label>
                <Input
                  id="reviewPeriodMonths"
                  type="number"
                  min={1}
                  max={60}
                  value={formData.reviewPeriodMonths}
                  onChange={(e) => setFormData({ ...formData, reviewPeriodMonths: parseInt(e.target.value) || 12 })}
                />
              </div>
            </div>

            {/* Dosya Yükleme - Drag & Drop */}
            <div className="space-y-2">
              <Label>Doküman Dosyası (Opsiyonel)</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 transition-all duration-200 cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !selectedFile && document.getElementById("file-upload-create")?.click()}
              >
                <input
                  type="file"
                  id="file-upload-create"
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
                      onClick={(e) => { e.stopPropagation(); document.getElementById("file-upload-create")?.click(); }}
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
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreate}>
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dokümanı Düzenle</DialogTitle>
            <DialogDescription>
              Doküman bilgilerini güncelleyin
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-documentNumber">Doküman No</Label>
                <Input
                  id="edit-documentNumber"
                  value={formData.documentNumber}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Kategori *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {documentCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Başlık *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Açıklama</Label>
              <Textarea
                id="edit-description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-departmentId">Departman</Label>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleUpdate}>
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokümanı Sil</DialogTitle>
            <DialogDescription>
              Bu dokümanı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <div className="py-4">
              <p className="font-medium">{selectedDocument.documentNumber}</p>
              <p className="text-muted-foreground">{selectedDocument.title}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guide Dialog */}
      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-6 w-6 text-blue-500" />
              Doküman Kontrolü Kılavuzu
            </DialogTitle>
            <DialogDescription>
              ISO 9001 uyumlu doküman yönetim sistemi hakkında bilgi edinin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Doküman Kontrolü Nedir? */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-lg text-blue-800 dark:text-blue-200 mb-2">Doküman Kontrolü Nedir?</h3>
              <p className="text-sm text-muted-foreground">
                Doküman kontrolü, kalite yönetim sisteminin temel bileşenlerinden biridir. ISO 9001 standardına göre,
                organizasyonlar tüm kalite ile ilgili dokümanlarını kontrollü bir şekilde oluşturmalı, onaylamalı,
                dağıtmalı ve güncellendiğinde eski versiyonları yönetmelidir.
              </p>
            </div>

            {/* Doküman Türleri */}
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                Doküman Türleri
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium text-blue-600">Prosedür</span>
                  <p className="text-xs text-muted-foreground mt-1">Süreçlerin nasıl yürütüleceğini tanımlar</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium text-green-600">Talimat</span>
                  <p className="text-xs text-muted-foreground mt-1">Belirli görevlerin detaylı açıklamaları</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium text-purple-600">Form</span>
                  <p className="text-xs text-muted-foreground mt-1">Veri toplama ve kayıt şablonları</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium text-orange-600">Politika</span>
                  <p className="text-xs text-muted-foreground mt-1">Üst düzey yönetim kararları ve ilkeler</p>
                </div>
              </div>
            </div>

            {/* Doküman Yaşam Döngüsü */}
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-blue-500" />
                Doküman Yaşam Döngüsü
              </h3>
              <div className="flex items-center justify-between bg-muted/30 rounded-lg p-4">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-gray-500 text-white flex items-center justify-center mx-auto mb-2">1</div>
                  <span className="text-xs font-medium">Taslak</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-yellow-500 text-white flex items-center justify-center mx-auto mb-2">2</div>
                  <span className="text-xs font-medium">İnceleme</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center mx-auto mb-2">3</div>
                  <span className="text-xs font-medium">Onay</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-2">4</div>
                  <span className="text-xs font-medium">Yayın</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center mx-auto mb-2">5</div>
                  <span className="text-xs font-medium">Arşiv</span>
                </div>
              </div>
            </div>

            {/* Önemli Özellikler */}
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                Sistemin Özellikleri
              </h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Versiyon Kontrolü</span>
                    <p className="text-xs text-muted-foreground">Her değişiklik kaydedilir, eski versiyonlara erişilebilir</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Users className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Onay Akışı</span>
                    <p className="text-xs text-muted-foreground">Çok aşamalı onay süreci ile kontrollü yayınlama</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Periyodik Gözden Geçirme</span>
                    <p className="text-xs text-muted-foreground">Belirlenen periyotlarda otomatik hatırlatma</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <History className="h-5 w-5 text-purple-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Değişiklik Geçmişi</span>
                    <p className="text-xs text-muted-foreground">Kim, ne zaman, ne değiştirdi - tam izlenebilirlik</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Nasıl Kullanılır */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-lg">
              <h3 className="font-semibold text-lg mb-3">Hızlı Başlangıç</h3>
              <ol className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">1.</span>
                  <span>&quot;Yeni Doküman&quot; butonuna tıklayarak yeni doküman oluşturun</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">2.</span>
                  <span>Doküman numarası, başlık ve kategori bilgilerini girin</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">3.</span>
                  <span>Taslak olarak kaydedilen dokümanı düzenleyin ve &quot;Onaya Gönder&quot;</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">4.</span>
                  <span>Onay sürecinden geçen doküman otomatik olarak yayınlanır</span>
                </li>
              </ol>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setIsGuideOpen(false)}>
              Anladım, Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Document Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getFileIcon(selectedDocument?.mimeType || null)}
              {selectedDocument?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedDocument?.documentNumber} - v{selectedDocument?.version}
            </DialogDescription>
          </DialogHeader>

          {selectedDocument && (
            <div className="space-y-6">
              {/* Doküman Bilgileri */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Kategori</Label>
                  <p className="font-medium">{getCategoryLabel(selectedDocument.category)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Durum</Label>
                  <div>{getStatusBadge(selectedDocument.status)}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Departman</Label>
                  <p className="font-medium">{selectedDocument.department?.name || "-"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Doküman Sahibi</Label>
                  <p className="font-medium">{selectedDocument.owner?.name || "-"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Revizyon No</Label>
                  <p className="font-medium">{selectedDocument.revisionNumber}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Son Güncelleme</Label>
                  <p className="font-medium">
                    {format(new Date(selectedDocument.updatedAt), "dd MMM yyyy HH:mm", { locale: tr })}
                  </p>
                </div>
              </div>

              {selectedDocument.description && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Açıklama</Label>
                  <p className="text-sm">{selectedDocument.description}</p>
                </div>
              )}

              <Separator />

              {/* Dosya Bölümü */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <File className="h-4 w-4" />
                  Dosya
                </h4>

                {selectedDocument.fileName ? (
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      {getFileIcon(selectedDocument.mimeType)}
                      <div>
                        <p className="font-medium">{selectedDocument.fileName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(selectedDocument.fileSize)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/api/qdms/documents/download/${selectedDocument.id}`, "_blank")}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Görüntüle
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/api/qdms/documents/download/${selectedDocument.id}?download=true`, "_blank")}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        İndir
                      </Button>
                      {selectedDocument.status === "PUBLISHED" && selectedDocument.mimeType?.includes("pdf") && (
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => window.open(`/api/qdms/documents/${selectedDocument.id}/signed-pdf`, "_blank")}
                        >
                          <QrCode className="mr-2 h-4 w-4" />
                          İmzalı PDF
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
                      selectedDocument.status === "DRAFT" ? "cursor-pointer" : ""
                    } ${
                      isDragging
                        ? "border-primary bg-primary/5 scale-[1.02]"
                        : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                    onDragOver={selectedDocument.status === "DRAFT" ? handleDragOver : undefined}
                    onDragLeave={selectedDocument.status === "DRAFT" ? handleDragLeave : undefined}
                    onDrop={selectedDocument.status === "DRAFT" ? handleDrop : undefined}
                    onClick={() => selectedDocument.status === "DRAFT" && !selectedFile && document.getElementById("file-upload-view")?.click()}
                  >
                    <div className="text-center text-muted-foreground">
                      <Upload className={`h-10 w-10 mx-auto mb-3 transition-colors ${isDragging ? "text-primary" : "opacity-50"}`} />
                      <p className="font-medium">{isDragging ? "Dosyayı buraya bırakın" : "Bu dokümana henüz dosya yüklenmemiş"}</p>
                      {selectedDocument.status === "DRAFT" && (
                        <div className="mt-4">
                          <input
                            type="file"
                            id="file-upload-view"
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
                            <div className="flex items-center justify-center gap-3 mt-2 p-3 bg-muted/50 rounded-lg">
                              {getFileIcon(selectedFile.type)}
                              <div className="text-left">
                                <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                              </div>
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleFileUpload(selectedDocument.id); }}
                                disabled={uploading}
                              >
                                {uploading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Yükle
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="pointer-events-none">
                              <p className="text-sm mb-3">Dosyayı sürükleyip bırakın veya</p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="pointer-events-auto"
                                onClick={(e) => { e.stopPropagation(); document.getElementById("file-upload-view")?.click(); }}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Dosya Seç
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Dijital Onay Bilgileri - Sadece Yayınlanmış Dokümanlar İçin */}
              {selectedDocument.status === "PUBLISHED" && selectedDocument.approvals && selectedDocument.approvals.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-green-600" />
                      Dijital Onay Bilgileri
                    </h4>
                    {selectedDocument.approvals
                      .filter((approval) => approval.status === "APPROVED")
                      .map((approval) => (
                        <div key={approval.id} className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-muted-foreground text-xs">Onay Adımı</Label>
                              <p className="font-medium">{approval.stepName}</p>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-muted-foreground text-xs">Onaylayan</Label>
                              <p className="font-medium">{approval.approver?.name || approval.approver?.email}</p>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-muted-foreground text-xs">Onay Tarihi</Label>
                              <p className="font-medium">
                                {approval.signatureTimestamp
                                  ? format(new Date(approval.signatureTimestamp), "dd MMM yyyy HH:mm:ss", { locale: tr })
                                  : approval.actionDate
                                    ? format(new Date(approval.actionDate), "dd MMM yyyy HH:mm:ss", { locale: tr })
                                    : "-"
                                }
                              </p>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-muted-foreground text-xs">Doğrulama Kodu</Label>
                              <p className="font-mono text-sm">{approval.verificationCode || "-"}</p>
                            </div>
                          </div>
                          {approval.signatureHash && (
                            <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                              <Label className="text-muted-foreground text-xs">Dijital İmza (SHA-256)</Label>
                              <p className="font-mono text-xs text-muted-foreground break-all mt-1">
                                {approval.signatureHash}
                              </p>
                            </div>
                          )}
                          {approval.verificationCode && (
                            <div className="mt-3 flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`/verify/${approval.verificationCode}`, "_blank")}
                              >
                                <QrCode className="mr-2 h-4 w-4" />
                                Doğrulama Sayfası
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision History Dialog */}
      <Dialog open={isRevisionDialogOpen} onOpenChange={setIsRevisionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Revizyon Geçmişi
            </DialogTitle>
            <DialogDescription>
              {selectedDocument?.documentNumber} - {selectedDocument?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Mevcut Versiyon */}
            {selectedDocument && (
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-blue-500">v{selectedDocument.version}</Badge>
                    <span className="font-medium">Mevcut Versiyon</span>
                  </div>
                  {getStatusBadge(selectedDocument.status)}
                </div>
                {selectedDocument.fileName && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    {getFileIcon(selectedDocument.mimeType)}
                    <span>{selectedDocument.fileName}</span>
                    <span>({formatFileSize(selectedDocument.fileSize)})</span>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Geçmiş Revizyonlar */}
            <div>
              <h4 className="font-medium mb-3">Geçmiş Revizyonlar</h4>
              {revisionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : revisions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Henüz revizyon geçmişi yok</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {revisions.map((revision) => (
                      <div
                        key={revision.id}
                        className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">v{revision.version}</Badge>
                            <span className="text-sm text-muted-foreground">
                              Rev. {revision.revisionNumber}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CalendarDays className="h-4 w-4" />
                            {format(new Date(revision.createdAt), "dd MMM yyyy HH:mm", { locale: tr })}
                          </div>
                        </div>
                        <p className="text-sm mb-2">{revision.changeDescription}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            {revision.revisedBy.name}
                          </div>
                          {revision.fileName && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {getFileIcon(null)}
                              <span>{revision.fileName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRevisionDialogOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Revision Dialog */}
      <Dialog open={isNewRevisionDialogOpen} onOpenChange={setIsNewRevisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Yeni Revizyon Oluştur
            </DialogTitle>
            <DialogDescription>
              {selectedDocument?.documentNumber} - v{selectedDocument?.version} için yeni revizyon başlat
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                Yeni revizyon oluşturulduğunda doküman <strong>Taslak</strong> durumuna geçecek
                ve yeni dosya yüklemeniz gerekecektir.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="changeDescription">Değişiklik Açıklaması *</Label>
              <Textarea
                id="changeDescription"
                placeholder="Bu revizyonda yapılan değişiklikleri açıklayın..."
                rows={4}
                value={newRevisionDescription}
                onChange={(e) => setNewRevisionDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsNewRevisionDialogOpen(false)
              setNewRevisionDescription("")
            }}>
              İptal
            </Button>
            <Button onClick={handleCreateRevision} disabled={!newRevisionDescription}>
              Revizyon Başlat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog - For Quality Managers */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {approvalAction === "approve" ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Dokümanı Onayla
                </>
              ) : (
                <>
                  <X className="h-5 w-5 text-red-500" />
                  Dokümanı Reddet
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedDocument?.documentNumber} - {selectedDocument?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {approvalAction === "approve" ? (
              <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <CheckCircle className="h-4 w-4 inline mr-2" />
                  Bu dokümanı onayladığınızda <strong>Yayınlandı</strong> durumuna geçecek
                  ve tüm kullanıcılar tarafından erişilebilir olacak.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  Bu dokümanı reddettiğinizde <strong>Taslak</strong> durumuna geri dönecek.
                  Lütfen red nedenini belirtin.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="approvalComments">
                {approvalAction === "approve" ? "Onay Notu (Opsiyonel)" : "Red Nedeni *"}
              </Label>
              <Textarea
                id="approvalComments"
                placeholder={
                  approvalAction === "approve"
                    ? "Onay ile ilgili notlarınız..."
                    : "Dokümanın neden reddedildiğini açıklayın..."
                }
                rows={3}
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsApprovalDialogOpen(false)
                setApprovalComments("")
                setSelectedDocument(null)
              }}
            >
              İptal
            </Button>
            <Button
              onClick={handleApproval}
              disabled={approving || (approvalAction === "reject" && !approvalComments)}
              className={approvalAction === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
              variant={approvalAction === "reject" ? "destructive" : "default"}
            >
              {approving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : approvalAction === "approve" ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              {approvalAction === "approve" ? "Onayla" : "Reddet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
