"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect as Select } from "@/components/ui/select"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Search, Filter, Calendar, AlertCircle, CheckCircle2, Clock, Pencil, Trash2, Download, Upload, FileText, Trash, UserX, ArrowUpDown, ArrowUp, ArrowDown, History, Settings2, Wrench, Ban, Coins, Building2, Beaker, XCircle } from "lucide-react"
import * as XLSX from 'xlsx'
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { UserSearchCombobox } from "@/components/user-search-combobox"

// TL ikonu (lucide'da yok)
const TLIcon = ({ className }: { className?: string }) => (
  <span className={`font-bold ${className}`}>₺</span>
)

type CalibrationDevice = {
  id: string
  deviceId: string
  name: string
  type: string
  calibrationType?: string | null
  manufacturer?: string | null
  model?: string | null
  serialNumber?: string | null
  location?: string | null
  department?: string | null
  responsiblePerson?: string | null
  responsiblePersonEmail?: string | null
  calibrationInterval: number
  lastCalibrationDate: string
  nextCalibrationDate: string
  plannedCalibrationDate?: string | null
  verificationInterval?: number | null
  lastVerificationDate?: string | null
  nextVerificationDate?: string | null
  plannedVerificationDate?: string | null
  certificateNumber?: string | null
  status: string
  statusManualOverride?: boolean
  deviceCondition?: string | null
  calibrationSentDate?: string | null
  calibrationReturnDate?: string | null
  scrapDate?: string | null
  scrapDescription?: string | null
  notes?: string | null
  imageUrl?: string | null
  attachments?: string | null
  requiresResponsible?: boolean
}

type CalibrationHistoryRecord = {
  id: string
  calibrationDate: string
  nextDueDate: string
  certificateNumber?: string | null
  calibratedBy: string
  cost?: number | null
  result: string
  notes?: string | null
  certificatePath?: string | null
  createdAt: string
}

type Stats = {
  total: number
  valid: number
  expiring: number
  expired: number
  inProcess: number
  outOfOrder: number
  noResponsible: number
  atCompany: number
  atCalibration: number
  scrap: number
  totalCost: number
}

