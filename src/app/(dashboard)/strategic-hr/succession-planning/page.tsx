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
import {
  Users,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Shield,
  UserCheck,
  HelpCircle,
  BookOpen,
  Target,
  ArrowRight,
  Lightbulb
} from "lucide-react"

interface Position {
  id: string
  code: string
  title: string
  department: string
  level: string
  isCritical: boolean
}

interface TalentProfile {
  id: string
  userName: string
  userEmail: string
  department: string | null
  nineBoxPosition: string | null
}

interface SuccessionCandidate {
  id: string
  readiness: string
  overallFit: number | null
  readyNowProfile: TalentProfile | null
  readyIn1YearProfile: TalentProfile | null
  readyIn2YearsProfile: TalentProfile | null
}

interface SuccessionPlan {
  id: string
  positionId: string
  position: Position
  currentHolderId: string | null
  currentHolderEmail: string | null
  currentHolderName: string | null
  status: string
  priority: string
  vacancyRisk: string
  impactIfVacant: string | null
  notes: string | null
  candidates: SuccessionCandidate[]
  createdAt: string
}

const statusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  ACTIVE: "Aktif",
  COMPLETED: "Tamamlandı"
}

const priorityLabels: Record<string, string> = {
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  CRITICAL: "Kritik"
}

const vacancyRiskLabels: Record<string, string> = {
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  IMMINENT: "Yakın"
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  ACTIVE: "bg-green-100 text-green-800",
  COMPLETED: "bg-blue-100 text-blue-800"
}

const priorityColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800"
}

