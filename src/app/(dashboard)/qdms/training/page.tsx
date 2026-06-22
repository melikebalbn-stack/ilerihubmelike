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
  BookOpen, Plus, Search, MoreHorizontal, Eye, Edit, RefreshCw,
  GraduationCap, Users, Calendar, Award, HelpCircle, ArrowRight,
  Lightbulb, Settings, Target, CheckCircle, Shield,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

const trainingTypes = [
  { value: "ORIENTATION", label: "Oryantasyon" },
  { value: "TECHNICAL", label: "Teknik Eğitim" },
  { value: "QUALITY", label: "Kalite Eğitimi" },
  { value: "SAFETY", label: "İş Güvenliği" },
  { value: "PROCEDURE", label: "Prosedür Eğitimi" },
  { value: "CERTIFICATION", label: "Sertifikasyon" },
  { value: "REFRESHER", label: "Tazeleme Eğitimi" },
  { value: "OTHER", label: "Diğer" },
]

const trainingStatuses = [
  { value: "PLANNED", label: "Planlandı", color: "bg-blue-500" },
  { value: "IN_PROGRESS", label: "Devam Ediyor", color: "bg-yellow-500" },
  { value: "COMPLETED", label: "Tamamlandı", color: "bg-green-500" },
  { value: "CANCELLED", label: "İptal", color: "bg-gray-500" },
]

interface Training {
  id: string
  trainingCode: string
  title: string
  type: string
  status: string
  trainer: string | null
  plannedDate: string
  actualDate: string | null
  duration: number
  participantCount: number
  location: string | null
  createdAt: string
}

