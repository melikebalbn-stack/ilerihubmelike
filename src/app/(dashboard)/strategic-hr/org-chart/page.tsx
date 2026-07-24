"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import OrgChartTree from "./OrgChartTree"
import RevizyonPanel from "./RevizyonPanel"
import BosKadroModal, { BosKadro } from "./BosKadroModal"
import SorumluTablosuPanel from "./SorumluTablosuPanel"
import PozisyonYonetimPanel from "./PozisyonYonetimPanel"
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
  User,
  Layers,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Lightbulb,
  Target,
  Upload,
  X,
  AlertCircle,
  Edit,
  Trash2,
  Download,
  History
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
  orgUnitId: string
  isActive?: boolean
  personnelId?: string | null
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
  approvedHeadcount?: number | null // full-access'te gelir, yoksa undefined
  isActive: boolean
  parentId?: string | null
  children?: OrgUnit[] // client'ta buildTree ile doldurulur
  employees?: OrgEmployee[]
  _count: {
    employees: number
  }
  // --- F1 alanları ---
  positionId?: string | null
  positionStatus?: "AKTIF" | "DONDURULDU" | "PLANLANAN"
  isExternal?: boolean
  gecerlilikBaslangic?: string | null
  gecerlilikBitis?: string | null
  // --- R4/V3 vekalet — full-access'te gelir, yoksa undefined ---
  vekaletDurumu?: boolean
  vekilAdi?: string | null
  // --- F1 sorumlu tablosu (IV-LS-45) — yalnız departman kökünde dolu gelir ---
  sorumluluklar?: SorumlulukKaydi[]
  // --- Pozisyon dondurma izi — full-access'te gelir, yoksa undefined ---
  dondurmaGerekce?: string | null
  dondurmaTarihi?: string | null
  dondurmaYapan?: string | null
}

interface SorumlulukKaydi {
  id: string
  sira: number
  birinciSorumlu: string
  yedekSorumlu: string | null
}

// Flat OrgUnit listesinden hiyerarşik ağaç kurar (GET artık flat dönüyor)
function buildTree(flat: OrgUnit[]): OrgUnit[] {
  const byId = new Map<string, OrgUnit>()
  flat.forEach(u => byId.set(u.id, { ...u, children: [] }))
  const roots: OrgUnit[] = []
  byId.forEach(node => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })
  // children'ı sortOrder'a göre sırala (flat zaten sıralı gelse de garanti)
  byId.forEach(n => n.children!.sort((a, b) => a.sortOrder - b.sortOrder))
  return roots
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