export default function CalibrationPage() {
  const { data: session } = useSession()
  const canEdit = session?.user?.permissions?.includes("kalibrasyon.admin") ?? false

  const [devices, setDevices] = useState<CalibrationDevice[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, valid: 0, expiring: 0, expired: 0, inProcess: 0, outOfOrder: 0, noResponsible: 0, atCompany: 0, atCalibration: 0, scrap: 0, totalCost: 0 })
  const [selectedDevice, setSelectedDevice] = useState<CalibrationDevice | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Form state
  const [formData, setFormData] = useState({
    deviceId: "",
    name: "",
    type: "",
    calibrationType: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    location: "",
    department: "",
    responsiblePerson: "",
    responsiblePersonEmail: "",
    calibrationInterval: "365",
    lastCalibrationDate: new Date().toISOString().split('T')[0],
    plannedCalibrationDate: "",
    verificationInterval: "",
    lastVerificationDate: "",
    plannedVerificationDate: "",
    certificateNumber: "",
    deviceCondition: "",
    calibrationSentDate: "",
    calibrationReturnDate: "",
    scrapDate: "",
    scrapDescription: "",
    notes: "",
    imageUrl: "",
    attachments: [] as string[],
    requiresResponsible: false,
  })

  const [uploadingFiles, setUploadingFiles] = useState(false)

  // Dropdown verileri için state'ler (API'den gelecek)
  const [departments, setDepartments] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [deviceTypes, setDeviceTypes] = useState<string[]>([])
  const [deviceNames, setDeviceNames] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [productionSections, setProductionSections] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [lastImportErrors, setLastImportErrors] = useState<string[]>([])
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAttachmentsDialog, setShowAttachmentsDialog] = useState(false)
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([])
  const [selectedDeviceName, setSelectedDeviceName] = useState("")

  // History dialog
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [historyDevice, setHistoryDevice] = useState<CalibrationDevice | null>(null)
  const [historyRecords, setHistoryRecords] = useState<CalibrationHistoryRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showAddHistoryForm, setShowAddHistoryForm] = useState(false)
  const [historyFormData, setHistoryFormData] = useState({
    calibrationDate: new Date().toISOString().split('T')[0],
    certificateNumber: "",
    calibratedBy: "",
    cost: "",
    result: "PASS",
    notes: "",
  })

  // Status dialog
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [statusDevice, setStatusDevice] = useState<CalibrationDevice | null>(null)
  const [selectedStatus, setSelectedStatus] = useState("")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Sorting
  const [sortField, setSortField] = useState<keyof CalibrationDevice | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Otomatik ID oluştur
  const generateDeviceId = () => {
    if (devices.length === 0) {
      return "CAL001"
    }

    // Son cihazın ID'sini al ve sayıyı artır
    const lastDevice = devices[devices.length - 1]
    const lastIdNumber = parseInt(lastDevice.deviceId.replace("CAL", ""))
    const newIdNumber = lastIdNumber + 1
    return `CAL${newIdNumber.toString().padStart(3, "0")}`
  }

  // Verileri yükle
  const loadData = async () => {
    try {
      setLoading(true)
      const [devicesRes, statsRes] = await Promise.all([
        fetch('/api/calibration'),
        fetch('/api/calibration/stats'),
      ])

      if (devicesRes.ok) {
        const devicesData = await devicesRes.json()
        setDevices(devicesData)
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error)
    } finally {
      setLoading(false)
    }
  }

  // Dropdown verilerini yükle
  const loadDropdownData = async () => {
    try {
      const [settingsRes, deptRes] = await Promise.all([
        fetch('/api/settings/calibration'),
        fetch('/api/departments'),
      ])

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setLocations(data.locations?.map((l: any) => l.name) || [])
        setDeviceTypes(data.deviceTypes?.map((t: any) => t.name) || [])
        setDeviceNames(data.deviceModels?.map((m: any) => m.name) || [])
        setModels(data.deviceModels?.map((m: any) => m.name) || [])
        setProductionSections(data.productionSections?.map((s: any) => s.name) || [])
      }

      if (deptRes.ok) {
        const depts = await deptRes.json()
        setDepartments(depts.map((d: any) => d.name))
      }
    } catch (error) {
      console.error('Dropdown verileri yüklenirken hata:', error)
      // Fallback - sabit değerler
      setDepartments(["Üretim", "Kalite Kontrol", "Ar-Ge", "Bakım Onarım", "Laboratuvar"])
      setLocations(["Ana Bina - 1. Kat", "Üretim Tesisi", "Laboratuvar"])
      setDeviceTypes(["Ölçüm Cihazı", "Test Ekipmanı", "Analiz Cihazı"])
      setDeviceNames(["Dijital Kumpas", "Hassas Terazi", "pH Metre"])
      setModels(["Mitutoyo 500-196", "Sartorius BP 210 S"])
    }
  }

  useEffect(() => {
    loadData()
    loadDropdownData()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VALID":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Geçerli
          </Badge>
        )
      case "EXPIRING":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="mr-1 h-3 w-3" />
            Yaklaşıyor
          </Badge>
        )
      case "EXPIRED":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <AlertCircle className="mr-1 h-3 w-3" />
            Süresi Doldu
          </Badge>
        )
      case "IN_PROCESS":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <Wrench className="mr-1 h-3 w-3" />
            Kalibrasyonda
          </Badge>
        )
      case "OUT_OF_ORDER":
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            <Ban className="mr-1 h-3 w-3" />
            Arızalı
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const statCards = [
    {
      title: "Toplam Cihaz",
      value: stats.total,
      icon: Calendar,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Geçerli Kalibrasyon",
      value: stats.valid,
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Süresi Yaklaşan",
      value: stats.expiring,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: "Süresi Dolan",
      value: stats.expired,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      title: "Şirkette",
      value: stats.atCompany,
      icon: Building2,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: "Kalibrasyonda",
      value: stats.atCalibration,
      icon: Beaker,
      color: "text-sky-600",
      bgColor: "bg-sky-100",
    },
    {
      title: "Hurda",
      value: stats.scrap,
      icon: XCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Zimmeti Yok",
      value: stats.noResponsible,
      icon: UserX,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
    },
  ]

  // Sıralama fonksiyonu
  const handleSort = (field: keyof CalibrationDevice) => {
    if (sortField === field) {
      // Aynı alana tıklanırsa yönü değiştir
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Yeni alan için artan sıralama
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Filtreleme ve sıralama
  let filteredDevices = devices.filter(device =>
    device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.deviceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (device.serialNumber && device.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (device.location && device.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (device.model && device.model.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Sıralama uygula
  if (sortField) {
    filteredDevices = [...filteredDevices].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]

      // Null/undefined kontrolü
      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1

      // Tarih alanları için özel karşılaştırma
      if (sortField === 'lastCalibrationDate' || sortField === 'nextCalibrationDate' || sortField === 'plannedCalibrationDate' || sortField === ('lastVerificationDate' as any) || sortField === ('plannedVerificationDate' as any)) {
        const dateA = new Date(aValue as string).getTime()
        const dateB = new Date(bValue as string).getTime()
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
      }

      // String karşılaştırma
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue, 'tr')
        return sortDirection === 'asc' ? comparison : -comparison
      }

      // Sayı karşılaştırma
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      return 0
    })
  }

  // Pagination calculations
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedDevices = filteredDevices.slice(startIndex, endIndex)

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const resetForm = () => {
    setFormData({
      deviceId: "",
      name: "",
      type: "",
      calibrationType: "",
      manufacturer: "",
      model: "",
      serialNumber: "",
      location: "",
      department: "",
      responsiblePerson: "",
      responsiblePersonEmail: "",
      calibrationInterval: "365",
      lastCalibrationDate: new Date().toISOString().split('T')[0],
      plannedCalibrationDate: "",
      verificationInterval: "",
      lastVerificationDate: "",
      plannedVerificationDate: "",
      certificateNumber: "",
      deviceCondition: "",
      calibrationSentDate: "",
      calibrationReturnDate: "",
      scrapDate: "",
      scrapDescription: "",
      notes: "",
      imageUrl: "",
      attachments: [],
      requiresResponsible: false,
    })
  }

  const handleFileUpload = async (file: File) => {
    try {
      setUploadingFiles(true)
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Dosya başarıyla yüklendi!')
        return data.fileUrl
      } else {
        const error = await response.json()
        toast.error(error.error || 'Dosya yüklenirken bir hata oluştu')
        return null
      }
    } catch (error) {
      console.error('Dosya yükleme hatası:', error)
      toast.error('Dosya yüklenirken bir hata oluştu')
      return null
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const fileUrl = await handleFileUpload(file)
      if (fileUrl) {
        setFormData({ ...formData, imageUrl: fileUrl })
      }
    }
  }

  const handleAttachmentsChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const uploadedUrls: string[] = []

    for (const file of files) {
      const fileUrl = await handleFileUpload(file)
      if (fileUrl) {
        uploadedUrls.push(fileUrl)
      }
    }

    if (uploadedUrls.length > 0) {
      setFormData({
        ...formData,
        attachments: [...formData.attachments, ...uploadedUrls],
      })
    }
  }

  const removeAttachment = (index: number) => {
    const newAttachments = formData.attachments.filter((_, i) => i !== index)
    setFormData({ ...formData, attachments: newAttachments })
  }

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // deviceId boşsa otomatik oluştur
      const deviceId = formData.deviceId

      const response = await fetch('/api/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          deviceId,
          calibrationInterval: parseInt(formData.calibrationInterval),
          plannedCalibrationDate: formData.plannedCalibrationDate || null,
          verificationInterval: formData.verificationInterval || null,
          lastVerificationDate: formData.lastVerificationDate || null,
          plannedVerificationDate: formData.plannedVerificationDate || null,
          deviceCondition: formData.deviceCondition || null,
          // Tarihler durum değişse bile korunur (geçmiş kalibrasyon bilgisi kaybolmasın)
          calibrationSentDate: formData.calibrationSentDate || null,
          calibrationReturnDate: formData.calibrationReturnDate || null,
          scrapDate: formData.scrapDate || null,
          scrapDescription: formData.scrapDescription || null,
          attachments: JSON.stringify(formData.attachments),
        }),
      })

      if (response.ok) {
        setIsAddDialogOpen(false)
        resetForm()
        loadData()
        toast.success('Cihaz başarıyla eklendi!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Cihaz eklenirken bir hata oluştu')
      }
    } catch (error) {
      console.error('Cihaz ekleme hatası:', error)
      toast.error('Cihaz eklenirken bir hata oluştu')
    }
  }

  const handleEditDevice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDevice) return

    try {
      const response = await fetch(`/api/calibration/${selectedDevice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          calibrationInterval: parseInt(formData.calibrationInterval) || null,
          lastCalibrationDate: formData.lastCalibrationDate || null,
          plannedCalibrationDate: formData.plannedCalibrationDate || null,
          verificationInterval: formData.verificationInterval || null,
          lastVerificationDate: formData.lastVerificationDate || null,
          plannedVerificationDate: formData.plannedVerificationDate || null,
          deviceCondition: formData.deviceCondition || null,
          // Tarihler durum değişse bile korunur (geçmiş kalibrasyon bilgisi kaybolmasın)
          calibrationSentDate: formData.calibrationSentDate || null,
          calibrationReturnDate: formData.calibrationReturnDate || null,
          scrapDate: formData.scrapDate || null,
          scrapDescription: formData.scrapDescription || null,
          attachments: JSON.stringify(formData.attachments),
        }),
      })

      if (response.ok) {
        setIsEditDialogOpen(false)
        setSelectedDevice(null)
        resetForm()
        loadData()
        toast.success('Cihaz başarıyla güncellendi!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Cihaz güncellenirken bir hata oluştu')
      }
    } catch (error) {
      console.error('Cihaz güncelleme hatası:', error)
      toast.error('Cihaz güncellenirken bir hata oluştu')
    }
  }

  const handleDeleteDevice = async (id: string) => {
    if (!confirm('Bu cihazı silmek istediğinizden emin misiniz?')) return

    try {
      const response = await fetch(`/api/calibration/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        loadData()
        toast.success('Cihaz başarıyla silindi!')
      } else {
        toast.error('Cihaz silinirken bir hata oluştu')
      }
    } catch (error) {
      console.error('Cihaz silme hatası:', error)
      toast.error('Cihaz silinirken bir hata oluştu')
    }
  }

  const handleDeleteAll = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch('/api/calibration/delete-all', {
        method: 'DELETE',
      })

      if (response.ok) {
        setShowDeleteAllDialog(false)
        loadData()
        setCurrentPage(1)
        toast.success('Tüm cihazlar başarıyla silindi!')
      } else {
        const err = await response.json().catch(() => ({}))
        toast.error(err.error || 'Cihazlar silinirken bir hata oluştu')
      }
    } catch (error) {
      console.error('Toplu silme hatası:', error)
      toast.error('Cihazlar silinirken bir hata oluştu')
    } finally {
      setIsDeleting(false)
    }
  }

  const openEditDialog = (device: CalibrationDevice) => {
    setSelectedDevice(device)
    const deviceAttachments = device.attachments ? JSON.parse(device.attachments as string) : []
    setFormData({
      deviceId: device.deviceId,
      name: device.name,
      type: device.type,
      calibrationType: device.calibrationType || "",
      manufacturer: device.manufacturer || "",
      model: device.model || "",
      serialNumber: device.serialNumber || "",
      location: device.location || "",
      department: device.department || "",
      responsiblePerson: device.responsiblePerson || "",
      responsiblePersonEmail: device.responsiblePersonEmail || "",
      calibrationInterval: device.calibrationInterval?.toString() || "",
      lastCalibrationDate: device.lastCalibrationDate
        ? new Date(device.lastCalibrationDate).toISOString().split('T')[0]
        : "",
      plannedCalibrationDate: device.plannedCalibrationDate
        ? new Date(device.plannedCalibrationDate).toISOString().split('T')[0]
        : "",
      verificationInterval: device.verificationInterval?.toString() || "",
      lastVerificationDate: device.lastVerificationDate
        ? new Date(device.lastVerificationDate).toISOString().split('T')[0]
        : "",
      plannedVerificationDate: device.plannedVerificationDate
        ? new Date(device.plannedVerificationDate).toISOString().split('T')[0]
        : "",
      certificateNumber: device.certificateNumber || "",
      deviceCondition: device.deviceCondition || "",
      calibrationSentDate: device.calibrationSentDate
        ? new Date(device.calibrationSentDate).toISOString().split('T')[0]
        : "",
      calibrationReturnDate: device.calibrationReturnDate
        ? new Date(device.calibrationReturnDate).toISOString().split('T')[0]
        : "",
      scrapDate: device.scrapDate
        ? new Date(device.scrapDate).toISOString().split('T')[0]
        : "",
      scrapDescription: device.scrapDescription || "",
      notes: device.notes || "",
      imageUrl: device.imageUrl || "",
      attachments: Array.isArray(deviceAttachments) ? deviceAttachments : [],
      requiresResponsible: device.requiresResponsible || false,
    })
    setIsEditDialogOpen(true)
  }

  // Geçmiş dialog
  const openHistoryDialog = async (device: CalibrationDevice) => {
    setHistoryDevice(device)
    setShowHistoryDialog(true)
    setLoadingHistory(true)
    setShowAddHistoryForm(false)
    setHistoryFormData({
      calibrationDate: new Date().toISOString().split('T')[0],
      certificateNumber: "",
      calibratedBy: "",
      cost: "",
      result: "PASS",
      notes: "",
    })
    try {
      const res = await fetch(`/api/calibration/${device.id}`)
      if (res.ok) {
        const data = await res.json()
        setHistoryRecords(data.calibrationHistory || [])
      }
    } catch (error) {
      console.error('Geçmiş yükleme hatası:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleAddHistory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!historyDevice) return
    try {
      const res = await fetch('/api/calibration/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: historyDevice.id,
          calibrationDate: historyFormData.calibrationDate,
          certificateNumber: historyFormData.certificateNumber || undefined,
          calibratedBy: historyFormData.calibratedBy,
          cost: historyFormData.cost ? parseFloat(historyFormData.cost) : null,
          result: historyFormData.result,
          notes: historyFormData.notes || undefined,
        }),
      })
      if (res.ok) {
        toast.success('Kalibrasyon kaydı eklendi!')
        openHistoryDialog(historyDevice)
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kayıt eklenemedi')
      }
    } catch (error) {
      toast.error('Kayıt eklenirken hata oluştu')
    }
  }

  // Durum değiştir
  const handleStatusChange = async () => {
    if (!statusDevice) return
    try {
      const res = await fetch(`/api/calibration/${statusDevice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedStatus || undefined,
        }),
      })
      if (res.ok) {
        toast.success('Durum güncellendi')
        setShowStatusDialog(false)
        loadData()
      } else {
        toast.error('Durum güncellenemedi')
      }
    } catch (error) {
      toast.error('Durum güncellenirken hata oluştu')
    }
  }

  // Excel'e aktar
  const handleExportToExcel = () => {
    const exportData = devices.map(device => ({
      'Cihaz ID': device.deviceId,
      'Cihaz Adı': device.name,
      'Cihaz Tipi': device.type,
      'Kalibrasyon Tipi': device.calibrationType || '',
      'Üretici': device.manufacturer || '',
      'Model': device.model || '',
      'Seri No': device.serialNumber || '',
      'Lokasyon': device.location || '',
      'Departman': device.department || '',
      'Sorumlu Kişi': device.responsiblePerson || '',
      'Kalibrasyon Periyodu (Gün)': device.calibrationInterval || '',
      'Son Kalibrasyon': device.lastCalibrationDate
        ? new Date(device.lastCalibrationDate).toLocaleDateString('tr-TR')
        : '',
      'Sonraki Kalibrasyon': device.nextCalibrationDate
        ? new Date(device.nextCalibrationDate).toLocaleDateString('tr-TR')
        : '',
      'Planlanan Kalibrasyon': device.plannedCalibrationDate
        ? new Date(device.plannedCalibrationDate).toLocaleDateString('tr-TR')
        : '',
      'Doğrulama Periyodu (Gün)': device.verificationInterval || '',
      'Son Doğrulama': device.lastVerificationDate
        ? new Date(device.lastVerificationDate).toLocaleDateString('tr-TR')
        : '',
      'Planlanan Doğrulama': device.plannedVerificationDate
        ? new Date(device.plannedVerificationDate).toLocaleDateString('tr-TR')
        : '',
      'Sertifika No': device.certificateNumber || '',
      'Cihaz Durumu': device.deviceCondition || '',
      'Gönderim Tarihi': device.calibrationSentDate
        ? new Date(device.calibrationSentDate).toLocaleDateString('tr-TR')
        : '',
      'Dönüş Tarihi': device.calibrationReturnDate
        ? new Date(device.calibrationReturnDate).toLocaleDateString('tr-TR')
        : '',
      'Hurda Tarihi': device.scrapDate
        ? new Date(device.scrapDate).toLocaleDateString('tr-TR')
        : '',
      'Hurda Açıklaması': device.scrapDescription || '',
      'Durum': device.status,
      'Notlar': device.notes || '',
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kalibrasyon')

    const fileName = `kalibrasyon_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  // Excel'den içeri aktar
  const handleImportFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        setIsImporting(true)
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        const totalRows = jsonData.length
        setImportProgress({ current: 0, total: totalRows })

        // Excel kolon başlıklarını konsola yazdır (debugging için)
        if (jsonData.length > 0) {
          console.log('📊 Excel Kolon Başlıkları:', Object.keys(jsonData[0] as Record<string, unknown>))
        }

        toast.info(`${totalRows} kayıt içeri aktarılıyor...`, {
          duration: 2000,
        })

        let successCount = 0
        let errorCount = 0
        let skippedCount = 0
        const errors: string[] = []

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as any
          setImportProgress({ current: i + 1, total: totalRows })

          try {
            // Tüm olası kolon başlığı varyasyonlarını kontrol et
            const deviceName = row['Cihaz Adı'] || row['Cihaz Adi'] || row['CihazAdi'] ||
                              row['CIHAZ ADI'] || row['cihaz adı'] || row['Model'] || row['MODEL'] || ''
            const deviceType = row['Cihaz Tipi'] || row['Cihaz Tipi'] || row['CihazTipi'] ||
                              row['CIHAZ TIPI'] || row['cihaz tipi'] || row['Tip'] || row['TIP'] || ''

            // Boş satırları atla
            if (!deviceName || deviceName.toString().trim() === '') {
              skippedCount++
              continue
            }

            // Tarih formatını düzelt (Excel tarihleri bazen sayı olarak gelir)
            let lastCalibrationDate = row['Son Kalibrasyon'] || row['Son Kalibrasyon Tarihi'] ||
                                     row['Kalibrasyon Tarihi'] || row['Tarih'] || row['SON KALIBRASYON']
            if (typeof lastCalibrationDate === 'number') {
              // Excel serial date to JS Date
              const excelEpoch = new Date(1899, 11, 30)
              const msPerDay = 86400000
              const date = new Date(excelEpoch.getTime() + lastCalibrationDate * msPerDay)
              lastCalibrationDate = date.toISOString().split('T')[0]
            } else if (lastCalibrationDate) {
              // String tarih formatını kontrol et
              const parsedDate = new Date(lastCalibrationDate)
              if (!isNaN(parsedDate.getTime())) {
                lastCalibrationDate = parsedDate.toISOString().split('T')[0]
              } else {
                lastCalibrationDate = new Date().toISOString().split('T')[0]
              }
            } else {
              lastCalibrationDate = new Date().toISOString().split('T')[0]
            }

            // Tüm kolonları esnek şekilde oku
            const deviceId = row['Cihaz ID'] || row['CihazID'] || row['ID'] || ''
            const manufacturer = row['Üretici'] || row['Uretici'] || row['ÜRETICI'] || row['Marka'] || ''
            const model = row['Model'] || row['MODEL'] || deviceName
            const serialNumber = row['Seri No'] || row['SeriNo'] || row['Seri Numarası'] || row['SERI NO'] || ''
            const location = row['Lokasyon'] || row['LOKASYON'] || row['Konum'] || row['Yer'] || ''
            const department = row['Departman'] || row['DEPARTMAN'] || row['Bölüm'] || ''
            const responsiblePerson = row['Sorumlu Kişi'] || row['Sorumlu Kisi'] || row['Sorumlu'] || row['SORUMLU'] || ''
            const calibrationIntervalRaw = row['Kalibrasyon Periyodu (Gün)'] || row['Kalibrasyon Periyodu'] ||
                                          row['Periyot'] || row['Süre'] || '365'
            const certificateNumber = row['Sertifika No'] || row['SertifikaNo'] || row['Sertifika'] || ''
            const notes = row['Notlar'] || row['Not'] || row['NOTLAR'] || ''

            // Planlanan tarih
            let plannedCalibrationDate = row['Planlanan Kalibrasyon'] || row['Planlanan Tarih'] ||
                                         row['Planlanan Kalibrasyon Tarihi'] || row['PLANLANAN KALIBRASYON'] || ''
            if (typeof plannedCalibrationDate === 'number') {
              const excelEpoch = new Date(1899, 11, 30)
              const msPerDay = 86400000
              const date = new Date(excelEpoch.getTime() + plannedCalibrationDate * msPerDay)
              plannedCalibrationDate = date.toISOString().split('T')[0]
            } else if (plannedCalibrationDate) {
              const parsedDate = new Date(plannedCalibrationDate)
              if (!isNaN(parsedDate.getTime())) {
                plannedCalibrationDate = parsedDate.toISOString().split('T')[0]
              } else {
                plannedCalibrationDate = ''
              }
            }

            // Doğrulama alanları
            const verificationIntervalRaw = row['Doğrulama Periyodu (Gün)'] || row['Doğrulama Periyodu'] ||
                                             row['Dogrulama Periyodu'] || ''
            let lastVerificationDate = row['Son Doğrulama'] || row['Son Doğrulama Tarihi'] ||
                                        row['Son Dogrulama'] || ''
            if (typeof lastVerificationDate === 'number') {
              const excelEpoch = new Date(1899, 11, 30)
              const msPerDay = 86400000
              const date = new Date(excelEpoch.getTime() + lastVerificationDate * msPerDay)
              lastVerificationDate = date.toISOString().split('T')[0]
            } else if (lastVerificationDate) {
              const parsedDate = new Date(lastVerificationDate)
              if (!isNaN(parsedDate.getTime())) {
                lastVerificationDate = parsedDate.toISOString().split('T')[0]
              } else {
                lastVerificationDate = ''
              }
            }
            let plannedVerificationDate = row['Planlanan Doğrulama'] || row['Planlanan Doğrulama Tarihi'] ||
                                           row['Planlanan Dogrulama'] || ''
            if (typeof plannedVerificationDate === 'number') {
              const excelEpoch = new Date(1899, 11, 30)
              const msPerDay = 86400000
              const date = new Date(excelEpoch.getTime() + plannedVerificationDate * msPerDay)
              plannedVerificationDate = date.toISOString().split('T')[0]
            } else if (plannedVerificationDate) {
              const parsedDate = new Date(plannedVerificationDate)
              if (!isNaN(parsedDate.getTime())) {
                plannedVerificationDate = parsedDate.toISOString().split('T')[0]
              } else {
                plannedVerificationDate = ''
              }
            }

            // Kalibrasyon Tipi
            const calibrationType = row['Kalibrasyon Tipi'] || row['Tip'] || row['TIP'] || row['Kalibrasyon tipi'] || ''

            // Cihaz Durumu alanları
            const deviceCondition = row['Cihaz Durumu'] || row['Cihaz durumu'] || row['CIHAZ DURUMU'] || ''

            // Gönderim/Dönüş tarihleri (Kalibrasyonda durumu için)
            let calibrationSentDate = row['Gönderim Tarihi'] || row['Gonderim Tarihi'] || row['GÖNDERİM TARİHİ'] || ''
            if (typeof calibrationSentDate === 'number') {
              const excelEpoch = new Date(1899, 11, 30)
              calibrationSentDate = new Date(excelEpoch.getTime() + calibrationSentDate * 86400000).toISOString().split('T')[0]
            } else if (calibrationSentDate) {
              const parsed = new Date(calibrationSentDate)
              calibrationSentDate = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : ''
            }

            let calibrationReturnDate = row['Dönüş Tarihi'] || row['Donus Tarihi'] || row['DÖNÜŞ TARİHİ'] || ''
            if (typeof calibrationReturnDate === 'number') {
              const excelEpoch = new Date(1899, 11, 30)
              calibrationReturnDate = new Date(excelEpoch.getTime() + calibrationReturnDate * 86400000).toISOString().split('T')[0]
            } else if (calibrationReturnDate) {
              const parsed = new Date(calibrationReturnDate)
              calibrationReturnDate = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : ''
            }

            // Hurda alanları
            let scrapDate = row['Hurda Tarihi'] || row['HURDA TARİHİ'] || ''
            if (typeof scrapDate === 'number') {
              const excelEpoch = new Date(1899, 11, 30)
              scrapDate = new Date(excelEpoch.getTime() + scrapDate * 86400000).toISOString().split('T')[0]
            } else if (scrapDate) {
              const parsed = new Date(scrapDate)
              scrapDate = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : ''
            }
            const scrapDescription = row['Hurda Açıklaması'] || row['Hurda Aciklamasi'] || row['HURDA AÇIKLAMASI'] || ''

            const response = await fetch('/api/calibration', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deviceId: deviceId.toString().trim(),
                name: deviceName.toString().trim(),
                type: deviceType.toString().trim(),
                calibrationType: calibrationType.toString().trim() || null,
                manufacturer: manufacturer.toString().trim(),
                model: model.toString().trim(),
                serialNumber: serialNumber.toString().trim(),
                location: location.toString().trim(),
                department: department.toString().trim(),
                responsiblePerson: responsiblePerson.toString().trim(),
                calibrationInterval: parseInt(calibrationIntervalRaw.toString()) || 365,
                lastCalibrationDate,
                certificateNumber: certificateNumber.toString().trim(),
                notes: notes.toString().trim(),
                plannedCalibrationDate: plannedCalibrationDate || null,
                verificationInterval: verificationIntervalRaw ? parseInt(verificationIntervalRaw.toString()) : null,
                lastVerificationDate: lastVerificationDate || null,
                plannedVerificationDate: plannedVerificationDate || null,
                deviceCondition: deviceCondition.toString().trim() || null,
                calibrationSentDate: calibrationSentDate || null,
                calibrationReturnDate: calibrationReturnDate || null,
                scrapDate: scrapDate || null,
                scrapDescription: scrapDescription.toString().trim() || null,
              }),
            })

            if (response.ok) {
              successCount++
            } else {
              const errorData = await response.json()
              errorCount++
              const rowInfo = `[ID: ${row['Cihaz ID'] || 'BOŞ'}, Ad: ${deviceName || 'BOŞ'}, Tip: ${deviceType || 'BOŞ'}]`
              errors.push(`Satır ${i + 2} ${rowInfo}: ${errorData.error || 'Bilinmeyen hata'}`)
            }
          } catch (error) {
            errorCount++
            const rowInfo = `[ID: ${row['Cihaz ID'] || 'BOŞ'}, Ad: ${row['Cihaz Adı'] || row['Cihaz Adi'] || 'BOŞ'}]`
            errors.push(`Satır ${i + 2} ${rowInfo}: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`)
          }
        }

        setIsImporting(false)
        setImportProgress({ current: 0, total: 0 })

        // Sonuç bildirimi
        const summaryMsg = skippedCount > 0
          ? `Başarılı: ${successCount} | Hata: ${errorCount} | Atlanan: ${skippedCount}`
          : `Başarılı: ${successCount} | Hata: ${errorCount}`

        if (errorCount === 0 && successCount > 0) {
          toast.success(`Tüm kayıtlar başarıyla içeri aktarıldı!\n${summaryMsg}`, {
            duration: 5000,
          })
        } else if (successCount > 0) {
          toast.warning(`İçeri aktarma tamamlandı.\n${summaryMsg}`, {
            duration: 8000,
            description: errors.length > 0 ? `İlk hatalar:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n... ve ${errors.length - 3} hata daha` : ''}` : undefined,
          })
        } else {
          toast.error(`Hiçbir kayıt içeri aktarılamadı!\n${summaryMsg}`, {
            duration: 8000,
            description: errors.length > 0 ? `Hatalar:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n... ve ${errors.length - 3} hata daha` : ''}` : undefined,
          })
        }

        // Hata ve özet logları
        console.group('📊 Excel İçeri Aktarma Özeti')
        console.log(`✅ Başarılı: ${successCount}`)
        console.log(`❌ Hatalı: ${errorCount}`)
        console.log(`⏭️  Atlanan (Boş): ${skippedCount}`)
        console.log(`📝 Toplam İşlenen: ${totalRows}`)
        console.groupEnd()

        if (errors.length > 0) {
          setLastImportErrors(errors)
          console.group('📋 Excel İçeri Aktarma Hataları')
          console.log(`Toplam ${errors.length} hata:`)
          errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`)
          })
          console.groupEnd()
        } else {
          setLastImportErrors([])
        }

        loadData()
      } catch (error) {
        console.error('Excel okuma hatası:', error)
        toast.error('Excel dosyası okunamadı!', {
          description: error instanceof Error ? error.message : 'Bilinmeyen hata',
        })
        setIsImporting(false)
        setImportProgress({ current: 0, total: 0 })
      }
    }

    reader.readAsArrayBuffer(file)
    e.target.value = '' // Reset input
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight">Kalibrasyon Yönetimi</h1>
          <p className="text-muted-foreground">
            Cihaz takibi, periyodik kontrol ve sertifika yönetimi
          </p>
        </div>
        <div className="flex gap-2">
          {lastImportErrors.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowErrorDialog(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <FileText className="mr-2 h-4 w-4" />
                Hata Logları ({lastImportErrors.length})
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setLastImportErrors([])
                  toast.success('Hata logları temizlendi')
                }}
                className="text-red-600 hover:bg-red-50"
                title="Hata loglarını temizle"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {canEdit && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteAllDialog(true)}
              disabled={devices.length === 0}
            >
              <Trash className="mr-2 h-4 w-4" />
              Tüm Verileri Sil
            </Button>
          )}
          <Button variant="outline" onClick={handleExportToExcel}>
            <Download className="mr-2 h-4 w-4" />
            Excel'e Aktar
          </Button>
          {canEdit && (
            <>
              <Button
                variant="outline"
                onClick={() => document.getElementById('excel-import')?.click()}
                disabled={isImporting}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isImporting ? `İçeri aktarılıyor... (${importProgress.current}/${importProgress.total})` : 'Excel\'den İçeri Aktar'}
              </Button>
              <input
                id="excel-import"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFromExcel}
                className="hidden"
              />
            </>
          )}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            {canEdit && (
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Yeni Cihaz Ekle
                </Button>
              </DialogTrigger>
            )}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddDevice}>
              <DialogHeader>
                <DialogTitle>Yeni Cihaz Ekle</DialogTitle>
                <DialogDescription>
                  Kalibrasyona tabi yeni bir cihaz ekleyin
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deviceId">Cihaz ID</Label>
                    <Input
                      id="deviceId"
                      value={formData.deviceId}
                      onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                      placeholder="Cihaz ID girin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Cihaz Tipi</Label>
                    <Select
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    >
                      <option value="">Seçiniz</option>
                      {deviceNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calibrationType">Yöntem</Label>
                    <Select
                      id="calibrationType"
                      value={formData.calibrationType}
                      onChange={(e) => setFormData({ ...formData, calibrationType: e.target.value })}
                    >
                      <option value="">Seçiniz</option>
                      <option value="Kalibrasyon">Kalibrasyon</option>
                      <option value="Doğrulama">Doğrulama</option>
                      <option value="Kal/Doğ">Kal/Doğ</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">Marka</Label>
                    <Input
                      id="manufacturer"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      placeholder="Mitutoyo"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="Model adı girin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serialNumber">Seri No</Label>
                    <Input
                      id="serialNumber"
                      value={formData.serialNumber}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      placeholder="SN123456"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Lokasyon</Label>
                    <Select
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    >
                      <option value="">Seçiniz</option>
                      {locations.map((location) => (
                        <option key={location} value={location}>{location}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Departman</Label>
                    <Select
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value, ...(e.target.value !== "Üretim" ? { location: formData.location } : {}) })}
                    >
                      <option value="">Seçiniz</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                {formData.department === "Üretim" && (
                  <div className="space-y-2">
                    <Label htmlFor="productionSection">Üretim Bölümü</Label>
                    <Select
                      id="productionSection"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    >
                      <option value="">Bölüm Seçiniz</option>
                      {productionSections.map((section) => (
                        <option key={section} value={section}>{section}</option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="responsiblePerson">Sorumlu Kişi</Label>
                    <UserSearchCombobox
                      value={formData.responsiblePersonEmail}
                      onSelect={(user) => {
                        setFormData(prev => ({
                          ...prev,
                          responsiblePerson: user?.name || "",
                          responsiblePersonEmail: user?.email || ""
                        }))
                      }}
                      placeholder="Sorumlu kişi arayın..."
                    />
                    {formData.responsiblePersonEmail && (
                      <p className="text-xs text-muted-foreground">
                        Kalibrasyon süresi dolmadan 7 gün önce bu kişiye mail gönderilecektir.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requiresResponsible">Zorunlu Zimmet</Label>
                    <div className="flex items-center h-10">
                      <input
                        type="checkbox"
                        id="requiresResponsible"
                        checked={formData.requiresResponsible}
                        onChange={(e) => setFormData({ ...formData, requiresResponsible: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <label htmlFor="requiresResponsible" className="ml-2 text-sm text-muted-foreground">
                        Bu cihaz için zimmet zorunludur
                      </label>
                    </div>
                  </div>
                </div>

                {/* Cihaz Durumu */}
                <div className="space-y-2">
                  <Label htmlFor="deviceCondition">Cihaz Durumu</Label>
                  <Select
                    id="deviceCondition"
                    value={formData.deviceCondition}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData({
                        ...formData,
                        deviceCondition: val,
                        // Tarihler durum değişse bile korunur - geçmiş kalibrasyon bilgisi saklanır
                      })
                    }}
                  >
                    <option value="">Seçiniz</option>
                    <option value="Kalibrasyonda">Kalibrasyonda</option>
                    <option value="Şirkette">Şirkette</option>
                    <option value="Hurda">Hurda</option>
                  </Select>
                </div>

                {formData.deviceCondition === "Kalibrasyonda" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="calibrationSentDate">Gönderim Tarihi</Label>
                      <Input
                        id="calibrationSentDate"
                        type="date"
                        value={formData.calibrationSentDate}
                        onChange={(e) => setFormData({ ...formData, calibrationSentDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="calibrationReturnDate">Dönüş Tarihi</Label>
                      <Input
                        id="calibrationReturnDate"
                        type="date"
                        value={formData.calibrationReturnDate}
                        onChange={(e) => setFormData({ ...formData, calibrationReturnDate: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* Gün sayısı bilgisi: durum değişse bile tarihler varsa gösterilir */}
                {formData.calibrationSentDate && (() => {
                  const sent = new Date(formData.calibrationSentDate)
                  const isOngoing = !formData.calibrationReturnDate && formData.deviceCondition === "Kalibrasyonda"
                  const end = formData.calibrationReturnDate
                    ? new Date(formData.calibrationReturnDate)
                    : new Date()
                  const days = Math.max(0, Math.floor((end.getTime() - sent.getTime()) / 86400000))
                  return (
                    <div className={`rounded-md border px-3 py-2 text-sm flex items-center gap-2 ${
                      isOngoing ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-sky-50 border-sky-200 text-sky-800'
                    }`}>
                      <Clock className="h-4 w-4" />
                      <span>
                        {isOngoing
                          ? `${days} gün kalibrasyonda (devam ediyor)`
                          : formData.calibrationReturnDate
                            ? `Son kalibrasyon: ${days} gün sürdü (${new Date(formData.calibrationSentDate).toLocaleDateString('tr-TR')} → ${new Date(formData.calibrationReturnDate).toLocaleDateString('tr-TR')})`
                            : `Son gönderim: ${new Date(formData.calibrationSentDate).toLocaleDateString('tr-TR')} (${days} gün)`}
                      </span>
                    </div>
                  )
                })()}

                {formData.deviceCondition === "Hurda" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scrapDate">Hurda Tarihi</Label>
                      <Input
                        id="scrapDate"
                        type="date"
                        value={formData.scrapDate}
                        onChange={(e) => setFormData({ ...formData, scrapDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scrapDescription">Hurda Açıklaması</Label>
                      <Input
                        id="scrapDescription"
                        value={formData.scrapDescription}
                        onChange={(e) => setFormData({ ...formData, scrapDescription: e.target.value })}
                        placeholder="Hurda sebebini yazınız..."
                      />
                    </div>
                  </div>
                )}

                {/* Kalibrasyon alanları - Kalibrasyon veya Kal/Doğ seçildiğinde */}
                {(formData.calibrationType === 'Kalibrasyon' || formData.calibrationType === 'Kal/Doğ') && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="calibrationInterval">Kalibrasyon Periyodu (gün)</Label>
                        <Input
                          id="calibrationInterval"
                          type="number"
                          value={formData.calibrationInterval}
                          onChange={(e) => {
                            const newInterval = e.target.value
                            const interval = parseInt(newInterval) || 365
                            const planned = formData.lastCalibrationDate ? new Date(new Date(formData.lastCalibrationDate).getTime() + (interval - 20) * 86400000).toISOString().split('T')[0] : ""
                            setFormData({ ...formData, calibrationInterval: newInterval, plannedCalibrationDate: planned || formData.plannedCalibrationDate })
                          }}
                          placeholder="365"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastCalibrationDate">Son Kalibrasyon Tarihi</Label>
                        <Input
                          id="lastCalibrationDate"
                          type="date"
                          value={formData.lastCalibrationDate}
                          onChange={(e) => {
                            const val = e.target.value
                            const interval = parseInt(formData.calibrationInterval) || 365
                            const planned = val ? new Date(new Date(val).getTime() + (interval - 20) * 86400000).toISOString().split('T')[0] : ""
                            setFormData({ ...formData, lastCalibrationDate: val, plannedCalibrationDate: planned })
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plannedCalibrationDate">Planlanan Kalibrasyon Tarihi</Label>
                      <Input
                        id="plannedCalibrationDate"
                        type="date"
                        value={formData.plannedCalibrationDate}
                        onChange={(e) => setFormData({ ...formData, plannedCalibrationDate: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Sonraki kalibrasyon tarihinden 20 gün önce otomatik hesaplanır, değiştirilebilir
                      </p>
                    </div>
                  </>
                )}

                {/* Doğrulama alanları - Doğrulama veya Kal/Doğ seçildiğinde */}
                {(formData.calibrationType === 'Doğrulama' || formData.calibrationType === 'Kal/Doğ') && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="verificationInterval">Doğrulama Periyodu (gün)</Label>
                        <Input
                          id="verificationInterval"
                          type="number"
                          value={formData.verificationInterval}
                          onChange={(e) => {
                            const newInterval = e.target.value
                            const interval = parseInt(newInterval) || 365
                            const planned = formData.lastVerificationDate ? new Date(new Date(formData.lastVerificationDate).getTime() + (interval - 20) * 86400000).toISOString().split('T')[0] : ""
                            setFormData({ ...formData, verificationInterval: newInterval, plannedVerificationDate: planned || formData.plannedVerificationDate })
                          }}
                          placeholder="365"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastVerificationDate">Son Doğrulama Tarihi</Label>
                        <Input
                          id="lastVerificationDate"
                          type="date"
                          value={formData.lastVerificationDate}
                          onChange={(e) => {
                            const val = e.target.value
                            const interval = parseInt(formData.verificationInterval) || 365
                            const planned = val ? new Date(new Date(val).getTime() + (interval - 20) * 86400000).toISOString().split('T')[0] : ""
                            setFormData({ ...formData, lastVerificationDate: val, plannedVerificationDate: planned })
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plannedVerificationDate">Planlanan Doğrulama Tarihi</Label>
                      <Input
                        id="plannedVerificationDate"
                        type="date"
                        value={formData.plannedVerificationDate}
                        onChange={(e) => setFormData({ ...formData, plannedVerificationDate: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Sonraki doğrulama tarihinden 20 gün önce otomatik hesaplanır, değiştirilebilir
                      </p>
                    </div>
                  </>
                )}

                {/* Tip seçilmediğinde default kalibrasyon alanları */}
                {!formData.calibrationType && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="calibrationInterval">Kalibrasyon Periyodu (gün)</Label>
                        <Input
                          id="calibrationInterval"
                          type="number"
                          value={formData.calibrationInterval}
                          onChange={(e) => {
                            const newInterval = e.target.value
                            const interval = parseInt(newInterval) || 365
                            const planned = formData.lastCalibrationDate ? new Date(new Date(formData.lastCalibrationDate).getTime() + (interval - 20) * 86400000).toISOString().split('T')[0] : ""
                            setFormData({ ...formData, calibrationInterval: newInterval, plannedCalibrationDate: planned || formData.plannedCalibrationDate })
                          }}
                          placeholder="365"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastCalibrationDate">Son Kalibrasyon Tarihi</Label>
                        <Input
                          id="lastCalibrationDate"
                          type="date"
                          value={formData.lastCalibrationDate}
                          onChange={(e) => {
                            const val = e.target.value
                            const interval = parseInt(formData.calibrationInterval) || 365
                            const planned = val ? new Date(new Date(val).getTime() + (interval - 20) * 86400000).toISOString().split('T')[0] : ""
                            setFormData({ ...formData, lastCalibrationDate: val, plannedCalibrationDate: planned })
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plannedCalibrationDate">Planlanan Kalibrasyon Tarihi</Label>
                      <Input
                        id="plannedCalibrationDate"
                        type="date"
                        value={formData.plannedCalibrationDate}
                        onChange={(e) => setFormData({ ...formData, plannedCalibrationDate: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Sonraki kalibrasyon tarihinden 20 gün önce otomatik hesaplanır, değiştirilebilir
                      </p>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="certificateNumber">Sertifika No</Label>
                  <Input
                    id="certificateNumber"
                    value={formData.certificateNumber}
                    onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })}
                    placeholder="CERT-2024-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notlar</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Ek bilgiler..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image">Cihaz Görseli</Label>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={uploadingFiles}
                  />
                  {formData.imageUrl && (
                    <div className="mt-2">
                      <img src={formData.imageUrl} alt="Cihaz" className="h-24 w-24 object-cover rounded" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="attachments">Ekler (Sertifika, PDF vs.)</Label>
                  <Input
                    id="attachments"
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={handleAttachmentsChange}
                    disabled={uploadingFiles}
                  />
                  {formData.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {formData.attachments.map((url, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex-1">
                            {url.split('/').pop()}
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  İptal
                </Button>
                <Button type="submit" disabled={uploadingFiles}>
                  {uploadingFiles ? 'Dosyalar yükleniyor...' : 'Kaydet'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className={`rounded-md p-1 ${stat.bgColor}`}>
                  <Icon className={`h-3 w-3 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-lg font-semibold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Device List */}
      <Card>
        <CardHeader>
          <CardTitle>Cihaz Listesi</CardTitle>
          <CardDescription>
            Tüm kalibrasyona tabi cihazlar ve durumları
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cihaz adı, ID, seri no veya lokasyon ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-accent"
                    onClick={() => handleSort('deviceId')}
                  >
                    <div className="flex items-center gap-1">
                      Cihaz ID
                      {sortField === 'deviceId' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-accent"
                    onClick={() => handleSort('model')}
                  >
                    <div className="flex items-center gap-1">
                      Model
                      {sortField === 'model' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-accent"
                    onClick={() => handleSort('calibrationType')}
                  >
                    <div className="flex items-center gap-1">
                      Yöntem
                      {sortField === 'calibrationType' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-accent"
                    onClick={() => handleSort('department')}
                  >
                    <div className="flex items-center gap-1">
                      Departman
                      {sortField === 'department' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-accent"
                    onClick={() => handleSort('lastCalibrationDate')}
                  >
                    <div className="flex items-center gap-1">
                      Son Kalibrasyon
                      {sortField === 'lastCalibrationDate' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-accent"
                    onClick={() => handleSort('nextCalibrationDate')}
                  >
                    <div className="flex items-center gap-1">
                      Sonraki Kalibrasyon
                      {sortField === 'nextCalibrationDate' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-accent"
                    onClick={() => handleSort('plannedCalibrationDate')}
                  >
                    <div className="flex items-center gap-1">
                      Planlanan Kal.
                      {sortField === 'plannedCalibrationDate' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-accent"
                    onClick={() => handleSort('lastVerificationDate' as keyof CalibrationDevice)}
                  >
                    <div className="flex items-center gap-1">
                      Son Doğrulama
                      {sortField === ('lastVerificationDate' as keyof CalibrationDevice) ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-accent"
                    onClick={() => handleSort('plannedVerificationDate' as keyof CalibrationDevice)}
                  >
                    <div className="flex items-center gap-1">
                      Planlanan Doğ.
                      {sortField === ('plannedVerificationDate' as keyof CalibrationDevice) ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-accent"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Durum
                      {sortField === 'status' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Ekler</TableHead>
                  {canEdit && <TableHead className="text-right">İşlemler</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center text-muted-foreground">
                      {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz cihaz eklenmemiş'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDevices.map((device) => {
                    const attachments = device.attachments ? JSON.parse(device.attachments as string) : []
                    const attachmentCount = Array.isArray(attachments) ? attachments.length : 0

                    return (
                    <TableRow key={device.id}>
                      <TableCell
                        className="font-medium cursor-pointer hover:underline text-blue-600"
                        onClick={() => openHistoryDialog(device)}
                        title="Kalibrasyon geçmişini görüntüle"
                      >
                        {device.deviceId}
                      </TableCell>
                      <TableCell>{device.model || "-"}</TableCell>
                      <TableCell>{device.calibrationType || "-"}</TableCell>
                      <TableCell>{device.department || "-"}</TableCell>
                      <TableCell>{device.calibrationType === 'Doğrulama' || !device.lastCalibrationDate ? '-' : new Date(device.lastCalibrationDate).toLocaleDateString('tr-TR')}</TableCell>
                      <TableCell>{device.calibrationType === 'Doğrulama' || !device.nextCalibrationDate ? '-' : new Date(device.nextCalibrationDate).toLocaleDateString('tr-TR')}</TableCell>
                      <TableCell>
                        {device.calibrationType === 'Doğrulama' ? '-' : device.plannedCalibrationDate ? (() => {
                          const planned = new Date(device.plannedCalibrationDate!)
                          const lastCal = new Date(device.lastCalibrationDate)
                          const now = new Date()
                          if (lastCal >= planned) {
                            return (
                              <span className="text-green-600 font-medium" title="Kalibrasyon tamamlandı">
                                {planned.toLocaleDateString('tr-TR')} ✓
                              </span>
                            )
                          }
                          if (planned < now) {
                            return (
                              <span className="text-red-600 font-medium" title="Kalibrasyon gecikmiş">
                                {planned.toLocaleDateString('tr-TR')} !
                              </span>
                            )
                          }
                          return (
                            <span className="text-yellow-600" title="Kalibrasyon bekliyor">
                              {planned.toLocaleDateString('tr-TR')}
                            </span>
                          )
                        })() : "-"}
                      </TableCell>
                      <TableCell>
                        {device.calibrationType === 'Kalibrasyon' ? '-' : device.lastVerificationDate
                          ? new Date(device.lastVerificationDate).toLocaleDateString('tr-TR')
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {device.calibrationType === 'Kalibrasyon' ? '-' : device.plannedVerificationDate ? (() => {
                          const planned = new Date(device.plannedVerificationDate!)
                          const lastVer = device.lastVerificationDate ? new Date(device.lastVerificationDate) : null
                          const now = new Date()
                          if (lastVer && lastVer >= planned) {
                            return (
                              <span className="text-green-600 font-medium" title="Doğrulama tamamlandı">
                                {planned.toLocaleDateString('tr-TR')} ✓
                              </span>
                            )
                          }
                          if (planned < now) {
                            return (
                              <span className="text-red-600 font-medium" title="Doğrulama gecikmiş">
                                {planned.toLocaleDateString('tr-TR')} !
                              </span>
                            )
                          }
                          return (
                            <span className="text-yellow-600" title="Doğrulama bekliyor">
                              {planned.toLocaleDateString('tr-TR')}
                            </span>
                          )
                        })() : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(device.status)}</TableCell>
                      <TableCell>
                        {attachmentCount > 0 ? (
                          <Badge
                            variant="outline"
                            className="gap-1 cursor-pointer hover:bg-accent"
                            onClick={() => {
                              setSelectedAttachments(attachments)
                              setSelectedDeviceName(device.deviceId)
                              setShowAttachmentsDialog(true)
                            }}
                          >
                            <FileText className="h-3 w-3" />
                            {attachmentCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setStatusDevice(device)
                              setSelectedStatus(device.status)
                              setShowStatusDialog(true)
                            }}
                            title="Durum Değiştir"
                          >
                            <Settings2 className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(device)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDevice(device.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Toplam {filteredDevices.length} kayıt - Sayfa {currentPage} / {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Önceki
                </Button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first, last, current, and pages around current
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      )
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="px-2 py-1 text-muted-foreground">...</span>
                    }
                    return null
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleEditDevice}>
            <DialogHeader>
              <DialogTitle>Cihaz Düzenle</DialogTitle>
              <DialogDescription>
                Cihaz bilgilerini güncelleyin
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Kalibrasyon Bilgisi Özeti */}
              {selectedDevice && (
                <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Kalibrasyon Bilgisi</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditDialogOpen(false)
                        openHistoryDialog(selectedDevice)
                      }}
                    >
                      <History className="mr-2 h-3 w-3" />
                      Geçmişi Gör
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Son Kalibrasyon</p>
                      <p className="font-medium">{new Date(selectedDevice.lastCalibrationDate).toLocaleDateString('tr-TR')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Sonraki Vade</p>
                      <p className="font-medium">{new Date(selectedDevice.nextCalibrationDate).toLocaleDateString('tr-TR')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Planlanan Tarih</p>
                      <p className="font-medium">
                        {formData.plannedCalibrationDate
                          ? new Date(formData.plannedCalibrationDate).toLocaleDateString('tr-TR')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Kalibrasyon Durumu</p>
                      {(() => {
                        if (!formData.plannedCalibrationDate) {
                          return <p className="text-muted-foreground text-xs mt-1">Tarih planlanmadı</p>
                        }
                        const planned = new Date(formData.plannedCalibrationDate)
                        const lastCal = new Date(selectedDevice.lastCalibrationDate)
                        const now = new Date()
                        if (lastCal >= planned) {
                          return (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 mt-1">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Tamamlandı
                            </Badge>
                          )
                        }
                        if (planned < now) {
                          return (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100 mt-1">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Gecikmiş
                            </Badge>
                          )
                        }
                        const daysLeft = Math.ceil((planned.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                        return (
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 mt-1">
                            <Clock className="mr-1 h-3 w-3" />
                            {daysLeft} gün kaldı
                          </Badge>
                        )
                      })()}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maliyet bilgisi &quot;Geçmişi Gör&quot; bölümünden her kalibrasyon kaydına ayrı ayrı girilir.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-deviceId">Cihaz ID</Label>
                  <Input
                    id="edit-deviceId"
                    value={formData.deviceId}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Cihaz Tipi</Label>
                  <Select
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  >
                    <option value="">Seçiniz</option>
                    {deviceNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-calibrationType">Yöntem</Label>
                  <Select
                    id="edit-calibrationType"
                    value={formData.calibrationType}
                    onChange={(e) => setFormData({ ...formData, calibrationType: e.target.value })}
                  >
                    <option value="">Seçiniz</option>
                    <option value="Kalibrasyon">Kalibrasyon</option>
                    <option value="Doğrulama">Doğrulama</option>
                    <option value="Kal/Doğ">Kal/Doğ</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-manufacturer">Marka</Label>
                  <Input
                    id="edit-manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-model">Model</Label>
                  <Input
                    id="edit-model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Model adı girin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-serialNumber">Seri No</Label>
                  <Input
                    id="edit-serialNumber"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-location">Lokasyon</Label>
                  <Select
                    id="edit-location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  >
                    <option value="">Seçiniz</option>
                    {locations.map((location) => (
                      <option key={location} value={location}>{location}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Departman</Label>
                  <Select
                    id="edit-department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value, ...(e.target.value !== "Üretim" ? { location: formData.location } : {}) })}
                  >
                    <option value="">Seçiniz</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </Select>
                </div>
              </div>

              {formData.department === "Üretim" && (
                <div className="space-y-2">
                  <Label htmlFor="edit-productionSection">Üretim Bölümü</Label>
                  <Select
                    id="edit-productionSection"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  >
                    <option value="">Bölüm Seçiniz</option>
                    {productionSections.map((section) => (
                      <option key={section} value={section}>{section}</option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-responsiblePerson">Sorumlu Kişi</Label>
                  <UserSearchCombobox
                    value={formData.responsiblePersonEmail}
                    onSelect={(user) => {
                      setFormData(prev => ({
                        ...prev,
                        responsiblePerson: user?.name || "",
                        responsiblePersonEmail: user?.email || ""
                      }))
                    }}
                    placeholder="Sorumlu kişi arayın..."
                  />
                  {formData.responsiblePersonEmail && (
                    <p className="text-xs text-muted-foreground">
                      Kalibrasyon süresi dolmadan 7 gün önce bu kişiye mail gönderilecektir.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-requiresResponsible">Zorunlu Zimmet</Label>
                  <div className="flex items-center h-10">
                    <input
                      type="checkbox"
                      id="edit-requiresResponsible"
                      checked={formData.requiresResponsible}
                      onChange={(e) => setFormData({ ...formData, requiresResponsible: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="edit-requiresResponsible" className="ml-2 text-sm text-muted-foreground">
                      Bu cihaz için zimmet zorunludur
                    </label>
                  </div>
                </div>
              </div>

              {/* Cihaz Durumu */}
              <div className="space-y-2">
                <Label htmlFor="edit-deviceCondition">Cihaz Durumu</Label>
                <Select
                  id="edit-deviceCondition"
                  value={formData.deviceCondition}
                  onChange={(e) => {
                    const val = e.target.value
                    setFormData({
                      ...formData,
                      deviceCondition: val,
                      // Tarihler durum değişse bile korunur - geçmiş kalibrasyon bilgisi saklanır
                    })
                  }}
                >
                  <option value="">Seçiniz</option>
                  <option value="Kalibrasyonda">Kalibrasyonda</option>
                  <option value="Şirkette">Şirkette</option>
                  <option value="Hurda">Hurda</option>
                </Select>
              </div>

              {formData.deviceCondition === "Kalibrasyonda" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-calibrationSentDate">Gönderim Tarihi</Label>
                    <Input
                      id="edit-calibrationSentDate"
                      type="date"
                      value={formData.calibrationSentDate}
                      onChange={(e) => setFormData({ ...formData, calibrationSentDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-calibrationReturnDate">Dönüş Tarihi</Label>
                    <Input
                      id="edit-calibrationReturnDate"
                      type="date"
                      value={formData.calibrationReturnDate}
                      onChange={(e) => setFormData({ ...formData, calibrationReturnDate: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Gün sayısı bilgisi: durum değişse bile tarihler varsa gösterilir */}
              {formData.calibrationSentDate && (() => {
                const sent = new Date(formData.calibrationSentDate)
                const isOngoing = !formData.calibrationReturnDate && formData.deviceCondition === "Kalibrasyonda"
                const end = formData.calibrationReturnDate
                  ? new Date(formData.calibrationReturnDate)
                  : new Date()
                const days = Math.max(0, Math.floor((end.getTime() - sent.getTime()) / 86400000))
                return (
                  <div className={`rounded-md border px-3 py-2 text-sm flex items-center gap-2 ${
                    isOngoing ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-sky-50 border-sky-200 text-sky-800'
                  }`}>
                    <Clock className="h-4 w-4" />
                    <span>
                      {isOngoing
                        ? `${days} gün kalibrasyonda (devam ediyor)`
                        : formData.calibrationReturnDate
                          ? `Son kalibrasyon: ${days} gün sürdü (${new Date(formData.calibrationSentDate).toLocaleDateString('tr-TR')} → ${new Date(formData.calibrationReturnDate).toLocaleDateString('tr-TR')})`
                          : `Son gönderim: ${new Date(formData.calibrationSentDate).toLocaleDateString('tr-TR')} (${days} gün)`}
                    </span>
                  </div>
                )
              })()}

              {formData.deviceCondition === "Hurda" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-scrapDate">Hurda Tarihi</Label>
                    <Input
                      id="edit-scrapDate"
                      type="date"
                      value={formData.scrapDate}
                      onChange={(e) => setFormData({ ...formData, scrapDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-scrapDescription">Hurda Açıklaması</Label>
                    <Input
                      id="edit-scrapDescription"
                      value={formData.scrapDescription}
                      onChange={(e) => setFormData({ ...formData, scrapDescription: e.target.value })}
                      placeholder="Hurda sebebini yazınız..."
                    />
                  </div>
                </div>
              )}

              {/* Kalibrasyon alanları - Kalibrasyon veya Kal/Doğ seçildiğinde */}
              {(formData.calibrationType === 'Kalibrasyon' || formData.calibrationType === 'Kal/Doğ') && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-calibrationInterval">Kalibrasyon Periyodu (gün)</Label>
                      <Input
                        id="edit-calibrationInterval"
                        type="number"
                        value={formData.calibrationInterval}
                        onChange={(e) => {
                          const newInterval = e.target.value
                          const interval = parseInt(newInterval) || 365
                          const planned = formData.lastCalibrationDate ? new Date(new Date(formData.lastCalibrationDate).getTime() + (interval - 20) * 86400000).toISOString().split('T')[0] : ""
                          setFormData({ ...formData, calibrationInterval: newInterval, plannedCalibrationDate: planned || formData.plannedCalibrationDate })
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-lastCalibrationDate">Son Kalibrasyon Tarihi</Label>
                      <Input
                        id="edit-lastCalibrationDate"
                        type="date"
                        value={formData.lastCalibrationDate}
                        onChange={(e) => {
                          const val = e.target.value
                          const interval = parseInt(formData.calibrationInterval) || 365
                          const planned = val ? new Date(new Date(val).getTime() + (interval - 20) * 86400000).toISOString().split('T')[0] : ""
                          setFormData({ ...formData, lastCalibrationDate: val, plannedCalibrationDate: planned })
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-plannedCalibrationDate">Planlanan Kalibrasyon Tarihi</Label>
                    <Input
                      id="edit-plannedCalibrationDate"
                      type="date"
                      value={formData.plannedCalibrationDate}
                      onChange={(e) => setFormData({ ...formData, plannedCalibrationDate: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Sonraki kalibrasyon tarihinden 20 gün önce otomatik hesaplanır, değiştirilebilir
                    </p>
                  </div>
                </>
              )}

              {/* Doğrulama alanları - Doğrulama veya Kal/Doğ seçildiğinde */}
              {(formData.calibrationType === 'Doğrulama' || formData.calibrationType === 'Kal/Doğ') && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-verificationInterval">Doğrulama Periyodu (gün)</Label>
                      <Input
                        id="edit-verificationInterval"
                        type="number"
                        value={formData.verificationInterval}
                        onChange={(e) => {
                          const newInterval = e.target.value
                          const interval = parseInt(newInterval) || 365
                          const planned = formData.lastVerificationDate ? new Date(new Date(formData.lastVerificationDate).getTime() + (interval - 20) * 86400000).toISOString().split('T')[0] : ""
                          setFormData({ ...formData, verificationInterval: newInterval, plannedVerificationDate: planned || formData.plannedVerificationDate })
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-lastVerificationDate">Son Doğrulama Tarihi</Label>
                      <Input
                        id="edit-lastVerificationDate"
                        type="date"
                        value={formData.lastVerificationDate}
                        onChange={(e) => {
                          const val = e.target.value
                          const interval = parseInt(formData.verificationInterval) || 365
                          const planned = val ? new Date(new Date(val).getTime() + (interval - 20) * 86400000).toISOString().split('T')[0] : ""
                          setFormData({ ...formData, lastVerificationDate: val, plannedVerificationDate: planned })
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-plannedVerificationDate">Planlanan Doğrulama Tarihi</Label>
                    <Input
                      id="edit-plannedVerificationDate"
                      type="date"
                      value={formData.plannedVerificationDate}
                      onChange={(e) => setFormData({ ...formData, plannedVerificationDate: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Sonraki doğrulama tarihinden 20 gün önce otomatik hesaplanır, değiştirilebilir
                    </p>
                  </div>
                </>
              )}

              {/* Tip seçilmediğinde default kalibrasyon alanları */}
              {!formData.calibrationType && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-calibrationInterval">Kalibrasyon Periyodu (gün)</Label>
                      <Input
                        id="edit-calibrationInterval"
                        type="number"
                        value={formData.calibrationInterval}
                        onChange={(e) => setFormData({ ...formData, calibrationInterval: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-lastCalibrationDate">Son Kalibrasyon Tarihi</Label>
                      <Input
                        id="edit-lastCalibrationDate"
                        type="date"
                        value={formData.lastCalibrationDate}
                        onChange={(e) => {
                          const val = e.target.value
                          const interval = parseInt(formData.calibrationInterval) || 365
                          const planned = val ? new Date(new Date(val).getTime() + (interval - 20) * 86400000).toISOString().split('T')[0] : ""
                          setFormData({ ...formData, lastCalibrationDate: val, plannedCalibrationDate: planned })
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-plannedCalibrationDate">Planlanan Kalibrasyon Tarihi</Label>
                    <Input
                      id="edit-plannedCalibrationDate"
                      type="date"
                      value={formData.plannedCalibrationDate}
                      onChange={(e) => setFormData({ ...formData, plannedCalibrationDate: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Sonraki kalibrasyon tarihinden 20 gün önce otomatik hesaplanır, değiştirilebilir
                    </p>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-certificateNumber">Sertifika No</Label>
                <Input
                  id="edit-certificateNumber"
                  value={formData.certificateNumber}
                  onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notlar</Label>
                <Input
                  id="edit-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-image">Cihaz Görseli</Label>
                <Input
                  id="edit-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={uploadingFiles}
                />
                {formData.imageUrl && (
                  <div className="mt-2">
                    <img src={formData.imageUrl} alt="Cihaz" className="h-24 w-24 object-cover rounded" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-attachments">Ekler (Sertifika, PDF vs.)</Label>
                <Input
                  id="edit-attachments"
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  onChange={handleAttachmentsChange}
                  disabled={uploadingFiles}
                />
                {formData.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {formData.attachments.map((url, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex-1">
                          {url.split('/').pop()}
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit" disabled={uploadingFiles}>
                {uploadingFiles ? 'Dosyalar yükleniyor...' : 'Güncelle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Error Log Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Excel İçeri Aktarma Hataları</DialogTitle>
            <DialogDescription>
              Son içeri aktarma işleminde {lastImportErrors.length} hata oluştu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="rounded-md bg-red-50 border border-red-200 p-4">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {lastImportErrors.map((error, index) => (
                  <div key={index} className="text-sm font-mono text-red-800 border-b border-red-100 pb-2 last:border-0">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowErrorDialog(false)}>
              Kapat
            </Button>
            <Button
              variant="default"
              onClick={() => {
                const errorText = lastImportErrors.join('\n')
                navigator.clipboard.writeText(errorText)
                toast.success('Hatalar panoya kopyalandı!')
              }}
            >
              Panoya Kopyala
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachments Dialog */}
      <Dialog open={showAttachmentsDialog} onOpenChange={setShowAttachmentsDialog}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ekler - {selectedDeviceName}</DialogTitle>
            <DialogDescription>
              {selectedAttachments.length} ek dosya
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              {selectedAttachments.map((url, index) => {
                const fileName = url.split('/').pop() || `Ek ${index + 1}`
                const fileExtension = fileName.split('.').pop()?.toLowerCase()
                const isPDF = fileExtension === 'pdf'
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension || '')

                return (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer no-underline text-inherit"
                  >
                    <div className="flex-shrink-0">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fileName}</p>
                      <p className="text-xs text-muted-foreground uppercase">
                        {isPDF ? 'PDF Dosyası' : isImage ? 'Görsel' : fileExtension || 'Dosya'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <span>Aç</span>
                    </Button>
                  </a>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAttachmentsDialog(false)}
            >
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Kalibrasyon Geçmişi - {historyDevice?.deviceId} ({historyDevice?.name})
            </DialogTitle>
            <DialogDescription>
              Cihazın tüm kalibrasyon kayıtları
            </DialogDescription>
          </DialogHeader>

          {loadingHistory ? (
            <p className="text-center text-muted-foreground py-8">Yükleniyor...</p>
          ) : historyRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Henüz kalibrasyon kaydı yok</p>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Sonraki Vade</TableHead>
                      <TableHead>Sertifika No</TableHead>
                      <TableHead>Kalibre Eden</TableHead>
                      <TableHead>Sonuç</TableHead>
                      <TableHead>Maliyet</TableHead>
                      <TableHead>Notlar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{new Date(record.calibrationDate).toLocaleDateString('tr-TR')}</TableCell>
                        <TableCell>{new Date(record.nextDueDate).toLocaleDateString('tr-TR')}</TableCell>
                        <TableCell>{record.certificateNumber || '-'}</TableCell>
                        <TableCell>{record.calibratedBy || '-'}</TableCell>
                        <TableCell>
                          <Badge className={
                            record.result === 'PASS' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                            record.result === 'FAIL' ? 'bg-red-100 text-red-800 hover:bg-red-100' :
                            'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                          }>
                            {record.result === 'PASS' ? 'Başarılı' :
                             record.result === 'FAIL' ? 'Başarısız' : 'Şartlı'}
                          </Badge>
                        </TableCell>
                        <TableCell>{record.cost ? `${Number(record.cost).toLocaleString('tr-TR')} TL` : '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{record.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-2 text-sm text-right text-muted-foreground">
                Toplam Maliyet: <strong>
                  {historyRecords.reduce((sum, r) => sum + (Number(r.cost) || 0), 0).toLocaleString('tr-TR')} TL
                </strong>
              </div>
            </>
          )}

          {canEdit && (
            <>
              {!showAddHistoryForm ? (
                <Button onClick={() => setShowAddHistoryForm(true)} className="mt-2">
                  <Plus className="mr-2 h-4 w-4" /> Yeni Kalibrasyon Kaydı Ekle
                </Button>
              ) : (
                <form onSubmit={handleAddHistory} className="mt-4 border-t pt-4 space-y-4">
                  <h4 className="font-medium">Yeni Kalibrasyon Kaydı</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Kalibrasyon Tarihi</Label>
                      <Input type="date" value={historyFormData.calibrationDate}
                        onChange={e => setHistoryFormData({...historyFormData, calibrationDate: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Kalibre Eden</Label>
                      <Input value={historyFormData.calibratedBy}
                        onChange={e => setHistoryFormData({...historyFormData, calibratedBy: e.target.value})}
                        placeholder="Firma/Kişi adı" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Sertifika No</Label>
                      <Input value={historyFormData.certificateNumber}
                        onChange={e => setHistoryFormData({...historyFormData, certificateNumber: e.target.value})}
                        placeholder="CERT-2024-001" />
                    </div>
                    <div className="space-y-2">
                      <Label>Maliyet (TL)</Label>
                      <Input type="number" step="0.01" value={historyFormData.cost}
                        onChange={e => setHistoryFormData({...historyFormData, cost: e.target.value})}
                        placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <Label>Sonuç</Label>
                      <Select value={historyFormData.result}
                        onChange={e => setHistoryFormData({...historyFormData, result: e.target.value})}>
                        <option value="PASS">Başarılı</option>
                        <option value="FAIL">Başarısız</option>
                        <option value="CONDITIONAL">Şartlı</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Notlar</Label>
                      <Input value={historyFormData.notes}
                        onChange={e => setHistoryFormData({...historyFormData, notes: e.target.value})}
                        placeholder="Ek bilgiler..." />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setShowAddHistoryForm(false)}>İptal</Button>
                    <Button type="submit">Kaydet</Button>
                  </div>
                </form>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="w-[95vw] max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Durum Değiştir - {statusDevice?.deviceId}</DialogTitle>
            <DialogDescription>
              Cihazın durumunu manuel olarak değiştirin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
              <option value="IN_PROCESS">Kalibrasyonda</option>
              <option value="OUT_OF_ORDER">Arızalı</option>
              <option value="">Otomatik Hesapla (Sıfırla)</option>
            </Select>
            <p className="text-xs text-muted-foreground">
              &quot;Kalibrasyonda&quot; veya &quot;Arızalı&quot; seçildiğinde otomatik durum hesaplaması devre dışı kalır.
              &quot;Otomatik Hesapla&quot; seçeneği tarihe göre durumu yeniden hesaplar.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>İptal</Button>
            <Button onClick={handleStatusChange}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tüm Verileri Sil</DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. Tüm kalibrasyon kayıtları silinecektir.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-md bg-red-50 border border-red-200 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-900">
                    Uyarı: Kalıcı Silme İşlemi
                  </p>
                  <p className="text-sm text-red-700">
                    Toplam <strong>{devices.length}</strong> cihaz kaydı silinecektir. Bu işlem geri alınamaz.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteAllDialog(false)}
              disabled={isDeleting}
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={isDeleting}
            >
              {isDeleting ? 'Siliniyor...' : 'Evet, Tümünü Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
