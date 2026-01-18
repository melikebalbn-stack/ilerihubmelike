"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import Image from "next/image"
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
  Building2,
  Plus,
  Users,
  ChevronRight,
  ChevronDown,
  User,
  MapPin,
  Layers,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Lightbulb,
  Target,
  Upload,
  X,
  UserPlus,
  Briefcase,
  AlertCircle,
  Edit,
  Trash2
} from "lucide-react"
import { toast } from "sonner"

interface OrgEmployee {
  id: string
  displayName: string
  email: string | null
  title: string | null
  positionTitle: string | null
  employmentStatus: string
  photoUrl: string | null
  reportsToId: string | null
  reportsTo: {
    id: string
    displayName: string
  } | null
  orgUnit?: {
    id: string
    code: string
    name: string
  }
}

interface OrgUnit {
  id: string
  code: string
  name: string
  shortName: string | null
  description: string | null
  level: number
  sortOrder: number
  unitType: string
  managerId: string | null
  managerEmail: string | null
  managerName: string | null
  managerPhoto: string | null
  location: string | null
  headcount: number
  approvedHeadcount: number | null
  isActive: boolean
  children: OrgUnit[]
  employees?: OrgEmployee[]
  _count: {
    employees: number
  }
}

const unitTypeLabels: Record<string, string> = {
  COMPANY: "Sirket",
  DIVISION: "Bolum",
  DEPARTMENT: "Departman",
  TEAM: "Takim",
  GROUP: "Grup",
  PROJECT: "Proje"
}

const unitTypeColors: Record<string, string> = {
  COMPANY: "bg-purple-100 text-purple-800",
  DIVISION: "bg-blue-100 text-blue-800",
  DEPARTMENT: "bg-green-100 text-green-800",
  TEAM: "bg-yellow-100 text-yellow-800",
  GROUP: "bg-orange-100 text-orange-800",
  PROJECT: "bg-pink-100 text-pink-800"
}

const employmentStatusLabels: Record<string, string> = {
  ACTIVE: "Aktif",
  ON_LEAVE: "Izinli",
  SUSPENDED: "Askida",
  RESIGNED: "Istifa",
  TERMINATED: "Cikis",
  RETIRED: "Emekli",
  VACANT: "Bos Pozisyon"
}

const employmentStatusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  ON_LEAVE: "bg-yellow-100 text-yellow-800",
  SUSPENDED: "bg-orange-100 text-orange-800",
  RESIGNED: "bg-gray-100 text-gray-800",
  TERMINATED: "bg-red-100 text-red-800",
  RETIRED: "bg-blue-100 text-blue-800",
  VACANT: "bg-amber-100 text-amber-800 border-2 border-dashed border-amber-400"
}

// Unvan sıralaması - düşük değer = yüksek öncelik
const titlePriority: Record<string, number> = {
  "mudur": 1,
  "müdür": 1,
  "genel mudur": 0,
  "genel müdür": 0,
  "direktor": 2,
  "direktör": 2,
  "sef": 3,
  "şef": 3,
  "muhendis": 4,
  "mühendis": 4,
  "uzman": 5,
  "uzman yardimcisi": 6,
  "uzman yardımcısı": 6,
  "asistan": 7,
  "stajyer": 8
}

// Unvana göre öncelik hesapla
function getTitlePriority(title: string | null | undefined): number {
  if (!title) return 100 // Unvan yoksa en sona
  const lowerTitle = title.toLowerCase()

  // Tam eşleşme ara
  for (const [key, value] of Object.entries(titlePriority)) {
    if (lowerTitle.includes(key)) {
      return value
    }
  }
  return 50 // Bilinmeyen unvan ortada
}

// Personelleri unvana göre sırala (boş pozisyonlar en sona)
function sortEmployeesByTitle(employees: OrgEmployee[]): OrgEmployee[] {
  return [...employees].sort((a, b) => {
    // Önce boş pozisyonları en sona at
    if (a.employmentStatus === "VACANT" && b.employmentStatus !== "VACANT") return 1
    if (a.employmentStatus !== "VACANT" && b.employmentStatus === "VACANT") return -1

    // İkisi de boş pozisyon ise alfabetik
    if (a.employmentStatus === "VACANT" && b.employmentStatus === "VACANT") {
      return a.displayName.localeCompare(b.displayName, 'tr')
    }

    // Unvan önceliğine göre sırala
    const priorityA = getTitlePriority(a.positionTitle)
    const priorityB = getTitlePriority(b.positionTitle)

    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }

    // Aynı öncelikteyse alfabetik
    return a.displayName.localeCompare(b.displayName, 'tr')
  })
}

