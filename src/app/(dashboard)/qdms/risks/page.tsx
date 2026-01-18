"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Scale, Plus, Search, MoreHorizontal, Eye, Edit, RefreshCw,
  AlertTriangle, TrendingDown, TrendingUp, Activity, HelpCircle,
  BookOpen, ArrowRight, Lightbulb, Settings, Target, CheckCircle, Shield,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

const riskCategories = [
  { value: "OPERATIONAL", label: "Operasyonel" },
  { value: "STRATEGIC", label: "Stratejik" },
  { value: "FINANCIAL", label: "Finansal" },
  { value: "COMPLIANCE", label: "Uyum" },
  { value: "QUALITY", label: "Kalite" },
  { value: "SAFETY", label: "Güvenlik" },
  { value: "ENVIRONMENTAL", label: "Çevresel" },
  { value: "INFORMATION", label: "Bilgi Güvenliği" },
]

const riskStatuses = [
  { value: "IDENTIFIED", label: "Tanımlandı", color: "bg-blue-500" },
  { value: "ASSESSED", label: "Değerlendirildi", color: "bg-yellow-500" },
  { value: "MITIGATED", label: "Azaltıldı", color: "bg-green-500" },
  { value: "ACCEPTED", label: "Kabul Edildi", color: "bg-purple-500" },
  { value: "CLOSED", label: "Kapatıldı", color: "bg-gray-500" },
]

const riskLevels = [
  { value: "LOW", label: "Düşük", color: "bg-green-500" },
  { value: "MEDIUM", label: "Orta", color: "bg-yellow-500" },
  { value: "HIGH", label: "Yüksek", color: "bg-orange-500" },
  { value: "CRITICAL", label: "Kritik", color: "bg-red-500" },
]

interface Risk {
  id: string
  riskNumber: string
  title: string
  description: string
  category: string
  status: string
  probability: number
  impact: number
  riskLevel: string
  owner: { id: string; name: string }
  department: { id: string; name: string } | null
  identifiedDate: string
  reviewDate: string | null
  createdAt: string
}

