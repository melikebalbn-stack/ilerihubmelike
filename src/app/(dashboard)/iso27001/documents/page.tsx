"use client"

import { useState, useEffect } from "react"
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

// Kategori bilgileri
const CATEGORIES = [
  { value: "MANDATORY", label: "Zorunlu Dokumanlar", description: "Madde 4-10 kapsamindaki zorunlu dokumanlar" },
  { value: "RECORD", label: "Zorunlu Kayitlar", description: "Egitim, denetim, gozden gecirme kayitlari" },
  { value: "ANNEX_A", label: "Annex A Dokumanlari", description: "93 kontrol ile ilgili dokumanlar" },
  { value: "POLICY", label: "Politikalar", description: "Bilgi guvenligi politikalari" },
  { value: "PROCEDURE", label: "Prosedurler", description: "Is surecleri ve prosedurler" },
  { value: "GUIDELINE", label: "Kilavuzlar", description: "Uygulama kilavuzlari" },
  { value: "FORM", label: "Formlar", description: "Standart formlar ve sablonlar" },
  { value: "OTHER", label: "Diger", description: "Diger dokumanlar" },
]

// Durum bilgileri
const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: "Taslak", color: "bg-gray-100 text-gray-800", icon: FileText },
  PENDING_APPROVAL: { label: "Onay Bekliyor", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  APPROVED: { label: "Onayli", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  PUBLISHED: { label: "Yayinda", color: "bg-blue-100 text-blue-800", icon: FileCheck },
  UNDER_REVIEW: { label: "Gozden Geciriliyor", color: "bg-purple-100 text-purple-800", icon: Eye },
  OBSOLETE: { label: "Gecersiz", color: "bg-red-100 text-red-800", icon: AlertCircle },
  ARCHIVED: { label: "Arsivlenmis", color: "bg-gray-100 text-gray-500", icon: FileText },
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
      console.error("Dokumanlar yuklenemedi:", error)
      toast.error("Dokumanlar yuklenemedi")
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
      toast.error("Dosya, baslik ve kategori zorunludur")
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
        toast.success("Dokuman basariyla yuklendi")
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
        toast.error(error.error || "Yukleme basarisiz")
      }
    } catch (error) {
      console.error("Yukleme hatasi:", error)
      toast.error("Yukleme sirasinda hata olustu")
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
        toast.success("Dokuman onaylandi")
        fetchDocuments()
      } else {
        const error = await res.json()
        toast.error(error.error || "Onaylama basarisiz")
      }
    } catch (error) {
      console.error("Onaylama hatasi:", error)
      toast.error("Onaylama sirasinda hata olustu")
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
        toast.success("Dokuman yayina alindi")
        fetchDocuments()
      } else {
        const error = await res.json()
        toast.error(error.error || "Yayinlama basarisiz")
      }
    } catch (error) {
      console.error("Yayinlama hatasi:", error)
      toast.error("Yayinlama sirasinda hata olustu")
    }
  }

  // Doküman silme
  const handleDelete = async (id: string) => {
    if (!confirm("Bu dokumani silmek istediginizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/iso27001/documents/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Dokuman silindi")
        fetchDocuments()
      } else {
        const error = await res.json()
        toast.error(error.error || "Silme basarisiz")
      }
    } catch (error) {
      console.error("Silme hatasi:", error)
      toast.error("Silme sirasinda hata olustu")
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
            <p className="font-medium">Dokuman imzalandi!</p>
            <p className="text-sm">Imza Kodu: <span className="font-mono">{data.signature.signatureCode}</span></p>
          </div>
        )
        setIsSignDialogOpen(false)
        fetchDocuments()
      } else {
        toast.error(data.error || "Imzalama basarisiz")
      }
    } catch (error) {
      console.error("Imzalama hatasi:", error)
      toast.error("Imzalama sirasinda hata olustu")
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
      console.error("Imzalar alinamadi:", error)
      toast.error("Imzalar alinamadi")
    } finally {
      setLoadingSignatures(false)
    }
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
      console.error("Indirme hatasi:", error)
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
            Dokuman Yonetimi
          </h1>
          <p className="text-muted-foreground">
            ISO 27001 zorunlu dokumanlar ve kayitlar
          </p>
        </div>
        <Button onClick={() => setIsUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Dokuman Yukle
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
                  placeholder="Dokuman ara..."
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
                <SelectItem value="all">Tum Kategoriler</SelectItem>
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
                <SelectItem value="all">Tum Durumlar</SelectItem>
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
            <p className="text-sm text-muted-foreground">Toplam Dokuman</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {documents.filter(d => d.status === "APPROVED" || d.status === "PUBLISHED").length}
            </div>
            <p className="text-sm text-muted-foreground">Onayli</p>
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
            <p className="text-sm text-muted-foreground">Gozden Gecirme Yaklasan</p>
          </CardContent>
        </Card>
      </div>

      {/* Doküman Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle>Dokumanlar</CardTitle>
          <CardDescription>
            Tum ISO 27001 dokumanlari ve kayitlari
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Yukleniyor...</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Henuz dokuman bulunmuyor. Yeni dokuman yuklemek icin yukardaki butonu kullanin.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dokuman No</TableHead>
                  <TableHead>Baslik</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Versiyon</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Sahip</TableHead>
                  <TableHead>Gozden Gecirme</TableHead>
                  <TableHead className="text-right">Islemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const status = STATUS_MAP[doc.status] || STATUS_MAP.DRAFT
                  const StatusIcon = status.icon
                  const isReviewSoon = doc.nextReviewDate &&
                    Math.ceil((new Date(doc.nextReviewDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 30

                  return (
                    <TableRow key={doc.id}>
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
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <a href={doc.fileUrl.startsWith("/api/") ? doc.fileUrl : `/api/files${doc.fileUrl}`} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4 mr-2" />
                                Goruntule
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(doc)}>
                              <Download className="h-4 w-4 mr-2" />
                              Indir
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
                                Yayinla
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleSign(doc.id, doc.title)}>
                              <PenTool className="h-4 w-4 mr-2" />
                              Imzala
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewSignatures(doc.id, doc.title)}>
                              <FileCheck className="h-4 w-4 mr-2" />
                              Imzalari Gor ({doc._count?.signatures || 0})
                            </DropdownMenuItem>
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
            <DialogTitle>Yeni Dokuman Yukle</DialogTitle>
            <DialogDescription>
              ISO 27001 kapsaminda yeni bir dokuman yukleyin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Dosya Seçimi */}
            <div className="space-y-2">
              <Label>Dosya *</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                {uploadForm.file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{uploadForm.file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(uploadForm.file.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadForm(prev => ({ ...prev, file: null }))}
                    >
                      Degistir
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Dosya secmek icin tiklayin veya surukleyin
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
              <Label htmlFor="title">Baslik *</Label>
              <Input
                id="title"
                value={uploadForm.title}
                onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Dokuman basligi"
              />
            </div>

            {/* Açıklama */}
            <div className="space-y-2">
              <Label htmlFor="description">Aciklama</Label>
              <Textarea
                id="description"
                value={uploadForm.description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Dokuman hakkinda kisa aciklama"
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
                    <SelectValue placeholder="Kategori secin" />
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
                <Label htmlFor="clause">Ilgili Madde</Label>
                <Input
                  id="clause"
                  value={uploadForm.clause}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, clause: e.target.value }))}
                  placeholder="Ornek: 6.1.2, A.5.1"
                />
              </div>
            </div>

            {/* Gözden Geçirme Süresi */}
            <div className="space-y-2">
              <Label>Gozden Gecirme Periyodu</Label>
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
                  <SelectItem value="365">1 Yil</SelectItem>
                  <SelectItem value="730">2 Yil</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Iptal
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? "Yukleniyor..." : "Yukle"}
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
              Dokuman Imzala
            </DialogTitle>
            <DialogDescription>
              {signingDocTitle}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Imza Turu</Label>
              <Select value={signatureType} onValueChange={setSignatureType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVAL">Onay Imzasi</SelectItem>
                  <SelectItem value="REVIEW">Gozden Gecirme Imzasi</SelectItem>
                  <SelectItem value="ACKNOWLEDGEMENT">Bilgi Alma Imzasi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notlar (Opsiyonel)</Label>
              <Textarea
                value={signatureNotes}
                onChange={(e) => setSignatureNotes(e.target.value)}
                placeholder="Imza ile ilgili notlariniz..."
                rows={3}
              />
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Dikkat:</strong> Bu islemi gerceklestirdiginizde, dijital imzaniz olusturulacak
                ve benzersiz bir imza kodu atanacaktir. Imzaniz, IP adresiniz ve tarih bilgisi ile birlikte kaydedilecektir.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSignDialogOpen(false)}>
              Iptal
            </Button>
            <Button onClick={handleSubmitSign} disabled={signing}>
              {signing ? "Imzalaniyor..." : "Imzala"}
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
              Dokuman Imzalari
            </DialogTitle>
            <DialogDescription>
              {signingDocTitle}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto">
            {loadingSignatures ? (
              <div className="text-center py-8 text-muted-foreground">Yukleniyor...</div>
            ) : signatures.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Bu dokumanda henuz imza bulunmuyor.
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
                        <span className="text-muted-foreground">Unvan:</span> {sig.signerTitle || "-"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Departman:</span> {sig.signerDepartment || "-"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Imza Turu:</span>{" "}
                        {sig.signatureType === "APPROVAL" ? "Onay" :
                         sig.signatureType === "REVIEW" ? "Gozden Gecirme" : "Bilgi Alma"}
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
                      {sig.isVerified ? "Dogrulanmis Imza" : "Imza Bekleniyor"}
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
    </div>
  )
}