export default function TrainingPage() {
  const [trainings, setTrainings] = useState<Training[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    type: "",
    trainer: "",
    plannedDate: "",
    duration: 60,
    location: "",
    description: "",
  })

  const fetchTrainings = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      if (typeFilter !== "all") params.append("type", typeFilter)
      if (statusFilter !== "all") params.append("status", statusFilter)

      const res = await fetch(`/api/qdms/training?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTrainings(data)
      }
    } catch (error) {
      toast.error("Eğitimler yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrainings()
  }, [searchQuery, typeFilter, statusFilter])

  const handleCreate = async () => {
    if (!formData.title || !formData.type || !formData.plannedDate) {
      toast.error("Başlık, tür ve tarih zorunludur")
      return
    }

    try {
      const res = await fetch("/api/qdms/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Eğitim başarıyla oluşturuldu")
        setIsCreateDialogOpen(false)
        setFormData({ title: "", type: "", trainer: "", plannedDate: "", duration: 60, location: "", description: "" })
        fetchTrainings()
      } else {
        const data = await res.json()
        toast.error(data.message || "Hata oluştu")
      }
    } catch (error) {
      toast.error("Sunucu hatası")
    }
  }

  const getStatusBadge = (status: string) => {
    const info = trainingStatuses.find(s => s.value === status)
    return <Badge className={`${info?.color} text-white`}>{info?.label || status}</Badge>
  }

  const getTypeLabel = (type: string) => trainingTypes.find(t => t.value === type)?.label || type

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return mins > 0 ? `${hours} saat ${mins} dk` : `${hours} saat`
    }
    return `${minutes} dk`
  }

  const stats = {
    total: trainings.length,
    planned: trainings.filter(t => t.status === "PLANNED").length,
    completed: trainings.filter(t => t.status === "COMPLETED").length,
    totalParticipants: trainings.reduce((sum, t) => sum + t.participantCount, 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Eğitim Yönetimi</h1>
          <p className="text-muted-foreground">Eğitim planlama ve takip</p>
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
            Yeni Eğitim
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Eğitim</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planlanan</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{stats.planned}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tamamlanan</CardTitle>
            <Award className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{stats.completed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Katılımcı</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-purple-600">{stats.totalParticipants}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Eğitim ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Tür" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Türler</SelectItem>
                {trainingTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {trainingStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchTrainings}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Eğitim Adı</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Eğitmen</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Süre</TableHead>
                <TableHead>Katılımcı</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : trainings.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Henüz eğitim bulunmuyor</TableCell></TableRow>
              ) : (
                trainings.map(training => (
                  <TableRow key={training.id}>
                    <TableCell className="font-mono">{training.trainingCode}</TableCell>
                    <TableCell><div className="max-w-[200px] truncate">{training.title}</div></TableCell>
                    <TableCell>{getTypeLabel(training.type)}</TableCell>
                    <TableCell>{getStatusBadge(training.status)}</TableCell>
                    <TableCell>{training.trainer || "-"}</TableCell>
                    <TableCell>{format(new Date(training.plannedDate), "dd MMM yyyy", { locale: tr })}</TableCell>
                    <TableCell>{formatDuration(training.duration)}</TableCell>
                    <TableCell>{training.participantCount}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />Görüntüle</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="mr-2 h-4 w-4" />Düzenle</DropdownMenuItem>
                          <DropdownMenuItem><Users className="mr-2 h-4 w-4" />Katılımcılar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Eğitim Planla</DialogTitle>
            <DialogDescription>Yeni bir eğitim kaydı oluşturun</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Eğitim Adı *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Eğitim adı"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tür *</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger><SelectValue placeholder="Tür seçin" /></SelectTrigger>
                <SelectContent>
                  {trainingTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plannedDate">Tarih *</Label>
                <Input
                  id="plannedDate"
                  type="date"
                  value={formData.plannedDate}
                  onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Süre (dk)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trainer">Eğitmen</Label>
              <Input
                id="trainer"
                value={formData.trainer}
                onChange={(e) => setFormData({ ...formData, trainer: e.target.value })}
                placeholder="Eğitmen adı"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Lokasyon</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Eğitim yeri"
              />
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
              Eğitim Yönetimi Rehberi
            </DialogTitle>
            <DialogDescription>
              ISO 9001 yetkinlik ve eğitim yönetimi hakkında bilgi edinin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Eğitim Yönetimi Nedir */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-blue-600" />
                Eğitim Yönetimi Nedir?
              </h3>
              <p className="text-muted-foreground">
                Eğitim yönetimi, personelin görevlerini etkili bir şekilde yerine getirebilmesi için
                gerekli bilgi, beceri ve yetkinlikleri kazandırma sürecidir.
                ISO 9001:2015 standardının 7.2 maddesi kapsamında zorunludur.
              </p>
            </div>

            {/* Eğitim Türleri */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Eğitim Türleri
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {trainingTypes.map((type) => (
                  <div key={type.value} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <ArrowRight className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">{type.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Eğitim Süreci */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                Eğitim Süreci
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <span className="font-medium">İhtiyaç Analizi</span>
                    <p className="text-sm text-muted-foreground">Yetkinlik açığı ve eğitim ihtiyaçlarını belirle</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <span className="font-medium">Planlama</span>
                    <p className="text-sm text-muted-foreground">Yıllık eğitim planı ve program oluştur</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-yellow-600 text-white flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <span className="font-medium">Uygulama</span>
                    <p className="text-sm text-muted-foreground">Eğitimleri gerçekleştir ve katılım takibi yap</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm font-bold">4</div>
                  <div>
                    <span className="font-medium">Değerlendirme</span>
                    <p className="text-sm text-muted-foreground">Eğitim etkinliğini ölç ve raporla</p>
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
                  <span className="text-muted-foreground">Otomatik eğitim kodu oluşturma</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Eğitim takvimi ve planlama</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Katılımcı takibi ve sertifika yönetimi</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Eğitmen ve lokasyon yönetimi</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                  <span className="text-muted-foreground">Tazeleme eğitimi hatırlatmaları</span>
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
                  <strong>İpucu:</strong> Önce yıllık eğitim ihtiyaç analizini yapın, ardından eğitim planını
                  oluşturun. Zorunlu eğitimleri (iş güvenliği, kalite, vb.) öncelikli olarak planlayın.
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
