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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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
  Eye,
  Pencil,
  Trash2,
  Download,
  BarChart3,
  ListChecks,
  BookOpen,
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  Activity,
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"

// ==========================================
// Sabitler
// ==========================================

const RISK_LEVELS: Record<string, { label: string; color: string; bgColor: string }> = {
  LOW: { label: "Düşük", color: "text-green-700", bgColor: "bg-green-100" },
  MEDIUM: { label: "Orta", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  HIGH: { label: "Yüksek", color: "text-orange-700", bgColor: "bg-orange-100" },
  CRITICAL: { label: "Kritik", color: "text-red-700", bgColor: "bg-red-100" },
}

const RISK_STATUS: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Açık", color: "bg-blue-100 text-blue-700" },
  IN_TREATMENT: { label: "İşleniyor", color: "bg-yellow-100 text-yellow-700" },
  CLOSED: { label: "Kapalı", color: "bg-gray-100 text-gray-700" },
  MONITORING: { label: "İzleniyor", color: "bg-green-100 text-green-700" },
}

const TREATMENT_OPTIONS: Record<string, { label: string; color: string }> = {
  AVOID: { label: "Kaçınma", color: "bg-red-100 text-red-700" },
  MITIGATE: { label: "Azaltma", color: "bg-blue-100 text-blue-700" },
  TRANSFER: { label: "Transfer", color: "bg-purple-100 text-purple-700" },
  ACCEPT: { label: "Kabul", color: "bg-green-100 text-green-700" },
}

const TREATMENT_STATUS: Record<string, { label: string; color: string }> = {
  PLANNED: { label: "Planlandı", color: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "Devam Ediyor", color: "bg-yellow-100 text-yellow-700" },
  COMPLETED: { label: "Tamamlandı", color: "bg-green-100 text-green-700" },
  MONITORING: { label: "İzleniyor", color: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "İptal", color: "bg-gray-100 text-gray-700" },
}

const THREAT_CATEGORIES: Record<string, string> = {
  NATURAL_DISASTER: "Doğal Afet",
  CYBER_ATTACK: "Siber Saldırı",
  HUMAN: "İnsan Kaynaklı",
  TECHNICAL_FAILURE: "Teknik Arıza",
  PHYSICAL_SECURITY: "Fiziksel Güvenlik",
  SUPPLY_CHAIN: "Tedarik Zinciri",
  COMPLIANCE: "Uyumluluk",
}

// ==========================================
// Tipler
// ==========================================

interface Risk {
  id: string
  riskNumber: string
  title: string
  description: string | null
  assetId: string | null
  assetName: string
  assetValue: number
  threatId: string | null
  threatName: string
  scenario: string
  vulnerability: string | null
  existingControls: string | null
  likelihood: number
  impact: number
  riskScore: number
  riskLevel: string
  treatmentOption: string | null
  treatmentSummary: string | null
  residualLikelihood: number | null
  residualImpact: number | null
  residualRiskScore: number | null
  residualRiskLevel: string | null
  relatedControls: string[]
  ownerName: string
  ownerEmail: string
  status: string
  identifiedDate: string
  reviewDate: string | null
  asset: { id: string; name: string; category: string; confidentiality: number; integrity: number; availability: number } | null
  threat: { id: string; code: string; name: string; category: string } | null
  treatmentPlans: TreatmentPlan[]
}

interface TreatmentPlan {
  id: string
  riskId?: string
  treatmentOption: string
  description: string
  responsibleName: string
  responsibleEmail: string | null
  targetDate: string | null
  completionDate: string | null
  status: string
  notes: string | null
  createdAt?: string
}

interface Threat {
  id: string
  code: string
  name: string
  category: string
  description: string | null
  affectedAssetTypes: string | null
  typicalLikelihood: number
  typicalImpact: number
  _count: { risks: number }
}

interface Asset {
  id: string
  name: string
  category: string
  confidentiality: number
  integrity: number
  availability: number
}

interface Stats {
  total: number
  byLevel: Record<string, number>
  byStatus: Record<string, number>
  byTreatment: Record<string, number>
  acceptedCount: number
}

// ==========================================
// Yardımcı fonksiyonlar
// ==========================================

function calculateRiskLevel(score: number): string {
  if (score >= 51) return "CRITICAL"
  if (score >= 31) return "HIGH"
  if (score >= 13) return "MEDIUM"
  return "LOW"
}

