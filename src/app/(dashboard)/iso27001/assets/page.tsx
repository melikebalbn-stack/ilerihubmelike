"use client"

import { useState, useEffect } from "react"
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
  HardDrive,
  Globe,
  Database,
  Users,
  Building2,
  Cloud,
  Package,
  Filter,
  AlertTriangle,
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
  _count?: { childAssets: number }
}

interface Stats {
  total: number
  byCategory: Record<string, number>
  byCriticality: Record<string, number>
  byStatus: Record<string, number>
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

  // Form state
  const [formData, setFormData] = useState({
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
    notes: "",
  })

  useEffect(() => {
    fetchAssets()
  }, [filterCategory, filterStatus])

  const fetchAssets = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterCategory) params.append("category", filterCategory)
      if (filterStatus) params.append("status", filterStatus)

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
    } catch (error) {
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
    } catch (error) {
      toast.error("Bir hata olustu")
    }
  }

  const resetForm = () => {
    setFormData({
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
      notes: "",
    })
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
      manufacturer: "",
      model: "",
      serialNumber: "",
      notes: "",
    })
    setDialogOpen(true)
  }

  const filteredAssets = assets.filter(
    (a) =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.assetNumber.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const exportAssets = () => {
    const blob = new Blob([JSON.stringify(assets, null, 2)], { type: "application/json" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ISO27001-Varlik-Envanteri-${new Date().toISOString().split("T")[0]}.json`
    a.click()
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            Varlik Envanteri
          </h1>
          <p className="text-muted-foreground">
            ISO 27001:2022 A.5.9 - Bilgi ve diger iliskili varliklarin envanteri
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportAssets}>
            <Download className="h-4 w-4 mr-2" />
            Disari Aktar
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
                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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

                {/* CIA Değerleme */}
                <div className="border rounded-lg p-4 space-y-4">
                  <h4 className="font-medium">Varlik Degerleme (CIA)</h4>
                  <div className="grid grid-cols-3 gap-4">
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

                {/* Sınıflandırma */}
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

      {/* İstatistikler */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Toplam Varlik</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.byStatus.active} aktif
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
              <div className="text-2xl font-bold text-red-600">{stats.byCriticality.critical}</div>
              <p className="text-xs text-muted-foreground">
                {stats.byCriticality.high} yuksek
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
              <div className="text-2xl font-bold">{stats.byCategory.hardware}</div>
              <p className="text-xs text-muted-foreground">
                {stats.byCategory.software} yazilim
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cloud className="h-4 w-4 text-purple-500" />
                Hizmet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byCategory.service}</div>
              <p className="text-xs text-muted-foreground">
                {stats.byCategory.network} ag
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtreler */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Varlik ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
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
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
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

      {/* Varlık Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Varlik Listesi</CardTitle>
          <CardDescription>{filteredAssets.length} varlik listeleniyor</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Varlik No</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Sinif</TableHead>
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
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CATEGORIES.find((c) => c.value === asset.category)?.label || asset.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={CLASSIFICATION_COLORS[asset.classification]}>
                          {asset.classification}
                        </Badge>
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
