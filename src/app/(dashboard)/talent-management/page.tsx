"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import {
  Users,
  Target,
  TrendingUp,
  Award,
  Briefcase,
  GraduationCap,
  UserCheck,
  Star,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  Edit,
  Trash2,
  FolderSync,
  Eye,
  Grid3X3,
  Route,
  ClipboardList,
  HelpCircle,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Lightbulb,
  Info,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { toast } from "sonner"

// Tip tanımları
interface Competency {
  id: string
  code: string
  name: string
  description: string | null
  category: string
  level1Desc: string | null
  level2Desc: string | null
  level3Desc: string | null
  level4Desc: string | null
  level5Desc: string | null
  sortOrder: number
  isActive: boolean
  _count: {
    positionCompetencies: number
    employeeCompetencies: number
  }
}

interface TalentProfile {
  id: string
  userId: string
  userEmail: string
  userName: string
  talentScore: number
  performanceScore: number
  potentialScore: number
  competencyScore: number
  performanceLevel: string
  potentialLevel: string
  nineBoxPosition: string | null
  retentionRisk: string
  engagementLevel: string
  tags: string[]
  currentPosition: {
    id: string
    code: string
    title: string
    department: string
    level: string
  } | null
  competencies: Array<{
    id: string
    currentLevel: number
    targetLevel: number
    competency: {
      id: string
      code: string
      name: string
      category: string
    }
  }>
  _count: {
    developmentPlans: number
    careerPaths: number
    mentorOf: number
    menteeOf: number
  }
}

interface Position {
  id: string
  code: string
  title: string
  department: string
  level: string
  isCritical: boolean
  source: "MANUAL" | "AD"
  adJobTitle?: string | null
  lastSyncedAt?: string | null
  nextPosition: {
    id: string
    code: string
    title: string
  } | null
  requiredCompetencies: Array<{
    id: string
    requiredLevel: number
    weight: number
    competency: {
      id: string
      code: string
      name: string
      category: string
    }
  }>
  _count: {
    talentProfiles: number
    successionPlans: number
  }
}

// AD Pozisyon Önizleme tipi
interface ADPositionPreview {
  title: string
  department: string
  employeeCount: number
  suggestedCode: string
  suggestedLevel: string
}

// AD/DB Kullanici tipi
interface ADUser {
  id: string
  name: string
  email: string
  department?: string | null
  jobTitle?: string | null
  source?: "ldap" | "db"
}

// Seviye sıralaması (kariyer yolu için)
const levelOrder: Record<string, number> = {
  ENTRY: 1,
  MID: 2,
  SENIOR: 3,
  LEAD: 4,
  MANAGER: 5,
  EXECUTIVE: 6
}

// Sabitler
const categoryLabels: Record<string, string> = {
  CORE: "Temel",
  LEADERSHIP: "Liderlik",
  TECHNICAL: "Teknik",
  BEHAVIORAL: "Davranissal",
  FUNCTIONAL: "Fonksiyonel"
}

const categoryColors: Record<string, string> = {
  CORE: "bg-blue-500",
  LEADERSHIP: "bg-purple-500",
  TECHNICAL: "bg-green-500",
  BEHAVIORAL: "bg-orange-500",
  FUNCTIONAL: "bg-cyan-500"
}

const performanceLevelLabels: Record<string, string> = {
  LOW: "Dusuk",
  MEETING: "Beklentiyi Karsilar",
  EXCEEDING: "Beklentiyi Asar"
}

const potentialLevelLabels: Record<string, string> = {
  LOW: "Dusuk",
  MEDIUM: "Orta",
  HIGH: "Yuksek"
}

const retentionRiskLabels: Record<string, string> = {
  LOW: "Dusuk Risk",
  MEDIUM: "Orta Risk",
  HIGH: "Yuksek Risk",
  CRITICAL: "Kritik Risk"
}

const retentionRiskColors: Record<string, string> = {
  LOW: "bg-green-500",
  MEDIUM: "bg-yellow-500",
  HIGH: "bg-orange-500",
  CRITICAL: "bg-red-500"
}

const positionLevelLabels: Record<string, string> = {
  ENTRY: "Giris",
  JUNIOR: "Junior",
  MID: "Orta",
  SENIOR: "Senior",
  LEAD: "Lead",
  MANAGER: "Yonetici",
  DIRECTOR: "Direktor",
  EXECUTIVE: "Ust Yonetim"
}

// 9-Box Grid Pozisyon İsimleri
const nineBoxLabels: Record<string, { label: string; color: string; description: string }> = {
  "1-1": { label: "Risk", color: "bg-red-200", description: "Dusuk Performans / Dusuk Potansiyel" },
  "1-2": { label: "Sorgulanir", color: "bg-orange-200", description: "Dusuk Performans / Orta Potansiyel" },
  "1-3": { label: "Potansiyel Proje", color: "bg-yellow-200", description: "Dusuk Performans / Yuksek Potansiyel" },
  "2-1": { label: "Deneyimli Pro", color: "bg-blue-200", description: "Orta Performans / Dusuk Potansiyel" },
  "2-2": { label: "Temel Katkici", color: "bg-gray-200", description: "Orta Performans / Orta Potansiyel" },
  "2-3": { label: "Yukselen Yildiz", color: "bg-lime-200", description: "Orta Performans / Yuksek Potansiyel" },
  "3-1": { label: "Uzman", color: "bg-teal-200", description: "Yuksek Performans / Dusuk Potansiyel" },
  "3-2": { label: "Yuksek Performans", color: "bg-cyan-200", description: "Yuksek Performans / Orta Potansiyel" },
  "3-3": { label: "Yildiz", color: "bg-green-200", description: "Yuksek Performans / Yuksek Potansiyel" }
}

