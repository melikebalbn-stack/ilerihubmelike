"use client"

import { useState, useEffect, useRef } from "react"
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
import {
  Server,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Search,
  Download,
  Upload,
  HardDrive,
  Globe,
  Database,
  Users,
  Building2,
  Cloud,
  Package,
  Filter,
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

interface Asset {
  id: string
  assetNumber: string
  name: string
  description: string | null
  category: string
  type: string
  location: string | null
  department: string | null
  owner: { id: string; name: string; email: string } | null
  custodian: { id: string; name: string; email: string } | null
  confidentiality: number
  integrity: number
  availability: number
  assetValue: number | null
  criticality: string
  classification: string
  status: string
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  hostname: string | null
  ipAddress: string | null
  macAddress: string | null
  operatingSystem: string | null
  processor: string | null
  ram: string | null
  diskSize: string | null
  barcode: string | null
  warrantyEndDate: string | null
  assignedTo: string | null
  assignedToEmail: string | null
  notes: string | null
  _count?: { childAssets: number }
}

interface Stats {
  total: number
  byCategory: Record<string, number>
  byCriticality: Record<string, number>
  byStatus: Record<string, number>
  reviewDue: number
}

interface ImportResult {
  message: string
  success: number
  failed: number
  skipped: number
  errors: string[]
  columnMapping: Record<string, string | null>
}

const CATEGORIES = [
  { value: "INFORMATION", label: "Bilgi Varliklari", icon: Database },
  { value: "SOFTWARE", label: "Yazilim", icon: Package },
  { value: "HARDWARE", label: "Donanim", icon: HardDrive },
  { value: "NETWORK", label: "Ag", icon: Globe },
  { value: "PERSONNEL", label: "Personel", icon: Users },
  { value: "PHYSICAL", label: "Fiziksel", icon: Building2 },
  { value: "SERVICE", label: "Hizmet", icon: Cloud },
]

const TYPES: Record<string, { value: string; label: string }[]> = {
  INFORMATION: [
    { value: "DATABASE", label: "Veritabani" },
    { value: "DOCUMENT", label: "Dokuman" },
    { value: "RECORD", label: "Kayit" },
    { value: "BACKUP", label: "Yedek" },
  ],
  SOFTWARE: [
    { value: "APPLICATION", label: "Uygulama" },
    { value: "OPERATING_SYSTEM", label: "Isletim Sistemi" },
    { value: "MIDDLEWARE", label: "Ara Katman" },
    { value: "DEVELOPMENT_TOOL", label: "Gelistirme Araci" },
  ],
  HARDWARE: [
    { value: "SERVER", label: "Sunucu" },
    { value: "DESKTOP", label: "Masaustu" },
    { value: "LAPTOP", label: "Dizustu" },
    { value: "MOBILE_DEVICE", label: "Mobil Cihaz" },
    { value: "STORAGE", label: "Depolama" },
    { value: "PRINTER", label: "Yazici" },
  ],
  NETWORK: [
    { value: "ROUTER", label: "Yonlendirici" },
    { value: "SWITCH", label: "Anahtar" },
    { value: "FIREWALL", label: "Guvenlik Duvari" },
    { value: "ACCESS_POINT", label: "Erisim Noktasi" },
  ],
  PHYSICAL: [
    { value: "BUILDING", label: "Bina" },
    { value: "ROOM", label: "Oda" },
    { value: "CABINET", label: "Kabin" },
    { value: "MEDIA", label: "Ortam" },
  ],
  SERVICE: [
    { value: "CLOUD_SERVICE", label: "Bulut Hizmeti" },
    { value: "EXTERNAL_SERVICE", label: "Dis Hizmet" },
    { value: "UTILITY", label: "Altyapi Hizmeti" },
  ],
  PERSONNEL: [{ value: "OTHER", label: "Diger" }],
}

const CRITICALITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-700",
  UNDER_MAINTENANCE: "bg-yellow-100 text-yellow-700",
  DISPOSED: "bg-red-100 text-red-700",
  LOST: "bg-purple-100 text-purple-700",
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  PUBLIC: "bg-blue-100 text-blue-700",
  INTERNAL: "bg-gray-100 text-gray-700",
  CONFIDENTIAL: "bg-orange-100 text-orange-700",
  RESTRICTED: "bg-red-100 text-red-700",
}

const CATEGORY_COLORS: Record<string, string> = {
  INFORMATION: "bg-indigo-500",
  SOFTWARE: "bg-purple-500",
  HARDWARE: "bg-blue-500",
  NETWORK: "bg-teal-500",
  PERSONNEL: "bg-amber-500",
  PHYSICAL: "bg-emerald-500",
  SERVICE: "bg-pink-500",
}

