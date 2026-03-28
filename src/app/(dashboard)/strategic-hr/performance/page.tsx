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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Target,
  Plus,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Lightbulb,
  Star
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

interface PerformanceCycle {
  id: string
  name: string
  description: string | null
  year: number
  cycleType: string
  startDate: string
  endDate: string
  status: string
  isActive: boolean
  _count: {
    reviews: number
  }
  createdAt: string
}

interface PerformanceReview {
  id: string
  employeeName: string
  employeeEmail: string
  employeeDepartment: string | null
  managerName: string | null
  status: string
  overallRating: string | null
  overallScore: number | null
  cycle: {
    id: string
    name: string
    year: number
  }
  _count: {
    goals: number
  }
}

const cycleTypeLabels: Record<string, string> = {
  ANNUAL: "Yillik",
  SEMI_ANNUAL: "6 Aylik",
  QUARTERLY: "3 Aylik"
}

const cycleStatusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  GOAL_SETTING: "Hedef Belirleme",
  IN_PROGRESS: "Devam Ediyor",
  MID_YEAR: "Ara Degerlendirme",
  YEAR_END: "Yil Sonu",
  CALIBRATION: "Kalibrasyon",
  COMPLETED: "Tamamlandi",
  ARCHIVED: "Arsivlendi"
}

const reviewStatusLabels: Record<string, string> = {
  NOT_STARTED: "Baslamadi",
  GOALS_SET: "Hedefler Belirlendi",
  IN_PROGRESS: "Devam Ediyor",
  SELF_COMPLETED: "Oz Degerlendirme Tamam",
  MANAGER_COMPLETED: "Yonetici Degerlendirdi",
  CALIBRATED: "Kalibre Edildi",
  FINALIZED: "Sonuclandi",
  ACKNOWLEDGED: "Onaylandi"
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  GOAL_SETTING: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  MID_YEAR: "bg-purple-100 text-purple-800",
  YEAR_END: "bg-orange-100 text-orange-800",
  CALIBRATION: "bg-pink-100 text-pink-800",
  COMPLETED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-gray-100 text-gray-800"
}