export default function TalentManagementPage() {
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState("competencies")
  const [loading, setLoading] = useState(true)

  // Yetkinlikler
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [competencyDialogOpen, setCompetencyDialogOpen] = useState(false)
  const [editingCompetency, setEditingCompetency] = useState<Competency | null>(null)
  const [competencyForm, setCompetencyForm] = useState({
    code: "",
    name: "",
    description: "",
    category: "CORE",
    level1Desc: "",
    level2Desc: "",
    level3Desc: "",
    level4Desc: "",
    level5Desc: "",
    sortOrder: 0
  })

  // Profiller
  const [profiles, setProfiles] = useState<TalentProfile[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProfile, setSelectedProfile] = useState<TalentProfile | null>(null)
  const [profileDetailOpen, setProfileDetailOpen] = useState(false)

  // Yeni Profil Ekleme
  const [newProfileDialogOpen, setNewProfileDialogOpen] = useState(false)
  const [adUsers, setAdUsers] = useState<ADUser[]>([])
  const [adSearchTerm, setAdSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<ADUser | null>(null)
  const [adLoading, setAdLoading] = useState(false)
  const [newProfileForm, setNewProfileForm] = useState({
    performanceLevel: "MEETING",
    potentialLevel: "MEDIUM",
    retentionRisk: "LOW",
    engagementLevel: "ENGAGED",
    currentPositionId: "",
    tags: ""
  })

  // Pozisyonlar
  const [positions, setPositions] = useState<Position[]>([])
  const [positionDialogOpen, setPositionDialogOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<Position | null>(null)
  const [positionForm, setPositionForm] = useState({
    code: "",
    title: "",
    department: "",
    level: "MID",
    description: "",
    nextPositionId: "",
    isCritical: false,
    minExperienceYears: 0,
    requiredEducation: ""
  })

  // AD Sync için
  const [adSyncDialogOpen, setAdSyncDialogOpen] = useState(false)
  const [adSyncLoading, setAdSyncLoading] = useState(false)
  const [adPositionPreviews, setAdPositionPreviews] = useState<ADPositionPreview[]>([])
  const [adSyncPreviewLoading, setAdSyncPreviewLoading] = useState(false)

  // Kariyer Zinciri Modal
  const [careerPathDialogOpen, setCareerPathDialogOpen] = useState(false)
  const [selectedPositionForCareer, setSelectedPositionForCareer] = useState<Position | null>(null)

  // Klavuz modal
  const [guideOpen, setGuideOpen] = useState(false)

  // 9-Box Grid için istatistikler
  const [nineBoxStats, setNineBoxStats] = useState<Record<string, number>>({})

  // Yetki kontrolü
  const canAccess = session?.user?.role === "IT_MANAGER" ||
    session?.user?.role === "ADMIN" ||
    session?.user?.role === "SUPER_ADMIN" ||
    session?.user?.role === "HR_MANAGER"

  useEffect(() => {
    if (status === "authenticated" && !canAccess) {
      redirect("/dashboard")
    }
  }, [status, canAccess])

  // Verileri yükle
  const fetchCompetencies = async () => {
    try {
      const res = await fetch("/api/talent-management/competencies")
      if (res.ok) {
        const data = await res.json()
        setCompetencies(data)
      }
    } catch (error) {
      console.error("Yetkinlikler yuklenemedi:", error)
    }
  }

  const fetchProfiles = async () => {
    try {
      const res = await fetch("/api/talent-management/profiles")
      if (res.ok) {
        const data = await res.json()
        setProfiles(data)

        // 9-Box istatistiklerini hesapla
        const stats: Record<string, number> = {}
        data.forEach((profile: TalentProfile) => {
          if (profile.nineBoxPosition) {
            stats[profile.nineBoxPosition] = (stats[profile.nineBoxPosition] || 0) + 1
          }
        })
        setNineBoxStats(stats)
      }
    } catch (error) {
      console.error("Profiller yuklenemedi:", error)
    }
  }

  const fetchPositions = async () => {
    try {
      const res = await fetch("/api/talent-management/positions")
      if (res.ok) {
        const data = await res.json()
        setPositions(data)
      }
    } catch (error) {
      console.error("Pozisyonlar yuklenemedi:", error)
    }
  }

  const fetchAllData = async () => {
    setLoading(true)
    await Promise.all([fetchCompetencies(), fetchProfiles(), fetchPositions()])
    setLoading(false)
  }

  // AD Pozisyonlarını Önizle
  const fetchADPositionPreview = async () => {
    setAdSyncPreviewLoading(true)
    try {
      const res = await fetch("/api/talent-management/positions/sync-ad")
      if (res.ok) {
        const data = await res.json()
        setAdPositionPreviews(data.positions || [])
      } else {
        const error = await res.json()
        toast.error(error.error || "AD pozisyonları alınamadı")
      }
    } catch (error) {
      console.error("AD pozisyon önizleme hatası:", error)
      toast.error("AD bağlantı hatası")
    } finally {
      setAdSyncPreviewLoading(false)
    }
  }

  // AD Pozisyonlarını Senkronize Et
  const syncADPositions = async () => {
    setAdSyncLoading(true)
    try {
      const res = await fetch("/api/talent-management/positions/sync-ad", {
        method: "POST"
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`${data.created} yeni pozisyon eklendi, ${data.updated} pozisyon güncellendi`)
        setAdSyncDialogOpen(false)
        fetchPositions()
      } else {
        const error = await res.json()
        toast.error(error.error || "Senkronizasyon başarısız")
      }
    } catch (error) {
      console.error("AD senkronizasyon hatası:", error)
      toast.error("Senkronizasyon hatası")
    } finally {
      setAdSyncLoading(false)
    }
  }

  // Pozisyon kaydet (yeni veya güncelle)
  const handleSavePosition = async () => {
    try {
      const url = editingPosition
        ? `/api/talent-management/positions/${editingPosition.id}`
        : "/api/talent-management/positions"

      const res = await fetch(url, {
        method: editingPosition ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(positionForm)
      })

      if (res.ok) {
        toast.success(editingPosition ? "Pozisyon güncellendi" : "Pozisyon oluşturuldu")
        setPositionDialogOpen(false)
        resetPositionForm()
        fetchPositions()
      } else {
        const error = await res.json()
        toast.error(error.error || "İşlem başarısız")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    }
  }

  // Pozisyon sil
  const handleDeletePosition = async (id: string) => {
    if (!confirm("Bu pozisyonu silmek istediğinize emin misiniz?")) return

    try {
      const res = await fetch(`/api/talent-management/positions/${id}`, {
        method: "DELETE"
      })

      if (res.ok) {
        toast.success("Pozisyon silindi")
        fetchPositions()
      } else {
        const error = await res.json()
        toast.error(error.error || "Silme başarısız")
      }
    } catch (error) {
      toast.error("Bir hata oluştu")
    }
  }

  // Pozisyon form reset
  const resetPositionForm = () => {
    setPositionForm({
      code: "",
      title: "",
      department: "",
      level: "MID",
      description: "",
      nextPositionId: "",
      isCritical: false,
      minExperienceYears: 0,
      requiredEducation: ""
    })
    setEditingPosition(null)
  }

  // Pozisyon düzenlemeye aç
  const openEditPosition = (pos: Position) => {
    setEditingPosition(pos)
    setPositionForm({
      code: pos.code,
      title: pos.title,
      department: pos.department,
      level: pos.level,
      description: "",
      nextPositionId: pos.nextPosition?.id || "",
      isCritical: pos.isCritical,
      minExperienceYears: 0,
      requiredEducation: ""
    })
    setPositionDialogOpen(true)
  }

  // Kariyer zincirini hesapla (aynı departmandaki pozisyonları seviyeye göre sırala)
  const getCareerChain = (position: Position) => {
    // Aynı departmandaki pozisyonları bul
    const sameDeptPositions = positions.filter(p =>
      p.department.toLowerCase() === position.department.toLowerCase()
    )

    // Seviyeye göre sırala
    const sortedPositions = sameDeptPositions.sort((a, b) => {
      const levelA = levelOrder[a.level] || 0
      const levelB = levelOrder[b.level] || 0
      return levelA - levelB
    })

    // Mevcut pozisyonun index'i
    const currentIndex = sortedPositions.findIndex(p => p.id === position.id)

    // Önceki pozisyonlar (daha düşük seviyeler)
    const previousPositions = sortedPositions.slice(0, currentIndex)

    // Sonraki pozisyonlar (daha yüksek seviyeler)
    const nextPositions = sortedPositions.slice(currentIndex + 1)

    return {
      previous: previousPositions,
      current: position,
      next: nextPositions,
      allInDept: sortedPositions
    }
  }

  // Kariyer zinciri modalını aç
  const openCareerPathModal = (pos: Position) => {
    setSelectedPositionForCareer(pos)
    setCareerPathDialogOpen(true)
  }

  useEffect(() => {
    if (session) {
      fetchAllData()
    }
  }, [session])

  // Yetkinlik kaydet
  const handleSaveCompetency = async () => {
    try {
      const url = editingCompetency
        ? `/api/talent-management/competencies/${editingCompetency.id}`
        : "/api/talent-management/competencies"

      const res = await fetch(url, {
        method: editingCompetency ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(competencyForm)
      })

      if (res.ok) {
        toast.success(editingCompetency ? "Yetkinlik guncellendi" : "Yetkinlik olusturuldu")
        setCompetencyDialogOpen(false)
        resetCompetencyForm()
        fetchCompetencies()
      } else {
        const error = await res.json()
        toast.error(error.error || "Islem basarisiz")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    }
  }

  // Yetkinlik sil
  const handleDeleteCompetency = async (id: string) => {
    if (!confirm("Bu yetkinligi silmek istediginize emin misiniz?")) return

    try {
      const res = await fetch(`/api/talent-management/competencies/${id}`, {
        method: "DELETE"
      })

      if (res.ok) {
        toast.success("Yetkinlik silindi")
        fetchCompetencies()
      } else {
        const error = await res.json()
        toast.error(error.error || "Silme basarisiz")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    }
  }

  const resetCompetencyForm = () => {
    setCompetencyForm({
      code: "",
      name: "",
      description: "",
      category: "CORE",
      level1Desc: "",
      level2Desc: "",
      level3Desc: "",
      level4Desc: "",
      level5Desc: "",
      sortOrder: 0
    })
    setEditingCompetency(null)
  }

  const openEditCompetency = (comp: Competency) => {
    setEditingCompetency(comp)
    setCompetencyForm({
      code: comp.code,
      name: comp.name,
      description: comp.description || "",
      category: comp.category,
      level1Desc: comp.level1Desc || "",
      level2Desc: comp.level2Desc || "",
      level3Desc: comp.level3Desc || "",
      level4Desc: comp.level4Desc || "",
      level5Desc: comp.level5Desc || "",
      sortOrder: comp.sortOrder
    })
    setCompetencyDialogOpen(true)
  }

  // AD Kullanici Ara
  const searchADUsers = useCallback(async (search: string) => {
    if (search.length < 2) {
      setAdUsers([])
      return
    }

    setAdLoading(true)
    try {
      const res = await fetch(`/api/users?search=${encodeURIComponent(search)}`)
      if (res.ok) {
        const data = await res.json()
        // Zaten profili olanları filtrele
        const existingEmails = (profiles || []).map(p => p.userEmail?.toLowerCase() || "")
        const filtered = (data || []).filter((u: ADUser) => {
          if (!u || !u.email) return false
          return !existingEmails.includes(u.email.toLowerCase())
        })
        setAdUsers(filtered)
      }
    } catch (error) {
      console.error("AD kullanicilari aranamadi:", error)
      setAdUsers([])
    } finally {
      setAdLoading(false)
    }
  }, [profiles])

  // AD arama debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (adSearchTerm) {
        searchADUsers(adSearchTerm)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [adSearchTerm, searchADUsers])

  // Yeni profil kaydet
  const handleSaveNewProfile = async () => {
    if (!selectedUser) {
      toast.error("Lutfen bir kullanici secin")
      return
    }

    try {
      const res = await fetch("/api/talent-management/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          userEmail: selectedUser.email,
          userName: selectedUser.name,
          currentPositionId: newProfileForm.currentPositionId || null,
          performanceLevel: newProfileForm.performanceLevel,
          potentialLevel: newProfileForm.potentialLevel,
          retentionRisk: newProfileForm.retentionRisk,
          engagementLevel: newProfileForm.engagementLevel,
          tags: newProfileForm.tags ? newProfileForm.tags.split(",").map(t => t.trim()) : []
        })
      })

      if (res.ok) {
        toast.success(`${selectedUser.name} icin yetenek profili olusturuldu`)
        setNewProfileDialogOpen(false)
        resetNewProfileForm()
        fetchProfiles()
      } else {
        const error = await res.json()
        toast.error(error.error || "Profil olusturulamadi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    }
  }

  const resetNewProfileForm = () => {
    setSelectedUser(null)
    setAdSearchTerm("")
    setAdUsers([])
    setNewProfileForm({
      performanceLevel: "MEETING",
      potentialLevel: "MEDIUM",
      retentionRisk: "LOW",
      engagementLevel: "ENGAGED",
      currentPositionId: "",
      tags: ""
    })
  }

  // Filtrelenmis profiller
  const filteredProfiles = profiles.filter(p =>
    p.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!canAccess) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Yetenek Yonetimi
          </h1>
          <p className="text-muted-foreground">
            Yetkinlik matrisi, yetenek profilleri ve kariyer planlama
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setGuideOpen(true)}>
            <HelpCircle className="h-4 w-4 mr-2" />
            Klavuz
          </Button>
          <Button variant="outline" onClick={fetchAllData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* Ozet Kartlar */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              Tanimli Yetkinlikler
            </CardDescription>
            <CardTitle className="text-3xl">{competencies.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(categoryLabels).map(([key, label]) => {
                const count = competencies.filter(c => c.category === key).length
                if (count === 0) return null
                return (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {label}: {count}
                  </Badge>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <UserCheck className="h-4 w-4" />
              Yetenek Profilleri
            </CardDescription>
            <CardTitle className="text-3xl">{profiles.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {profiles.filter(p => p.nineBoxPosition === "3-3").length} yıldız çalışanı
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Briefcase className="h-4 w-4" />
              Pozisyonlar
            </CardDescription>
            <CardTitle className="text-3xl">{positions.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {positions.filter(p => p.isCritical).length} kritik pozisyon
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Ort. Yetenek Skoru
            </CardDescription>
            <CardTitle className="text-3xl">
              {profiles.length > 0
                ? Math.round(profiles.reduce((sum, p) => sum + p.talentScore, 0) / profiles.length)
                : 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress
              value={profiles.length > 0
                ? profiles.reduce((sum, p) => sum + p.talentScore, 0) / profiles.length
                : 0}
              className="h-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Sekmeler */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="competencies" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Yetkinlikler
          </TabsTrigger>
          <TabsTrigger value="profiles" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Profiller
          </TabsTrigger>
          <TabsTrigger value="ninebox" className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            9-Box Grid
          </TabsTrigger>
          <TabsTrigger value="positions" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Pozisyonlar
          </TabsTrigger>
        </TabsList>

        {/* Yetkinlikler Sekmesi */}
        <TabsContent value="competencies" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Yetkinlik Matrisi</CardTitle>
                  <CardDescription>
                    Organizasyonel yetkinlik tanimlamalari ve seviyeleri
                  </CardDescription>
                </div>
                <Button onClick={() => {
                  resetCompetencyForm()
                  setCompetencyDialogOpen(true)
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Yetkinlik
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {competencies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Henuz tanimli yetkinlik yok</p>
                  <p className="text-sm">Yeni yetkinlik ekleyerek baslayabilirsiniz</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kod</TableHead>
                        <TableHead>Yetkinlik Adi</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-center">Pozisyon</TableHead>
                        <TableHead className="text-center">Calisan</TableHead>
                        <TableHead className="text-center">Durum</TableHead>
                        <TableHead className="text-center">Islemler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {competencies.map((comp) => (
                        <TableRow key={comp.id}>
                          <TableCell className="font-mono font-medium">{comp.code}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{comp.name}</p>
                              {comp.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {comp.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${categoryColors[comp.category]} text-white`}>
                              {categoryLabels[comp.category]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {comp._count.positionCompetencies}
                          </TableCell>
                          <TableCell className="text-center">
                            {comp._count.employeeCompetencies}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={comp.isActive ? "default" : "secondary"}>
                              {comp.isActive ? "Aktif" : "Pasif"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditCompetency(comp)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCompetency(comp.id)}
                                disabled={comp._count.positionCompetencies > 0 || comp._count.employeeCompetencies > 0}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profiller Sekmesi */}
        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Yetenek Profilleri</CardTitle>
                  <CardDescription>
                    Calisanlarin yetenek degerlendirmeleri ve kariyer planlari
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => {
                    resetNewProfileForm()
                    setNewProfileDialogOpen(true)
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Yeni Profil
                  </Button>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Ara..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-[200px]"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredProfiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Henuz yetenek profili olusturulmamis</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Calisan</TableHead>
                        <TableHead>Pozisyon</TableHead>
                        <TableHead className="text-center">Performans</TableHead>
                        <TableHead className="text-center">Potansiyel</TableHead>
                        <TableHead className="text-center">9-Box</TableHead>
                        <TableHead className="text-center">Yetenek Skoru</TableHead>
                        <TableHead className="text-center">Risk</TableHead>
                        <TableHead className="text-center">Islemler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProfiles.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{profile.userName}</p>
                              <p className="text-xs text-muted-foreground">{profile.userEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {profile.currentPosition ? (
                              <div>
                                <p className="text-sm">{profile.currentPosition.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {profile.currentPosition.department}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">
                              {performanceLevelLabels[profile.performanceLevel]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">
                              {potentialLevelLabels[profile.potentialLevel]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {profile.nineBoxPosition && nineBoxLabels[profile.nineBoxPosition] && (
                              <Badge className={nineBoxLabels[profile.nineBoxPosition].color}>
                                {nineBoxLabels[profile.nineBoxPosition].label}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Progress value={profile.talentScore} className="w-16 h-2" />
                              <span className="text-sm font-medium">{Math.round(profile.talentScore)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className={`w-3 h-3 rounded-full mx-auto ${retentionRiskColors[profile.retentionRisk]}`}
                              title={retentionRiskLabels[profile.retentionRisk]}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedProfile(profile)
                                setProfileDetailOpen(true)
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Detay
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 9-Box Grid Sekmesi */}
        <TabsContent value="ninebox" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>9-Box Talent Grid</CardTitle>
              <CardDescription>
                Performans ve potansiyele gore calisanlarinizi konumlandirin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 max-w-3xl mx-auto">
                {/* Grid başlıkları */}
                <div className="col-span-3 flex justify-center mb-2">
                  <span className="text-sm font-medium text-muted-foreground">POTANSIYEL</span>
                </div>
                <div className="col-span-3 grid grid-cols-3 text-center text-xs text-muted-foreground mb-1">
                  <span>Dusuk</span>
                  <span>Orta</span>
                  <span>Yuksek</span>
                </div>

                {/* Grid hücreleri - Yukarıdan aşağıya: Yüksek, Orta, Düşük performans */}
                {[
                  ["3-1", "3-2", "3-3"],
                  ["2-1", "2-2", "2-3"],
                  ["1-1", "1-2", "1-3"]
                ].map((row, rowIndex) => (
                  row.map((pos) => {
                    const config = nineBoxLabels[pos]
                    const count = nineBoxStats[pos] || 0
                    const profilesInBox = profiles.filter(p => p.nineBoxPosition === pos)

                    return (
                      <div
                        key={pos}
                        className={`${config.color} rounded-lg p-4 min-h-[120px] flex flex-col justify-between border-2 border-transparent hover:border-gray-400 transition-colors cursor-pointer`}
                        title={config.description}
                      >
                        <div>
                          <p className="font-medium text-sm">{config.label}</p>
                          <p className="text-xs text-muted-foreground">{config.description}</p>
                        </div>
                        <div className="mt-2">
                          <span className="text-2xl font-bold">{count}</span>
                          <span className="text-xs text-muted-foreground ml-1">kisi</span>
                        </div>
                        {profilesInBox.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {profilesInBox.slice(0, 3).map(p => (
                              <p key={p.id} className="text-xs truncate">{p.userName}</p>
                            ))}
                            {profilesInBox.length > 3 && (
                              <p className="text-xs text-muted-foreground">+{profilesInBox.length - 3} daha</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                ))}

                {/* Sol taraf performans etiketleri */}
                <div className="col-span-3 flex items-center justify-start mt-2">
                  <div className="flex flex-col text-xs text-muted-foreground -rotate-90 translate-x-[-40px]">
                    <span>PERFORMANS</span>
                  </div>
                </div>
              </div>

              {/* Performans seviyesi göstergesi */}
              <div className="flex justify-start mt-4 ml-8">
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span>Yuksek</span>
                  <span>Orta</span>
                  <span>Dusuk</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pozisyonlar Sekmesi */}
        <TabsContent value="positions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pozisyon Tanimlari</CardTitle>
                  <CardDescription>
                    Pozisyonlar ve gerektirdikleri yetkinlikler
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => {
                    resetPositionForm()
                    setPositionDialogOpen(true)
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Yeni Pozisyon
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setAdSyncDialogOpen(true)
                    fetchADPositionPreview()
                  }}>
                    <FolderSync className="h-4 w-4 mr-2" />
                    AD Senkronize Et
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {positions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Henuz tanimli pozisyon yok</p>
                  <p className="text-sm mt-2">AD Senkronize Et butonu ile Active Directory'den pozisyonları çekebilirsiniz</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kod</TableHead>
                        <TableHead>Unvan</TableHead>
                        <TableHead>Departman</TableHead>
                        <TableHead>Seviye</TableHead>
                        <TableHead className="text-center">Kaynak</TableHead>
                        <TableHead className="text-center">Yetkinlik</TableHead>
                        <TableHead className="text-center">Calisan</TableHead>
                        <TableHead className="text-center">Kritik</TableHead>
                        <TableHead>Kariyer Yolu</TableHead>
                        <TableHead className="text-center">Islemler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {positions.map((pos) => (
                        <TableRow key={pos.id}>
                          <TableCell className="font-mono font-medium">{pos.code}</TableCell>
                          <TableCell className="font-medium">
                            <div>
                              {pos.title}
                              {pos.adJobTitle && pos.adJobTitle !== pos.title && (
                                <p className="text-xs text-muted-foreground">AD: {pos.adJobTitle}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{pos.department}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {positionLevelLabels[pos.level]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={pos.source === "AD" ? "default" : "secondary"}>
                              {pos.source === "AD" ? "AD" : "Manuel"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {pos.requiredCompetencies.length}
                          </TableCell>
                          <TableCell className="text-center">
                            {pos._count.talentProfiles}
                          </TableCell>
                          <TableCell className="text-center">
                            {pos.isCritical && (
                              <Star className="h-4 w-4 text-yellow-500 mx-auto fill-yellow-500" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto py-1 px-2"
                              onClick={() => openCareerPathModal(pos)}
                            >
                              <Route className="h-3 w-3 mr-1" />
                              <span className="text-xs">Kariyer Yolu</span>
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditPosition(pos)}
                                title="Düzenle"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeletePosition(pos.id)}
                                disabled={pos._count.talentProfiles > 0 || pos._count.successionPlans > 0}
                                title="Sil"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Yetkinlik Dialog */}
      <Dialog open={competencyDialogOpen} onOpenChange={(open) => {
        setCompetencyDialogOpen(open)
        if (!open) resetCompetencyForm()
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompetency ? "Yetkinlik Duzenle" : "Yeni Yetkinlik"}
            </DialogTitle>
            <DialogDescription>
              Yetkinlik tanimi ve seviye aciklamalari
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Yetkinlik Kodu *</Label>
                <Input
                  id="code"
                  value={competencyForm.code}
                  onChange={(e) => setCompetencyForm({ ...competencyForm, code: e.target.value.toUpperCase() })}
                  placeholder="COMM001"
                  disabled={!!editingCompetency}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Kategori *</Label>
                <Select
                  value={competencyForm.category}
                  onValueChange={(v) => setCompetencyForm({ ...competencyForm, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Yetkinlik Adi *</Label>
              <Input
                id="name"
                value={competencyForm.name}
                onChange={(e) => setCompetencyForm({ ...competencyForm, name: e.target.value })}
                placeholder="Iletisim Becerileri"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Aciklama</Label>
              <Textarea
                id="description"
                value={competencyForm.description}
                onChange={(e) => setCompetencyForm({ ...competencyForm, description: e.target.value })}
                placeholder="Yetkinlik aciklamasi..."
                rows={2}
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Seviye Tanimlari (1-5)</h4>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div key={level} className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-2 w-12 justify-center">
                      {level}
                    </Badge>
                    <div className="flex-1">
                      <Input
                        value={competencyForm[`level${level}Desc` as keyof typeof competencyForm] as string}
                        onChange={(e) => setCompetencyForm({
                          ...competencyForm,
                          [`level${level}Desc`]: e.target.value
                        })}
                        placeholder={`Seviye ${level} tanimi...`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompetencyDialogOpen(false)}>
              Iptal
            </Button>
            <Button onClick={handleSaveCompetency} disabled={!competencyForm.code || !competencyForm.name}>
              {editingCompetency ? "Guncelle" : "Olustur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profil Detay Dialog */}
      <Dialog open={profileDetailOpen} onOpenChange={setProfileDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Yetenek Profili
            </DialogTitle>
            <DialogDescription>
              {selectedProfile?.userName}
            </DialogDescription>
          </DialogHeader>

          {selectedProfile && (
            <div className="space-y-6">
              {/* Ozet Kartlar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Yetenek Skoru</CardDescription>
                    <CardTitle className="text-2xl">{Math.round(selectedProfile.talentScore)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={selectedProfile.talentScore} className="h-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Performans</CardDescription>
                    <CardTitle className="text-lg">
                      {performanceLevelLabels[selectedProfile.performanceLevel]}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Potansiyel</CardDescription>
                    <CardTitle className="text-lg">
                      {potentialLevelLabels[selectedProfile.potentialLevel]}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>9-Box Pozisyon</CardDescription>
                    <CardTitle className="text-lg">
                      {selectedProfile.nineBoxPosition && nineBoxLabels[selectedProfile.nineBoxPosition]
                        ? nineBoxLabels[selectedProfile.nineBoxPosition].label
                        : "-"
                      }
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Yetkinlikler */}
              {selectedProfile.competencies.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Yetkinlik Degerlendirmesi
                  </h4>
                  <div className="space-y-3">
                    {selectedProfile.competencies.map((ec) => (
                      <div key={ec.id} className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{ec.competency.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {ec.currentLevel} / {ec.targetLevel}
                            </span>
                          </div>
                          <Progress value={(ec.currentLevel / 5) * 100} className="h-2" />
                        </div>
                        <Badge variant="outline" className={categoryColors[ec.competency.category].replace('bg-', 'border-')}>
                          {categoryLabels[ec.competency.category]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Etiketler */}
              {selectedProfile.tags.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Etiketler</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProfile.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Istatistikler */}
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{selectedProfile._count.developmentPlans}</p>
                  <p className="text-xs text-muted-foreground">Gelisim Plani</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{selectedProfile._count.careerPaths}</p>
                  <p className="text-xs text-muted-foreground">Kariyer Yolu</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{selectedProfile._count.mentorOf}</p>
                  <p className="text-xs text-muted-foreground">Mentor</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{selectedProfile._count.menteeOf}</p>
                  <p className="text-xs text-muted-foreground">Mentee</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Klavuz Modal */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <BookOpen className="h-6 w-6 text-primary" />
              Yetenek Yonetimi Klavuzu
            </DialogTitle>
            <DialogDescription>
              Stratejik insan kaynaklari yonetimi icin kapsamli rehber
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-8">
              {/* Giris */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Yetenek Yonetimi Nedir?
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Yetenek Yonetimi, organizasyonunuzdaki calisanlarin yetkinliklerini, performanslarini ve
                  potansiyellerini sistematik olarak degerlendirmenizi, gelistirmenizi ve stratejik olarak
                  yonetmenizi saglayan kapsamli bir sistemdir. Bu modul ile calisanlarinizi 9-Box Grid
                  uzerinde konumlandirir, kariyer yollarini planlar ve yedekleme stratejileri olusturursunuz.
                </p>
              </div>

              {/* Yetkinlik Matrisi */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  1. Yetkinlik Matrisi
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-medium">Yetkinlik Nedir?</h4>
                    <p className="text-sm text-muted-foreground">
                      Yetkinlikler, bir pozisyonda basarili olmak icin gerekli bilgi, beceri ve
                      davranislarin tanimlanmis halidir. Her yetkinlik 1-5 arasi seviyelendirilir.
                    </p>
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium">Yetkinlik Kategorileri:</h5>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-blue-500">Temel</Badge>
                        <Badge className="bg-purple-500">Liderlik</Badge>
                        <Badge className="bg-green-500">Teknik</Badge>
                        <Badge className="bg-orange-500">Davranissal</Badge>
                        <Badge className="bg-cyan-500">Fonksiyonel</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Seviye Tanimlari</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">1</Badge>
                        <span>Baslangic - Temel bilgi duzeyi</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">2</Badge>
                        <span>Gelisen - Rehberlik ile uygular</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">3</Badge>
                        <span>Yetkin - Bagimsiz uygular</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">4</Badge>
                        <span>Ileri - Baskalarina ogretir</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">5</Badge>
                        <span>Uzman - Stratejik liderlik yapar</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Nasil Kullanilir?</p>
                      <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                        <li>• "Yeni Yetkinlik" butonu ile organizasyonunuza ozgu yetkinlikler tanimlayin</li>
                        <li>• Her seviye icin net ve olculebilir aciklamalar yazin</li>
                        <li>• Yetkinlikleri pozisyonlara atayarak beklentileri netlestirin</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 9-Box Grid */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                  <Grid3X3 className="h-5 w-5 text-purple-500" />
                  2. 9-Box Talent Grid
                </h3>
                <p className="text-sm text-muted-foreground">
                  9-Box Grid, calisanlarinizi performans ve potansiyel eksenlerinde
                  konumlandirmanizi saglayan stratejik bir aractir.
                </p>
                <div className="grid grid-cols-3 gap-2 max-w-md mx-auto text-center text-xs">
                  <div className="bg-yellow-200 p-3 rounded">
                    <p className="font-medium">Potansiyel Proje</p>
                    <p className="text-muted-foreground">Gelistir</p>
                  </div>
                  <div className="bg-lime-200 p-3 rounded">
                    <p className="font-medium">Yukselen Yildiz</p>
                    <p className="text-muted-foreground">Hizlandir</p>
                  </div>
                  <div className="bg-green-200 p-3 rounded">
                    <p className="font-medium">Yildiz</p>
                    <p className="text-muted-foreground">Elde Tut</p>
                  </div>
                  <div className="bg-orange-200 p-3 rounded">
                    <p className="font-medium">Sorgulanir</p>
                    <p className="text-muted-foreground">Gozlemle</p>
                  </div>
                  <div className="bg-gray-200 p-3 rounded">
                    <p className="font-medium">Temel Katkici</p>
                    <p className="text-muted-foreground">Destekle</p>
                  </div>
                  <div className="bg-cyan-200 p-3 rounded">
                    <p className="font-medium">Yuksek Performans</p>
                    <p className="text-muted-foreground">Odullendir</p>
                  </div>
                  <div className="bg-red-200 p-3 rounded">
                    <p className="font-medium">Risk</p>
                    <p className="text-muted-foreground">Karar Ver</p>
                  </div>
                  <div className="bg-blue-200 p-3 rounded">
                    <p className="font-medium">Deneyimli Pro</p>
                    <p className="text-muted-foreground">Deger Ver</p>
                  </div>
                  <div className="bg-teal-200 p-3 rounded">
                    <p className="font-medium">Uzman</p>
                    <p className="text-muted-foreground">Bilgi Aktar</p>
                  </div>
                </div>
                <div className="flex justify-center gap-8 text-xs text-muted-foreground">
                  <span>← Dusuk Potansiyel | Yuksek Potansiyel →</span>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-5 w-5 text-purple-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Stratejik Kullanim</p>
                      <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                        <li>• <strong>Yildizlar (3-3):</strong> Kritik projelere atama, yedekleme planlarina dahil etme</li>
                        <li>• <strong>Yukselen Yildizlar (2-3):</strong> Hizlandirilmis gelisim programlari</li>
                        <li>• <strong>Temel Katkicilar (2-2):</strong> Sureklilik ve stabilite icin deger verin</li>
                        <li>• <strong>Risk Grubu (1-1):</strong> Performans iyilestirme plani veya ayrilma karari</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Yetenek Profilleri */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                  <UserCheck className="h-5 w-5 text-green-500" />
                  3. Yetenek Profilleri
                </h3>
                <p className="text-sm text-muted-foreground">
                  Her calisan icin olusturulan profil, kisinin yetkinlik degerlendirilmelerini,
                  performans ve potansiyel seviyelerini, kariyer hedeflerini ve gelisim planlarini icerir.
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Yetenek Skoru
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      0-100 arasi hesaplanan skor, performans, potansiyel ve yetkinlik
                      degerlendirmelerinin birlesiminden olusur.
                    </p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      Retention Risk
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Calisanin organizasyondan ayrilma riski. Yuksek performansli
                      calisanlar icin kritik bir gosterge.
                    </p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Engagement Level
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Calisanin baglilik ve motivasyon seviyesi. Dusuk baglilik
                      performans dususune yol acabilir.
                    </p>
                  </div>
                </div>
              </div>

              {/* Pozisyon Tanimlari */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                  <Briefcase className="h-5 w-5 text-orange-500" />
                  4. Pozisyon Tanimlari
                </h3>
                <p className="text-sm text-muted-foreground">
                  Her pozisyon icin gerekli yetkinlikler, kariyer yolu ve kritiklik durumu tanimlanir.
                </p>
                <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Kritik Pozisyon Nedir?</h4>
                  <p className="text-sm text-muted-foreground">
                    Organizasyonun stratejik hedefleri icin vazgecilmez olan, bos kaldiginda
                    ciddi operasyonel veya finansal etki yaratacak pozisyonlardir. Bu pozisyonlar
                    icin yedekleme planlari olusturmak kritik onem tasir.
                  </p>
                </div>
              </div>

              {/* En Iyi Uygulamalar */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                  <CheckCircle2 className="h-5 w-5 text-teal-500" />
                  En Iyi Uygulamalar
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-teal-500 mt-1" />
                      <div>
                        <p className="font-medium text-sm">Duzeni Degerlendirme</p>
                        <p className="text-xs text-muted-foreground">
                          Yillik veya 6 aylik performans ve potansiyel degerlendirmeleri yapin
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-teal-500 mt-1" />
                      <div>
                        <p className="font-medium text-sm">Kalibrasyon Toplantilari</p>
                        <p className="text-xs text-muted-foreground">
                          Yoneticiler arasi tutarlilik icin degerlendirme kalibrasyon toplantilari duzenleyin
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-teal-500 mt-1" />
                      <div>
                        <p className="font-medium text-sm">Gelisim Odakli Yaklasim</p>
                        <p className="text-xs text-muted-foreground">
                          Her calisan icin somut gelisim planlari ve hedefler belirleyin
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-teal-500 mt-1" />
                      <div>
                        <p className="font-medium text-sm">Yedekleme Planlama</p>
                        <p className="text-xs text-muted-foreground">
                          Kritik pozisyonlar icin en az 2 yedek aday belirleyin
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-teal-500 mt-1" />
                      <div>
                        <p className="font-medium text-sm">Seffaflik</p>
                        <p className="text-xs text-muted-foreground">
                          Kariyer yollari ve beklentiler hakkinda calisanlarla acik iletisim kurun
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-teal-500 mt-1" />
                      <div>
                        <p className="font-medium text-sm">Veri Tabanli Kararlar</p>
                        <p className="text-xs text-muted-foreground">
                          Terfi ve atama kararlarinda yetenek verilerini kullanin
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kisa Yollar */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Hizli Erisim</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span>Yetkinlikler</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-green-500" />
                    <span>Profiller</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4 text-purple-500" />
                    <span>9-Box Grid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-orange-500" />
                    <span>Pozisyonlar</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button onClick={() => setGuideOpen(false)}>
              Anladim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Yeni Profil Ekleme Dialog */}
      <Dialog open={newProfileDialogOpen} onOpenChange={setNewProfileDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Yeni Yetenek Profili Olustur
            </DialogTitle>
            <DialogDescription>
              Active Directory veya veritabanindan bir kullanici secin ve ilk degerlendirmesini yapin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Kullanici Secimi */}
            <div className="space-y-3">
              <Label>Calisan Sec</Label>
              {selectedUser ? (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{selectedUser.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    {selectedUser.jobTitle && (
                      <p className="text-xs text-blue-600">{selectedUser.jobTitle}</p>
                    )}
                    {selectedUser.department && (
                      <p className="text-xs text-muted-foreground">{selectedUser.department}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setSelectedUser(null)
                    setNewProfileForm(prev => ({...prev, currentPositionId: ""}))
                  }}>
                    Degistir
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Calisan adi veya email ile ara (min 2 karakter)..."
                      value={adSearchTerm}
                      onChange={(e) => setAdSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {adLoading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!adLoading && adUsers.length > 0 && (
                    <ScrollArea className="h-[200px] border rounded-lg">
                      <div className="p-2 space-y-1">
                        {adUsers.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => {
                              setSelectedUser(user)
                              setAdSearchTerm("")
                              setAdUsers([])
                              // AD'den gelen bilgilere göre pozisyon eşleştir
                              if (user.jobTitle || user.department) {
                                const matchedPosition = positions.find(pos => {
                                  // Önce title ile eşleştir
                                  if (user.jobTitle) {
                                    const jobTitleLower = user.jobTitle.toLowerCase()
                                    const posTitleLower = pos.title.toLowerCase()
                                    if (posTitleLower.includes(jobTitleLower) || jobTitleLower.includes(posTitleLower)) {
                                      return true
                                    }
                                  }
                                  // Departman ile de kontrol et
                                  if (user.department && pos.department) {
                                    const deptLower = user.department.toLowerCase()
                                    const posDeptLower = pos.department.toLowerCase()
                                    if (posDeptLower.includes(deptLower) || deptLower.includes(posDeptLower)) {
                                      // Aynı departmanda ve title benzer mi?
                                      if (user.jobTitle) {
                                        const jobTitleLower = user.jobTitle.toLowerCase()
                                        const posTitleLower = pos.title.toLowerCase()
                                        // Bazı anahtar kelimeler eşleşiyor mu?
                                        const keywords = ["yazilim", "software", "developer", "gelistirici", "muhendis", "engineer", "yonetici", "manager", "uzman", "specialist", "analist", "analyst"]
                                        const hasKeywordMatch = keywords.some(kw => jobTitleLower.includes(kw) && posTitleLower.includes(kw))
                                        if (hasKeywordMatch) return true
                                      }
                                    }
                                  }
                                  return false
                                })
                                if (matchedPosition) {
                                  setNewProfileForm(prev => ({...prev, currentPositionId: matchedPosition.id}))
                                }
                              }
                            }}
                            className="w-full text-left p-2 rounded hover:bg-accent transition-colors"
                          >
                            <p className="font-medium text-sm">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                            {user.jobTitle && (
                              <p className="text-xs text-blue-600">{user.jobTitle}</p>
                            )}
                            {user.department && (
                              <p className="text-xs text-muted-foreground">{user.department}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  {!adLoading && adSearchTerm.length >= 2 && adUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Sonuc bulunamadi veya tum kullanicilarin zaten profili var
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Degerlendirme Formu */}
            {selectedUser && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium">Ilk Degerlendirme</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Performans Seviyesi</Label>
                    <Select
                      value={newProfileForm.performanceLevel}
                      onValueChange={(v) => setNewProfileForm({...newProfileForm, performanceLevel: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Dusuk</SelectItem>
                        <SelectItem value="MEETING">Beklentiyi Karsilar</SelectItem>
                        <SelectItem value="EXCEEDING">Beklentiyi Asar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Potansiyel Seviyesi</Label>
                    <Select
                      value={newProfileForm.potentialLevel}
                      onValueChange={(v) => setNewProfileForm({...newProfileForm, potentialLevel: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Dusuk</SelectItem>
                        <SelectItem value="MEDIUM">Orta</SelectItem>
                        <SelectItem value="HIGH">Yuksek</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Ayrilma Riski</Label>
                    <Select
                      value={newProfileForm.retentionRisk}
                      onValueChange={(v) => setNewProfileForm({...newProfileForm, retentionRisk: v})}
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

                  <div className="space-y-2">
                    <Label>Baglilik Durumu</Label>
                    <Select
                      value={newProfileForm.engagementLevel}
                      onValueChange={(v) => setNewProfileForm({...newProfileForm, engagementLevel: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DISENGAGED">Kopuk</SelectItem>
                        <SelectItem value="NEUTRAL">Notr</SelectItem>
                        <SelectItem value="ENGAGED">Bagli</SelectItem>
                        <SelectItem value="HIGHLY_ENGAGED">Cok Bagli</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Mevcut Pozisyon</Label>
                  {selectedUser?.jobTitle && (
                    <p className="text-xs text-muted-foreground">
                      AD Pozisyonu: <span className="text-blue-600 font-medium">{selectedUser.jobTitle}</span>
                      {newProfileForm.currentPositionId && newProfileForm.currentPositionId !== "none" && (
                        <span className="text-green-600 ml-2">✓ Otomatik eslesti</span>
                      )}
                    </p>
                  )}
                  <Select
                    value={newProfileForm.currentPositionId || "none"}
                    onValueChange={(v) => setNewProfileForm({...newProfileForm, currentPositionId: v === "none" ? "" : v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pozisyon secin..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Pozisyon Yok</SelectItem>
                      {positions.map((pos) => (
                        <SelectItem key={pos.id} value={pos.id}>
                          {pos.title} ({pos.department})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Etiketler (Opsiyonel)</Label>
                  <Input
                    placeholder="yuksek-potansiyel, mentor, teknik-lider (virgul ile ayirin)"
                    value={newProfileForm.tags}
                    onChange={(e) => setNewProfileForm({...newProfileForm, tags: e.target.value})}
                  />
                </div>

                {/* 9-Box Onizleme */}
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">9-Box Konumu:</p>
                  <Badge className={`${nineBoxLabels[
                    `${newProfileForm.performanceLevel === "LOW" ? "1" : newProfileForm.performanceLevel === "MEETING" ? "2" : "3"}-${newProfileForm.potentialLevel === "LOW" ? "1" : newProfileForm.potentialLevel === "MEDIUM" ? "2" : "3"}`
                  ]?.color || "bg-gray-200"}`}>
                    {nineBoxLabels[
                      `${newProfileForm.performanceLevel === "LOW" ? "1" : newProfileForm.performanceLevel === "MEETING" ? "2" : "3"}-${newProfileForm.potentialLevel === "LOW" ? "1" : newProfileForm.potentialLevel === "MEDIUM" ? "2" : "3"}`
                    ]?.label || "Bilinmiyor"}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {nineBoxLabels[
                      `${newProfileForm.performanceLevel === "LOW" ? "1" : newProfileForm.performanceLevel === "MEETING" ? "2" : "3"}-${newProfileForm.potentialLevel === "LOW" ? "1" : newProfileForm.potentialLevel === "MEDIUM" ? "2" : "3"}`
                    ]?.description}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProfileDialogOpen(false)}>
              Iptal
            </Button>
            <Button onClick={handleSaveNewProfile} disabled={!selectedUser}>
              Profil Olustur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AD Sync Dialog */}
      <Dialog open={adSyncDialogOpen} onOpenChange={setAdSyncDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderSync className="h-5 w-5" />
              Active Directory Pozisyon Senkronizasyonu
            </DialogTitle>
            <DialogDescription>
              AD'deki benzersiz job title değerlerini pozisyon olarak içe aktarın
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {adSyncPreviewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">AD'den pozisyonlar alınıyor...</span>
              </div>
            ) : adPositionPreviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderSync className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>AD'de yeni pozisyon bulunamadı</p>
                <p className="text-sm">Tüm pozisyonlar zaten senkronize edilmiş olabilir</p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Önizleme</p>
                      <p className="text-sm text-muted-foreground">
                        Aşağıdaki pozisyonlar AD'den eklenecek. Senkronize Et butonuna tıkladığınızda bu pozisyonlar sisteme eklenir.
                      </p>
                    </div>
                  </div>
                </div>

                <ScrollArea className="h-[400px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Öneri Kod</TableHead>
                        <TableHead>AD Job Title</TableHead>
                        <TableHead>Departman</TableHead>
                        <TableHead>Öneri Seviye</TableHead>
                        <TableHead className="text-center">Calisan Sayisi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adPositionPreviews.map((pos, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">{pos.suggestedCode}</TableCell>
                          <TableCell className="font-medium">{pos.title}</TableCell>
                          <TableCell>{pos.department}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {positionLevelLabels[pos.suggestedLevel] || pos.suggestedLevel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{pos.employeeCount}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                <div className="text-sm text-muted-foreground">
                  Toplam <strong>{adPositionPreviews.length}</strong> yeni pozisyon eklenecek
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdSyncDialogOpen(false)}>
              Iptal
            </Button>
            <Button
              onClick={syncADPositions}
              disabled={adSyncLoading || adSyncPreviewLoading || adPositionPreviews.length === 0}
            >
              {adSyncLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Senkronize Ediliyor...
                </>
              ) : (
                <>
                  <FolderSync className="h-4 w-4 mr-2" />
                  Senkronize Et ({adPositionPreviews.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pozisyon Dialog */}
      <Dialog open={positionDialogOpen} onOpenChange={(open) => {
        setPositionDialogOpen(open)
        if (!open) resetPositionForm()
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              {editingPosition ? "Pozisyon Duzenle" : "Yeni Pozisyon"}
            </DialogTitle>
            <DialogDescription>
              Pozisyon bilgilerini girin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="posCode">Pozisyon Kodu *</Label>
                <Input
                  id="posCode"
                  value={positionForm.code}
                  onChange={(e) => setPositionForm({ ...positionForm, code: e.target.value.toUpperCase() })}
                  placeholder="IT-SWD-001"
                  disabled={!!editingPosition}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="posLevel">Seviye *</Label>
                <Select
                  value={positionForm.level}
                  onValueChange={(v) => setPositionForm({ ...positionForm, level: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(positionLevelLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="posTitle">Pozisyon Unvani *</Label>
              <Input
                id="posTitle"
                value={positionForm.title}
                onChange={(e) => setPositionForm({ ...positionForm, title: e.target.value })}
                placeholder="Yazilim Gelistirici"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="posDept">Departman *</Label>
              <Input
                id="posDept"
                value={positionForm.department}
                onChange={(e) => setPositionForm({ ...positionForm, department: e.target.value })}
                placeholder="Bilgi Teknolojileri"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="posDesc">Aciklama</Label>
              <Textarea
                id="posDesc"
                value={positionForm.description}
                onChange={(e) => setPositionForm({ ...positionForm, description: e.target.value })}
                placeholder="Pozisyon aciklamasi..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="posNextPosition">Kariyer Yolu (Sonraki Pozisyon)</Label>
                <Select
                  value={positionForm.nextPositionId || "none"}
                  onValueChange={(v) => setPositionForm({ ...positionForm, nextPositionId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sec..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Yok</SelectItem>
                    {positions
                      .filter(p => p.id !== editingPosition?.id)
                      .map((pos) => (
                        <SelectItem key={pos.id} value={pos.id}>
                          {pos.title} ({pos.department})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="posExp">Minimum Deneyim (Yil)</Label>
                <Input
                  id="posExp"
                  type="number"
                  min={0}
                  value={positionForm.minExperienceYears}
                  onChange={(e) => setPositionForm({ ...positionForm, minExperienceYears: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="posEdu">Gerekli Egitim</Label>
              <Input
                id="posEdu"
                value={positionForm.requiredEducation}
                onChange={(e) => setPositionForm({ ...positionForm, requiredEducation: e.target.value })}
                placeholder="Lisans, Muhendislik vb."
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="posCritical"
                checked={positionForm.isCritical}
                onChange={(e) => setPositionForm({ ...positionForm, isCritical: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="posCritical" className="font-normal">
                Kritik Pozisyon (Yedekleme planlama gerektirir)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPositionDialogOpen(false)}>
              Iptal
            </Button>
            <Button
              onClick={handleSavePosition}
              disabled={!positionForm.code || !positionForm.title || !positionForm.department || !positionForm.level}
            >
              {editingPosition ? "Guncelle" : "Olustur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kariyer Zinciri Modal */}
      <Dialog open={careerPathDialogOpen} onOpenChange={setCareerPathDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Kariyer Yolu - {selectedPositionForCareer?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedPositionForCareer?.department} departmanındaki kariyer zinciri
            </DialogDescription>
          </DialogHeader>

          {selectedPositionForCareer && (() => {
            const careerChain = getCareerChain(selectedPositionForCareer)
            return (
              <div className="space-y-6">
                {/* Kariyer Zinciri Görselleştirme */}
                <div className="bg-muted/30 p-6 rounded-lg">
                  <h4 className="font-medium mb-4 text-center">Kariyer Zinciri</h4>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {careerChain.allInDept.map((pos, index) => {
                      const isCurrent = pos.id === selectedPositionForCareer.id
                      const isPast = levelOrder[pos.level] < levelOrder[selectedPositionForCareer.level]
                      const isFuture = levelOrder[pos.level] > levelOrder[selectedPositionForCareer.level]

                      return (
                        <div key={pos.id} className="flex items-center">
                          <div
                            className={`
                              relative p-4 rounded-lg border-2 min-w-[160px] text-center transition-all
                              ${isCurrent
                                ? "border-primary bg-primary/10 ring-2 ring-primary/50"
                                : isPast
                                  ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                                  : "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                              }
                            `}
                          >
                            {isCurrent && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                                Mevcut
                              </div>
                            )}
                            {isPast && !isCurrent && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-0.5 rounded">
                                Onceki
                              </div>
                            )}
                            {isFuture && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                                Sonraki
                              </div>
                            )}

                            <p className="font-medium text-sm">{pos.title}</p>
                            <Badge variant="outline" className="mt-2 text-xs">
                              {positionLevelLabels[pos.level]}
                            </Badge>

                            {pos.isCritical && (
                              <div className="mt-2">
                                <Star className="h-3 w-3 text-yellow-500 mx-auto fill-yellow-500" />
                              </div>
                            )}

                            <p className="text-xs text-muted-foreground mt-2">
                              {pos._count.talentProfiles} calisan
                            </p>
                          </div>

                          {index < careerChain.allInDept.length - 1 && (
                            <ArrowRight className="h-5 w-5 text-muted-foreground mx-2 flex-shrink-0" />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {careerChain.allInDept.length === 1 && (
                    <p className="text-center text-muted-foreground mt-4">
                      Bu departmanda tek pozisyon bulunuyor
                    </p>
                  )}
                </div>

                {/* Pozisyon Detayları */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Mevcut Pozisyon Bilgileri</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Kod:</span>
                        <span className="font-mono">{selectedPositionForCareer.code}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Departman:</span>
                        <span>{selectedPositionForCareer.department}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Seviye:</span>
                        <Badge variant="outline">{positionLevelLabels[selectedPositionForCareer.level]}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Kaynak:</span>
                        <Badge variant={selectedPositionForCareer.source === "AD" ? "default" : "secondary"}>
                          {selectedPositionForCareer.source === "AD" ? "AD" : "Manuel"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Kritik:</span>
                        <span>{selectedPositionForCareer.isCritical ? "Evet" : "Hayir"}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Kariyer Ilerleme Ozeti</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Onceki Pozisyonlar:</span>
                        <span className="font-medium text-green-600">{careerChain.previous.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sonraki Pozisyonlar:</span>
                        <span className="font-medium text-blue-600">{careerChain.next.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Toplam Zincir:</span>
                        <span className="font-medium">{careerChain.allInDept.length} pozisyon</span>
                      </div>
                      {careerChain.next.length > 0 && (
                        <div className="pt-2 border-t">
                          <span className="text-muted-foreground">Bir sonraki adim:</span>
                          <p className="font-medium text-blue-600">{careerChain.next[0].title}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Detaylı Liste */}
                {careerChain.allInDept.length > 1 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Departmandaki Tum Pozisyonlar</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Sira</TableHead>
                            <TableHead>Pozisyon</TableHead>
                            <TableHead>Seviye</TableHead>
                            <TableHead className="text-center">Calisan</TableHead>
                            <TableHead>Durum</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {careerChain.allInDept.map((pos, index) => {
                            const isCurrent = pos.id === selectedPositionForCareer.id
                            return (
                              <TableRow key={pos.id} className={isCurrent ? "bg-primary/5" : ""}>
                                <TableCell className="font-mono">{index + 1}</TableCell>
                                <TableCell className="font-medium">
                                  {pos.title}
                                  {pos.isCritical && <Star className="h-3 w-3 text-yellow-500 inline ml-1 fill-yellow-500" />}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{positionLevelLabels[pos.level]}</Badge>
                                </TableCell>
                                <TableCell className="text-center">{pos._count.talentProfiles}</TableCell>
                                <TableCell>
                                  {isCurrent ? (
                                    <Badge className="bg-primary">Mevcut</Badge>
                                  ) : levelOrder[pos.level] < levelOrder[selectedPositionForCareer.level] ? (
                                    <Badge className="bg-green-500">Tamamlandi</Badge>
                                  ) : (
                                    <Badge className="bg-blue-500">Hedef</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            )
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCareerPathDialogOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