interface OrgUnitNodeProps {
  unit: OrgUnit
  level: number
  expandedIds: Set<string>
  toggleExpand: (id: string) => void
  employees: OrgEmployee[]
  onAddEmployee: (unitId: string) => void
}

function OrgUnitNode({ unit, level, expandedIds, toggleExpand, employees, onAddEmployee }: OrgUnitNodeProps) {
  const isExpanded = expandedIds.has(unit.id)
  const hasChildren = unit.children && unit.children.length > 0
  const unitEmployees = employees.filter(e => e.orgUnit?.id === unit.id)
  const sortedEmployees = sortEmployeesByTitle(unitEmployees)
  const activeEmployees = unitEmployees.filter(e => e.employmentStatus !== "VACANT")
  const vacantPositions = unitEmployees.filter(e => e.employmentStatus === "VACANT")

  return (
    <div className="ml-4">
      <div
        className={`flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer border border-transparent hover:border-border ${
          level === 0 ? "ml-0" : ""
        }`}
        onClick={() => toggleExpand(unit.id)}
      >
        {(hasChildren || unitEmployees.length > 0) ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}

        {/* Unit Icon */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={unitTypeColors[unit.unitType]}>
              {unitTypeLabels[unit.unitType]}
            </Badge>
            <span className="font-semibold text-base">{unit.name}</span>
            {unit.shortName && (
              <span className="text-muted-foreground text-sm">({unit.shortName})</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
            {unit.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {unit.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {activeEmployees.length} personel
            </span>
            {vacantPositions.length > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3 w-3" />
                {vacantPositions.length} bos pozisyon
              </span>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onAddEmployee(unit.id)
          }}
          className="p-2 hover:bg-primary/10 rounded-lg"
          title="Personel/Pozisyon Ekle"
        >
          <UserPlus className="h-4 w-4 text-primary" />
        </button>
      </div>

      {isExpanded && (
        <div className="border-l-2 border-primary/20 ml-6">
          {/* Employees - Kart Görünümü */}
          {sortedEmployees.length > 0 && (
            <div className="py-3 px-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {sortedEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className={`p-4 rounded-xl border shadow-sm transition-all hover:shadow-md ${
                      emp.employmentStatus === "VACANT"
                        ? "bg-amber-50/50 border-dashed border-amber-300 hover:border-amber-400"
                        : "bg-card hover:bg-accent/50 border-border"
                    }`}
                  >
                    {/* Üst Kısım - Foto ve İsim */}
                    <div className="flex items-center gap-3 mb-3">
                      {/* Employee Photo */}
                      <div className="flex-shrink-0">
                        {emp.photoUrl ? (
                          <Image
                            src={emp.photoUrl}
                            alt={emp.displayName}
                            width={48}
                            height={48}
                            className="rounded-full object-cover border-2 border-primary/20"
                          />
                        ) : (
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            emp.employmentStatus === "VACANT"
                              ? "bg-amber-100 border-2 border-dashed border-amber-400"
                              : "bg-gradient-to-br from-primary/20 to-primary/40"
                          }`}>
                            {emp.employmentStatus === "VACANT" ? (
                              <Briefcase className="h-6 w-6 text-amber-600" />
                            ) : (
                              <User className="h-6 w-6 text-primary" />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold truncate ${emp.employmentStatus === "VACANT" ? "text-amber-700" : ""}`}>
                          {emp.displayName}
                        </p>
                        {emp.employmentStatus === "VACANT" && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs mt-1">
                            Bos Pozisyon
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Alt Kısım - Unvan ve Email */}
                    <div className="space-y-1.5">
                      {emp.positionTitle && (
                        <div className="flex items-center gap-2 text-sm">
                          <Briefcase className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground truncate">{emp.positionTitle}</span>
                        </div>
                      )}
                      {emp.email && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground truncate">{emp.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Children */}
          {hasChildren && unit.children.map((child) => (
            <OrgUnitNode
              key={child.id}
              unit={child}
              level={level + 1}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              employees={employees}
              onAddEmployee={onAddEmployee}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrgChartPage() {
  const { data: session } = useSession()
  const [units, setUnits] = useState<OrgUnit[]>([])
  const [employees, setEmployees] = useState<OrgEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [uploading, setUploading] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const empFileInputRef = useRef<HTMLInputElement>(null)

  // Form state - Birim
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    shortName: "",
    description: "",
    parentId: "",
    unitType: "DEPARTMENT",
    managerName: "",
    managerEmail: "",
    managerPhoto: "",
    location: "",
    approvedHeadcount: ""
  })

  // Form state - Personel/Pozisyon
  const [empFormData, setEmpFormData] = useState({
    displayName: "",
    email: "",
    positionTitle: "",
    employmentStatus: "ACTIVE",
    photoUrl: "",
    phone: "",
    workLocation: ""
  })

  useEffect(() => {
    fetchUnits()
    fetchEmployees()
  }, [])

  const fetchUnits = async () => {
    try {
      const res = await fetch("/api/strategic-hr/org-chart")
      if (res.ok) {
        const data = await res.json()
        setUnits(data)
        // Ilk seviye birimleri otomatik ac
        const rootIds = data.map((u: OrgUnit) => u.id)
        setExpandedIds(new Set(rootIds))
      }
    } catch (error) {
      console.error("Birimler yuklenirken hata:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/strategic-hr/org-chart/employees")
      if (res.ok) {
        const data = await res.json()
        setEmployees(data)
      }
    } catch (error) {
      console.error("Personeller yuklenirken hata:", error)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Max 2MB
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Dosya boyutu 2MB'dan kucuk olmali")
      return
    }

    setUploading(true)
    try {
      const formDataUpload = new FormData()
      formDataUpload.append("file", file)

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload
      })

      if (res.ok) {
        const data = await res.json()
        setFormData({ ...formData, managerPhoto: data.url })
        toast.success("Fotograf yuklendi")
      } else {
        toast.error("Fotograf yuklenemedi")
      }
    } catch (error) {
      console.error("Upload hatasi:", error)
      toast.error("Fotograf yuklenirken hata olustu")
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const res = await fetch("/api/strategic-hr/org-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          parentId: formData.parentId || null,
          approvedHeadcount: formData.approvedHeadcount ? parseInt(formData.approvedHeadcount) : null
        })
      })

      if (res.ok) {
        setIsDialogOpen(false)
        fetchUnits()
        setFormData({
          code: "",
          name: "",
          shortName: "",
          description: "",
          parentId: "",
          unitType: "DEPARTMENT",
          managerName: "",
          managerEmail: "",
          managerPhoto: "",
          location: "",
          approvedHeadcount: ""
        })
        toast.success("Birim olusturuldu")
      } else {
        const errorData = await res.json()
        toast.error(errorData.error || "Birim olusturulamadi")
      }
    } catch (error) {
      console.error("Birim olusturulurken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  // Personel fotograf yukleme
  const handleEmpPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Dosya boyutu 2MB'dan kucuk olmali")
      return
    }

    setUploading(true)
    try {
      const formDataUpload = new FormData()
      formDataUpload.append("file", file)

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload
      })

      if (res.ok) {
        const data = await res.json()
        setEmpFormData({ ...empFormData, photoUrl: data.url })
        toast.success("Fotograf yuklendi")
      } else {
        toast.error("Fotograf yuklenemedi")
      }
    } catch (error) {
      console.error("Upload hatasi:", error)
      toast.error("Fotograf yuklenirken hata olustu")
    } finally {
      setUploading(false)
    }
  }

  // Personel/Pozisyon ekle
  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const res = await fetch("/api/strategic-hr/org-chart/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...empFormData,
          orgUnitId: selectedUnitId
        })
      })

      if (res.ok) {
        setIsEmployeeDialogOpen(false)
        fetchEmployees()
        fetchUnits()
        setEmpFormData({
          displayName: "",
          email: "",
          positionTitle: "",
          employmentStatus: "ACTIVE",
          photoUrl: "",
          phone: "",
          workLocation: ""
        })
        toast.success(empFormData.employmentStatus === "VACANT" ? "Bos pozisyon eklendi" : "Personel eklendi")
      } else {
        const errorData = await res.json()
        toast.error(errorData.error || "Islem basarisiz")
      }
    } catch (error) {
      console.error("Personel eklenirken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  // Birime personel ekleme dialogunu ac
  const openAddEmployeeDialog = (unitId: string) => {
    setSelectedUnitId(unitId)
    setEmpFormData({
      displayName: "",
      email: "",
      positionTitle: "",
      employmentStatus: "ACTIVE",
      photoUrl: "",
      phone: "",
      workLocation: ""
    })
    setIsEmployeeDialogOpen(true)
  }

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  const expandAll = () => {
    const allIds = new Set<string>()
    const addAllIds = (unitList: OrgUnit[]) => {
      unitList.forEach((unit) => {
        allIds.add(unit.id)
        if (unit.children) {
          addAllIds(unit.children)
        }
      })
    }
    addAllIds(units)
    setExpandedIds(allIds)
  }

  const collapseAll = () => {
    setExpandedIds(new Set())
  }

  // Stats
  const countUnits = (unitList: OrgUnit[]): number => {
    return unitList.reduce((sum, unit) => {
      return sum + 1 + (unit.children ? countUnits(unit.children) : 0)
    }, 0)
  }

  const totalUnits = countUnits(units)
  const activeEmployees = employees.filter(e => e.employmentStatus !== "VACANT")
  const vacantPositions = employees.filter(e => e.employmentStatus === "VACANT")
  const departments = units.reduce((sum, u) => {
    const countDepts = (list: OrgUnit[]): number => {
      return list.reduce((s, unit) => {
        const isDept = unit.unitType === "DEPARTMENT" ? 1 : 0
        return s + isDept + (unit.children ? countDepts(unit.children) : 0)
      }, 0)
    }
    return sum + (u.unitType === "DEPARTMENT" ? 1 : 0) + (u.children ? countDepts(u.children) : 0)
  }, 0)

  // Tum birimleri flat liste olarak al (Select icin)
  const getAllUnitsFlat = (unitList: OrgUnit[], result: OrgUnit[] = []): OrgUnit[] => {
    unitList.forEach((unit) => {
      result.push(unit)
      if (unit.children) {
        getAllUnitsFlat(unit.children, result)
      }
    })
    return result
  }

  const flatUnits = getAllUnitsFlat(units)

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Organizasyon Semasi
          </h1>
          <p className="text-muted-foreground">
            Sirket organizasyon yapisini goruntuleyin ve yonetin
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsGuideOpen(true)}>
            <HelpCircle className="h-4 w-4 mr-2" />
            Kilavuz
          </Button>
          <Button variant="outline" onClick={expandAll}>
            Tumu Ac
          </Button>
          <Button variant="outline" onClick={collapseAll}>
            Tumu Kapat
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Yeni Birim
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Yeni Organizasyon Birimi</DialogTitle>
                <DialogDescription>
                  Yeni bir organizasyon birimi olusturun
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Birim Kodu</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="IT, HR, FIN"
                      required
                    />
                  </div>

                  <div>
                    <Label>Birim Tipi</Label>
                    <Select
                      value={formData.unitType}
                      onValueChange={(v) => setFormData({ ...formData, unitType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COMPANY">Sirket</SelectItem>
                        <SelectItem value="DIVISION">Bolum</SelectItem>
                        <SelectItem value="DEPARTMENT">Departman</SelectItem>
                        <SelectItem value="TEAM">Takim</SelectItem>
                        <SelectItem value="GROUP">Grup</SelectItem>
                        <SelectItem value="PROJECT">Proje</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <Label>Birim Adi</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Bilgi Teknolojileri"
                      required
                    />
                  </div>

                  <div>
                    <Label>Kisa Ad</Label>
                    <Input
                      value={formData.shortName}
                      onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                      placeholder="BT"
                    />
                  </div>

                  <div>
                    <Label>Ust Birim</Label>
                    <Select
                      value={formData.parentId || "none"}
                      onValueChange={(v) => setFormData({ ...formData, parentId: v === "none" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Ust birim secin (opsiyonel)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Yok (Root)</SelectItem>
                        {flatUnits.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {"  ".repeat(unit.level)}{unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Yonetici Adi</Label>
                    <Input
                      value={formData.managerName}
                      onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                      placeholder="Ad Soyad"
                    />
                  </div>

                  <div>
                    <Label>Yonetici E-posta</Label>
                    <Input
                      type="email"
                      value={formData.managerEmail}
                      onChange={(e) => setFormData({ ...formData, managerEmail: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>

                  {/* Manager Photo Upload */}
                  <div className="col-span-2">
                    <Label>Yonetici Fotografı</Label>
                    <div className="flex items-center gap-4 mt-2">
                      {formData.managerPhoto ? (
                        <div className="relative">
                          <Image
                            src={formData.managerPhoto}
                            alt="Yonetici"
                            width={80}
                            height={80}
                            className="rounded-full object-cover border-2 border-primary/20"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, managerPhoto: "" })}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploading ? "Yukleniyor..." : "Fotograf Yukle"}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">Max 2MB, JPG/PNG</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Lokasyon</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Istanbul - Merkez"
                    />
                  </div>

                  <div>
                    <Label>Onayli Kadro</Label>
                    <Input
                      type="number"
                      value={formData.approvedHeadcount}
                      onChange={(e) => setFormData({ ...formData, approvedHeadcount: e.target.value })}
                      placeholder="10"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Aciklama</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Birim hakkinda aciklama..."
                      rows={2}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Iptal
                  </Button>
                  <Button type="submit" disabled={!formData.code || !formData.name}>
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
                Organizasyon Semasi Kilavuzu
              </DialogTitle>
              <DialogDescription>
                Organizasyon yapisinin nasil olusturulacagini ve yonetilecegini ogrenim
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Nedir */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  Organizasyon Semasi Nedir?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Organizasyon semasi, sirketin hiyerarsik yapisini gorsel olarak gosteren bir aractir.
                  Bu modul ile sirketin bolum, departman, takim ve grup yapisini olusturabilir,
                  yoneticileri atayabilir ve calisan dagılımını takip edebilirsiniz.
                </p>
              </div>

              {/* Birim Tipleri */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-500" />
                  Birim Tipleri
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-100 text-purple-800">Sirket</Badge>
                    <span className="text-muted-foreground">En ust seviye, ana sirket</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800">Bolum</Badge>
                    <span className="text-muted-foreground">Ana is alanlari (Operasyon, Finans)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800">Departman</Badge>
                    <span className="text-muted-foreground">Fonksiyonel birimler (IT, IK)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-100 text-yellow-800">Takim</Badge>
                    <span className="text-muted-foreground">Calisma gruplari</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-100 text-orange-800">Grup</Badge>
                    <span className="text-muted-foreground">Ozel gorev gruplari</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-pink-100 text-pink-800">Proje</Badge>
                    <span className="text-muted-foreground">Gecici proje takimlari</span>
                  </div>
                </div>
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
                      <p className="font-medium">Ana Sirket Olusturun</p>
                      <p className="text-muted-foreground">Once "Sirket" tipinde ana birimi olusturun. Bu en ust seviye olacak.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-primary text-primary-foreground">2</Badge>
                    <div>
                      <p className="font-medium">Bolumleri Ekleyin</p>
                      <p className="text-muted-foreground">Sirketin altina ana bolumleri (Operasyon, Finans vb.) ekleyin.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-primary text-primary-foreground">3</Badge>
                    <div>
                      <p className="font-medium">Departmanlari Tanimlayın</p>
                      <p className="text-muted-foreground">Her bolumun altina ilgili departmanlari ekleyin.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-primary text-primary-foreground">4</Badge>
                    <div>
                      <p className="font-medium">Yoneticileri Atayin</p>
                      <p className="text-muted-foreground">Her birime yonetici bilgilerini ve fotograflarini girin.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <Badge className="bg-primary text-primary-foreground">5</Badge>
                    <div>
                      <p className="font-medium">Kadro Bilgilerini Girin</p>
                      <p className="text-muted-foreground">Onayli kadro ve mevcut calisan sayilarini takip edin.</p>
                    </div>
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
                  <li>Birim kodlarini anlamli ve tutarli tutun (IT-DEV, IT-OPS gibi)</li>
                  <li>Hiyerarsiyi 4-5 seviyeden fazla derinlestirmeyin</li>
                  <li>Yonetici degisikliklerini zamaninda guncelleyin</li>
                  <li>Kadro bilgilerini butce donemiyle senkronize tutun</li>
                  <li>Proje tabanli birimleri ayri tutun, isler bitince arsivleyin</li>
                  <li>Yonetici fotograflari profesyonel gorunumlu olmali</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setIsGuideOpen(false)}>Anladim</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Personel/Pozisyon Ekleme Modal */}
      <Dialog open={isEmployeeDialogOpen} onOpenChange={setIsEmployeeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Personel / Pozisyon Ekle</DialogTitle>
            <DialogDescription>
              Birime yeni bir personel veya bos pozisyon ekleyin
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEmployeeSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Durum</Label>
                <Select
                  value={empFormData.employmentStatus}
                  onValueChange={(v) => setEmpFormData({ ...empFormData, employmentStatus: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Aktif Personel</SelectItem>
                    <SelectItem value="VACANT">Bos Pozisyon (Doldurulacak)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label>{empFormData.employmentStatus === "VACANT" ? "Pozisyon Adi" : "Ad Soyad"}</Label>
                <Input
                  value={empFormData.displayName}
                  onChange={(e) => setEmpFormData({ ...empFormData, displayName: e.target.value })}
                  placeholder={empFormData.employmentStatus === "VACANT" ? "IT Uzmani" : "Ahmet Yilmaz"}
                  required
                />
              </div>

              <div className="col-span-2">
                <Label>Unvan</Label>
                <Input
                  value={empFormData.positionTitle}
                  onChange={(e) => setEmpFormData({ ...empFormData, positionTitle: e.target.value })}
                  placeholder="Sistem Gelistirme Muhendisi"
                />
              </div>

              {empFormData.employmentStatus !== "VACANT" && (
                <>
                  <div className="col-span-2">
                    <Label>E-posta</Label>
                    <Input
                      type="email"
                      value={empFormData.email}
                      onChange={(e) => setEmpFormData({ ...empFormData, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>

                  <div>
                    <Label>Telefon</Label>
                    <Input
                      value={empFormData.phone}
                      onChange={(e) => setEmpFormData({ ...empFormData, phone: e.target.value })}
                      placeholder="+90 5XX XXX XX XX"
                    />
                  </div>

                  <div>
                    <Label>Calisma Lokasyonu</Label>
                    <Input
                      value={empFormData.workLocation}
                      onChange={(e) => setEmpFormData({ ...empFormData, workLocation: e.target.value })}
                      placeholder="Istanbul Merkez"
                    />
                  </div>

                  {/* Photo Upload */}
                  <div className="col-span-2">
                    <Label>Fotograf</Label>
                    <div className="flex items-center gap-4 mt-2">
                      {empFormData.photoUrl ? (
                        <div className="relative">
                          <Image
                            src={empFormData.photoUrl}
                            alt="Personel"
                            width={64}
                            height={64}
                            className="rounded-full object-cover border-2 border-primary/20"
                          />
                          <button
                            type="button"
                            onClick={() => setEmpFormData({ ...empFormData, photoUrl: "" })}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <input
                          ref={empFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleEmpPhotoUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => empFileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploading ? "Yukleniyor..." : "Fotograf Yukle"}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">Max 2MB</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEmployeeDialogOpen(false)}>
                Iptal
              </Button>
              <Button type="submit" disabled={!empFormData.displayName}>
                {empFormData.employmentStatus === "VACANT" ? "Pozisyon Ekle" : "Personel Ekle"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Birim</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUnits}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departmanlar</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Personel</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeEmployees.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bos Pozisyon</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{vacantPositions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Org Chart Tree */}
      <Card>
        <CardHeader>
          <CardTitle>Organizasyon Yapisi</CardTitle>
          <CardDescription>
            Sirketin hiyerarsik organizasyon yapisi
          </CardDescription>
        </CardHeader>
        <CardContent>
          {units.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Henuz organizasyon birimi olusturulmamis</p>
              <p className="text-sm text-muted-foreground mt-1">Yukaridaki "Yeni Birim" butonuna tiklayarak baslayabilirsiniz.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {units.map((unit) => (
                <OrgUnitNode
                  key={unit.id}
                  unit={unit}
                  level={0}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                  employees={employees}
                  onAddEmployee={openAddEmployeeDialog}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