export default function PerformanceManagementPage() {
  const { data: session } = useSession()
  const [cycles, setCycles] = useState<PerformanceCycle[]>([])
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("cycles")

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    year: new Date().getFullYear(),
    cycleType: "ANNUAL",
    startDate: "",
    endDate: "",
    goalSettingStart: "",
    goalSettingEnd: "",
    midYearReviewStart: "",
    midYearReviewEnd: "",
    yearEndReviewStart: "",
    yearEndReviewEnd: ""
  })

  useEffect(() => {
    fetchCycles()
    fetchReviews()
  }, [])

  const fetchCycles = async () => {
    try {
      const res = await fetch("/api/strategic-hr/performance")
      if (res.ok) {
        const data = await res.json()
        setCycles(data)
      }
    } catch (error) {
      console.error("Donguler yuklenirken hata:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/strategic-hr/performance/reviews")
      if (res.ok) {
        const data = await res.json()
        setReviews(data)
      }
    } catch (error) {
      console.error("Degerlendirmeler yuklenirken hata:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const res = await fetch("/api/strategic-hr/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setIsDialogOpen(false)
        fetchCycles()
        setFormData({
          name: "",
          description: "",
          year: new Date().getFullYear(),
          cycleType: "ANNUAL",
          startDate: "",
          endDate: "",
          goalSettingStart: "",
          goalSettingEnd: "",
          midYearReviewStart: "",
          midYearReviewEnd: "",
          yearEndReviewStart: "",
          yearEndReviewEnd: ""
        })
      }
    } catch (error) {
      console.error("Dongu olusturulurken hata:", error)
    }
  }

  // Stats
  const activeCycles = cycles.filter(c => c.isActive).length
  const totalReviews = reviews.length
  const completedReviews = reviews.filter(r => r.status === "FINALIZED" || r.status === "ACKNOWLEDGED").length
  const pendingReviews = reviews.filter(r => r.status === "NOT_STARTED" || r.status === "GOALS_SET").length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Yukleniyor...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Performans Yonetimi
          </h1>
          <p className="text-muted-foreground">
            Performans dongulerini ve degerlendirmelerini yonetin
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsGuideOpen(true)}>
            <HelpCircle className="h-4 w-4 mr-2" />
            Kilavuz
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Yeni Dongu
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Yeni Performans Dongusu</DialogTitle>
              <DialogDescription>
                Yeni bir performans degerlendirme dongusu olusturun
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Dongu Adi</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="2026 Yillik Performans Degerlendirmesi"
                    required
                  />
                </div>

                <div>
                  <Label>Yil</Label>
                  <Input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <Label>Dongu Tipi</Label>
                  <Select
                    value={formData.cycleType}
                    onValueChange={(v) => setFormData({ ...formData, cycleType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANNUAL">Yillik</SelectItem>
                      <SelectItem value="SEMI_ANNUAL">6 Aylik</SelectItem>
                      <SelectItem value="QUARTERLY">3 Aylik</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Baslangic Tarihi</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Bitis Tarihi</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Hedef Belirleme Baslangic</Label>
                  <Input
                    type="date"
                    value={formData.goalSettingStart}
                    onChange={(e) => setFormData({ ...formData, goalSettingStart: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Hedef Belirleme Bitis</Label>
                  <Input
                    type="date"
                    value={formData.goalSettingEnd}
                    onChange={(e) => setFormData({ ...formData, goalSettingEnd: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Aciklama</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Dongu hakkinda aciklama..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Iptal
                </Button>
                <Button type="submit" disabled={!formData.name || !formData.startDate || !formData.endDate}>
                  Olustur
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>

        {/* Kilavuz Modal */}
        <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Performans Yonetimi Kilavuzu
              </DialogTitle>
              <DialogDescription>
                Performans degerlendirme surecinin nasil yurutulecegini ogrenim
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Nedir */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  Performans Yonetimi Nedir?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Performans yonetimi, calisanlarin hedeflerini belirleme, takip etme ve degerlendirme
                  surecidir. Bu sistem yillik, 6 aylik veya 3 aylik dongulerle calisarak calisanlarin
                  gelisimini ve basarilarini olcmenizi saglar.
                </p>
              </div>

              {/* Dongu Asamalari */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-green-500" />
                  Performans Dongusu Asamalari
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-blue-100 text-blue-800">1</Badge>
                    <div>
                      <p className="font-medium">Hedef Belirleme</p>
                      <p className="text-muted-foreground">Yil/donem basinda calisan ve yonetici birlikte SMART hedefler belirler.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-yellow-100 text-yellow-800">2</Badge>
                    <div>
                      <p className="font-medium">Devam Eden Takip</p>
                      <p className="text-muted-foreground">Hedefler duzenli olarak takip edilir, ilerleme kaydedilir.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-purple-100 text-purple-800">3</Badge>
                    <div>
                      <p className="font-medium">Ara Degerlendirme</p>
                      <p className="text-muted-foreground">Donem ortasinda ilerleme gozden gecirilir, gerekirse hedefler guncellenir.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-orange-100 text-orange-800">4</Badge>
                    <div>
                      <p className="font-medium">Yil Sonu Degerlendirme</p>
                      <p className="text-muted-foreground">Calisan oz degerlendirme yapar, yonetici degerlendirmesini tamamlar.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-pink-100 text-pink-800">5</Badge>
                    <div>
                      <p className="font-medium">Kalibrasyon</p>
                      <p className="text-muted-foreground">Yoneticiler bir araya gelerek degerlendirmeleri normalize eder.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-green-100 text-green-800">6</Badge>
                    <div>
                      <p className="font-medium">Sonuclarin Paylasimi</p>
                      <p className="text-muted-foreground">Degerlendirme sonuclari calisanla paylasilir ve onaylanir.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Degerlendirme Olcegi */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  Degerlendirme Olcegi
                </h3>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center gap-2 p-2 bg-red-50 rounded">
                    <Badge className="bg-red-100 text-red-800">1</Badge>
                    <span className="font-medium">Beklentilerin Altinda</span>
                    <span className="text-muted-foreground">- Hedeflere ulasilamadi</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-orange-50 rounded">
                    <Badge className="bg-orange-100 text-orange-800">2</Badge>
                    <span className="font-medium">Gelisim Gerekli</span>
                    <span className="text-muted-foreground">- Bazi hedefler karsilandi</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
                    <Badge className="bg-yellow-100 text-yellow-800">3</Badge>
                    <span className="font-medium">Beklentileri Karsilar</span>
                    <span className="text-muted-foreground">- Hedefler karsilandi</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                    <Badge className="bg-green-100 text-green-800">4</Badge>
                    <span className="font-medium">Beklentilerin Ustunde</span>
                    <span className="text-muted-foreground">- Hedefler asildi</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-purple-50 rounded">
                    <Badge className="bg-purple-100 text-purple-800">5</Badge>
                    <span className="font-medium">Olaganustu</span>
                    <span className="text-muted-foreground">- Istisnai basari</span>
                  </div>
                </div>
              </div>

              {/* Ipuclari */}
              <div className="space-y-2 bg-amber-50 p-4 rounded-lg">
                <h3 className="font-semibold flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Ipuclari
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>SMART hedefler belirleyin (Spesifik, Olculebilir, Ulasilabilir, Ilgili, Zamanli)</li>
                  <li>Yil boyunca duzenli geri bildirim verin, yil sonuna birakmayın</li>
                  <li>Hedefleri en az 3 ayda bir gozden gecirin</li>
                  <li>Kalibrasyon toplantilarina tum yoneticilerin katilimini saglayin</li>
                  <li>Degerlendirme sonuclarini gelisim planlariyla eslestirin</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setIsGuideOpen(false)}>Anladim</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif Dongu</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCycles}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Degerlendirme</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReviews}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tamamlanan</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedReviews}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bekleyen</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReviews}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="cycles">Donguler</TabsTrigger>
          <TabsTrigger value="reviews">Degerlendirmeler</TabsTrigger>
        </TabsList>

        <TabsContent value="cycles">
          <Card>
            <CardHeader>
              <CardTitle>Performans Donguleri</CardTitle>
              <CardDescription>
                Tum performans degerlendirme donguleri
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cycles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Henuz performans dongusu olusturulmamis.
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dongu Adi</TableHead>
                      <TableHead>Yil</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead>Donem</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Degerlendirme</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycles.map((cycle) => (
                      <TableRow key={cycle.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {cycle.isActive && (
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                            )}
                            {cycle.name}
                          </div>
                        </TableCell>
                        <TableCell>{cycle.year}</TableCell>
                        <TableCell>{cycleTypeLabels[cycle.cycleType]}</TableCell>
                        <TableCell>
                          {format(new Date(cycle.startDate), "dd MMM", { locale: tr })} -{" "}
                          {format(new Date(cycle.endDate), "dd MMM yyyy", { locale: tr })}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[cycle.status]}>
                            {cycleStatusLabels[cycle.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{cycle._count.reviews} kisi</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>Degerlendirmeler</CardTitle>
              <CardDescription>
                Bireysel performans degerlendirmeleri
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Henuz degerlendirme olusturulmamis.
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Calisan</TableHead>
                      <TableHead>Departman</TableHead>
                      <TableHead>Yonetici</TableHead>
                      <TableHead>Dongu</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Hedef Sayisi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell className="font-medium">{review.employeeName}</TableCell>
                        <TableCell>{review.employeeDepartment || "-"}</TableCell>
                        <TableCell>{review.managerName || "-"}</TableCell>
                        <TableCell>{review.cycle.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {reviewStatusLabels[review.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{review._count.goals}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
