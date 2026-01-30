"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import {
  Scale,
  Plus,
  Search,
  MoreHorizontal,
  AlertTriangle,
  Shield,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"

// Risk seviyeleri
const RISK_LEVELS = {
  LOW: { label: "Dusuk", color: "bg-green-100 text-green-700", icon: TrendingDown },
  MEDIUM: { label: "Orta", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
  HIGH: { label: "Yuksek", color: "bg-orange-100 text-orange-700", icon: TrendingUp },
  CRITICAL: { label: "Kritik", color: "bg-red-100 text-red-700", icon: AlertTriangle },
}

// Risk durumları
const RISK_STATUS = {
  IDENTIFIED: { label: "Tanimlanmis", color: "bg-blue-100 text-blue-700" },
  ASSESSING: { label: "Degerlendiriliyor", color: "bg-purple-100 text-purple-700" },
  TREATING: { label: "Isleniyor", color: "bg-yellow-100 text-yellow-700" },
  MONITORING: { label: "Izleniyor", color: "bg-green-100 text-green-700" },
  CLOSED: { label: "Kapandi", color: "bg-gray-100 text-gray-700" },
}

// Risk kategorileri
const RISK_CATEGORIES = [
  "Operasyonel",
  "Teknik",
  "Insan Kaynaklari",
  "Fiziksel",
  "Yasal/Uyumluluk",
  "Tedarik Zinciri",
  "Diger",
]

interface Risk {
  id: string
  riskNumber: string
  title: string
  description: string
  category: string
  assetName: string | null
  threatSource: string | null
  vulnerability: string | null
  likelihood: number
  impact: number
  riskScore: number
  riskLevel: string
  currentControls: string | null
  treatmentPlan: string | null
  treatmentType: string | null
  residualLikelihood: number | null
  residualImpact: number | null
  residualRiskScore: number | null
  residualRiskLevel: string | null
  riskOwnerName: string | null
  riskOwnerEmail: string | null
  status: string
  reviewDate: string | null
  createdAt: string
}

export default function Iso27001RisksPage() {
  const { data: session } = useSession()
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLevel, setSelectedLevel] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    assetName: "",
    threatSource: "",
    vulnerability: "",
    likelihood: 3,
    impact: 3,
    currentControls: "",
    treatmentPlan: "",
    treatmentType: "MITIGATE",
    riskOwnerName: "",
    riskOwnerEmail: "",
  })

  // Riskleri yukle
  const fetchRisks = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedLevel !== "all") params.append("level", selectedLevel)
      if (selectedStatus !== "all") params.append("status", selectedStatus)
      if (searchQuery) params.append("search", searchQuery)

      const res = await fetch(`/api/iso27001/risks?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRisks(data)
      }
    } catch (error) {
      console.error("Riskler yuklenemedi:", error)
      toast.error("Riskler yuklenemedi")
    } finally {
      setLoading(false)
    }
  }, [selectedLevel, selectedStatus, searchQuery])

  useEffect(() => {
    fetchRisks()
  }, [fetchRisks])

  // Risk skoru hesapla
  const calculateRiskScore = (likelihood: number, impact: number) => likelihood * impact

  // Risk seviyesi belirle
  const getRiskLevel = (score: number) => {
    if (score >= 20) return "CRITICAL"
    if (score >= 12) return "HIGH"
    if (score >= 6) return "MEDIUM"
    return "LOW"
  }

  // Yeni risk olustur
  const handleCreate = async () => {
    if (!formData.title || !formData.description || !formData.assetName) {
      toast.error("Baslik, aciklama ve varlik adi zorunludur")
      return
    }

    try {
      setSaving(true)
      const riskScore = calculateRiskScore(formData.likelihood, formData.impact)
      const riskLevel = getRiskLevel(riskScore)

      const res = await fetch("/api/iso27001/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          riskScore,
          riskLevel,
        }),
      })

      if (res.ok) {
        toast.success("Risk olusturuldu")
        setIsCreateDialogOpen(false)
        setFormData({
          title: "",
          description: "",
          category: "",
          assetName: "",
          threatSource: "",
          vulnerability: "",
          likelihood: 3,
          impact: 3,
          currentControls: "",
          treatmentPlan: "",
          treatmentType: "MITIGATE",
          riskOwnerName: "",
          riskOwnerEmail: "",
        })
        fetchRisks()
      } else {
        const error = await res.json()
        toast.error(error.error || "Risk olusturulamadi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    } finally {
      setSaving(false)
    }
  }

  // Istatistikler
  const stats = useMemo(() => ({
    total: risks.length,
    critical: risks.filter(r => r.riskLevel === "CRITICAL").length,
    high: risks.filter(r => r.riskLevel === "HIGH").length,
    medium: risks.filter(r => r.riskLevel === "MEDIUM").length,
    low: risks.filter(r => r.riskLevel === "LOW").length,
    open: risks.filter(r => r.status !== "CLOSED").length,
  }), [risks])

  // Hesaplanan risk skoru ve seviyesi
  const calculatedScore = calculateRiskScore(formData.likelihood, formData.impact)
  const calculatedLevel = getRiskLevel(calculatedScore)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            Risk Analizi
          </h1>
          <p className="text-muted-foreground">
            ISO 27001 Bilgi Guvenligi Risk Degerlendirmesi
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Risk
        </Button>
      </div>

      {/* Istatistikler */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Toplam Risk</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <p className="text-sm text-muted-foreground">Kritik</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
            <p className="text-sm text-muted-foreground">Yuksek</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
            <p className="text-sm text-muted-foreground">Orta</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.low}</div>
            <p className="text-sm text-muted-foreground">Dusuk</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
            <p className="text-sm text-muted-foreground">Acik Risk</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtreler */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Risk ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Risk Seviyesi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Seviyeler</SelectItem>
                {Object.entries(RISK_LEVELS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Durumlar</SelectItem>
                {Object.entries(RISK_STATUS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchRisks}>
              Filtrele
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Risk Listesi */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Kayitlari</CardTitle>
          <CardDescription>Tanimlanan bilgi guvenligi riskleri</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Riskler yukleniyor...</p>
            </div>
          ) : risks.length === 0 ? (
            <div className="text-center py-12">
              <Scale className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Risk Bulunamadi</h3>
              <p className="text-muted-foreground mb-4">
                Henuz tanimlanmis risk bulunmuyor.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ilk Riski Olustur
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risk No</TableHead>
                  <TableHead>Baslik</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Skor</TableHead>
                  <TableHead>Seviye</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Sorumlu</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {risks.map((risk) => {
                  const levelInfo = RISK_LEVELS[risk.riskLevel as keyof typeof RISK_LEVELS] || RISK_LEVELS.LOW
                  const statusInfo = RISK_STATUS[risk.status as keyof typeof RISK_STATUS] || RISK_STATUS.IDENTIFIED
                  const LevelIcon = levelInfo.icon

                  return (
                    <TableRow key={risk.id}>
                      <TableCell className="font-mono">{risk.riskNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{risk.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {risk.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{risk.category}</TableCell>
                      <TableCell>
                        <span className="font-bold">{risk.riskScore}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({risk.likelihood}x{risk.impact})
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={levelInfo.color}>
                          <LevelIcon className="h-3 w-3 mr-1" />
                          {levelInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell>{risk.riskOwnerName || "-"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Detay</DropdownMenuItem>
                            <DropdownMenuItem>Duzenle</DropdownMenuItem>
                            <DropdownMenuItem>Tedavi Plani</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Yeni Risk Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Risk Tanimla</DialogTitle>
            <DialogDescription>
              Bilgi guvenligi riski tanimlayın
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Risk Basligi *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ornegin: Yetkisiz veri erisimi riski"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Aciklama *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Riskin detayli aciklamasi..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Kategori *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kategori secin" />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Varlik Adi</Label>
                <Input
                  value={formData.assetName}
                  onChange={(e) => setFormData(prev => ({ ...prev, assetName: e.target.value }))}
                  placeholder="Etkilenen varlik"
                />
              </div>

              <div className="space-y-2">
                <Label>Tehdit Kaynagi</Label>
                <Input
                  value={formData.threatSource}
                  onChange={(e) => setFormData(prev => ({ ...prev, threatSource: e.target.value }))}
                  placeholder="Ornegin: Siber saldirgan, dogal afet"
                />
              </div>

              <div className="space-y-2">
                <Label>Zafiyet</Label>
                <Input
                  value={formData.vulnerability}
                  onChange={(e) => setFormData(prev => ({ ...prev, vulnerability: e.target.value }))}
                  placeholder="Ornegin: Zayif parola politikasi"
                />
              </div>

              <div className="space-y-2">
                <Label>Olasilik (1-5)</Label>
                <Select
                  value={formData.likelihood.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, likelihood: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Cok Dusuk</SelectItem>
                    <SelectItem value="2">2 - Dusuk</SelectItem>
                    <SelectItem value="3">3 - Orta</SelectItem>
                    <SelectItem value="4">4 - Yuksek</SelectItem>
                    <SelectItem value="5">5 - Cok Yuksek</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Etki (1-5)</Label>
                <Select
                  value={formData.impact.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, impact: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Cok Dusuk</SelectItem>
                    <SelectItem value="2">2 - Dusuk</SelectItem>
                    <SelectItem value="3">3 - Orta</SelectItem>
                    <SelectItem value="4">4 - Yuksek</SelectItem>
                    <SelectItem value="5">5 - Cok Yuksek</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Hesaplanan risk skoru */}
              <div className="col-span-2 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Hesaplanan Risk Skoru</p>
                    <p className="text-2xl font-bold">{calculatedScore}</p>
                  </div>
                  <Badge className={RISK_LEVELS[calculatedLevel as keyof typeof RISK_LEVELS].color}>
                    {RISK_LEVELS[calculatedLevel as keyof typeof RISK_LEVELS].label}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Mevcut Kontroller</Label>
                <Textarea
                  value={formData.currentControls}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentControls: e.target.value }))}
                  placeholder="Uygulanan mevcut kontroller..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Risk Sahibi</Label>
                <Input
                  value={formData.riskOwnerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, riskOwnerName: e.target.value }))}
                  placeholder="Sorumlu kisi"
                />
              </div>

              <div className="space-y-2">
                <Label>Risk Sahibi E-posta</Label>
                <Input
                  type="email"
                  value={formData.riskOwnerEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, riskOwnerEmail: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Iptal
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Olustur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