export default function OrgChartPage() {
  const { data: session } = useSession()
  const [units, setUnits] = useState<OrgUnit[]>([])
  const [employees, setEmployees] = useState<OrgEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [isRevizyonDialogOpen, setIsRevizyonDialogOpen] = useState(false)
  const [isBosKadroModalOpen, setIsBosKadroModalOpen] = useState(false)
  const [selectedDeptId, setSelectedDeptId] = useState<string>("")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    fetchUnits()
    fetchEmployees()
  }, [])

  const fetchUnits = async () => {
    try {
      const res = await fetch("/api/strategic-hr/org-chart?flat=true")
      if (res.ok) {
        const data = await res.json()
        const roots = buildTree(data)
        setUnits(roots)
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

  // Stats
  // Tum birimleri flat liste olarak al (Select icin + kurul/Tum Firma/Yonetim tespiti icin asagida kullanilir)
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

  // Toplam Birim / Toplam Personel — Tüm Firma (ORG-TF*) ve Yönetim (ORG-YN*) HARİÇ:
  // Tüm Firma gerçek departmanların isimsiz kopyası (envanter), Yönetim'deki müdürler
  // zaten kendi gerçek departmanlarında sayılı — ikisi de üst sayaçlarda mükerrer.
  // Departman seçicide GÖRÜNMEYE devam ederler, yalnız bu sayaçlardan çıkarıldılar.
  const tfYnUnitIds = new Set(
    flatUnits
      .filter(
        u =>
          u.code === "ORG-TF" ||
          u.code.startsWith("ORG-TF-") ||
          u.code === "ORG-YN" ||
          u.code.startsWith("ORG-YN-")
      )
      .map(u => u.id)
  )
  const totalUnits = flatUnits.filter(u => !tfYnUnitIds.has(u.id)).length

  // Toplam Personel — kurul (ORG-KR-*) kutularindaki OrgEmployee'ler ek gorev/mukerrer
  // sayildigi icin, Tum Firma/Yonetim de yukaridaki sebeple haric tutulur. Ayrica ayni
  // kisi birden fazla kutuda olabildigi icin (ör. Bedri Güler, Fatih Kaya) benzersiz
  // personnelId'ye göre sayılır — personnelId'si olmayan (eşleşmemiş) kayıtlar ayrı ayrı
  // sayılır (ortak bir kimlik anahtarları olmadığı için tekilleştirilemezler).
  // Vekiller zaten OrgEmployee degil (OrgUnit.vekilAdi alaninda statik metin) — bu sayima
  // hic girmiyorlar, ekstra filtreye gerek yok.
  const kurulUnitIds = new Set(flatUnits.filter(u => u.code.startsWith("ORG-KR-")).map(u => u.id))
  const disariBirakilanUnitIds = new Set([...kurulUnitIds, ...tfYnUnitIds])
  const activeEmployees = employees.filter(
    e => e.employmentStatus !== "VACANT" && !disariBirakilanUnitIds.has(e.orgUnitId)
  )
  const benzersizPersonnelIdler = new Set(activeEmployees.filter(e => e.personnelId).map(e => e.personnelId))
  const isimsizCalisanSayisi = activeEmployees.filter(e => !e.personnelId).length
  const toplamPersonelSayisi = benzersizPersonnelIdler.size + isimsizCalisanSayisi

  // Boş Pozisyon — gerçek açık kadro listesi: her POSITION kutusu için (N - M), N>0,
  // M<N, DONDURULMUŞ olmayan kutularda satır. Eskiden employmentStatus==="VACANT"
  // OrgEmployee kaydı arıyordu — pilot seed'ler hiç VACANT-statülü kayıt oluşturmadığı
  // için (boş kadro = OrgEmployee'nin YOKLUĞU) bu sayaç hep 0 kalıyordu. Tüm Firma/
  // Yönetim (tfYnUnitIds) yukarıdaki sayaçlarla tutarlı olsun diye hariç. Vekaletli
  // kutular da SAYILIR — vekalet, kadronun hâlâ açık (M=0) olduğu, yalnız geçici
  // vekille yürütüldüğü anlamına gelir. Sayaç (bosPozisyonSayisi) VE modal (BosKadroModal)
  // AYNI listeden (bosKadrolar) türetilir — kopya filtre mantığı yok, tek kaynak.
  const flatUnitsById = new Map(flatUnits.map(u => [u.id, u]))

  // Kutunun kök DEPARTMENT'ini bulur (parentId zinciriyle) — "Bölüm" sütunu için.
  const bulKokDepartman = (unit: OrgUnit): string => {
    let current: OrgUnit | undefined = unit
    while (current) {
      if (current.unitType === "DEPARTMENT" && !current.parentId) return current.name
      current = current.parentId ? flatUnitsById.get(current.parentId) : undefined
    }
    return unit.name
  }

  const bosKadrolar: BosKadro[] = flatUnits
    .filter(u => u.unitType === "POSITION" && !tfYnUnitIds.has(u.id) && u.positionStatus !== "DONDURULDU")
    .map(u => {
      const n = u.approvedHeadcount ?? 0
      const m = (u.employees ?? []).filter(e => e.employmentStatus !== "VACANT").length
      return { unit: u, acikKadro: n - m }
    })
    .filter(({ acikKadro }) => acikKadro > 0)
    .map(({ unit, acikKadro }) => ({
      id: unit.id,
      bolum: bulKokDepartman(unit),
      pozisyon: unit.name,
      acikKadro,
      vekaletDurumu: unit.vekaletDurumu === true,
      vekilAdi: unit.vekilAdi ?? null,
    }))
    .sort((a, b) => a.bolum.localeCompare(b.bolum, "tr") || a.pozisyon.localeCompare(b.pozisyon, "tr"))

  const bosPozisyonSayisi = bosKadrolar.reduce((sum, k) => sum + k.acikKadro, 0)
  const departments = units.reduce((sum, u) => {
    const countDepts = (list: OrgUnit[]): number => {
      return list.reduce((s, unit) => {
        const isDept = unit.unitType === "DEPARTMENT" ? 1 : 0
        return s + isDept + (unit.children ? countDepts(unit.children) : 0)
      }, 0)
    }
    return sum + (u.unitType === "DEPARTMENT" ? 1 : 0) + (u.children ? countDepts(u.children) : 0)
  }, 0)

  // Departman seçici — units (buildTree kökleri) birden fazla DEPARTMENT içerebilir (İK, Fabrika, ...)
  const departmanKokleri = units.filter(u => u.unitType === "DEPARTMENT")
  const selectedUnit = departmanKokleri.find(u => u.id === selectedDeptId) ?? departmanKokleri[0]

  // Yalnız seçili departmanın kendi kutuları (kök + tüm alt pozisyonlar) — Pozisyon
  // Yönetimi panelindeki parent/dondurma dropdown'ları başka departmana karışmasın.
  const selectedDeptUnits = selectedUnit ? getAllUnitsFlat([selectedUnit]) : []

  useEffect(() => {
    if (!selectedDeptId && departmanKokleri.length > 0) {
      setSelectedDeptId(departmanKokleri[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units])

  // Export gate — org-chart/export route'undaki checkAccess ile AYNI liste (client'ta UX amaçlı;
  // gerçek yetki denetimi route'ta yapılıyor, buton burada sadece göster/gizle)
  const userRole = session?.user?.role ?? ""
  const userDepartment = session?.user?.department || ""
  const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"]
  const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"]
  const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept))
  const hasFullAccess = fullAccessRoles.includes(userRole) || isHrDepartment

  // Export/Revizyon artık SEÇİLİ departmanı hedefler (birden fazla departman olabildiği için)
  const kokKod = selectedUnit?.code ?? "ORG-IV"
  const kokAd = selectedUnit?.name ?? kokKod
  const varsayilanYapan = session?.user?.name || "İV"

  const handleExportOrgChart = async () => {
    try {
      const res = await fetch(`/api/strategic-hr/org-chart/export?code=${kokKod}`)
      if (res.status === 403) {
        toast.error("Bu işlem için yetkiniz yok")
        return
      }
      if (!res.ok) throw new Error("Export hatası")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ORG_${kokKod}_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Excel dosyası indirildi")
    } catch (err: any) {
      toast.error(err.message || "Export başarısız")
    }
  }

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
          {hasFullAccess && (
            <Button variant="outline" onClick={handleExportOrgChart}>
              <Download className="h-4 w-4 mr-2" />
              IV-LS-45 İndir
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsRevizyonDialogOpen(true)}>
            <History className="h-4 w-4 mr-2" />
            Revizyon Geçmişi
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <RevizyonPanel
          open={isRevizyonDialogOpen}
          onOpenChange={setIsRevizyonDialogOpen}
          kokKod={kokKod}
          kokAd={kokAd}
          hasFullAccess={hasFullAccess}
          varsayilanYapan={varsayilanYapan}
        />

        <BosKadroModal
          open={isBosKadroModalOpen}
          onOpenChange={setIsBosKadroModalOpen}
          bosKadrolar={bosKadrolar}
          toplamAcikKadro={bosPozisyonSayisi}
        />

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
                <div className="grid grid-cols-1 md:grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
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
            <div className="text-2xl font-bold">{toplamPersonelSayisi}</div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-colors hover:bg-amber-50"
          onClick={() => setIsBosKadroModalOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bos Pozisyon</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{bosPozisyonSayisi}</div>
          </CardContent>
        </Card>
      </div>

      {/* Org Chart Tree */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Organizasyon Yapisi</CardTitle>
            <CardDescription>
              Sirketin hiyerarsik organizasyon yapisi
            </CardDescription>
          </div>
          {departmanKokleri.length > 0 && (
            <Select value={selectedUnit?.id ?? ""} onValueChange={setSelectedDeptId}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder="Departman seçin" />
              </SelectTrigger>
              <SelectContent>
                {departmanKokleri.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {units.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Henuz organizasyon birimi olusturulmamis</p>
              <p className="text-sm text-muted-foreground mt-1">Yukaridaki "Yeni Birim" butonuna tiklayarak baslayabilirsiniz.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-2">
                <div className="w-full sm:w-auto sm:min-w-[380px] sm:max-w-md space-y-2">
                  <SorumluTablosuPanel
                    sorumluluklar={selectedUnit?.sorumluluklar}
                    orgUnitCode={selectedUnit?.code}
                    hasFullAccess={hasFullAccess}
                    onRefresh={fetchUnits}
                  />
                  <PozisyonYonetimPanel
                    departmanUnitlari={selectedDeptUnits}
                    orgUnitCode={selectedUnit?.code}
                    hasFullAccess={hasFullAccess}
                    onRefresh={fetchUnits}
                  />
                </div>
              </div>
              <OrgChartTree
                units={selectedUnit ? [selectedUnit] : []}
                hasFullAccess={hasFullAccess}
                onRefresh={fetchUnits}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