const initialFormData = {
  name: "",
  description: "",
  category: "",
  type: "",
  location: "",
  department: "",
  confidentiality: 1,
  integrity: 1,
  availability: 1,
  classification: "INTERNAL",
  status: "ACTIVE",
  manufacturer: "",
  model: "",
  serialNumber: "",
  hostname: "",
  ipAddress: "",
  macAddress: "",
  operatingSystem: "",
  processor: "",
  ram: "",
  diskSize: "",
  barcode: "",
  warrantyEndDate: "",
  assignedTo: "",
  assignedToEmail: "",
  notes: "",
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("")
  const [filterStatus, setFilterStatus] = useState<string>("")
  const [filterCriticality, setFilterCriticality] = useState<string>("")

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<Record<string, unknown>[]>([])
  const [importColumns, setImportColumns] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [formData, setFormData] = useState(initialFormData)

  useEffect(() => {
    fetchAssets()
  }, [filterCategory, filterStatus, filterCriticality])

  const fetchAssets = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterCategory && filterCategory !== "all") params.append("category", filterCategory)
      if (filterStatus && filterStatus !== "all") params.append("status", filterStatus)
      if (filterCriticality && filterCriticality !== "all") params.append("criticality", filterCriticality)

      const res = await fetch(`/api/iso27001/assets?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAssets(data.assets)
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Varliklar alinamadi:", error)
      toast.error("Varliklar yuklenemedi")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.category || !formData.type) {
      toast.error("Zorunlu alanlari doldurun")
      return
    }

    setSaving(true)
    try {
      const url = editingAsset
        ? `/api/iso27001/assets/${editingAsset.id}`
        : "/api/iso27001/assets"
      const method = editingAsset ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success(editingAsset ? "Varlik guncellendi" : "Varlik olusturuldu")
        setDialogOpen(false)
        resetForm()
        fetchAssets()
      } else {
        const error = await res.json()
        toast.error(error.error || "Islem basarisiz")
      }
    } catch {
      toast.error("Bir hata olustu")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Bu varligi silmek istediginizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/iso27001/assets/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Varlik silindi")
        fetchAssets()
      } else {
        const error = await res.json()
        toast.error(error.error || "Silme basarisiz")
      }
    } catch {
      toast.error("Bir hata olustu")
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setEditingAsset(null)
  }

  const openEditDialog = (asset: Asset) => {
    setEditingAsset(asset)
    setFormData({
      name: asset.name,
      description: asset.description || "",
      category: asset.category,
      type: asset.type,
      location: asset.location || "",
      department: asset.department || "",
      confidentiality: asset.confidentiality,
      integrity: asset.integrity,
      availability: asset.availability,
      classification: asset.classification,
      status: asset.status,
      manufacturer: asset.manufacturer || "",
      model: asset.model || "",
      serialNumber: asset.serialNumber || "",
      hostname: asset.hostname || "",
      ipAddress: asset.ipAddress || "",
      macAddress: asset.macAddress || "",
      operatingSystem: asset.operatingSystem || "",
      processor: asset.processor || "",
      ram: asset.ram || "",
      diskSize: asset.diskSize || "",
      barcode: asset.barcode || "",
      warrantyEndDate: asset.warrantyEndDate ? asset.warrantyEndDate.split("T")[0] : "",
      assignedTo: asset.assignedTo || "",
      assignedToEmail: asset.assignedToEmail || "",
      notes: asset.notes || "",
    })
    setDialogOpen(true)
  }

  const filteredAssets = assets.filter(
    (a) =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.assetNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.hostname && a.hostname.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.ipAddress && a.ipAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.assignedTo && a.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Excel import - dosya secildiginde on izleme
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    setImportResult(null)

    try {
      const XLSX = await import("xlsx")
      const reader = new FileReader()
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]
        setImportColumns(Object.keys(jsonData[0] || {}))
        setImportPreview(jsonData.slice(0, 5))
      }
      reader.readAsArrayBuffer(file)
    } catch {
      toast.error("Dosya okunamadi")
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    setIsImporting(true)
    try {
      const fd = new FormData()
      fd.append("file", importFile)
      const res = await fetch("/api/iso27001/assets/import", { method: "POST", body: fd })
      const result = await res.json()
      if (res.ok) {
        setImportResult(result)
        toast.success(result.message)
        fetchAssets()
      } else {
        toast.error(result.error || "Import basarisiz")
      }
    } catch {
      toast.error("Import sirasinda hata olustu")
    } finally {
      setIsImporting(false)
    }
  }

  const resetImport = () => {
    setImportFile(null)
    setImportPreview([])
    setImportColumns([])
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category)
    if (cat) {
      const Icon = cat.icon
      return <Icon className="h-4 w-4" />
    }
    return <Server className="h-4 w-4" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            Varlik Envanteri
          </h1>
          <p className="text-muted-foreground">
            ISO 27001:2022 A.5.9 - Bilgi ve diger iliskili varliklarin envanteri
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setImportDialogOpen(true); resetImport(); }}>
            <Upload className="h-4 w-4 mr-2" />
            Toplu Ice Aktar
          </Button>
          <Button variant="outline" onClick={() => window.open("/api/iso27001/assets/export", "_blank")}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel Aktar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Yeni Varlik
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAsset ? "Varlik Duzenle" : "Yeni Varlik Ekle"}</DialogTitle>
                <DialogDescription>Varlik bilgilerini girin</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Temel Bilgiler */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Varlik Adi *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="orn: Uretim Sunucusu"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Kategori *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v, type: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Kategori secin" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Tur *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v) => setFormData({ ...formData, type: v })}
                      disabled={!formData.category}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tur secin" />
                      </SelectTrigger>
                      <SelectContent>
                        {(TYPES[formData.category] || []).map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Durum</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Aktif</SelectItem>
                        <SelectItem value="INACTIVE">Pasif</SelectItem>
                        <SelectItem value="UNDER_MAINTENANCE">Bakimda</SelectItem>
                        <SelectItem value="DISPOSED">Imha Edildi</SelectItem>
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
                    placeholder="Varlik hakkinda aciklama"
                    rows={2}
                  />
                </div>

                {/* Konum ve Departman */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Konum</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="orn: Veri Merkezi A"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Departman</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="orn: Bilgi Islem"
                    />
                  </div>
                </div>

                {/* Uretici / Model / Seri No */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Uretici</Label>
                    <Input
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      placeholder="orn: Dell"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Input
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="orn: OptiPlex 7090"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Seri No</Label>
                    <Input
                      value={formData.serialNumber}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    />
                  </div>
                </div>

                {/* BT Donanim Detaylari - HARDWARE kategorisinde goruntulenir */}
                {(formData.category === "HARDWARE" || formData.category === "NETWORK") && (
                  <div className="border rounded-lg p-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      BT Donanim Detaylari
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Hostname</Label>
                        <Input
                          value={formData.hostname}
                          onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                          placeholder="orn: PC-MUHASEBE-01"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>IP Adresi</Label>
                        <Input
                          value={formData.ipAddress}
                          onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                          placeholder="orn: 192.168.1.100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>MAC Adresi</Label>
                        <Input
                          value={formData.macAddress}
                          onChange={(e) => setFormData({ ...formData, macAddress: e.target.value })}
                          placeholder="orn: AA:BB:CC:DD:EE:FF"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Isletim Sistemi</Label>
                        <Input
                          value={formData.operatingSystem}
                          onChange={(e) => setFormData({ ...formData, operatingSystem: e.target.value })}
                          placeholder="orn: Windows 11 Pro"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Islemci</Label>
                        <Input
                          value={formData.processor}
                          onChange={(e) => setFormData({ ...formData, processor: e.target.value })}
                          placeholder="orn: Intel Core i7-12700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>RAM</Label>
                        <Input
                          value={formData.ram}
                          onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                          placeholder="orn: 16 GB"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Disk</Label>
                        <Input
                          value={formData.diskSize}
                          onChange={(e) => setFormData({ ...formData, diskSize: e.target.value })}
                          placeholder="orn: 512 GB SSD"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Barkod</Label>
                        <Input
                          value={formData.barcode}
                          onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Garanti Bitis</Label>
                        <Input
                          type="date"
                          value={formData.warrantyEndDate}
                          onChange={(e) => setFormData({ ...formData, warrantyEndDate: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Atanan Kisi</Label>
                        <Input
                          value={formData.assignedTo}
                          onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                          placeholder="orn: Ahmet Yilmaz"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Atanan Email</Label>
                        <Input
                          value={formData.assignedToEmail}
                          onChange={(e) => setFormData({ ...formData, assignedToEmail: e.target.value })}
                          placeholder="orn: ahmet.yilmaz@ilerigroup.com"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* CIA Degerleme */}
                <div className="border rounded-lg p-4 space-y-4">
                  <h4 className="font-medium">Varlik Degerleme (CIA)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Gizlilik (C)</Label>
                      <Select
                        value={String(formData.confidentiality)}
                        onValueChange={(v) => setFormData({ ...formData, confidentiality: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Dusuk</SelectItem>
                          <SelectItem value="2">2 - Orta-Dusuk</SelectItem>
                          <SelectItem value="3">3 - Orta</SelectItem>
                          <SelectItem value="4">4 - Orta-Yuksek</SelectItem>
                          <SelectItem value="5">5 - Yuksek</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Butunluk (I)</Label>
                      <Select
                        value={String(formData.integrity)}
                        onValueChange={(v) => setFormData({ ...formData, integrity: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Dusuk</SelectItem>
                          <SelectItem value="2">2 - Orta-Dusuk</SelectItem>
                          <SelectItem value="3">3 - Orta</SelectItem>
                          <SelectItem value="4">4 - Orta-Yuksek</SelectItem>
                          <SelectItem value="5">5 - Yuksek</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Erisilebilirlik (A)</Label>
                      <Select
                        value={String(formData.availability)}
                        onValueChange={(v) => setFormData({ ...formData, availability: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Dusuk</SelectItem>
                          <SelectItem value="2">2 - Orta-Dusuk</SelectItem>
                          <SelectItem value="3">3 - Orta</SelectItem>
                          <SelectItem value="4">4 - Orta-Yuksek</SelectItem>
                          <SelectItem value="5">5 - Yuksek</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Toplam Deger: {formData.confidentiality + formData.integrity + formData.availability} / 15
                  </p>
                </div>

                {/* Siniflandirma */}
                <div className="space-y-2">
                  <Label>Bilgi Siniflandirmasi</Label>
                  <Select
                    value={formData.classification}
                    onValueChange={(v) => setFormData({ ...formData, classification: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC">Genel (Public)</SelectItem>
                      <SelectItem value="INTERNAL">Dahili (Internal)</SelectItem>
                      <SelectItem value="CONFIDENTIAL">Gizli (Confidential)</SelectItem>
                      <SelectItem value="RESTRICTED">Kisitli (Restricted)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notlar */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notlar</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Ek notlar"
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Iptal
                </Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingAsset ? "Guncelle" : "Olustur"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Istatistikler */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Toplam Varlik</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.byStatus.active || 0} aktif
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Kritik Varliklar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.byCriticality.critical || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats.byCriticality.high || 0} yuksek
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-blue-500" />
                Donanim
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byCategory.hardware || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats.byCategory.software || 0} yazilim
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cloud className="h-4 w-4 text-purple-500" />
                Hizmet / Ag
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(stats.byCategory.service || 0) + (stats.byCategory.network || 0)}</div>
              <p className="text-xs text-muted-foreground">
                {stats.byCategory.information || 0} bilgi
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Gozden Gecirme
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.reviewDue || 0}</div>
              <p className="text-xs text-muted-foreground">
                bekleyen
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Kategori Dagilimi */}
      {stats && stats.total > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Kategori Dagilimi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {CATEGORIES.map((cat) => {
                const count = stats.byCategory[cat.value.toLowerCase()] || 0
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                if (count === 0) return null
                return (
                  <div key={cat.value} className="flex items-center gap-3 text-sm">
                    <span className="w-28 text-muted-foreground">{cat.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div
                        className={`${CATEGORY_COLORS[cat.value]} rounded-full h-3 transition-all`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-medium">{count}</span>
                    <span className="w-12 text-right text-muted-foreground text-xs">{pct.toFixed(0)}%</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtreler */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Varlik, hostname, IP veya kullanici ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Kategoriler</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCriticality} onValueChange={setFilterCriticality}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Kritiklik" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Seviyeler</SelectItem>
                <SelectItem value="CRITICAL">Kritik</SelectItem>
                <SelectItem value="HIGH">Yuksek</SelectItem>
                <SelectItem value="MEDIUM">Orta</SelectItem>
                <SelectItem value="LOW">Dusuk</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Durumlar</SelectItem>
                <SelectItem value="ACTIVE">Aktif</SelectItem>
                <SelectItem value="INACTIVE">Pasif</SelectItem>
                <SelectItem value="UNDER_MAINTENANCE">Bakimda</SelectItem>
                <SelectItem value="DISPOSED">Imha</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Varlik Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Varlik Listesi</CardTitle>
          <CardDescription>{filteredAssets.length} varlik listeleniyor</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Varlik No</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Atanan Kisi</TableHead>
                  <TableHead>CIA</TableHead>
                  <TableHead>Kritiklik</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="w-[100px]">Islemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Varlik bulunamadi
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-mono text-sm">{asset.assetNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(asset.category)}
                          <div>
                            <div className="font-medium">{asset.name}</div>
                            {asset.location && (
                              <div className="text-xs text-muted-foreground">{asset.location}</div>
                            )}
                            {asset.hostname && (
                              <div className="text-xs text-muted-foreground font-mono">{asset.hostname}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CATEGORIES.find((c) => c.value === asset.category)?.label || asset.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {asset.assignedTo ? (
                          <div>
                            <div className="text-sm">{asset.assignedTo}</div>
                            {asset.department && (
                              <div className="text-xs text-muted-foreground">{asset.department}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-mono">
                          {asset.confidentiality}/{asset.integrity}/{asset.availability}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={CRITICALITY_COLORS[asset.criticality]}>
                          {asset.criticality === "CRITICAL" && "Kritik"}
                          {asset.criticality === "HIGH" && "Yuksek"}
                          {asset.criticality === "MEDIUM" && "Orta"}
                          {asset.criticality === "LOW" && "Dusuk"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[asset.status]}>
                          {asset.status === "ACTIVE" && "Aktif"}
                          {asset.status === "INACTIVE" && "Pasif"}
                          {asset.status === "UNDER_MAINTENANCE" && "Bakimda"}
                          {asset.status === "DISPOSED" && "Imha"}
                          {asset.status === "LOST" && "Kayip"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(asset)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(asset.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Toplu Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) resetImport(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Toplu Varlik Ice Aktar
            </DialogTitle>
            <DialogDescription>
              Excel dosyasindan (.xlsx, .xls) varliklari toplu olarak import edin.
              Kolon adlari otomatik olarak eslestirilir.
            </DialogDescription>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs"
              onClick={() => window.open("/api/iso27001/assets/template", "_blank")}
            >
              <Download className="h-3 w-3 mr-1" />
              Ornek Excel sablonu indir
            </Button>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Dosya Secimi */}
            <div className="space-y-2">
              <Label>Excel Dosyasi</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                disabled={isImporting}
              />
            </div>

            {/* On Izleme */}
            {importPreview.length > 0 && !importResult && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tespit Edilen Kolonlar ({importColumns.length})</Label>
                  <div className="flex flex-wrap gap-1">
                    {importColumns.map((col) => (
                      <Badge key={col} variant="outline" className="text-xs">
                        {col}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">On Izleme (ilk 5 satir)</Label>
                  <div className="border rounded-md overflow-x-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {importColumns.slice(0, 6).map((col) => (
                            <TableHead key={col} className="text-xs whitespace-nowrap">
                              {col}
                            </TableHead>
                          ))}
                          {importColumns.length > 6 && (
                            <TableHead className="text-xs">+{importColumns.length - 6} daha</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.map((row, i) => (
                          <TableRow key={i}>
                            {importColumns.slice(0, 6).map((col) => (
                              <TableCell key={col} className="text-xs whitespace-nowrap max-w-[150px] truncate">
                                {String(row[col] || "")}
                              </TableCell>
                            ))}
                            {importColumns.length > 6 && (
                              <TableCell className="text-xs text-muted-foreground">...</TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}

            {/* Import Sonucu */}
            {importResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="text-lg font-bold text-green-700">{importResult.success}</div>
                      <div className="text-xs text-green-600">Basarili</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <div className="text-lg font-bold text-red-700">{importResult.failed}</div>
                      <div className="text-xs text-red-600">Basarisiz</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Clock className="h-5 w-5 text-gray-500" />
                    <div>
                      <div className="text-lg font-bold text-gray-700">{importResult.skipped}</div>
                      <div className="text-xs text-gray-500">Atlanan</div>
                    </div>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-sm text-red-600">Hatalar:</Label>
                    <div className="bg-red-50 rounded p-2 max-h-32 overflow-y-auto">
                      {importResult.errors.map((err, i) => (
                        <div key={i} className="text-xs text-red-700">{err}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              {importResult ? "Kapat" : "Iptal"}
            </Button>
            {!importResult && (
              <Button onClick={handleImport} disabled={!importFile || isImporting}>
                {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isImporting ? "Import Ediliyor..." : "Import Et"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bilgi Notu */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Server className="h-6 w-6 text-blue-500 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900">Varlik Envanteri Hakkinda</h3>
              <p className="text-sm text-blue-700 mt-1">
                ISO 27001:2022 Annex A 5.9 geregi, organizasyonlar bilgi ve iliskili varliklarin envanterini
                olusturmali ve guncel tutmalidir. Her varlik icin sahiplik, siniflandirma ve deger
                belirlenmelidir. CIA (Gizlilik, Butunluk, Erisilebilirlik) degerleri 1-5 arasinda
                puanlanir ve toplam deger kritiklik seviyesini belirler.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