export default function RisksPage() {
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [levelFilter, setLevelFilter] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    probability: 3,
    impact: 3,
  })

  const fetchRisks = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      if (categoryFilter !== "all") params.append("category", categoryFilter)
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (levelFilter !== "all") params.append("riskLevel", levelFilter)

      const res = await fetch(`/api/qdms/risks?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRisks(data)
      }
    } catch (error) {
      toast.error("Riskler yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRisks()
  }, [searchQuery, categoryFilter, statusFilter, levelFilter])

  const handleCreate = async () => {
    if (!formData.title || !formData.category) {
      toast.error("Başlık ve kategori zorunludur")
      return
    }

    try {
      const res = await fetch("/api/qdms/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Risk başarıyla oluşturuldu")
        setIsCreateDialogOpen(false)
        setFormData({ title: "", description: "", category: "", probability: 3, impact: 3 })
        fetchRisks()
      } else {
        const data = await res.json()
        toast.error(data.message || "Hata oluştu")
      }
    } catch (error) {
      toast.error("Sunucu hatası")
    }
  }

  const getStatusBadge = (status: string) => {
    const info = riskStatuses.find(s => s.value === status)
    return <Badge className={`${info?.color} text-white`}>{info?.label || status}</Badge>
  }

  const getLevelBadge = (level: string) => {
    const info = riskLevels.find(l => l.value === level)
    return <Badge className={`${info?.color} text-white`}>{info?.label || level}</Badge>
  }

  const getCategoryLabel = (category: string) => riskCategories.find(c => c.value === category)?.label || category

  const getRiskScore = (probability: number, impact: number) => probability * impact

  const stats = {
    total: risks.length,
    critical: risks.filter(r => r.riskLevel === "CRITICAL").length,
    high: risks.filter(r => r.riskLevel === "HIGH").length,
    mitigated: risks.filter(r => r.status === "MITIGATED").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Risk Yönetimi</h1>
          <p className="text-muted-foreground">Risk tanımlama, değerlendirme ve izleme</p>
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
            Yeni Risk
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Risk</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kritik</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{stats.critical}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yüksek</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-600">{stats.high}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Azaltılan</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{stats.mitigated}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Risk ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {riskCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {riskStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Seviye" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Seviyeler</SelectItem>
                {riskLevels.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchRisks}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risk No</TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Olasılık</TableHead>
                <TableHead>Etki</TableHead>
                <TableHead>Skor</TableHead>
                <TableHead>Seviye</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Sahip</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : risks.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Henüz risk bulunmuyor</TableCell></TableRow>
              ) : (
                risks.map(risk => (
                  <TableRow key={risk.id}>
                    <TableCell className="font-mono">{risk.riskNumber}</TableCell>
                    <TableCell><div className="max-w-[200px] truncate">{risk.title}</div></TableCell>
                    <TableCell>{getCategoryLabel(risk.category)}</TableCell>
                    <TableCell>{risk.probability}</TableCell>
                    <TableCell>{risk.impact}</TableCell>
                    <TableCell className="font-bold">{getRiskScore(risk.probability, risk.impact)}</TableCell>
                    <TableCell>{getLevelBadge(risk.riskLevel)}</TableCell>
                    <TableCell>{getStatusBadge(risk.status)}</TableCell>
                    <TableCell>{risk.owner?.name || "-"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />Görüntüle</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="mr-2 h-4 w-4" />Düzenle</DropdownMenuItem>
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

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Risk Tanımla</DialogTitle>
            <DialogDescription>Yeni bir risk kaydı oluşturun</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Başlık *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Risk başlığı"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Kategori *</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                <SelectContent>
                  {riskCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Risk açıklaması"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Olasılık (1-5)</Label>
                <Select value={formData.probability.toString()} onValueChange={(v) => setFormData({ ...formData, probability: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Etki (1-5)</Label>
                <Select value={formData.impact.toString()} onValueChange={(v) => setFormData({ ...formData, impact: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Risk Skoru</div>
              <div className="text-2xl font-bold">{formData.probability * formData.impact}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>İptal</Button>
            <Button onClick={handleCreate}>Oluştur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guide Dialog */}
      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-6 w-6 text-blue-600" />
              Risk Yönetimi Rehberi
            </DialogTitle>
            <DialogDescription>
              ISO 9001 risk bazlı düşünme ve risk yönetimi hakkında bilgi edinin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Risk Yönetimi Nedir */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-600" />
                Risk Yönetimi Nedir?
              </h3>
              <p className="text-muted-foreground">
                Risk yönetimi, potansiyel tehditleri ve fırsatları tanımlama, değerlendirme ve
                kontrol etme sürecidir. ISO 9001:2015 standardının 6.1 maddesi gereği,
                "risk ve fırsatları ele alan eylemler" zorunludur.
              </p>
            </div>

            {/* Risk Değerlendirme Matrisi */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Risk Değerlendirme Matrisi
              </h3>
              <p className="text-muted-foreground">
                Risk skoru = Olasılık × Etki formülüyle hesaplanır:
              </p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-medium text-green-800">Düşük (1-5)</div>
                  <p className="text-sm text-green-700">İzleme yeterli</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="font-medium text-yellow-800">Orta (6-11)</div>
                  <p className="text-sm text-yellow-700">Aksiyon planla</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-medium text-orange-800">Yüksek (12-19)</div>
                  <p className="text-sm text-orange-700">Öncelikli müdahale</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="font-medium text-red-800">Kritik (20-25)</div>
                  <p className="text-sm text-red-700">Acil eylem gerekli</p>
                </div>
              </div>
            </div>

            {/* Risk Kategorileri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                Risk Kategorileri
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {riskCategories.map((cat) => (
                  <div key={cat.value} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <ArrowRight className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm">{cat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Yönetim Süreci */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                Risk Yönetim Süreci
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <span className="font-medium">Tanımlama</span>
                    <p className="text-sm text-muted-foreground">Potansiyel riskleri belirle</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <span className="font-medium">Analiz</span>
                    <p className="text-sm text-muted-foreground">Olasılık ve etkiyi değerlendir</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <span className="font-medium">Değerlendirme</span>
                    <p className="text-sm text-muted-foreground">Risk seviyesini belirle</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm font-bold">4</div>
                  <div>
                    <span className="font-medium">İşleme</span>
                    <p className="text-sm text-muted-foreground">Azaltma, transfer, kabul veya kaçınma</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold">5</div>
                  <div>
                    <span className="font-medium">İzleme</span>
                    <p className="text-sm text-muted-foreground">Periyodik gözden geçirme</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sistem Özellikleri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-600" />
                Sistem Özellikleri
              </h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Otomatik risk numarası ve skor hesaplama</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Kategori ve seviye bazlı filtreleme</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Risk sahibi atama</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Gözden geçirme tarihi takibi</span>
                </li>
              </ul>
            </div>

            {/* Hızlı Başlangıç */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-600" />
                Hızlı Başlangıç
              </h3>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>İpucu:</strong> Önce kritik süreçlerinizi belirleyin ve bu süreçlerdeki
                  potansiyel riskleri tanımlayarak başlayın. SWOT analizi bu aşamada faydalı olabilir.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsGuideOpen(false)}>
              Anladım
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