export default function SuccessionPlanningPage() {
  const { data: session } = useSession()
  const [plans, setPlans] = useState<SuccessionPlan[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<SuccessionPlan | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    positionId: "",
    currentHolderName: "",
    currentHolderEmail: "",
    priority: "MEDIUM",
    vacancyRisk: "LOW",
    impactIfVacant: "",
    notes: ""
  })

  useEffect(() => {
    fetchPlans()
    fetchPositions()
  }, [])

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/strategic-hr/succession-plans")
      if (res.ok) {
        const data = await res.json()
        setPlans(data)
      }
    } catch (error) {
      console.error("Planlar yüklenirken hata:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPositions = async () => {
    try {
      const res = await fetch("/api/talent-management/positions?isCritical=true")
      if (res.ok) {
        const data = await res.json()
        setPositions(data)
      }
    } catch (error) {
      console.error("Pozisyonlar yüklenirken hata:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const res = await fetch("/api/strategic-hr/succession-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setIsDialogOpen(false)
        fetchPlans()
        setFormData({
          positionId: "",
          currentHolderName: "",
          currentHolderEmail: "",
          priority: "MEDIUM",
          vacancyRisk: "LOW",
          impactIfVacant: "",
          notes: ""
        })
      }
    } catch (error) {
      console.error("Plan oluşturulurken hata:", error)
    }
  }

  const getCandidateCount = (plan: SuccessionPlan) => {
    return plan.candidates.filter(c =>
      c.readyNowProfile || c.readyIn1YearProfile || c.readyIn2YearsProfile
    ).length
  }

  const getReadyNowCount = (plan: SuccessionPlan) => {
    return plan.candidates.filter(c => c.readyNowProfile).length
  }

  // Stats
  const totalPlans = plans.length
  const activePlans = plans.filter(p => p.status === "ACTIVE").length
  const criticalPositions = plans.filter(p => p.priority === "CRITICAL").length
  const positionsWithSuccessors = plans.filter(p => getCandidateCount(p) > 0).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Yedekleme Planlamasi
          </h1>
          <p className="text-muted-foreground">
            Kritik pozisyonlar icin yedekleme planlarini yonetin
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
                Yeni Plan
              </Button>
            </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Yeni Yedekleme Plani</DialogTitle>
              <DialogDescription>
                Kritik bir pozisyon icin yedekleme plani olusturun
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Pozisyon</Label>
                  <Select
                    value={formData.positionId}
                    onValueChange={(v) => setFormData({ ...formData, positionId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pozisyon secin" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((pos) => (
                        <SelectItem key={pos.id} value={pos.id}>
                          {pos.title} - {pos.department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Mevcut Calisan Adi</Label>
                  <Input
                    value={formData.currentHolderName}
                    onChange={(e) => setFormData({ ...formData, currentHolderName: e.target.value })}
                    placeholder="Ad Soyad"
                  />
                </div>

                <div>
                  <Label>Mevcut Calisan E-posta</Label>
                  <Input
                    type="email"
                    value={formData.currentHolderEmail}
                    onChange={(e) => setFormData({ ...formData, currentHolderEmail: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <Label>Oncelik</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) => setFormData({ ...formData, priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Dusuk</SelectItem>
                      <SelectItem value="MEDIUM">Orta</SelectItem>
                      <SelectItem value="HIGH">Yuksek</SelectItem>
                      <SelectItem value="CRITICAL">Kritik</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Bosalma Riski</Label>
                  <Select
                    value={formData.vacancyRisk}
                    onValueChange={(v) => setFormData({ ...formData, vacancyRisk: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Dusuk</SelectItem>
                      <SelectItem value="MEDIUM">Orta</SelectItem>
                      <SelectItem value="HIGH">Yuksek</SelectItem>
                      <SelectItem value="IMMINENT">Yakin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>Bosalirsa Etkisi</Label>
                  <Textarea
                    value={formData.impactIfVacant}
                    onChange={(e) => setFormData({ ...formData, impactIfVacant: e.target.value })}
                    placeholder="Bu pozisyon bosalirsa ne olur?"
                    rows={2}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Notlar</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Ek notlar..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Iptal
                </Button>
                <Button type="submit" disabled={!formData.positionId}>
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
                Yedekleme Planlamasi Kilavuzu
              </DialogTitle>
              <DialogDescription>
                Kritik pozisyonlar icin yedekleme planlarinin nasil olusturulacagini ogrenim
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Nedir */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  Yedekleme Planlamasi Nedir?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Yedekleme planlamasi, kritik pozisyonlarin bosalmasi durumunda is surekliligi saglamak
                  icin onceden hazirlanmis yedek aday havuzu olusturma surecidir. Bu sistem sayesinde
                  ani ayrilmalarda organizasyon etkilenmez.
                </p>
              </div>

              {/* Nasil Kullanilir */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-green-500" />
                  Nasil Kullanilir?
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-primary text-primary-foreground">1</Badge>
                    <div>
                      <p className="font-medium">Kritik Pozisyonlari Belirleyin</p>
                      <p className="text-muted-foreground">Yetenek Yonetimi modulunden pozisyonlari "Kritik" olarak isaretleyin.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-primary text-primary-foreground">2</Badge>
                    <div>
                      <p className="font-medium">Yedekleme Plani Olusturun</p>
                      <p className="text-muted-foreground">"Yeni Plan" butonuyla kritik pozisyon icin plan acin. Oncelik ve bosalma riskini belirleyin.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-primary text-primary-foreground">3</Badge>
                    <div>
                      <p className="font-medium">Adaylari Ekleyin</p>
                      <p className="text-muted-foreground">Hazirlik durumuna gore adaylari ekleyin: "Simdi Hazir", "1 Yil Icinde Hazir", "2 Yil Icinde Hazir".</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-primary text-primary-foreground">4</Badge>
                    <div>
                      <p className="font-medium">Gelisim Planlari Yapın</p>
                      <p className="text-muted-foreground">Adaylarin hazirlik durumunu iyilestirmek icin gelisim planlari olusturun.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Oncelik Seviyeleri */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Oncelik Seviyeleri
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-gray-100 text-gray-800">Dusuk</Badge>
                    <span className="text-muted-foreground">Standart pozisyonlar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-100 text-yellow-800">Orta</Badge>
                    <span className="text-muted-foreground">Onemli pozisyonlar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-100 text-orange-800">Yuksek</Badge>
                    <span className="text-muted-foreground">Kritik pozisyonlar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-100 text-red-800">Kritik</Badge>
                    <span className="text-muted-foreground">En kritik, hemen doldurulmali</span>
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
                  <li>Her kritik pozisyon icin en az 2-3 aday belirleyin</li>
                  <li>Adaylarin 9-Box Grid konumlarini dikkate alin</li>
                  <li>Yillik olarak planlari gozden gecirin</li>
                  <li>Bosalma riski yuksek pozisyonlara oncelik verin</li>
                  <li>Adaylarin gelisim planlarini takip edin</li>
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
            <CardTitle className="text-sm font-medium">Toplam Plan</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPlans}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif Planlar</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePlans}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kritik Pozisyonlar</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{criticalPositions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yedegi Var</CardTitle>
            <UserCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{positionsWithSuccessors}</div>
          </CardContent>
        </Card>
      </div>

      {/* Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Yedekleme Planlari</CardTitle>
          <CardDescription>
            Kritik pozisyonlar ve yedek adaylar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Henuz yedekleme plani olusturulmamis.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pozisyon</TableHead>
                  <TableHead>Departman</TableHead>
                  <TableHead>Mevcut Calisan</TableHead>
                  <TableHead>Oncelik</TableHead>
                  <TableHead>Bosalma Riski</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Adaylar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {plan.position.isCritical && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                        {plan.position.title}
                      </div>
                    </TableCell>
                    <TableCell>{plan.position.department}</TableCell>
                    <TableCell>
                      {plan.currentHolderName || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={priorityColors[plan.priority]}>
                        {priorityLabels[plan.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {vacancyRiskLabels[plan.vacancyRisk]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[plan.status]}>
                        {statusLabels[plan.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {getCandidateCount(plan)} aday
                        </span>
                        {getReadyNowCount(plan) > 0 && (
                          <Badge className="bg-green-100 text-green-800">
                            {getReadyNowCount(plan)} hazir
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