function RiskLevelBadge({ level }: { level: string }) {
  const config = RISK_LEVELS[level]
  if (!config) return <Badge variant="outline">{level}</Badge>
  return <Badge className={`${config.bgColor} ${config.color} border-0`}>{config.label}</Badge>
}

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; color: string }> }) {
  const config = map[status]
  if (!config) return <Badge variant="outline">{status}</Badge>
  return <Badge className={`${config.color} border-0`}>{config.label}</Badge>
}

// ==========================================
// 5x5 Risk Matrisi
// ==========================================

function RiskMatrix({ risks }: { risks: Risk[] }) {
  // 5x5 grid: satır=olasılık (5→1), sütun=etki (1→5)
  const matrix: number[][] = Array(5).fill(null).map(() => Array(5).fill(0))
  for (const r of risks) {
    const li = r.likelihood - 1 // 0-4
    const ii = r.impact - 1     // 0-4
    if (li >= 0 && li < 5 && ii >= 0 && ii < 5) {
      matrix[li][ii]++
    }
  }

  const getCellColor = (l: number, i: number) => {
    const score = (l + 1) * (i + 1) * 2 // Yaklaşık skor (VD=2 ortalama)
    if (score >= 34) return "bg-red-500 text-white"
    if (score >= 20) return "bg-orange-400 text-white"
    if (score >= 10) return "bg-yellow-400 text-gray-900"
    return "bg-green-400 text-gray-900"
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-1 text-left w-16"></th>
            {[1, 2, 3, 4, 5].map(i => (
              <th key={i} className="p-1 text-center font-medium w-14">E:{i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[4, 3, 2, 1, 0].map(l => (
            <tr key={l}>
              <td className="p-1 font-medium text-right pr-2">O:{l + 1}</td>
              {[0, 1, 2, 3, 4].map(i => (
                <td key={i} className="p-0.5">
                  <div className={`${getCellColor(l, i)} rounded text-center py-2 px-1 font-bold min-h-[36px] flex items-center justify-center`}>
                    {matrix[l][i] > 0 ? matrix[l][i] : ""}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-3 mt-2 text-xs text-muted-foreground justify-center">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400"></span>Düşük</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400"></span>Orta</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400"></span>Yüksek</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"></span>Kritik</span>
      </div>
    </div>
  )
}

// ==========================================
// Ana Sayfa
// ==========================================

export default function Iso27001RisksPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [risks, setRisks] = useState<Risk[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [threats, setThreats] = useState<Threat[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingThreats, setLoadingThreats] = useState(false)

  // Filtreler
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLevel, setSelectedLevel] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedThreatCategory, setSelectedThreatCategory] = useState("all")

  // Dialoglar
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isTreatmentCreateOpen, setIsTreatmentCreateOpen] = useState(false)
  const [isCreateThreatOpen, setIsCreateThreatOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Risk form
  const defaultRiskForm = {
    title: "", description: "", assetId: "", threatId: "",
    scenario: "", vulnerability: "", existingControls: "",
    likelihood: 3, impact: 3, treatmentOption: "",
    treatmentSummary: "", relatedControls: "", ownerName: "", ownerEmail: "",
  }
  const [riskForm, setRiskForm] = useState(defaultRiskForm)

  // Treatment form
  const defaultTreatmentForm = {
    treatmentOption: "MITIGATE", description: "", responsibleName: "",
    responsibleEmail: "", targetDate: "", notes: "",
  }
  const [treatmentForm, setTreatmentForm] = useState(defaultTreatmentForm)

  // Threat form
  const defaultThreatForm = {
    name: "", category: "CYBER_ATTACK", description: "",
    affectedAssetTypes: "", typicalLikelihood: 3, typicalImpact: 3,
  }
  const [threatForm, setThreatForm] = useState(defaultThreatForm)

  // ==========================================
  // Veri yükleme
  // ==========================================

  const fetchRisks = useCallback(async () => {
    try {
      const res = await fetch("/api/iso27001/risks?stats=true")
      if (!res.ok) throw new Error("Riskler yüklenemedi")
      const data = await res.json()
      setRisks(data.risks || [])
      setStats(data.stats || null)
    } catch (error) {
      console.error("Risk yükleme hatası:", error)
      toast.error("Riskler yüklenemedi")
    }
  }, [])

  const fetchThreats = useCallback(async () => {
    setLoadingThreats(true)
    try {
      const res = await fetch("/api/iso27001/threats")
      if (!res.ok) throw new Error("Tehditler yüklenemedi")
      const data = await res.json()
      setThreats(data)
    } catch (error) {
      console.error("Tehdit yükleme hatası:", error)
    } finally {
      setLoadingThreats(false)
    }
  }, [])

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/iso27001/assets?status=ACTIVE&limit=200")
      if (!res.ok) return
      const data = await res.json()
      setAssets(Array.isArray(data) ? data : data.assets || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchRisks(), fetchThreats(), fetchAssets()])
      setLoading(false)
    }
    load()
  }, [fetchRisks, fetchThreats, fetchAssets])

  // ==========================================
  // Filtrelenmiş riskler
  // ==========================================

  const filteredRisks = useMemo(() => {
    return risks.filter(r => {
      if (selectedLevel !== "all" && r.riskLevel !== selectedLevel) return false
      if (selectedStatus !== "all" && r.status !== selectedStatus) return false
      if (selectedThreatCategory !== "all" && r.threat?.category !== selectedThreatCategory) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          r.riskNumber.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.assetName.toLowerCase().includes(q) ||
          r.threatName.toLowerCase().includes(q) ||
          r.scenario.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [risks, selectedLevel, selectedStatus, selectedThreatCategory, searchQuery])

  // ==========================================
  // Risk CRUD
  // ==========================================

  const handleCreateRisk = async () => {
    if (!riskForm.title || !riskForm.scenario) {
      toast.error("Başlık ve senaryo zorunludur")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/iso27001/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...riskForm,
          assetId: riskForm.assetId || undefined,
          threatId: riskForm.threatId || undefined,
          treatmentOption: riskForm.treatmentOption || undefined,
          relatedControls: riskForm.relatedControls ? riskForm.relatedControls.split(",").map(s => s.trim()) : [],
        }),
      })
      if (!res.ok) throw new Error("Risk oluşturulamadı")
      toast.success("Risk oluşturuldu")
      setIsCreateOpen(false)
      setRiskForm(defaultRiskForm)
      await fetchRisks()
    } catch (error) {
      toast.error("Risk oluşturma hatası")
    } finally {
      setSaving(false)
    }
  }

  const handleEditRisk = async () => {
    if (!selectedRisk) return
    setSaving(true)
    try {
      const res = await fetch(`/api/iso27001/risks/${selectedRisk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...riskForm,
          assetId: riskForm.assetId || undefined,
          threatId: riskForm.threatId || undefined,
          treatmentOption: riskForm.treatmentOption || undefined,
          relatedControls: riskForm.relatedControls ? riskForm.relatedControls.split(",").map(s => s.trim()) : [],
        }),
      })
      if (!res.ok) throw new Error("Risk güncellenemedi")
      toast.success("Risk güncellendi")
      setIsEditOpen(false)
      await fetchRisks()
    } catch (error) {
      toast.error("Risk güncelleme hatası")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRisk = async (risk: Risk) => {
    if (!confirm(`${risk.riskNumber} - ${risk.title} silinecek. Emin misiniz?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/iso27001/risks/${risk.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Risk silinemedi")
      toast.success("Risk silindi")
      await fetchRisks()
    } catch (error) {
      toast.error("Risk silme hatası")
    } finally {
      setDeleting(false)
    }
  }

  const openEditDialog = (risk: Risk) => {
    setSelectedRisk(risk)
    setRiskForm({
      title: risk.title,
      description: risk.description || "",
      assetId: risk.assetId || "",
      threatId: risk.threatId || "",
      scenario: risk.scenario,
      vulnerability: risk.vulnerability || "",
      existingControls: risk.existingControls || "",
      likelihood: risk.likelihood,
      impact: risk.impact,
      treatmentOption: risk.treatmentOption || "",
      treatmentSummary: risk.treatmentSummary || "",
      relatedControls: risk.relatedControls.join(", "),
      ownerName: risk.ownerName,
      ownerEmail: risk.ownerEmail,
    })
    setIsEditOpen(true)
  }

  // ==========================================
  // Treatment CRUD
  // ==========================================

  const handleCreateTreatment = async () => {
    if (!selectedRisk || !treatmentForm.description || !treatmentForm.responsibleName) {
      toast.error("Açıklama ve sorumlu zorunludur")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/iso27001/risks/${selectedRisk.id}/treatments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...treatmentForm,
          targetDate: treatmentForm.targetDate || undefined,
        }),
      })
      if (!res.ok) throw new Error("Tedavi planı oluşturulamadı")
      toast.success("Tedavi planı oluşturuldu")
      setIsTreatmentCreateOpen(false)
      setTreatmentForm(defaultTreatmentForm)
      await fetchRisks()
    } catch (error) {
      toast.error("Tedavi planı oluşturma hatası")
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateTreatmentStatus = async (riskId: string, treatmentId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/iso27001/risks/${riskId}/treatments/${treatmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Durum güncellenemedi")
      toast.success("Durum güncellendi")
      await fetchRisks()
    } catch (error) {
      toast.error("Durum güncelleme hatası")
    }
  }

  // ==========================================
  // Threat CRUD
  // ==========================================

  const handleCreateThreat = async () => {
    if (!threatForm.name || !threatForm.category) {
      toast.error("Tehdit adı ve kategorisi zorunludur")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/iso27001/threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(threatForm),
      })
      if (!res.ok) throw new Error("Tehdit oluşturulamadı")
      toast.success("Tehdit oluşturuldu")
      setIsCreateThreatOpen(false)
      setThreatForm(defaultThreatForm)
      await fetchThreats()
    } catch (error) {
      toast.error("Tehdit oluşturma hatası")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteThreat = async (threat: Threat) => {
    if (threat._count.risks > 0) {
      toast.error(`Bu tehdit ${threat._count.risks} risk ile ilişkili. Önce bağlantıları kaldırın.`)
      return
    }
    if (!confirm(`${threat.code} - ${threat.name} silinecek. Emin misiniz?`)) return
    try {
      const res = await fetch(`/api/iso27001/threats/${threat.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Tehdit silinemedi")
      toast.success("Tehdit silindi")
      await fetchThreats()
    } catch (error) {
      toast.error("Tehdit silme hatası")
    }
  }

  // ==========================================
  // Excel Export
  // ==========================================

  const handleExport = async () => {
    try {
      const res = await fetch("/api/iso27001/risks/export")
      if (!res.ok) throw new Error("Export başarısız")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ISO27001_Risk_Registeri_${new Date().toISOString().split("T")[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Excel dosyası indirildi")
    } catch (error) {
      toast.error("Excel export hatası")
    }
  }

  // ==========================================
  // Computed: assetValue
  // ==========================================

  const selectedAsset = useMemo(() => {
    return assets.find(a => a.id === riskForm.assetId)
  }, [assets, riskForm.assetId])

  const computedAssetValue = useMemo(() => {
    if (selectedAsset) {
      return Math.min(3, Math.max(selectedAsset.confidentiality, selectedAsset.integrity, selectedAsset.availability))
    }
    return 1
  }, [selectedAsset])

  const computedRiskScore = useMemo(() => {
    return computedAssetValue * riskForm.likelihood * riskForm.impact
  }, [computedAssetValue, riskForm.likelihood, riskForm.impact])

  const computedRiskLevel = useMemo(() => calculateRiskLevel(computedRiskScore), [computedRiskScore])

  // ==========================================
  // Treatment Plans (tüm risklerden topla)
  // ==========================================

  const allTreatmentPlans = useMemo(() => {
    const plans: (TreatmentPlan & { riskNumber: string; riskTitle: string; riskId: string })[] = []
    for (const risk of risks) {
      for (const plan of risk.treatmentPlans) {
        plans.push({ ...plan, riskNumber: risk.riskNumber, riskTitle: risk.title, riskId: risk.id })
      }
    }
    return plans.sort((a, b) => {
      const statusOrder: Record<string, number> = { IN_PROGRESS: 0, PLANNED: 1, MONITORING: 2, COMPLETED: 3, CANCELLED: 4 }
      return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5)
    })
  }, [risks])

  // ==========================================
  // Loading
  // ==========================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ==========================================
  // Risk Form Dialog (Create/Edit ortak)
  // ==========================================

  const RiskFormDialog = ({ open, onOpenChange, onSubmit, title: dialogTitle, isEdit }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: () => void
    title: string
    isEdit: boolean
  }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Risk bilgilerini güncelleyin" : "Yeni risk kaydı oluşturun"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Başlık *</Label>
            <Input value={riskForm.title} onChange={e => setRiskForm(f => ({ ...f, title: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Varlık</Label>
              <Select value={riskForm.assetId} onValueChange={v => setRiskForm(f => ({ ...f, assetId: v }))}>
                <SelectTrigger><SelectValue placeholder="Varlık seçin" /></SelectTrigger>
                <SelectContent>
                  {assets.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAsset && (
                <p className="text-xs text-muted-foreground">
                  C:{selectedAsset.confidentiality} I:{selectedAsset.integrity} A:{selectedAsset.availability} → VD: {computedAssetValue}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Tehdit</Label>
              <Select value={riskForm.threatId} onValueChange={v => setRiskForm(f => ({ ...f, threatId: v }))}>
                <SelectTrigger><SelectValue placeholder="Tehdit seçin" /></SelectTrigger>
                <SelectContent>
                  {threats.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.code} - {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Senaryo *</Label>
            <Textarea value={riskForm.scenario} onChange={e => setRiskForm(f => ({ ...f, scenario: e.target.value }))} rows={2} />
          </div>

          <div className="grid gap-2">
            <Label>Mevcut Kontroller</Label>
            <Textarea value={riskForm.existingControls} onChange={e => setRiskForm(f => ({ ...f, existingControls: e.target.value }))} rows={2} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Olasılık (1-5)</Label>
              <Select value={String(riskForm.likelihood)} onValueChange={v => setRiskForm(f => ({ ...f, likelihood: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Etki (1-5)</Label>
              <Select value={String(riskForm.impact)} onValueChange={v => setRiskForm(f => ({ ...f, impact: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Hesaplanan Skor</Label>
              <div className="flex items-center gap-2 h-10">
                <span className="text-2xl font-bold">{computedRiskScore}</span>
                <RiskLevelBadge level={computedRiskLevel} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>İşlem Türü</Label>
              <Select value={riskForm.treatmentOption} onValueChange={v => setRiskForm(f => ({ ...f, treatmentOption: v }))}>
                <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TREATMENT_OPTIONS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>İlgili Kontroller</Label>
              <Input value={riskForm.relatedControls} onChange={e => setRiskForm(f => ({ ...f, relatedControls: e.target.value }))} placeholder="A.5.1, A.8.7" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Açıklama</Label>
            <Textarea value={riskForm.description || ""} onChange={e => setRiskForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Güncelle" : "Oluştur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6" />
            Risk Analizi
          </h1>
          <p className="text-muted-foreground mt-1">
            ISO 27001 risk değerlendirmesi ve tedavi planları
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button onClick={() => { setRiskForm(defaultRiskForm); setIsCreateOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Risk
          </Button>
        </div>
      </div>

      {/* Sekmeler */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="risks" className="flex items-center gap-1">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Risk Listesi</span>
          </TabsTrigger>
          <TabsTrigger value="threats" className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Tehdit Katalogu</span>
          </TabsTrigger>
          <TabsTrigger value="treatments" className="flex items-center gap-1">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Tedavi Planları</span>
          </TabsTrigger>
        </TabsList>

        {/* ==========================================
            TAB 1: Dashboard
            ========================================== */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {/* KPI Kartları */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground">Toplam Risk</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-red-200">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-red-600">Kritik</p>
                <p className="text-2xl font-bold text-red-600">{stats?.byLevel.CRITICAL || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-orange-600">Yüksek</p>
                <p className="text-2xl font-bold text-orange-600">{stats?.byLevel.HIGH || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-yellow-600">Orta</p>
                <p className="text-2xl font-bold text-yellow-600">{stats?.byLevel.MEDIUM || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-green-200">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-green-600">Düşük</p>
                <p className="text-2xl font-bold text-green-600">{stats?.byLevel.LOW || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground">Kabul Edilen</p>
                <p className="text-2xl font-bold">{stats?.acceptedCount || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Matris + Dağılımlar */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">5x5 Risk Matrisi</CardTitle>
                <CardDescription>Olasılık x Etki dağılımı</CardDescription>
              </CardHeader>
              <CardContent>
                <RiskMatrix risks={risks} />
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Durum Dağılımı</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(RISK_STATUS).map(([key, { label, color }]) => {
                      const count = stats?.byStatus[key] || 0
                      const pct = stats && stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <Badge className={`${color} border-0 w-24 justify-center`}>{label}</Badge>
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-medium w-8 text-right">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">İşlem Türü Dağılımı</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(TREATMENT_OPTIONS).map(([key, { label, color }]) => {
                      const count = stats?.byTreatment[key] || 0
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <Badge className={`${color} border-0 w-24 justify-center`}>{label}</Badge>
                          <span className="text-sm font-medium">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ==========================================
            TAB 2: Risk Listesi
            ========================================== */}
        <TabsContent value="risks" className="space-y-4 mt-4">
          {/* Filtreler */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Risk ara..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Seviye" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Seviyeler</SelectItem>
                {Object.entries(RISK_LEVELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {Object.entries(RISK_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedThreatCategory} onValueChange={setSelectedThreatCategory}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Tehdit Kat." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                {Object.entries(THREAT_CATEGORIES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground">{filteredRisks.length} risk gösteriliyor</p>

          {/* Tablo */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">No</TableHead>
                      <TableHead>Varlık</TableHead>
                      <TableHead className="w-[40px] text-center">VD</TableHead>
                      <TableHead>Tehdit</TableHead>
                      <TableHead className="w-[40px] text-center">O</TableHead>
                      <TableHead className="w-[40px] text-center">E</TableHead>
                      <TableHead className="w-[50px] text-center">Skor</TableHead>
                      <TableHead className="w-[80px]">Seviye</TableHead>
                      <TableHead className="w-[80px]">İşlem</TableHead>
                      <TableHead className="w-[50px] text-center">A.Skor</TableHead>
                      <TableHead className="w-[80px]">A.Seviye</TableHead>
                      <TableHead className="w-[80px]">Durum</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRisks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                          Risk bulunamadı
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRisks.map(risk => (
                        <TableRow key={risk.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedRisk(risk); setIsDetailOpen(true) }}>
                          <TableCell className="font-mono text-xs">{risk.riskNumber}</TableCell>
                          <TableCell className="max-w-[150px] truncate text-sm">{risk.assetName}</TableCell>
                          <TableCell className="text-center font-bold">{risk.assetValue}</TableCell>
                          <TableCell className="max-w-[150px] truncate text-sm">{risk.threatName}</TableCell>
                          <TableCell className="text-center">{risk.likelihood}</TableCell>
                          <TableCell className="text-center">{risk.impact}</TableCell>
                          <TableCell className="text-center font-bold">{risk.riskScore}</TableCell>
                          <TableCell><RiskLevelBadge level={risk.riskLevel} /></TableCell>
                          <TableCell>
                            {risk.treatmentOption ? (
                              <StatusBadge status={risk.treatmentOption} map={TREATMENT_OPTIONS} />
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-sm">{risk.residualRiskScore ?? "-"}</TableCell>
                          <TableCell>
                            {risk.residualRiskLevel ? (
                              <RiskLevelBadge level={risk.residualRiskLevel} />
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell><StatusBadge status={risk.status} map={RISK_STATUS} /></TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedRisk(risk); setIsDetailOpen(true) }}>
                                  <Eye className="h-4 w-4 mr-2" />Detay
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditDialog(risk)}>
                                  <Pencil className="h-4 w-4 mr-2" />Düzenle
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedRisk(risk)
                                  setTreatmentForm(defaultTreatmentForm)
                                  setIsTreatmentCreateOpen(true)
                                }}>
                                  <ClipboardList className="h-4 w-4 mr-2" />Tedavi Planı Ekle
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteRisk(risk)}>
                                  <Trash2 className="h-4 w-4 mr-2" />Sil
                                </DropdownMenuItem>
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
        </TabsContent>

        {/* ==========================================
            TAB 3: Tehdit Katalogu
            ========================================== */}
        <TabsContent value="threats" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{threats.length} tehdit kayıtlı</p>
            <Button size="sm" onClick={() => { setThreatForm(defaultThreatForm); setIsCreateThreatOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />Yeni Tehdit
            </Button>
          </div>

          {loadingThreats ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(THREAT_CATEGORIES).map(([catKey, catLabel]) => {
                const catThreats = threats.filter(t => t.category === catKey)
                if (catThreats.length === 0) return null
                return (
                  <Card key={catKey}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{catLabel}</CardTitle>
                      <CardDescription>{catThreats.length} tehdit</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[70px]">Kod</TableHead>
                            <TableHead>Tehdit Adı</TableHead>
                            <TableHead className="hidden md:table-cell">Açıklama</TableHead>
                            <TableHead className="w-[50px] text-center">O</TableHead>
                            <TableHead className="w-[50px] text-center">E</TableHead>
                            <TableHead className="w-[60px] text-center">Risk</TableHead>
                            <TableHead className="w-[40px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {catThreats.map(t => (
                            <TableRow key={t.id}>
                              <TableCell className="font-mono text-xs font-bold">{t.code}</TableCell>
                              <TableCell className="font-medium">{t.name}</TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                                {t.description || "-"}
                              </TableCell>
                              <TableCell className="text-center">{t.typicalLikelihood}</TableCell>
                              <TableCell className="text-center">{t.typicalImpact}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary">{t._count.risks}</Badge>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteThreat(t)}>
                                      <Trash2 className="h-4 w-4 mr-2" />Sil
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ==========================================
            TAB 4: Tedavi Planları
            ========================================== */}
        <TabsContent value="treatments" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">{allTreatmentPlans.length} tedavi planı</p>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Risk No</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead className="w-[90px]">İşlem</TableHead>
                      <TableHead className="hidden md:table-cell">Açıklama</TableHead>
                      <TableHead>Sorumlu</TableHead>
                      <TableHead className="w-[100px]">Hedef Tarih</TableHead>
                      <TableHead className="w-[110px]">Durum</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTreatmentPlans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Tedavi planı bulunamadı
                        </TableCell>
                      </TableRow>
                    ) : (
                      allTreatmentPlans.map((plan, idx) => (
                        <TableRow key={plan.id || idx}>
                          <TableCell className="font-mono text-xs">{plan.riskNumber}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm">{plan.riskTitle}</TableCell>
                          <TableCell>
                            <StatusBadge status={plan.treatmentOption} map={TREATMENT_OPTIONS} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm max-w-[300px] truncate">
                            {plan.description}
                          </TableCell>
                          <TableCell className="text-sm">{plan.responsibleName}</TableCell>
                          <TableCell className="text-sm">
                            {plan.targetDate ? format(new Date(plan.targetDate), "dd.MM.yyyy", { locale: tr }) : "-"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={plan.status} map={TREATMENT_STATUS} />
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {plan.status !== "COMPLETED" && plan.status !== "CANCELLED" && (
                                  <>
                                    {plan.status === "PLANNED" && (
                                      <DropdownMenuItem onClick={() => handleUpdateTreatmentStatus(plan.riskId, plan.id, "IN_PROGRESS")}>
                                        <Activity className="h-4 w-4 mr-2" />Başlat
                                      </DropdownMenuItem>
                                    )}
                                    {plan.status === "IN_PROGRESS" && (
                                      <DropdownMenuItem onClick={() => handleUpdateTreatmentStatus(plan.riskId, plan.id, "COMPLETED")}>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />Tamamla
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-600" onClick={() => handleUpdateTreatmentStatus(plan.riskId, plan.id, "CANCELLED")}>
                                      <XCircle className="h-4 w-4 mr-2" />İptal
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {(plan.status === "COMPLETED" || plan.status === "CANCELLED") && (
                                  <DropdownMenuItem onClick={() => handleUpdateTreatmentStatus(plan.riskId, plan.id, "PLANNED")}>
                                    <Clock className="h-4 w-4 mr-2" />Yeniden Planla
                                  </DropdownMenuItem>
                                )}
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
        </TabsContent>
      </Tabs>

      {/* ==========================================
          Dialoglar
          ========================================== */}

      {/* Risk Detay Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{selectedRisk?.riskNumber}</span>
              {selectedRisk && <RiskLevelBadge level={selectedRisk.riskLevel} />}
            </DialogTitle>
            <DialogDescription>{selectedRisk?.title}</DialogDescription>
          </DialogHeader>

          {selectedRisk && (
            <div className="space-y-4">
              {/* Temel bilgiler */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Varlık</p>
                  <p className="font-medium">{selectedRisk.assetName} (VD: {selectedRisk.assetValue})</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tehdit</p>
                  <p className="font-medium">{selectedRisk.threat ? `${selectedRisk.threat.code} - ${selectedRisk.threatName}` : selectedRisk.threatName}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Senaryo</p>
                <p className="text-sm bg-muted rounded p-2">{selectedRisk.scenario}</p>
              </div>

              {selectedRisk.existingControls && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Mevcut Kontroller</p>
                  <p className="text-sm bg-muted rounded p-2">{selectedRisk.existingControls}</p>
                </div>
              )}

              {/* Risk değerlendirme */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Olasılık</p>
                  <p className="text-xl font-bold">{selectedRisk.likelihood}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Etki</p>
                  <p className="text-xl font-bold">{selectedRisk.impact}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Skor</p>
                  <p className="text-xl font-bold">{selectedRisk.riskScore}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Seviye</p>
                  <RiskLevelBadge level={selectedRisk.riskLevel} />
                </Card>
              </div>

              {/* Artık risk */}
              {selectedRisk.residualRiskScore !== null && (
                <>
                  <p className="text-sm font-medium">Artık Risk (İşleme Sonrası)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="p-3 text-center bg-muted/50">
                      <p className="text-xs text-muted-foreground">Olasılık</p>
                      <p className="text-xl font-bold">{selectedRisk.residualLikelihood}</p>
                    </Card>
                    <Card className="p-3 text-center bg-muted/50">
                      <p className="text-xs text-muted-foreground">Etki</p>
                      <p className="text-xl font-bold">{selectedRisk.residualImpact}</p>
                    </Card>
                    <Card className="p-3 text-center bg-muted/50">
                      <p className="text-xs text-muted-foreground">Skor</p>
                      <p className="text-xl font-bold">{selectedRisk.residualRiskScore}</p>
                    </Card>
                    <Card className="p-3 text-center bg-muted/50">
                      <p className="text-xs text-muted-foreground">Seviye</p>
                      {selectedRisk.residualRiskLevel && <RiskLevelBadge level={selectedRisk.residualRiskLevel} />}
                    </Card>
                  </div>
                </>
              )}

              {/* İşlem & Durum */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">İşlem Türü</p>
                  {selectedRisk.treatmentOption ? (
                    <StatusBadge status={selectedRisk.treatmentOption} map={TREATMENT_OPTIONS} />
                  ) : <p>-</p>}
                </div>
                <div>
                  <p className="text-muted-foreground">Durum</p>
                  <StatusBadge status={selectedRisk.status} map={RISK_STATUS} />
                </div>
                <div>
                  <p className="text-muted-foreground">Sorumlu</p>
                  <p className="font-medium">{selectedRisk.ownerName}</p>
                </div>
              </div>

              {selectedRisk.relatedControls.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">İlgili Kontroller</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedRisk.relatedControls.map((c, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Tedavi Planları */}
              {selectedRisk.treatmentPlans.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Tedavi Planları ({selectedRisk.treatmentPlans.length})</p>
                  <div className="space-y-2">
                    {selectedRisk.treatmentPlans.map(plan => (
                      <div key={plan.id} className="border rounded p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <StatusBadge status={plan.treatmentOption} map={TREATMENT_OPTIONS} />
                          <StatusBadge status={plan.status} map={TREATMENT_STATUS} />
                        </div>
                        <p className="text-sm mt-1">{plan.description}</p>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Sorumlu: {plan.responsibleName}</span>
                          {plan.targetDate && <span>Hedef: {format(new Date(plan.targetDate), "dd.MM.yyyy", { locale: tr })}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Kapat</Button>
            {selectedRisk && (
              <Button onClick={() => { setIsDetailOpen(false); openEditDialog(selectedRisk) }}>
                <Pencil className="h-4 w-4 mr-2" />Düzenle
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Risk Create/Edit Dialogs */}
      <RiskFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreateRisk}
        title="Yeni Risk Oluştur"
        isEdit={false}
      />
      <RiskFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSubmit={handleEditRisk}
        title="Riski Düzenle"
        isEdit={true}
      />

      {/* Treatment Create Dialog */}
      <Dialog open={isTreatmentCreateOpen} onOpenChange={setIsTreatmentCreateOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tedavi Planı Ekle</DialogTitle>
            <DialogDescription>
              {selectedRisk?.riskNumber} - {selectedRisk?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>İşlem Türü</Label>
              <Select value={treatmentForm.treatmentOption} onValueChange={v => setTreatmentForm(f => ({ ...f, treatmentOption: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TREATMENT_OPTIONS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Açıklama *</Label>
              <Textarea value={treatmentForm.description} onChange={e => setTreatmentForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Sorumlu *</Label>
                <Input value={treatmentForm.responsibleName} onChange={e => setTreatmentForm(f => ({ ...f, responsibleName: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Hedef Tarih</Label>
                <Input type="date" value={treatmentForm.targetDate} onChange={e => setTreatmentForm(f => ({ ...f, targetDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notlar</Label>
              <Textarea value={treatmentForm.notes} onChange={e => setTreatmentForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTreatmentCreateOpen(false)}>İptal</Button>
            <Button onClick={handleCreateTreatment} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Threat Create Dialog */}
      <Dialog open={isCreateThreatOpen} onOpenChange={setIsCreateThreatOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Tehdit Ekle</DialogTitle>
            <DialogDescription>Tehdit kataloğuna yeni tehdit ekleyin</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Tehdit Adı *</Label>
              <Input value={threatForm.name} onChange={e => setThreatForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Kategori *</Label>
              <Select value={threatForm.category} onValueChange={v => setThreatForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(THREAT_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Açıklama</Label>
              <Textarea value={threatForm.description} onChange={e => setThreatForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipik Olasılık</Label>
                <Select value={String(threatForm.typicalLikelihood)} onValueChange={v => setThreatForm(f => ({ ...f, typicalLikelihood: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tipik Etki</Label>
                <Select value={String(threatForm.typicalImpact)} onValueChange={v => setThreatForm(f => ({ ...f, typicalImpact: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateThreatOpen(false)}>İptal</Button>
            <Button onClick={handleCreateThreat} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
