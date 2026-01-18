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
import { Plus, Search, Filter, Calendar, AlertCircle, CheckCircle2, Clock, Pencil, Trash2, Download, Upload, FileText, Trash, UserX, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import * as XLSX from 'xlsx'
import { toast } from "sonner"

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
  certificateNumber?: string | null
  status: string
  notes?: string | null
  imageUrl?: string | null
  attachments?: string | null
  requiresResponsible?: boolean
}

type ADUser = {
  id: string
  name: string
  email: string
  department?: string | null
  jobTitle?: string | null
}

type Stats = {
  total: number
  valid: number
  expiring: number
  expired: number
  noResponsible: number
}

export default function CalibrationPage() {
  const [devices, setDevices] = useState<CalibrationDevice[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, valid: 0, expiring: 0, expired: 0, noResponsible: 0 })
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
    certificateNumber: "",
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
  const [responsiblePersons, setResponsiblePersons] = useState<ADUser[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [lastImportErrors, setLastImportErrors] = useState<string[]>([])
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAttachmentsDialog, setShowAttachmentsDialog] = useState(false)
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([])
  const [selectedDeviceName, setSelectedDeviceName] = useState("")

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
      const [settingsRes, deptRes, usersRes] = await Promise.all([
        fetch('/api/settings/calibration'),
        fetch('/api/departments'),
        fetch('/api/users'),
      ])

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setLocations(data.locations?.map((l: any) => l.name) || [])
        setDeviceTypes(data.deviceTypes?.map((t: any) => t.name) || [])
        setDeviceNames(data.deviceModels?.map((m: any) => m.name) || [])
        setModels(data.deviceModels?.map((m: any) => m.name) || [])
      }

      if (deptRes.ok) {
        const depts = await deptRes.json()
        setDepartments(depts.map((d: any) => d.name))
      }

      if (usersRes.ok) {
        const users = await usersRes.json()
        setResponsiblePersons(users.filter((u: any) => u.name && u.email))
      }
    } catch (error) {
      console.error('Dropdown verileri yüklenirken hata:', error)
      // Fallback - sabit değerler
      setDepartments(["Üretim", "Kalite Kontrol", "Ar-Ge", "Bakım Onarım", "Laboratuvar"])
      setLocations(["Ana Bina - 1. Kat", "Üretim Tesisi", "Laboratuvar"])
      setDeviceTypes(["Ölçüm Cihazı", "Test Ekipmanı", "Analiz Cihazı"])
      setDeviceNames(["Dijital Kumpas", "Hassas Terazi", "pH Metre"])
      setModels(["Mitutoyo 500-196", "Sartorius BP 210 S"])
      setResponsiblePersons([
        { id: "1", name: "Ahmet Yılmaz", email: "ahmet.yilmaz@ilerigroup.com" },
        { id: "2", name: "Ayşe Kaya", email: "ayse.kaya@ilerigroup.com" }
      ])
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
            <Clock className="mr-1 h-3 w-3" />
            Kalibrasyonda
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
      if (sortField === 'lastCalibrationDate' || sortField === 'nextCalibrationDate') {
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
      certificateNumber: "",
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
      const deviceId = formData.deviceId || generateDeviceId()

      const response = await fetch('/api/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          deviceId,
          calibrationInterval: parseInt(formData.calibrationInterval),
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
          calibrationInterval: parseInt(formData.calibrationInterval),
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
        toast.error('Cihazlar silinirken bir hata oluştu')
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
      calibrationInterval: device.calibrationInterval.toString(),
      lastCalibrationDate: new Date(device.lastCalibrationDate).toISOString().split('T')[0],
      certificateNumber: device.certificateNumber || "",
      notes: device.notes || "",
      imageUrl: device.imageUrl || "",
      attachments: Array.isArray(deviceAttachments) ? deviceAttachments : [],
      requiresResponsible: device.requiresResponsible || false,
    })
    setIsEditDialogOpen(true)
  }

  // Excel'e aktar
  const handleExportToExcel = () => {
    const exportData = devices.map(device => ({
      'Cihaz ID': device.deviceId,
      'Cihaz Adı': device.name,
      'Cihaz Tipi': device.type,
      'Üretici': device.manufacturer || '',
      'Model': device.model || '',
      'Seri No': device.serialNumber || '',
      'Lokasyon': device.location || '',
      'Departman': device.department || '',
      'Sorumlu Kişi': device.responsiblePerson || '',
      'Kalibrasyon Periyodu (Gün)': device.calibrationInterval,
      'Son Kalibrasyon': new Date(device.lastCalibrationDate).toLocaleDateString('tr-TR'),
      'Sonraki Kalibrasyon': new Date(device.nextCalibrationDate).toLocaleDateString('tr-TR'),
      'Sertifika No': device.certificateNumber || '',
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

            const response = await fetch('/api/calibration', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deviceId: deviceId.toString().trim(),
                name: deviceName.toString().trim(),
                type: deviceType.toString().trim(),
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kalibrasyon Yönetimi</h1>
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
          <Button
            variant="destructive"
            onClick={() => setShowDeleteAllDialog(true)}
            disabled={devices.length === 0}
          >
            <Trash className="mr-2 h-4 w-4" />
            Tüm Verileri Sil
          </Button>
          <Button variant="outline" onClick={handleExportToExcel}>
            <Download className="mr-2 h-4 w-4" />
            Excel'e Aktar
          </Button>
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
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Cihaz Ekle
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddDevice}>
              <DialogHeader>
                <DialogTitle>Yeni Cihaz Ekle</DialogTitle>
                <DialogDescription>
                  Kalibrasyona tabi yeni bir cihaz ekleyin
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deviceId">Cihaz ID (Otomatik)</Label>
                    <Input
                      id="deviceId"
                      value={formData.deviceId || generateDeviceId()}
                      onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                      placeholder="Otomatik oluşturulacak"
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Cihaz Adı</Label>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calibrationType">Tip</Label>
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
                    <Label htmlFor="manufacturer">Üretici</Label>
                    <Input
                      id="manufacturer"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      placeholder="Mitutoyo"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
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
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    >
                      <option value="">Seçiniz</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="responsiblePerson">Sorumlu Kişi (AD)</Label>
                    <Select
                      id="responsiblePerson"
                      value={formData.responsiblePersonEmail}
                      onChange={(e) => {
                        const selectedUser = responsiblePersons.find(p => p.email === e.target.value)
                        setFormData({
                          ...formData,
                          responsiblePerson: selectedUser?.name || "",
                          responsiblePersonEmail: selectedUser?.email || ""
                        })
                      }}
                    >
                      <option value="">Seçiniz</option>
                      {responsiblePersons.map((person) => (
                        <option key={person.email} value={person.email}>
                          {person.name} ({person.email})
                        </option>
                      ))}
                    </Select>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calibrationInterval">Kalibrasyon Periyodu (gün)</Label>
                    <Input
                      id="calibrationInterval"
                      type="number"
                      value={formData.calibrationInterval}
                      onChange={(e) => setFormData({ ...formData, calibrationInterval: e.target.value })}
                      placeholder="365"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastCalibrationDate">Son Kalibrasyon Tarihi</Label>
                    <Input
                      id="lastCalibrationDate"
                      type="date"
                      value={formData.lastCalibrationDate}
                      onChange={(e) => setFormData({ ...formData, lastCalibrationDate: e.target.value })}
                    />
                  </div>
                </div>

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
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
          <div className="rounded-md border">
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
                      Tip
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
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz cihaz eklenmemiş'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDevices.map((device) => {
                    const attachments = device.attachments ? JSON.parse(device.attachments as string) : []
                    const attachmentCount = Array.isArray(attachments) ? attachments.length : 0

                    return (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">{device.deviceId}</TableCell>
                      <TableCell>{device.model || "-"}</TableCell>
                      <TableCell>{device.calibrationType || "-"}</TableCell>
                      <TableCell>{device.department || "-"}</TableCell>
                      <TableCell>{new Date(device.lastCalibrationDate).toLocaleDateString('tr-TR')}</TableCell>
                      <TableCell>{new Date(device.nextCalibrationDate).toLocaleDateString('tr-TR')}</TableCell>
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
                      <TableCell className="text-right">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-deviceId">Cihaz ID</Label>
                  <Input
                    id="edit-deviceId"
                    value={formData.deviceId}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Cihaz Adı</Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-calibrationType">Tip</Label>
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
                  <Label htmlFor="edit-manufacturer">Üretici</Label>
                  <Input
                    id="edit-manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  >
                    <option value="">Seçiniz</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-responsiblePerson">Sorumlu Kişi (AD)</Label>
                  <Select
                    id="edit-responsiblePerson"
                    value={formData.responsiblePersonEmail}
                    onChange={(e) => {
                      const selectedUser = responsiblePersons.find(p => p.email === e.target.value)
                      setFormData({
                        ...formData,
                        responsiblePerson: selectedUser?.name || "",
                        responsiblePersonEmail: selectedUser?.email || ""
                      })
                    }}
                  >
                    <option value="">Seçiniz</option>
                    {responsiblePersons.map((person) => (
                      <option key={person.email} value={person.email}>
                        {person.name} ({person.email})
                      </option>
                    ))}
                  </Select>
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

              <div className="grid grid-cols-2 gap-4">
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
                    onChange={(e) => setFormData({ ...formData, lastCalibrationDate: e.target.value })}
                  />
                </div>
              </div>

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
        <DialogContent className="max-w-md">
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
