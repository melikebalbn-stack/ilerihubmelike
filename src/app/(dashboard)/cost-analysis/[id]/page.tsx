"use client"

import { useState, useEffect, use } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { NativeSelect as Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  FileText,
  FileSpreadsheet,
  Edit,
  Trash2,
  ArrowLeft,
  Package,
  Users,
  Truck,
  MoreHorizontal,
  Calculator,
  Info,
  ChevronRight,
  Download,
  Loader2,
  TrendingUp,
  X,
  GitBranch,
  History,
  ChevronDown,
  ChevronUp,
  Eye,
  Copy,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"

type CostAnalysis = {
  id: string
  code: string
  name: string
  description: string | null
  revision: string
  revisionNumber: number
  revisionNote: string | null
  revisionDate: string
  parentId: string | null
  isLatest: boolean
  finishedWeight: number
  currency: string
  status: string
  materialCost: number
  laborCost: number
  externalCost: number
  otherCost: number
  totalCost: number
  overheadRate: number
  profitRate: number
  salesPrice: number
  pricePerKg: number
  createdAt: string
  updatedAt: string
  category: { id: string; name: string; color: string } | null
  customer: { id: string; name: string } | null
  createdBy: { id: string; name: string | null; email: string } | null
  parent: { id: string; code: string; revision: string; revisionNumber: number } | null
  materials: CostMaterial[]
  laborItems: CostLabor[]
  externalServices: CostExternalService[]
  otherCosts: CostOtherItem[]
}

type RevisionItem = {
  id: string
  code: string
  name: string
  revision: string
  revisionNumber: number
  revisionNote: string | null
  revisionDate: string
  status: string
  totalCost: number
  salesPrice: number
  currency: string
  isLatest: boolean
  createdAt: string
}

type CostMaterial = {
  id: string
  materialCode: string | null
  name: string
  specification: string | null
  category: string
  unit: string
  currency: string
  grossQuantity: number
  wasteRate: number
  netQuantity: number
  unitPrice: number
  totalPrice: number
}

type CostLabor = {
  id: string
  operationName: string
  workCenter: string | null
  laborType: string
  setupTime: number
  processTime: number
  totalTime: number
  hourlyRate: number
  totalCost: number
}

type CostExternalService = {
  id: string
  serviceName: string
  description: string | null
  unitPrice: number
  quantity: number
  totalPrice: number
}

type CostOtherItem = {
  id: string
  name: string
  description: string | null
  category: string
  unitPrice: number
  quantity: number
  totalPrice: number
}

type Machine = {
  id: string
  code: string
  name: string
  hourlyRate: number
}

const statusConfig: Record<string, { label: string; color: string }> = {
  APPROVED: { label: "Onaylı", color: "bg-green-100 text-green-700" },
  PENDING_REVIEW: { label: "İncelemede", color: "bg-blue-100 text-blue-700" },
  DRAFT: { label: "Taslak", color: "bg-yellow-100 text-yellow-700" },
  ARCHIVED: { label: "Arşiv", color: "bg-gray-100 text-gray-700" },
}

const laborTypeConfig: Record<string, { label: string; color: string }> = {
  INTERNAL: { label: "Dahili", color: "bg-green-100 text-green-700" },
  EXTERNAL: { label: "Dış Hizmet", color: "bg-orange-100 text-orange-700" },
  ASSEMBLY: { label: "Montaj", color: "bg-purple-100 text-purple-700" },
}

const costTypeConfig: Record<string, string> = {
  ASSEMBLY: "Montaj",
  FASTENERS: "Bağlantı Elemanları",
  QUALITY_CONTROL: "Kalite Kontrol",
  PACKAGING: "Paketleme",
  SHIPPING: "Nakliye",
  ENGINEERING: "Mühendislik",
  OTHER: "Diğer",
}

const formatCurrency = (value: number | string, currency: string = "EUR") => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value) || 0)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export default function CostAnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)

  const [analysis, setAnalysis] = useState<CostAnalysis | null>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  // Dialogs
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false)
  const [laborDialogOpen, setLaborDialogOpen] = useState(false)
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
  const [otherDialogOpen, setOtherDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Edit states
  const [editingMaterial, setEditingMaterial] = useState<CostMaterial | null>(null)
  const [editingLabor, setEditingLabor] = useState<CostLabor | null>(null)
  const [editingService, setEditingService] = useState<CostExternalService | null>(null)
  const [editingOther, setEditingOther] = useState<CostOtherItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string } | null>(null)

  // Catalog states
  const [catalogItems, setCatalogItems] = useState<any[]>([])
  const [catalogSearch, setCatalogSearch] = useState("")
  const [showCatalog, setShowCatalog] = useState(false)

  // Form states
  const [materialForm, setMaterialForm] = useState({
    code: "",
    name: "",
    specification: "",
    category: "RAW_MATERIAL",
    unit: "kg",
    currency: "EUR",
    quantity: "",
    wasteRate: "0",
    unitPrice: "",
  })

  const [laborForm, setLaborForm] = useState({
    operationName: "",
    workCenter: "",
    laborType: "INTERNAL",
    setupTime: "",
    processTime: "",
    hourlyRate: "",
  })

  const [serviceForm, setServiceForm] = useState({
    serviceName: "",
    description: "",
    unitPrice: "",
    quantity: "1",
  })

  const [otherForm, setOtherForm] = useState({
    itemName: "",
    costType: "OTHER",
    unitPrice: "",
    quantity: "1",
    description: "",
  })

  const loadAnalysis = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/cost-analysis/${id}`)
      if (res.ok) {
        const data = await res.json()
        setAnalysis(data)
      } else {
        toast.error("Analiz bulunamadı")
        router.push("/cost-analysis")
      }
    } catch (error) {
      console.error("Veri yükleme hatası:", error)
      toast.error("Veri yüklenirken hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const loadMachines = async () => {
    try {
      const res = await fetch("/api/cost-analysis/machines?activeOnly=true")
      if (res.ok) {
        const data = await res.json()
        setMachines(data)
      }
    } catch (error) {
      console.error("Makine listesi yükleme hatası:", error)
    }
  }

  const loadCatalog = async () => {
    const res = await fetch("/api/cost-analysis/material-catalog?activeOnly=true")
    if (res.ok) {
      const data = await res.json()
      setCatalogItems(data)
    }
  }

  useEffect(() => {
    loadAnalysis()
    loadMachines()
    loadCatalog()
  }, [id])

  // Kâr karşılaştırma: profitRate başlat ve döviz kuru yükle
  useEffect(() => {
    if (analysis) {
      setProfitRates(prev => prev.length === 0 ? [Number(analysis.profitRate)] : prev)
      if (analysis.currency !== "TRY" && !exchangeRatesLoaded) {
        fetch("/api/cost-analysis/exchange-rates?latestOnly=true")
          .then(res => res.ok ? res.json() : [])
          .then(data => {
            setExchangeRates(Array.isArray(data) ? data.map((r: any) => ({
              fromCurrency: r.fromCurrency,
              toCurrency: r.toCurrency,
              rate: Number(r.rate),
            })) : [])
            setExchangeRatesLoaded(true)
          })
          .catch(() => setExchangeRatesLoaded(true))
      }
    }
  }, [analysis?.profitRate, analysis?.currency])

  const recalculateCosts = async () => {
    try {
      const res = await fetch(`/api/cost-analysis/${id}/recalculate`, {
        method: "POST",
      })
      if (res.ok) {
        await loadAnalysis()
        toast.success("Maliyetler yeniden hesaplandı")
      }
    } catch (error) {
      console.error("Hesaplama hatası:", error)
      toast.error("Maliyetler hesaplanırken hata oluştu")
    }
  }

  const [pdfLoading, setPdfLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)

  // Kâr marjı karşılaştırma
  const [profitRates, setProfitRates] = useState<number[]>([])
  const [customRate, setCustomRate] = useState("")
  const [exchangeRates, setExchangeRates] = useState<{ fromCurrency: string; toCurrency: string; rate: number }[]>([])
  const [exchangeRatesLoaded, setExchangeRatesLoaded] = useState(false)

  // Revizyon
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false)
  const [revisionNote, setRevisionNote] = useState("")
  const [revisionLoading, setRevisionLoading] = useState(false)
  const [revisions, setRevisions] = useState<RevisionItem[]>([])
  const [revisionsOpen, setRevisionsOpen] = useState(false)
  const [revisionsLoaded, setRevisionsLoaded] = useState(false)

  const handleDownloadPDF = async () => {
    try {
      setPdfLoading(true)
      const res = await fetch(`/api/cost-analysis/${id}/pdf`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'PDF oluşturulamadı' }))
        toast.error(err.error || 'PDF oluşturulamadı')
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `Maliyet_Analizi_${analysis?.code}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('PDF raporu indirildi')
    } catch (error) {
      console.error('PDF indirme hatası:', error)
      toast.error('PDF indirilirken hata oluştu')
    } finally {
      setPdfLoading(false)
    }
  }

  const handleDownloadExcel = async () => {
    try {
      setExcelLoading(true)
      const res = await fetch(`/api/cost-analysis/${id}/excel`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Excel oluşturulamadı' }))
        toast.error(err.error || 'Excel oluşturulamadı')
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `Maliyet_Analizi_${analysis?.code}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Excel dosyası indirildi')
    } catch (error) {
      console.error('Excel indirme hatası:', error)
      toast.error('Excel indirilirken hata oluştu')
    } finally {
      setExcelLoading(false)
    }
  }

  // Revizyon işlemleri
  const loadRevisions = async () => {
    try {
      const res = await fetch(`/api/cost-analysis/${id}/revisions`)
      if (res.ok) {
        const data = await res.json()
        setRevisions(data)
        setRevisionsLoaded(true)
      }
    } catch (error) {
      console.error("Revizyonlar yüklenirken hata:", error)
    }
  }

  const handleCreateRevision = async () => {
    try {
      setRevisionLoading(true)
      const res = await fetch(`/api/cost-analysis/${id}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionNote: revisionNote.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`${data.revision} oluşturuldu`)
        setRevisionDialogOpen(false)
        setRevisionNote("")
        router.push(`/cost-analysis/${data.id}`)
      } else {
        const err = await res.json().catch(() => ({ error: "Revizyon oluşturulamadı" }))
        toast.error(err.error || "Revizyon oluşturulamadı")
      }
    } catch (error) {
      console.error("Revizyon oluşturma hatası:", error)
      toast.error("Revizyon oluşturulurken hata oluştu")
    } finally {
      setRevisionLoading(false)
    }
  }

  const toggleRevisions = () => {
    if (!revisionsOpen && !revisionsLoaded) {
      loadRevisions()
    }
    setRevisionsOpen(!revisionsOpen)
  }

  // Material operations
  const handleMaterialSubmit = async () => {
    if (!materialForm.name || !materialForm.quantity || !materialForm.unitPrice) {
      toast.error("Lütfen zorunlu alanları doldurun")
      return
    }

    try {
      const url = `/api/cost-analysis/materials/${id}`
      const method = editingMaterial ? "PUT" : "POST"

      // Map form fields to API expected fields
      const apiData = {
        materialCode: materialForm.code,
        name: materialForm.name,
        specification: materialForm.specification,
        category: materialForm.category,
        unit: materialForm.unit,
        currency: materialForm.currency,
        grossQuantity: materialForm.quantity,
        wasteRate: materialForm.wasteRate,
        unitPrice: materialForm.unitPrice,
        ...(editingMaterial && { id: editingMaterial.id })
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiData),
      })

      if (res.ok) {
        toast.success(editingMaterial ? "Malzeme güncellendi" : "Malzeme eklendi")
        setMaterialDialogOpen(false)
        setEditingMaterial(null)
        setMaterialForm({
          code: "",
          name: "",
          specification: "",
          category: "RAW_MATERIAL",
          unit: "kg",
          currency: analysis?.currency || "EUR",
          quantity: "",
          wasteRate: "0",
          unitPrice: "",
        })
        await loadAnalysis()
      } else {
        const error = await res.json()
        toast.error(error.error || "İşlem başarısız")
      }
    } catch (error) {
      toast.error("İşlem sırasında hata oluştu")
    }
  }

  // Labor operations
  const handleLaborSubmit = async () => {
    if (!laborForm.operationName || !laborForm.hourlyRate) {
      toast.error("Lütfen zorunlu alanları doldurun")
      return
    }

    try {
      const method = editingLabor ? "PUT" : "POST"
      const body = editingLabor
        ? { ...laborForm, id: editingLabor.id }
        : laborForm

      const res = await fetch(`/api/cost-analysis/labor/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingLabor ? "İşçilik güncellendi" : "İşçilik eklendi")
        setLaborDialogOpen(false)
        setEditingLabor(null)
        setLaborForm({
          operationName: "",
          workCenter: "",
          laborType: "INTERNAL",
          setupTime: "",
          processTime: "",
          hourlyRate: "",
        })
        await loadAnalysis()
      } else {
        const error = await res.json()
        toast.error(error.error || "İşlem başarısız")
      }
    } catch (error) {
      toast.error("İşlem sırasında hata oluştu")
    }
  }

  // External service operations
  const handleServiceSubmit = async () => {
    if (!serviceForm.serviceName || !serviceForm.unitPrice) {
      toast.error("Lütfen zorunlu alanları doldurun")
      return
    }

    try {
      const method = editingService ? "PUT" : "POST"
      const body = editingService
        ? { ...serviceForm, id: editingService.id }
        : serviceForm

      const res = await fetch(`/api/cost-analysis/external-services/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingService ? "Hizmet güncellendi" : "Hizmet eklendi")
        setServiceDialogOpen(false)
        setEditingService(null)
        setServiceForm({
          serviceName: "",
          description: "",
          unitPrice: "",
          quantity: "1",
        })
        await loadAnalysis()
      } else {
        const error = await res.json()
        toast.error(error.error || "İşlem başarısız")
      }
    } catch (error) {
      toast.error("İşlem sırasında hata oluştu")
    }
  }

  // Other cost operations
  const handleOtherSubmit = async () => {
    if (!otherForm.itemName || !otherForm.unitPrice) {
      toast.error("Lütfen zorunlu alanları doldurun")
      return
    }

    try {
      const method = editingOther ? "PUT" : "POST"
      const body = editingOther
        ? { ...otherForm, id: editingOther.id }
        : otherForm

      const res = await fetch(`/api/cost-analysis/other-costs/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingOther ? "Maliyet güncellendi" : "Maliyet eklendi")
        setOtherDialogOpen(false)
        setEditingOther(null)
        setOtherForm({
          itemName: "",
          costType: "OTHER",
          unitPrice: "",
          quantity: "1",
          description: "",
        })
        await loadAnalysis()
      } else {
        const error = await res.json()
        toast.error(error.error || "İşlem başarısız")
      }
    } catch (error) {
      toast.error("İşlem sırasında hata oluştu")
    }
  }

  // Delete operations
  const handleDelete = async () => {
    if (!deleteItem) return

    try {
      let url = ""
      switch (deleteItem.type) {
        case "material":
          url = `/api/cost-analysis/materials/${id}?id=${deleteItem.id}`
          break
        case "labor":
          url = `/api/cost-analysis/labor/${id}?id=${deleteItem.id}`
          break
        case "service":
          url = `/api/cost-analysis/external-services/${id}?itemId=${deleteItem.id}`
          break
        case "other":
          url = `/api/cost-analysis/other-costs/${id}?itemId=${deleteItem.id}`
          break
      }

      const res = await fetch(url, { method: "DELETE" })
      if (res.ok) {
        toast.success("Silme işlemi başarılı")
        setDeleteDialogOpen(false)
        setDeleteItem(null)
        await loadAnalysis()
      } else {
        toast.error("Silme işlemi başarısız")
      }
    } catch (error) {
      toast.error("Silme sırasında hata oluştu")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-500">Analiz bulunamadı</p>
          <Link href="/cost-analysis">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Listeye Dön
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const totalCost = Number(analysis.materialCost) + Number(analysis.laborCost) + Number(analysis.externalCost) + Number(analysis.otherCost)
  const overheadCost = totalCost * (Number(analysis.overheadRate) / 100)
  const totalWithOverhead = totalCost + overheadCost
  const profit = totalWithOverhead * (Number(analysis.profitRate) / 100)

  // Calculate percentages for cost distribution
  const materialPercent = totalCost > 0 ? (Number(analysis.materialCost) / totalCost) * 100 : 0
  const laborPercent = totalCost > 0 ? (Number(analysis.laborCost) / totalCost) * 100 : 0
  const externalPercent = totalCost > 0 ? (Number(analysis.externalCost) / totalCost) * 100 : 0
  const otherPercent = totalCost > 0 ? (Number(analysis.otherCost) / totalCost) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm">
          <Link href="/cost-analysis" className="text-teal-600 hover:underline">
            Maliyet Analizleri
          </Link>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          <span className="text-gray-600">{analysis.code} - {analysis.name}</span>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={pdfLoading}>
            {pdfLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={excelLoading}>
            {excelLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevisionDialogOpen(true)}
          >
            <GitBranch className="h-4 w-4 mr-2" />
            Yeni Revizyon
          </Button>
          <Link href={`/cost-analysis/${id}/edit`}>
            <Button size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Düzenle
            </Button>
          </Link>
        </div>
      </div>

      {/* Product Info */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-2xl font-bold text-gray-900">{analysis.name}</h2>
                <Badge className={statusConfig[analysis.status]?.color || "bg-gray-100"}>
                  {statusConfig[analysis.status]?.label || analysis.status}
                </Badge>
              </div>
              <p className="text-gray-500 mt-1">
                Ürün Kodu: <span className="font-mono font-medium">{analysis.code}</span> · Revizyon: {analysis.revision}
              </p>
              {analysis.description && (
                <p className="text-gray-600 mt-2">{analysis.description}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Müşteri</div>
              <div className="font-medium">{analysis.customer?.name || "-"}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6 pt-6 border-t">
            <div>
              <div className="text-sm text-gray-500">Bitmiş Ağırlık</div>
              <div className="text-xl font-semibold">{analysis.finishedWeight} kg</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Para Birimi</div>
              <div className="text-xl font-semibold">{analysis.currency}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Oluşturma</div>
              <div className="text-xl font-semibold">{formatDate(analysis.createdAt)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Güncelleme</div>
              <div className="text-xl font-semibold">{formatDate(analysis.updatedAt)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revizyon Geçmişi */}
      <Card>
        <CardHeader
          className="cursor-pointer py-3 px-6"
          onClick={toggleRevisions}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <History className="h-4 w-4 text-gray-500" />
              <CardTitle className="text-sm font-medium">
                Revizyon Geçmişi
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {analysis.revision}
              </Badge>
              {!analysis.isLatest && (
                <Badge className="bg-amber-100 text-amber-700 text-xs">
                  Eski Revizyon
                </Badge>
              )}
            </div>
            {revisionsOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </CardHeader>
        {revisionsOpen && (
          <CardContent className="pt-0 px-6 pb-4">
            {!revisionsLoaded ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : revisions.length <= 1 ? (
              <p className="text-sm text-gray-500 py-2">
                Henüz başka revizyon bulunmuyor.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Revizyon</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Not</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">Toplam Maliyet</TableHead>
                    <TableHead className="text-right">Satış Fiyatı</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revisions.map((rev) => (
                    <TableRow
                      key={rev.id}
                      className={rev.id === id ? "bg-teal-50" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <span className="font-mono font-medium text-sm">
                            {rev.revision}
                          </span>
                          {rev.isLatest && (
                            <Badge className="bg-teal-100 text-teal-700 text-[10px] px-1">
                              Son
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(rev.revisionDate || rev.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                        {rev.revisionNote || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            statusConfig[rev.status]?.color || "bg-gray-100"
                          }
                        >
                          {statusConfig[rev.status]?.label || rev.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(rev.totalCost, rev.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(rev.salesPrice, rev.currency)}
                      </TableCell>
                      <TableCell>
                        {rev.id !== id ? (
                          <Link href={`/cost-analysis/${rev.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-400 px-2">
                            Aktif
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}
      </Card>

      {/* Cost Summary Cards - Pastel Colors */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card
          className="bg-[#E8F4FD] border-0 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveTab("materials")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-700 font-medium">Malzeme</span>
              <span className="text-xs text-blue-600">{analysis.materials.length} kalem</span>
            </div>
            <div className="text-2xl font-bold text-blue-800">
              {formatCurrency(analysis.materialCost, analysis.currency)}
            </div>
            <div className="mt-2 h-1.5 bg-blue-200 rounded">
              <div
                className="h-1.5 bg-blue-500 rounded"
                style={{ width: `${materialPercent}%` }}
              ></div>
            </div>
            <div className="text-xs text-blue-600 mt-1">%{materialPercent.toFixed(0)}</div>
          </CardContent>
        </Card>

        <Card
          className="bg-[#E8F5E9] border-0 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveTab("labor")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-700 font-medium">İşçilik</span>
              <span className="text-xs text-green-600">{analysis.laborItems.length} operasyon</span>
            </div>
            <div className="text-2xl font-bold text-green-800">
              {formatCurrency(analysis.laborCost, analysis.currency)}
            </div>
            <div className="mt-2 h-1.5 bg-green-200 rounded">
              <div
                className="h-1.5 bg-green-500 rounded"
                style={{ width: `${laborPercent}%` }}
              ></div>
            </div>
            <div className="text-xs text-green-600 mt-1">%{laborPercent.toFixed(0)}</div>
          </CardContent>
        </Card>

        <Card
          className="bg-[#FFF3E0] border-0 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveTab("services")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-orange-700 font-medium">Dış Hizmet</span>
              <span className="text-xs text-orange-600">{analysis.externalServices.length} hizmet</span>
            </div>
            <div className="text-2xl font-bold text-orange-800">
              {formatCurrency(analysis.externalCost, analysis.currency)}
            </div>
            <div className="mt-2 h-1.5 bg-orange-200 rounded">
              <div
                className="h-1.5 bg-orange-500 rounded"
                style={{ width: `${externalPercent}%` }}
              ></div>
            </div>
            <div className="text-xs text-orange-600 mt-1">%{externalPercent.toFixed(0)}</div>
          </CardContent>
        </Card>

        <Card
          className="bg-[#F3E5F5] border-0 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveTab("other")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-700 font-medium">Diğer</span>
              <span className="text-xs text-purple-600">{analysis.otherCosts.length} kalem</span>
            </div>
            <div className="text-2xl font-bold text-purple-800">
              {formatCurrency(analysis.otherCost, analysis.currency)}
            </div>
            <div className="mt-2 h-1.5 bg-purple-200 rounded">
              <div
                className="h-1.5 bg-purple-500 rounded"
                style={{ width: `${otherPercent}%` }}
              ></div>
            </div>
            <div className="text-xs text-purple-600 mt-1">%{otherPercent.toFixed(0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-gray-500">Toplam Maliyet</span>
              <div className="text-xl sm:text-3xl font-bold text-gray-900">
                {formatCurrency(totalWithOverhead, analysis.currency)}
              </div>
            </div>
            <div className="text-center px-8 border-l border-r">
              <span className="text-gray-500">Kar Oranı</span>
              <div className="text-xl sm:text-3xl font-bold text-teal-600">%{analysis.profitRate}</div>
            </div>
            <div className="text-right">
              <span className="text-gray-500">Satış Fiyatı</span>
              <div className="text-xl sm:text-3xl font-bold text-teal-600">
                {formatCurrency(analysis.salesPrice, analysis.currency)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="materials">Malzemeler</TabsTrigger>
          <TabsTrigger value="labor">İşçilik</TabsTrigger>
          <TabsTrigger value="services">Dış Hizmetler</TabsTrigger>
          <TabsTrigger value="other">Diğer Maliyetler</TabsTrigger>
          <TabsTrigger value="profit-comparison">Kâr Karşılaştırma</TabsTrigger>
          <TabsTrigger value="summary">Maliyet Özeti</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Cost Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Maliyet Dağılımı</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Malzeme</span>
                    <span className="font-medium">{formatCurrency(analysis.materialCost, analysis.currency)} ({materialPercent.toFixed(0)}%)</span>
                  </div>
                  <div className="h-4 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${materialPercent}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">İşçilik</span>
                    <span className="font-medium">{formatCurrency(analysis.laborCost, analysis.currency)} ({laborPercent.toFixed(0)}%)</span>
                  </div>
                  <div className="h-4 bg-green-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${laborPercent}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Dış Hizmet</span>
                    <span className="font-medium">{formatCurrency(analysis.externalCost, analysis.currency)} ({externalPercent.toFixed(0)}%)</span>
                  </div>
                  <div className="h-4 bg-orange-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${externalPercent}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Diğer</span>
                    <span className="font-medium">{formatCurrency(analysis.otherCost, analysis.currency)} ({otherPercent.toFixed(0)}%)</span>
                  </div>
                  <div className="h-4 bg-purple-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${otherPercent}%` }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Price Calculator */}
            <Card className="bg-gradient-to-br from-teal-600 to-teal-800 text-white">
              <CardHeader>
                <CardTitle className="text-white opacity-90">Fiyat Hesaplama</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="opacity-80">Ara Toplam</span>
                  <span className="font-medium">{formatCurrency(totalCost, analysis.currency)}</span>
                </div>

                <div className="border-t border-teal-400 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="opacity-80">İşletme Gideri (%{analysis.overheadRate})</span>
                    <span className="font-medium">{formatCurrency(overheadCost, analysis.currency)}</span>
                  </div>
                </div>

                <div className="border-t border-teal-400 pt-4">
                  <div className="flex justify-between">
                    <span className="font-semibold">TOPLAM MALİYET</span>
                    <span className="font-bold text-xl">{formatCurrency(totalWithOverhead, analysis.currency)}</span>
                  </div>
                </div>

                <div className="border-t border-teal-400 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="opacity-80">Kar (%{analysis.profitRate})</span>
                    <span className="font-medium">{formatCurrency(profit, analysis.currency)}</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t-2 border-white">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">SATIŞ FİYATI</span>
                    <span className="text-xl lg:text-3xl font-bold">{formatCurrency(analysis.salesPrice, analysis.currency)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Unit Prices */}
          <Card>
            <CardHeader>
              <CardTitle>Birim Fiyatlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Bitmiş Ağırlık:</span>
                  <span className="font-medium">{analysis.finishedWeight} kg</span>
                </div>
                <div className="h-8 border-l" />
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">kg Başına Maliyet:</span>
                  <span className="font-medium">
                    {formatCurrency(Number(analysis.finishedWeight) > 0 ? totalWithOverhead / Number(analysis.finishedWeight) : 0, analysis.currency)}/kg
                  </span>
                </div>
                <div className="h-8 border-l" />
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">kg Başına Fiyat:</span>
                  <span className="font-bold text-teal-600 text-lg">
                    {formatCurrency(analysis.pricePerKg, analysis.currency)}/kg
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Materials Tab */}
        <TabsContent value="materials" className="space-y-6">
          {/* Guide Box */}
          <div className="bg-[#E8F4FD] rounded-lg p-5 border-l-4 border-blue-500">
            <h3 className="font-semibold text-blue-800 mb-2">Malzeme Yönetimi Kılavuzu</h3>
            <p className="text-blue-700 text-sm mb-4">Ürün maliyetinin temelini oluşturan hammadde ve yarı mamullerin takibi.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <h4 className="font-medium text-blue-800 mb-2">Malzeme Türleri</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>Hammadde:</strong> İşlenmemiş malzeme (çelik, alüminyum)</li>
                  <li>• <strong>Yarı Mamul:</strong> Önceden işlenmiş parçalar</li>
                  <li>• <strong>Satın Alınan:</strong> Hazır parçalar</li>
                  <li>• <strong>Standart:</strong> Cıvata, somun, pul vb.</li>
                </ul>
              </div>
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <h4 className="font-medium text-blue-800 mb-2">Fire Oranı Hesaplama</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Lazer kesim: %5-10 fire</li>
                  <li>• CNC işleme: %8-15 fire</li>
                  <li>• Sac kesim: %10-20 fire</li>
                  <li>• Profil: %3-5 fire</li>
                </ul>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Malzeme Listesi</CardTitle>
                  <CardDescription>{analysis.code} - {analysis.name} · {analysis.materials.length} kalem</CardDescription>
                </div>
                <Button onClick={() => {
                  setEditingMaterial(null)
                  setMaterialForm({
                    code: "",
                    name: "",
                    specification: "",
                    category: "RAW_MATERIAL",
                    unit: "kg",
                    currency: analysis.currency || "EUR",
                    quantity: "",
                    wasteRate: "0",
                    unitPrice: "",
                  })
                  setMaterialDialogOpen(true)
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Malzeme Ekle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Malzeme Kodu</TableHead>
                    <TableHead>Malzeme Adı</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Spesifikasyon</TableHead>
                    <TableHead className="text-center">Birim</TableHead>
                    <TableHead className="text-right">Miktar</TableHead>
                    <TableHead className="text-right">Fire %</TableHead>
                    <TableHead className="text-right">Birim Fiyat</TableHead>
                    <TableHead className="text-right">Toplam</TableHead>
                    <TableHead className="text-center w-24">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.materials.map((material, index) => (
                    <TableRow key={material.id}>
                      <TableCell className="text-gray-500">{index + 1}</TableCell>
                      <TableCell className="font-mono text-sm text-gray-600">{material.materialCode || "-"}</TableCell>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {material.category === "RAW_MATERIAL" ? "Hammadde" :
                           material.category === "SEMI_FINISHED" ? "Yarı Mamul" :
                           material.category === "PURCHASED_PART" ? "Satın Alınan" :
                           material.category === "STANDARD_PART" ? "Standart" :
                           material.category === "CONSUMABLE" ? "Sarf" : material.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">{material.specification || "-"}</TableCell>
                      <TableCell className="text-center">{material.unit}</TableCell>
                      <TableCell className="text-right">{Number(material.grossQuantity).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-gray-500">
                        {Number(material.wasteRate) > 0 ? `${material.wasteRate}%` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(material.unitPrice, material.currency || analysis.currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(material.totalPrice, material.currency || analysis.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingMaterial(material)
                            setMaterialForm({
                              code: material.materialCode || "",
                              name: material.name,
                              specification: material.specification || "",
                              category: material.category || "RAW_MATERIAL",
                              unit: material.unit,
                              currency: material.currency || analysis.currency || "EUR",
                              quantity: material.grossQuantity.toString(),
                              wasteRate: material.wasteRate.toString(),
                              unitPrice: material.unitPrice.toString(),
                            })
                            setMaterialDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteItem({ type: "material", id: material.id })
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {analysis.materials.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                        Henüz malzeme eklenmemiş
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {analysis.materials.length > 0 && (
                  <tfoot className="bg-[#E8F4FD]">
                    <tr>
                      <td colSpan={8} className="px-4 py-3 text-right font-semibold text-blue-800">
                        MALZEME TOPLAMI:
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-lg text-blue-800">
                        {formatCurrency(analysis.materialCost, analysis.currency)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Labor Tab */}
        <TabsContent value="labor" className="space-y-6">
          {/* Guide Box */}
          <div className="bg-[#E8F5E9] rounded-lg p-5 border-l-4 border-green-500">
            <h3 className="font-semibold text-green-800 mb-2">İşçilik Yönetimi Kılavuzu</h3>
            <p className="text-green-700 text-sm mb-4">Üretim operasyonlarının süre ve maliyet takibi.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <h4 className="font-medium text-green-800 mb-2">İşçilik Türleri</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• <strong>Dahili:</strong> Kendi tesisinde yapılan işler</li>
                  <li>• <strong>Dış Hizmet:</strong> Tedarikçide yapılan işler</li>
                  <li>• <strong>Montaj:</strong> Son montaj işçiliği</li>
                </ul>
              </div>
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <h4 className="font-medium text-green-800 mb-2">Süre Hesaplama</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• <strong>Hazırlık:</strong> Setup, kalıp değişimi</li>
                  <li>• <strong>İşlem:</strong> Aktif üretim süresi</li>
                  <li>• <strong>Toplam:</strong> Hazırlık + İşlem</li>
                </ul>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>İşçilik Listesi</CardTitle>
                  <CardDescription>{analysis.code} - {analysis.name} · {analysis.laborItems.length} operasyon</CardDescription>
                </div>
                <Button onClick={() => {
                  setEditingLabor(null)
                  setLaborForm({
                    operationName: "",
                    workCenter: "",
                    laborType: "INTERNAL",
                    setupTime: "",
                    processTime: "",
                    hourlyRate: "",
                  })
                  setLaborDialogOpen(true)
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  İşçilik Ekle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Operasyon</TableHead>
                    <TableHead>İş Merkezi</TableHead>
                    <TableHead className="text-center">Tip</TableHead>
                    <TableHead className="text-right">Hazırlık</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                    <TableHead className="text-right">Toplam</TableHead>
                    <TableHead className="text-right">Saat Ücreti</TableHead>
                    <TableHead className="text-right">Toplam</TableHead>
                    <TableHead className="text-center w-24">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.laborItems.map((labor, index) => (
                    <TableRow key={labor.id} className={labor.laborType === "EXTERNAL" ? "bg-orange-50" : ""}>
                      <TableCell className="text-gray-500">{index + 1}</TableCell>
                      <TableCell className="font-medium">{labor.operationName}</TableCell>
                      <TableCell className="text-gray-600">{labor.workCenter || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={laborTypeConfig[labor.laborType]?.color || "bg-gray-100"}>
                          {laborTypeConfig[labor.laborType]?.label || labor.laborType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {labor.laborType !== "EXTERNAL" ? `${labor.setupTime} sa` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {labor.laborType !== "EXTERNAL" ? `${labor.processTime} sa` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {labor.laborType !== "EXTERNAL" ? `${labor.totalTime} sa` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {labor.laborType !== "EXTERNAL"
                          ? formatCurrency(labor.hourlyRate, analysis.currency)
                          : "-"
                        }
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(labor.totalCost, analysis.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingLabor(labor)
                            setLaborForm({
                              operationName: labor.operationName,
                              workCenter: labor.workCenter || "",
                              laborType: labor.laborType,
                              setupTime: labor.setupTime.toString(),
                              processTime: labor.processTime.toString(),
                              hourlyRate: labor.hourlyRate.toString(),
                            })
                            setLaborDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteItem({ type: "labor", id: labor.id })
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {analysis.laborItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                        Henüz işçilik eklenmemiş
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {analysis.laborItems.length > 0 && (
                  <tfoot className="bg-[#E8F5E9]">
                    <tr>
                      <td colSpan={8} className="px-4 py-3 text-right font-semibold text-green-800">
                        İŞÇİLİK TOPLAMI:
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-lg text-green-800">
                        {formatCurrency(analysis.laborCost, analysis.currency)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* External Services Tab */}
        <TabsContent value="services" className="space-y-6">
          {/* Guide Box */}
          <div className="bg-[#FFF3E0] rounded-lg p-5 border-l-4 border-orange-500">
            <h3 className="font-semibold text-orange-800 mb-2">Dış Hizmet Yönetimi Kılavuzu</h3>
            <p className="text-orange-700 text-sm mb-4">Tedarikçilerden alınan hizmetlerin maliyet takibi.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <h4 className="font-medium text-orange-800 mb-2">Yaygın Dış Hizmetler</h4>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• <strong>Isıl İşlem:</strong> Gerilim giderme, sertleştirme</li>
                  <li>• <strong>NDT:</strong> Tahribatsız muayene</li>
                  <li>• <strong>Kaplama:</strong> Boya, galvaniz, fosfat</li>
                  <li>• <strong>İşleme:</strong> Taşlama, honlama</li>
                </ul>
              </div>
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <h4 className="font-medium text-orange-800 mb-2">Maliyet İpuçları</h4>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• Toplu sipariş indirimi isteyin</li>
                  <li>• Alternatif tedarikçi fiyatları karşılaştırın</li>
                  <li>• Nakliye maliyetlerini dahil edin</li>
                </ul>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Dış Hizmet Listesi</CardTitle>
                  <CardDescription>{analysis.code} - {analysis.name} · {analysis.externalServices.length} hizmet</CardDescription>
                </div>
                <Button onClick={() => {
                  setEditingService(null)
                  setServiceForm({
                    serviceName: "",
                    description: "",
                    unitPrice: "",
                    quantity: "1",
                  })
                  setServiceDialogOpen(true)
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Hizmet Ekle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Hizmet Adı</TableHead>
                    <TableHead>Açıklama</TableHead>
                    <TableHead className="text-right">Birim Fiyat</TableHead>
                    <TableHead className="text-right">Miktar</TableHead>
                    <TableHead className="text-right">Toplam</TableHead>
                    <TableHead className="text-center w-24">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.externalServices.map((service, index) => (
                    <TableRow key={service.id}>
                      <TableCell className="text-gray-500">{index + 1}</TableCell>
                      <TableCell className="font-medium">{service.serviceName}</TableCell>
                      <TableCell className="text-gray-600">{service.description || "-"}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(service.unitPrice, analysis.currency)}
                      </TableCell>
                      <TableCell className="text-right">{service.quantity}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(service.totalPrice, analysis.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingService(service)
                            setServiceForm({
                              serviceName: service.serviceName,
                              description: service.description || "",
                              unitPrice: service.unitPrice.toString(),
                              quantity: service.quantity.toString(),
                            })
                            setServiceDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteItem({ type: "service", id: service.id })
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {analysis.externalServices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Henüz dış hizmet eklenmemiş
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {analysis.externalServices.length > 0 && (
                  <tfoot className="bg-[#FFF3E0]">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right font-semibold text-orange-800">
                        DIŞ HİZMET TOPLAMI:
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-lg text-orange-800">
                        {formatCurrency(analysis.externalCost, analysis.currency)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other Costs Tab */}
        <TabsContent value="other" className="space-y-6">
          {/* Guide Box */}
          <div className="bg-[#F3E5F5] rounded-lg p-5 border-l-4 border-purple-500">
            <h3 className="font-semibold text-purple-800 mb-2">Diğer Maliyetler Kılavuzu</h3>
            <p className="text-purple-700 text-sm mb-4">Üretime dolaylı katkı sağlayan ek maliyet kalemleri.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <h4 className="font-medium text-purple-800 mb-2">Maliyet Kategorileri</h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• <strong>Montaj:</strong> Son montaj işçiliği</li>
                  <li>• <strong>Bağlantı Elemanları:</strong> Cıvata, somun, pul</li>
                  <li>• <strong>Kalite Kontrol:</strong> Test ve muayene</li>
                  <li>• <strong>Paketleme:</strong> Ambalaj malzemeleri</li>
                </ul>
              </div>
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <h4 className="font-medium text-purple-800 mb-2">Ek Kategoriler</h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• <strong>Nakliye:</strong> Taşıma giderleri</li>
                  <li>• <strong>Mühendislik:</strong> Tasarım ve geliştirme</li>
                  <li>• <strong>Diğer:</strong> Sınıflandırılamayan giderler</li>
                </ul>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Diğer Maliyetler</CardTitle>
                  <CardDescription>{analysis.code} - {analysis.name} · {analysis.otherCosts.length} kalem</CardDescription>
                </div>
                <Button onClick={() => {
                  setEditingOther(null)
                  setOtherForm({
                    itemName: "",
                    costType: "OTHER",
                    unitPrice: "",
                    quantity: "1",
                    description: "",
                  })
                  setOtherDialogOpen(true)
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Maliyet Ekle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Kalem Adı</TableHead>
                    <TableHead>Maliyet Türü</TableHead>
                    <TableHead className="text-right">Birim Fiyat</TableHead>
                    <TableHead className="text-right">Miktar</TableHead>
                    <TableHead className="text-right">Toplam</TableHead>
                    <TableHead className="text-center w-24">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.otherCosts.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-gray-500">{index + 1}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-gray-600">
                        {costTypeConfig[item.category] || item.category}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unitPrice, analysis.currency)}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.totalPrice, analysis.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingOther(item)
                            setOtherForm({
                              itemName: item.name,
                              costType: item.category,
                              unitPrice: item.unitPrice.toString(),
                              quantity: item.quantity.toString(),
                              description: item.description || "",
                            })
                            setOtherDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteItem({ type: "other", id: item.id })
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {analysis.otherCosts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Henüz diğer maliyet eklenmemiş
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {analysis.otherCosts.length > 0 && (
                  <tfoot className="bg-[#F3E5F5]">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right font-semibold text-purple-800">
                        DİĞER MALİYET TOPLAMI:
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-lg text-purple-800">
                        {formatCurrency(analysis.otherCost, analysis.currency)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profit Comparison Tab */}
        <TabsContent value="profit-comparison" className="space-y-6">
          {/* Quick Select */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-teal-600" />
                Kâr Oranı Seçimi
              </CardTitle>
              <CardDescription>Karşılaştırmak istediğiniz kâr oranlarını seçin veya manuel girin.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[10, 15, 20, 25, 30, 35, 40].map(rate => (
                    <Button
                      key={rate}
                      variant={profitRates.includes(rate) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setProfitRates(prev =>
                          prev.includes(rate) && prev.length > 1
                            ? prev.filter(r => r !== rate)
                            : prev.includes(rate)
                            ? prev
                            : [...prev, rate].sort((a, b) => a - b)
                        )
                      }}
                    >
                      %{rate}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Özel oran (%)"
                    value={customRate}
                    onChange={(e) => setCustomRate(e.target.value)}
                    className="w-40"
                    min="0"
                    max="100"
                    step="0.5"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const rate = parseFloat(customRate)
                      if (!isNaN(rate) && rate >= 0 && rate <= 100 && !profitRates.includes(rate)) {
                        setProfitRates(prev => [...prev, rate].sort((a, b) => a - b))
                        setCustomRate("")
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ekle
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setProfitRates(analysis ? [Number(analysis.profitRate)] : [])}
                  >
                    Sıfırla
                  </Button>
                </div>
                {/* Selected rates badges */}
                <div className="flex flex-wrap gap-1">
                  {profitRates.map((rate, idx) => (
                    <Badge key={rate} variant={idx === 0 ? "default" : "secondary"} className="gap-1">
                      %{rate}{idx === 0 ? " (baz)" : ""}
                      {profitRates.length > 1 && (
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setProfitRates(prev => prev.filter(r => r !== rate))}
                        />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Table */}
          {profitRates.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Karşılaştırma Tablosu</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const baseRate = profitRates[0]
                    const baseSales = totalWithOverhead * (1 + baseRate / 100)
                    const exTlRate = exchangeRates.find(
                      r => r.fromCurrency === analysis?.currency && r.toCurrency === "TRY"
                    )?.rate || 0
                    const rows = [
                      {
                        "Kalem": "Toplam Maliyet",
                        ...Object.fromEntries(profitRates.map(r => [`%${r} Kâr`, Number(totalWithOverhead.toFixed(2))]))
                      },
                      {
                        "Kalem": "Kâr Tutarı",
                        ...Object.fromEntries(profitRates.map(r => [`%${r} Kâr`, Number((totalWithOverhead * r / 100).toFixed(2))]))
                      },
                      {
                        "Kalem": "Satış Fiyatı",
                        ...Object.fromEntries(profitRates.map(r => [`%${r} Kâr`, Number((totalWithOverhead * (1 + r / 100)).toFixed(2))]))
                      },
                      {
                        "Kalem": "Birim Fiyat (kg)",
                        ...Object.fromEntries(profitRates.map(r => {
                          const sp = totalWithOverhead * (1 + r / 100)
                          const w = Number(analysis?.finishedWeight) || 0
                          return [`%${r} Kâr`, w > 0 ? Number((sp / w).toFixed(2)) : 0]
                        }))
                      },
                      ...(exTlRate > 0 ? [{
                        "Kalem": "TL Karşılığı",
                        ...Object.fromEntries(profitRates.map(r => [`%${r} Kâr`, Number((totalWithOverhead * (1 + r / 100) * exTlRate).toFixed(2))]))
                      }] : []),
                      {
                        "Kalem": "Fark (baz'a göre)",
                        ...Object.fromEntries(profitRates.map((r, i) => {
                          const sp = totalWithOverhead * (1 + r / 100)
                          return [`%${r} Kâr`, i === 0 ? "-" : Number((sp - baseSales).toFixed(2))]
                        }))
                      },
                      {
                        "Kalem": "Fark %",
                        ...Object.fromEntries(profitRates.map((r, i) => {
                          const sp = totalWithOverhead * (1 + r / 100)
                          return [`%${r} Kâr`, i === 0 ? "-" : `%${((sp - baseSales) / baseSales * 100).toFixed(1)}`]
                        }))
                      },
                    ]
                    const ws = XLSX.utils.json_to_sheet(rows)
                    ws["!cols"] = [{ wch: 22 }, ...profitRates.map(() => ({ wch: 18 }))]
                    const wb = XLSX.utils.book_new()
                    XLSX.utils.book_append_sheet(wb, ws, "Kâr Karşılaştırma")
                    XLSX.writeFile(wb, `Kar_Karsilastirma_${analysis?.code || "analiz"}.xlsx`)
                    toast.success("Excel dosyası indirildi")
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel'e Aktar
                </Button>
              </CardHeader>
              <CardContent>
                {(() => {
                  const baseRate = profitRates[0]
                  const baseSalesPrice = totalWithOverhead * (1 + baseRate / 100)
                  const tlRate = exchangeRates.find(
                    r => r.fromCurrency === analysis?.currency && r.toCurrency === "TRY"
                  )?.rate || 0
                  const weight = Number(analysis?.finishedWeight) || 0

                  return (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[160px]">Kalem</TableHead>
                            {profitRates.map((rate, idx) => (
                              <TableHead key={rate} className={`text-right min-w-[130px] ${idx === 0 ? "bg-teal-50" : ""}`}>
                                %{rate} Kâr{idx === 0 ? " (baz)" : ""}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Toplam Maliyet */}
                          <TableRow>
                            <TableCell className="font-medium">Toplam Maliyet</TableCell>
                            {profitRates.map((_, idx) => (
                              <TableCell key={idx} className={`text-right ${idx === 0 ? "bg-teal-50" : ""}`}>
                                {formatCurrency(totalWithOverhead, analysis?.currency || "EUR")}
                              </TableCell>
                            ))}
                          </TableRow>
                          {/* Kâr Tutarı */}
                          <TableRow>
                            <TableCell className="font-medium">Kâr Tutarı</TableCell>
                            {profitRates.map((rate, idx) => (
                              <TableCell key={rate} className={`text-right ${idx === 0 ? "bg-teal-50" : ""}`}>
                                {formatCurrency(totalWithOverhead * rate / 100, analysis?.currency || "EUR")}
                              </TableCell>
                            ))}
                          </TableRow>
                          {/* Satış Fiyatı */}
                          <TableRow className="border-t-2 bg-gray-50 font-bold">
                            <TableCell className="font-bold">Satış Fiyatı</TableCell>
                            {profitRates.map((rate, idx) => {
                              const sp = totalWithOverhead * (1 + rate / 100)
                              return (
                                <TableCell key={rate} className={`text-right font-bold text-lg ${idx === 0 ? "bg-teal-100 text-teal-700" : ""}`}>
                                  {formatCurrency(sp, analysis?.currency || "EUR")}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                          {/* Birim Fiyat (kg) */}
                          <TableRow>
                            <TableCell className="font-medium">Birim Fiyat (kg)</TableCell>
                            {profitRates.map((rate, idx) => {
                              const sp = totalWithOverhead * (1 + rate / 100)
                              return (
                                <TableCell key={rate} className={`text-right ${idx === 0 ? "bg-teal-50" : ""}`}>
                                  {weight > 0 ? `${formatCurrency(sp / weight, analysis?.currency || "EUR")}/kg` : "-"}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                          {/* TL Karşılığı */}
                          {analysis?.currency !== "TRY" && tlRate > 0 && (
                            <TableRow className="border-t">
                              <TableCell className="font-medium">
                                TL Karşılığı
                                <span className="text-xs text-muted-foreground ml-1">(1 {analysis?.currency} = {tlRate.toFixed(4)} ₺)</span>
                              </TableCell>
                              {profitRates.map((rate, idx) => {
                                const sp = totalWithOverhead * (1 + rate / 100)
                                return (
                                  <TableCell key={rate} className={`text-right ${idx === 0 ? "bg-teal-50" : ""}`}>
                                    {formatCurrency(sp * tlRate, "TRY")}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          )}
                          {analysis?.currency !== "TRY" && !tlRate && exchangeRatesLoaded && (
                            <TableRow className="border-t">
                              <TableCell className="font-medium text-amber-600">TL Karşılığı</TableCell>
                              <TableCell colSpan={profitRates.length} className="text-center text-amber-600 text-sm">
                                Döviz kuru bilgisi bulunamadı. Ayarlar sayfasından kur ekleyebilirsiniz.
                              </TableCell>
                            </TableRow>
                          )}
                          {/* Separator */}
                          <TableRow className="border-t-2">
                            <TableCell className="font-medium text-gray-500">Fark (baz'a göre)</TableCell>
                            {profitRates.map((rate, idx) => {
                              if (idx === 0) return <TableCell key={rate} className="text-right text-gray-400 bg-teal-50">(baz)</TableCell>
                              const sp = totalWithOverhead * (1 + rate / 100)
                              const diff = sp - baseSalesPrice
                              return (
                                <TableCell key={rate} className={`text-right ${diff > 0 ? "text-green-600" : "text-red-600"}`}>
                                  {diff > 0 ? "+" : ""}{formatCurrency(diff, analysis?.currency || "EUR")}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium text-gray-500">Fark %</TableCell>
                            {profitRates.map((rate, idx) => {
                              if (idx === 0) return <TableCell key={rate} className="text-right text-gray-400 bg-teal-50">(baz)</TableCell>
                              const sp = totalWithOverhead * (1 + rate / 100)
                              const diffPct = baseSalesPrice > 0 ? ((sp - baseSalesPrice) / baseSalesPrice) * 100 : 0
                              return (
                                <TableCell key={rate} className={`text-right font-medium ${diffPct > 0 ? "text-green-600" : "text-red-600"}`}>
                                  {diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-6">
          {/* Guide Box */}
          <div className="bg-[#E0F2F1] rounded-lg p-5 border-l-4 border-teal-500">
            <h3 className="font-semibold text-teal-800 mb-2">Maliyet Hesaplama Kılavuzu</h3>
            <p className="text-teal-700 text-sm mb-4">Should-Cost analizi ve fiyatlandırma metodolojisi hakkında bilgi.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <h4 className="font-medium text-teal-800 mb-2">Maliyet Bileşenleri</h4>
                <ul className="text-sm text-teal-700 space-y-1">
                  <li>• Direkt Malzeme</li>
                  <li>• Direkt İşçilik</li>
                  <li>• Dış Hizmetler</li>
                  <li>• Genel Giderler</li>
                </ul>
              </div>
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <h4 className="font-medium text-teal-800 mb-2">İşletme Gideri</h4>
                <ul className="text-sm text-teal-700 space-y-1">
                  <li>• Standart oran: %20-30</li>
                  <li>• Kira, enerji, sigorta</li>
                  <li>• Yönetim giderleri</li>
                  <li>• Amortisman</li>
                </ul>
              </div>
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <h4 className="font-medium text-teal-800 mb-2">Kar Marjı</h4>
                <ul className="text-sm text-teal-700 space-y-1">
                  <li>• Savunma sanayi: %15-25</li>
                  <li>• Özel projeler: %20-40</li>
                  <li>• Risk faktörü dahil</li>
                  <li>• Pazar koşullarına göre</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Cost Detail */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Maliyet Detayı</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-gray-600">Malzeme Toplamı</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(analysis.materialCost, analysis.currency)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-gray-600">İşçilik Toplamı</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(analysis.laborCost, analysis.currency)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-gray-600">Dış Hizmetler</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(analysis.externalCost, analysis.currency)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-gray-600">Diğer Maliyetler</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(analysis.otherCost, analysis.currency)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-semibold">ARA TOPLAM</TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {formatCurrency(totalCost, analysis.currency)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-gray-600">İşletme Gideri (%{analysis.overheadRate})</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(overheadCost, analysis.currency)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 bg-gray-50">
                      <TableCell className="font-bold">TOPLAM MALİYET</TableCell>
                      <TableCell className="text-right font-bold text-xl">
                        {formatCurrency(totalWithOverhead, analysis.currency)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-gray-600">Kar (%{analysis.profitRate})</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(profit, analysis.currency)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 bg-teal-50">
                      <TableCell className="font-bold text-teal-800">SATIŞ FİYATI</TableCell>
                      <TableCell className="text-right font-bold text-2xl text-teal-600">
                        {formatCurrency(analysis.salesPrice, analysis.currency)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Birim Fiyatlar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bitmiş Ağırlık</span>
                    <span className="font-medium">{analysis.finishedWeight} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">kg Başına Maliyet</span>
                    <span className="font-medium">
                      {formatCurrency(Number(analysis.finishedWeight) > 0 ? totalWithOverhead / Number(analysis.finishedWeight) : 0, analysis.currency)}/kg
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-gray-600">kg Başına Fiyat</span>
                    <span className="font-bold text-teal-600 text-lg">
                      {formatCurrency(analysis.pricePerKg, analysis.currency)}/kg
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>İşlemler</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={handleDownloadPDF} disabled={pdfLoading}>
                    {pdfLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    PDF Rapor İndir
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={handleDownloadExcel} disabled={excelLoading}>
                    {excelLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    Excel'e Aktar
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={recalculateCosts}>
                    <Calculator className="h-4 w-4 mr-2" />
                    Yeniden Hesapla
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Material Dialog */}
      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMaterial ? "Malzeme Düzenle" : "Yeni Malzeme"}</DialogTitle>
            <DialogDescription>
              Malzeme bilgilerini girin
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Katalogdan Seç */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={showCatalog ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowCatalog(!showCatalog)}
                >
                  <Package className="h-4 w-4 mr-1" />
                  Katalogdan Seç
                </Button>
                <span className="text-xs text-gray-400">veya aşağıdan manuel girin</span>
              </div>
              {showCatalog && (
                <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  <Input
                    placeholder="Malzeme ara..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {catalogItems
                      .filter(item =>
                        item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                        item.code.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                        (item.specification || "").toLowerCase().includes(catalogSearch.toLowerCase())
                      )
                      .map(item => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 hover:bg-blue-50 rounded cursor-pointer text-sm"
                          onClick={() => {
                            setMaterialForm({
                              ...materialForm,
                              code: item.code,
                              name: item.name,
                              specification: item.specification || "",
                              category: item.category,
                              unit: item.unit,
                              currency: item.currency || analysis.currency || "EUR",
                              unitPrice: String(item.unitPrice),
                              // keep quantity and wasteRate as user enters
                            })
                            setShowCatalog(false)
                            setCatalogSearch("")
                            toast.success(`"${item.name}" katalogdan seçildi`)
                          }}
                        >
                          <div>
                            <span className="font-mono text-xs text-teal-600 mr-2">{item.code}</span>
                            <span className="font-medium">{item.name}</span>
                            {item.specification && (
                              <span className="text-gray-400 ml-2 text-xs">{item.specification}</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {Number(item.unitPrice).toFixed(2)} {item.currency}
                          </span>
                        </div>
                      ))}
                    {catalogItems.filter(item =>
                      item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                      item.code.toLowerCase().includes(catalogSearch.toLowerCase())
                    ).length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">Sonuç bulunamadı</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Malzeme Kodu</Label>
                <Input
                  value={materialForm.code}
                  onChange={(e) => setMaterialForm({ ...materialForm, code: e.target.value })}
                  placeholder="MAL-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Malzeme Adı *</Label>
                <Input
                  value={materialForm.name}
                  onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                  placeholder="ST 52 Profil"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Spesifikasyon</Label>
                <Input
                  value={materialForm.specification}
                  onChange={(e) => setMaterialForm({ ...materialForm, specification: e.target.value })}
                  placeholder="120x80x6 mm"
                />
              </div>
              <div className="space-y-2">
                <Label>Malzeme Türü *</Label>
                <Select
                  value={materialForm.category}
                  onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })}
                >
                  <option value="RAW_MATERIAL">Hammadde</option>
                  <option value="SEMI_FINISHED">Yarı Mamul</option>
                  <option value="PURCHASED_PART">Satın Alınan Parça</option>
                  <option value="STANDARD_PART">Standart Parça</option>
                  <option value="CONSUMABLE">Sarf Malzeme</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Birim</Label>
                <Select
                  value={materialForm.unit}
                  onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                >
                  <option value="kg">kg</option>
                  <option value="adet">adet</option>
                  <option value="set">set</option>
                  <option value="mt">mt</option>
                  <option value="m2">m²</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Miktar *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={materialForm.quantity}
                  onChange={(e) => setMaterialForm({ ...materialForm, quantity: e.target.value })}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label>Fire Oranı %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={materialForm.wasteRate}
                  onChange={(e) => setMaterialForm({ ...materialForm, wasteRate: e.target.value })}
                  placeholder="5"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Birim Fiyat *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={materialForm.unitPrice}
                  onChange={(e) => setMaterialForm({ ...materialForm, unitPrice: e.target.value })}
                  placeholder="2.50"
                />
              </div>
              <div className="space-y-2">
                <Label>Para Birimi</Label>
                <Select
                  value={materialForm.currency}
                  onChange={(e) => setMaterialForm({ ...materialForm, currency: e.target.value })}
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="TRY">TRY (₺)</option>
                  <option value="GBP">GBP (£)</option>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleMaterialSubmit}>
              {editingMaterial ? "Güncelle" : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Labor Dialog */}
      <Dialog open={laborDialogOpen} onOpenChange={setLaborDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLabor ? "İşçilik Düzenle" : "Yeni İşçilik"}</DialogTitle>
            <DialogDescription>
              İşçilik bilgilerini girin
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Operasyon Adı *</Label>
                <Input
                  value={laborForm.operationName}
                  onChange={(e) => setLaborForm({ ...laborForm, operationName: e.target.value })}
                  placeholder="CNC İşleme"
                />
              </div>
              <div className="space-y-2">
                <Label>İşçilik Tipi</Label>
                <Select
                  value={laborForm.laborType}
                  onChange={(e) => setLaborForm({ ...laborForm, laborType: e.target.value })}
                >
                  <option value="INTERNAL">Dahili</option>
                  <option value="EXTERNAL">Dış Hizmet</option>
                  <option value="ASSEMBLY">Montaj</option>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>İş Merkezi</Label>
              <Select
                value={laborForm.workCenter}
                onChange={(e) => {
                  const machine = machines.find(m => m.code === e.target.value)
                  setLaborForm({
                    ...laborForm,
                    workCenter: e.target.value,
                    hourlyRate: machine ? machine.hourlyRate.toString() : laborForm.hourlyRate
                  })
                }}
              >
                <option value="">Seçiniz</option>
                {machines.map((machine) => (
                  <option key={machine.id} value={machine.code}>
                    {machine.code} - {machine.name} ({machine.hourlyRate} €/sa)
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Hazırlık Süresi (sa)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={laborForm.setupTime}
                  onChange={(e) => setLaborForm({ ...laborForm, setupTime: e.target.value })}
                  placeholder="0.5"
                />
              </div>
              <div className="space-y-2">
                <Label>İşlem Süresi (sa)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={laborForm.processTime}
                  onChange={(e) => setLaborForm({ ...laborForm, processTime: e.target.value })}
                  placeholder="7.5"
                />
              </div>
              <div className="space-y-2">
                <Label>Saat Ücreti *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={laborForm.hourlyRate}
                  onChange={(e) => setLaborForm({ ...laborForm, hourlyRate: e.target.value })}
                  placeholder="45"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaborDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleLaborSubmit}>
              {editingLabor ? "Güncelle" : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingService ? "Hizmet Düzenle" : "Yeni Dış Hizmet"}</DialogTitle>
            <DialogDescription>
              Dış hizmet bilgilerini girin
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Hizmet Adı *</Label>
              <Input
                value={serviceForm.serviceName}
                onChange={(e) => setServiceForm({ ...serviceForm, serviceName: e.target.value })}
                placeholder="Gerilim Giderme"
              />
            </div>
            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Input
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                placeholder="Isıl işlem + NDT"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Birim Fiyat *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={serviceForm.unitPrice}
                  onChange={(e) => setServiceForm({ ...serviceForm, unitPrice: e.target.value })}
                  placeholder="5000"
                />
              </div>
              <div className="space-y-2">
                <Label>Miktar</Label>
                <Input
                  type="number"
                  step="1"
                  value={serviceForm.quantity}
                  onChange={(e) => setServiceForm({ ...serviceForm, quantity: e.target.value })}
                  placeholder="1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleServiceSubmit}>
              {editingService ? "Güncelle" : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Other Cost Dialog */}
      <Dialog open={otherDialogOpen} onOpenChange={setOtherDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOther ? "Maliyet Düzenle" : "Yeni Diğer Maliyet"}</DialogTitle>
            <DialogDescription>
              Diğer maliyet kalemini girin
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Kalem Adı *</Label>
              <Input
                value={otherForm.itemName}
                onChange={(e) => setOtherForm({ ...otherForm, itemName: e.target.value })}
                placeholder="Nakliye"
              />
            </div>
            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Input
                value={otherForm.description}
                onChange={(e) => setOtherForm({ ...otherForm, description: e.target.value })}
                placeholder="Maliyet kalemi açıklaması"
              />
            </div>
            <div className="space-y-2">
              <Label>Maliyet Türü</Label>
              <Select
                value={otherForm.costType}
                onChange={(e) => setOtherForm({ ...otherForm, costType: e.target.value })}
              >
                <option value="ASSEMBLY_LABOR">Montaj</option>
                <option value="CONNECTION_PARTS">Bağlantı Elemanları</option>
                <option value="QUALITY_CONTROL">Kalite Kontrol</option>
                <option value="PACKAGING">Paketleme</option>
                <option value="TRANSPORT">Nakliye</option>
                <option value="ENGINEERING">Mühendislik</option>
                <option value="TOOLING">Takım/Kalıp</option>
                <option value="CERTIFICATION">Sertifikasyon</option>
                <option value="OTHER">Diğer</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Birim Fiyat *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={otherForm.unitPrice}
                  onChange={(e) => setOtherForm({ ...otherForm, unitPrice: e.target.value })}
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label>Miktar</Label>
                <Input
                  type="number"
                  step="1"
                  value={otherForm.quantity}
                  onChange={(e) => setOtherForm({ ...otherForm, quantity: e.target.value })}
                  placeholder="1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtherDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleOtherSubmit}>
              {editingOther ? "Güncelle" : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Silme Onayı</DialogTitle>
            <DialogDescription>
              Bu öğeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revizyon Oluşturma Dialog */}
      <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Revizyon Oluştur</DialogTitle>
            <DialogDescription>
              Mevcut analizin tüm verileri kopyalanarak yeni bir revizyon oluşturulacaktır.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-500">Mevcut Revizyon</Label>
                <div className="mt-1 font-mono font-medium text-lg">
                  {analysis.revision}
                </div>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Yeni Revizyon</Label>
                <div className="mt-1 font-mono font-medium text-lg text-teal-600">
                  Rev.{String((analysis.revisionNumber || 0) + 1).padStart(2, "0")}
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="revisionNote">Revizyon Notu</Label>
              <Textarea
                id="revisionNote"
                placeholder="Bu revizyonda yapılan değişiklikleri açıklayın..."
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
              <div className="flex items-start space-x-2">
                <Copy className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Tüm veriler kopyalanacaktır</p>
                  <p className="text-amber-600 mt-1">
                    Malzemeler ({analysis.materials.length}), İşçilik ({analysis.laborItems.length}),
                    Dış Hizmetler ({analysis.externalServices.length}), Diğer Maliyetler ({analysis.otherCosts.length})
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRevisionDialogOpen(false)
                setRevisionNote("")
              }}
              disabled={revisionLoading}
            >
              İptal
            </Button>
            <Button onClick={handleCreateRevision} disabled={revisionLoading}>
              {revisionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <GitBranch className="h-4 w-4 mr-2" />
              )}
              Revizyon Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
