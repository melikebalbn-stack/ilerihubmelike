"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Loader2,
  Factory,
  Cog,
  Calendar,
  Play,
  ClipboardList,
  User,
  BookOpen,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import Link from "next/link"

interface Machine {
  id: string
  machineCode: string
  name: string
  description: string | null
  machineType: string
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  location: string | null
  area: string | null
  department: string | null
  status: string
  criticalityLevel: string
  operatingHoursCounter: number
  imageUrl: string | null
  _count?: {
    workOrders: number
    maintenancePlans: number
  }
}

interface MaintenancePlan {
  id: string
  planCode: string
  name: string
  description: string | null
  maintenanceType: string
  frequencyType: string
  frequencyValue: number
  frequencyUnit: string
  estimatedDurationMinutes: number
  nextDueAt: string | null
  lastPerformedAt: string | null
  assignedTeam: string | null
  assignedTo: string | null
  assignedToName: string | null
  status: string
  executionCount: number
  machine: {
    id: string
    machineCode: string
    name: string
    location: string | null
    area: string | null
  }
  _count: {
    workOrders: number
  }
}

interface WorkOrder {
  id: string
  workOrderNumber: string
  title: string
  description: string | null
  workOrderType: string
  priority: string
  status: string
  reportedBy: string
  reportedByName: string
  assignedTo: string | null
  assignedToName: string | null
  assignedTeam: string | null
  createdAt: string
  scheduledStartAt: string | null
  actualStartAt: string | null
  actualEndAt: string | null
  machine: {
    id: string
    machineCode: string
    name: string
    location: string | null
    area: string | null
  }
  maintenancePlan: {
    id: string
    planCode: string
    name: string
  } | null
  _count: {
    downtimeRecords: number
    sparePartsUsed: number
    laborLogs: number
  }
}

interface Stats {
  period: number
  machines: {
    total: number
    byStatus: Record<string, number>
  }
  workOrders: {
    total: number
    breakdown: number
    urgent: number
    byStatus: Record<string, number>
    byPriority: Record<string, number>
    byType: Record<string, number>
  }
  kpis: {
    mtbf: number
    mttr: number
    pmCompliance: number
    totalDowntimeHours: number
    breakdownDowntimeHours: number
  }
  oee: {
    average: number
    availability: number
    performance: number
    quality: number
    recordCount: number
  }
}

const machineTypeLabels: Record<string, string> = {
  CNC: "CNC Tezgah",
  LATHE: "Torna",
  MILLING: "Freze",
  DRILLING: "Matkap",
  GRINDING: "Taslama",
  PRESS: "Pres",
  INJECTION: "Enjeksiyon",
  ASSEMBLY: "Montaj Hatti",
  CONVEYOR: "Konveyor",
  PACKAGING: "Paketleme",
  WELDING: "Kaynak",
  CUTTING: "Kesim",
  TESTING: "Test Ekipmani",
  UTILITY: "Yardimci",
  OTHER: "Diger",
}

const statusLabels: Record<string, string> = {
  ACTIVE: "Calisıyor",
  IDLE: "Bosta",
  MAINTENANCE: "Bakimda",
  BREAKDOWN: "Arizali",
  SETUP: "Ayar/Hazirlik",
  RETIRED: "Hurdaya Ayrilmis",
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-500",
  IDLE: "bg-gray-400",
  MAINTENANCE: "bg-blue-500",
  BREAKDOWN: "bg-red-500",
  SETUP: "bg-yellow-500",
  RETIRED: "bg-gray-600",
}

const criticalityLabels: Record<string, string> = {
  A: "Kritik",
  B: "Onemli",
  C: "Normal",
}

const criticalityColors: Record<string, string> = {
  A: "bg-red-500",
  B: "bg-yellow-500",
  C: "bg-green-500",
}

const maintenanceTypeLabels: Record<string, string> = {
  PREVENTIVE: "Koruyucu",
  PREDICTIVE: "Kestirimci",
  CORRECTIVE: "Duzeltici",
  EMERGENCY: "Acil",
  INSPECTION: "Denetim",
}

const frequencyUnitLabels: Record<string, string> = {
  DAYS: "Gun",
  WEEKS: "Hafta",
  MONTHS: "Ay",
  HOURS: "Saat",
  CYCLES: "Cevrim",
}

const workOrderTypeLabels: Record<string, string> = {
  BREAKDOWN: "Ariza",
  PREVENTIVE: "Koruyucu Bakim",
  CORRECTIVE: "Duzeltici Bakim",
  IMPROVEMENT: "Iyilestirme",
  INSPECTION: "Denetim",
}

const priorityLabels: Record<string, string> = {
  CRITICAL: "Kritik",
  HIGH: "Yuksek",
  NORMAL: "Normal",
  LOW: "Dusuk",
}

const priorityColors: Record<string, string> = {
  CRITICAL: "bg-red-600",
  HIGH: "bg-orange-500",
  NORMAL: "bg-blue-500",
  LOW: "bg-gray-400",
}

const workOrderStatusLabels: Record<string, string> = {
  OPEN: "Acik",
  ASSIGNED: "Atandi",
  IN_PROGRESS: "Devam Ediyor",
  ON_HOLD: "Beklemede",
  COMPLETED: "Tamamlandi",
  CLOSED: "Kapandi",
  CANCELLED: "Iptal",
}

const workOrderStatusColors: Record<string, string> = {
  OPEN: "bg-gray-400",
  ASSIGNED: "bg-blue-400",
  IN_PROGRESS: "bg-yellow-500",
  ON_HOLD: "bg-orange-400",
  COMPLETED: "bg-green-500",
  CLOSED: "bg-gray-600",
  CANCELLED: "bg-red-400",
}

export default function MaintenancePage() {
  const { data: session } = useSession()
  const [machines, setMachines] = useState<Machine[]>([])
  const [plans, setPlans] = useState<MaintenancePlan[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [woStatusFilter, setWoStatusFilter] = useState<string>("all")
  const [woPriorityFilter, setWoPriorityFilter] = useState<string>("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showAddPlanDialog, setShowAddPlanDialog] = useState(false)
  const [showAddWorkOrderDialog, setShowAddWorkOrderDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("machines")

  // Form state for machines
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    machineType: "CNC",
    manufacturer: "",
    model: "",
    serialNumber: "",
    location: "",
    area: "",
    department: "",
    criticalityLevel: "B",
  })

  // Form state for maintenance plans
  const [planFormData, setPlanFormData] = useState({
    machineId: "",
    name: "",
    description: "",
    maintenanceType: "PREVENTIVE",
    frequencyType: "TIME_BASED",
    frequencyValue: 30,
    frequencyUnit: "DAYS",
    estimatedDurationMinutes: 60,
    assignedTeam: "",
    instructions: "",
    safetyNotes: "",
  })

  // Form state for work orders
  const [woFormData, setWoFormData] = useState({
    machineId: "",
    title: "",
    description: "",
    workOrderType: "BREAKDOWN",
    priority: "NORMAL",
    failureSymptom: "",
    assignedTeam: "",
  })

  useEffect(() => {
    fetchData()
  }, [statusFilter, typeFilter, woStatusFilter, woPriorityFilter, activeTab])

  const fetchData = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (typeFilter !== "all") params.set("type", typeFilter)
      if (search) params.set("search", search)

      const woParams = new URLSearchParams()
      if (woStatusFilter !== "all") woParams.set("status", woStatusFilter)
      if (woPriorityFilter !== "all") woParams.set("priority", woPriorityFilter)

      const [machinesRes, plansRes, workOrdersRes, statsRes] = await Promise.all([
        fetch(`/api/machines?${params}`),
        fetch("/api/maintenance-plans"),
        fetch(`/api/work-orders?${woParams}`),
        fetch("/api/maintenance/stats?period=30"),
      ])

      if (machinesRes.ok) {
        const data = await machinesRes.json()
        setMachines(data)
      }

      if (plansRes.ok) {
        const data = await plansRes.json()
        setPlans(data)
      }

      if (workOrdersRes.ok) {
        const data = await workOrdersRes.json()
        setWorkOrders(data)
      }

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Veriler yuklenirken hata olustu")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchData()
  }

  const handleAddPlan = async () => {
    if (!planFormData.machineId || !planFormData.name) {
      toast.error("Makine ve plan adi zorunludur")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/maintenance-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planFormData),
      })

      if (res.ok) {
        toast.success("Bakim plani basariyla eklendi")
        setShowAddPlanDialog(false)
        setPlanFormData({
          machineId: "",
          name: "",
          description: "",
          maintenanceType: "PREVENTIVE",
          frequencyType: "TIME_BASED",
          frequencyValue: 30,
          frequencyUnit: "DAYS",
          estimatedDurationMinutes: 60,
          assignedTeam: "",
          instructions: "",
          safetyNotes: "",
        })
        fetchData()
      } else {
        const error = await res.json()
        toast.error(error.error || "Plan eklenirken hata olustu")
      }
    } catch (error) {
      console.error("Error adding plan:", error)
      toast.error("Plan eklenirken hata olustu")
    } finally {
      setSubmitting(false)
    }
  }

  const handleExecutePlan = async (planId: string) => {
    try {
      const res = await fetch(`/api/maintenance-plans/${planId}`, {
        method: "POST",
      })

      if (res.ok) {
        const workOrder = await res.json()
        toast.success(`Is emri olusturuldu: ${workOrder.workOrderNumber}`)
        fetchData()
      } else {
        const error = await res.json()
        toast.error(error.error || "Is emri olusturulamadi")
      }
    } catch (error) {
      console.error("Error executing plan:", error)
      toast.error("Is emri olusturulurken hata olustu")
    }
  }

  const handleAddWorkOrder = async () => {
    if (!woFormData.machineId || !woFormData.title) {
      toast.error("Makine ve baslik zorunludur")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(woFormData),
      })

      if (res.ok) {
        const workOrder = await res.json()
        toast.success(`Is emri olusturuldu: ${workOrder.workOrderNumber}`)
        setShowAddWorkOrderDialog(false)
        setWoFormData({
          machineId: "",
          title: "",
          description: "",
          workOrderType: "BREAKDOWN",
          priority: "NORMAL",
          failureSymptom: "",
          assignedTeam: "",
        })
        fetchData()
      } else {
        const error = await res.json()
        toast.error(error.error || "Is emri olusturulamadi")
      }
    } catch (error) {
      console.error("Error creating work order:", error)
      toast.error("Is emri olusturulurken hata olustu")
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateWorkOrderStatus = async (woId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/work-orders/${woId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        toast.success("Is emri durumu guncellendi")
        fetchData()
      } else {
        const error = await res.json()
        toast.error(error.error || "Durum guncellenemedi")
      }
    } catch (error) {
      console.error("Error updating work order:", error)
      toast.error("Durum guncellenirken hata olustu")
    }
  }

  const handleAddMachine = async () => {
    if (!formData.name) {
      toast.error("Makine adi zorunludur")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Makine basariyla eklendi")
        setShowAddDialog(false)
        setFormData({
          name: "",
          description: "",
          machineType: "CNC",
          manufacturer: "",
          model: "",
          serialNumber: "",
          location: "",
          area: "",
          department: "",
          criticalityLevel: "B",
        })
        fetchData()
      } else {
        const error = await res.json()
        toast.error(error.error || "Makine eklenirken hata olustu")
      }
    } catch (error) {
      console.error("Error adding machine:", error)
      toast.error("Makine eklenirken hata olustu")
    } finally {
      setSubmitting(false)
    }
  }

  const canManage = session?.user?.role === "ADMIN" ||
    session?.user?.role === "SUPER_ADMIN" ||
    session?.user?.role === "QUALITY_MANAGER"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Factory className="h-8 w-8 text-primary" />
            Tezgah Bakim Yonetimi
          </h1>
          <p className="text-muted-foreground mt-1">
            Makine/tezgah bakim ve ariza takip sistemi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/maintenance/guide">
            <Button variant="outline">
              <BookOpen className="h-4 w-4 mr-2" />
              Kilavuz
            </Button>
          </Link>
          {canManage && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Makine
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Yeni Makine Ekle</DialogTitle>
                <DialogDescription>
                  Yeni bir makine/tezgah tanimlayin
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Makine Adi *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="CNC Torna #1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Makine Tipi</Label>
                  <Select
                    value={formData.machineType}
                    onValueChange={(v) => setFormData({ ...formData, machineType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(machineTypeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Uretici</Label>
                  <Input
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    placeholder="Mazak"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="QT-250"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Seri No</Label>
                  <Input
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="SN12345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kritiklik</Label>
                  <Select
                    value={formData.criticalityLevel}
                    onValueChange={(v) => setFormData({ ...formData, criticalityLevel: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A - Kritik (Uretim durur)</SelectItem>
                      <SelectItem value="B">B - Onemli (Uretim azalir)</SelectItem>
                      <SelectItem value="C">C - Normal (Alternatif var)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Lokasyon</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Fabrika A"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Alan/Hat</Label>
                  <Input
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    placeholder="Uretim Hatti 1"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Aciklama</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Makine hakkinda notlar..."
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Iptal
                </Button>
                <Button onClick={handleAddMachine} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Kaydet
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Toplam Makine</CardTitle>
              <Cog className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.machines.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.machines.byStatus?.ACTIVE || 0} aktif
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Arizali</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {stats.machines.byStatus?.BREAKDOWN || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.workOrders.urgent} acil is emri
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">MTBF</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.kpis.mtbf} saat</div>
              <p className="text-xs text-muted-foreground">
                Arizalar arasi ortalama sure
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">MTTR</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.kpis.mttr} dk</div>
              <p className="text-xs text-muted-foreground">
                Ortalama onarim suresi
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">OEE</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.oee.average > 0 ? `%${stats.oee.average}` : "-"}
              </div>
              <p className="text-xs text-muted-foreground">
                Genel ekipman verimliligi
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="machines">
            <Cog className="h-4 w-4 mr-2" />
            Makineler
          </TabsTrigger>
          <TabsTrigger value="plans">
            <Calendar className="h-4 w-4 mr-2" />
            Bakim Planlari
          </TabsTrigger>
          <TabsTrigger value="workorders">
            <Wrench className="h-4 w-4 mr-2" />
            Is Emirleri
          </TabsTrigger>
          <TabsTrigger value="dashboard">
            <Activity className="h-4 w-4 mr-2" />
            KPI Dashboard
          </TabsTrigger>
        </TabsList>

        {/* Makineler Tab */}
        <TabsContent value="machines" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="flex-1 max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Makine ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Durumlar</SelectItem>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tip" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Tipler</SelectItem>
                {Object.entries(machineTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Machine List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : machines.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Cog className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Henuz makine tanimlanmamis</p>
                {canManage && (
                  <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ilk Makineyi Ekle
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {machines.map((machine) => (
                <Card key={machine.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{machine.name}</CardTitle>
                        <CardDescription className="font-mono">
                          {machine.machineCode}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Badge className={criticalityColors[machine.criticalityLevel]}>
                          {criticalityLabels[machine.criticalityLevel]}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Durum</span>
                        <Badge className={statusColors[machine.status]}>
                          {statusLabels[machine.status]}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Tip</span>
                        <span className="text-sm">{machineTypeLabels[machine.machineType]}</span>
                      </div>
                      {machine.manufacturer && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Uretici</span>
                          <span className="text-sm">{machine.manufacturer}</span>
                        </div>
                      )}
                      {machine.location && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Lokasyon</span>
                          <span className="text-sm">{machine.location}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-muted-foreground">Is Emirleri</span>
                        <span className="text-sm font-medium">
                          {machine._count?.workOrders || 0}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        Detay
                      </Button>
                      <Button variant="outline" size="sm">
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Bakım Planları Tab */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Bakim Planlari</h2>
            {canManage && (
              <Dialog open={showAddPlanDialog} onOpenChange={setShowAddPlanDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Yeni Plan
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Yeni Bakim Plani</DialogTitle>
                    <DialogDescription>
                      Periyodik bakim plani olusturun
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Makine *</Label>
                      <Select
                        value={planFormData.machineId}
                        onValueChange={(v) => setPlanFormData({ ...planFormData, machineId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Makine secin" />
                        </SelectTrigger>
                        <SelectContent>
                          {machines.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.machineCode} - {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Plan Adi *</Label>
                      <Input
                        value={planFormData.name}
                        onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                        placeholder="Haftalik Yag Kontrolu"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bakim Tipi</Label>
                      <Select
                        value={planFormData.maintenanceType}
                        onValueChange={(v) => setPlanFormData({ ...planFormData, maintenanceType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(maintenanceTypeLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Periyot</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={planFormData.frequencyValue}
                          onChange={(e) => setPlanFormData({ ...planFormData, frequencyValue: parseInt(e.target.value) || 1 })}
                          className="w-20"
                        />
                        <Select
                          value={planFormData.frequencyUnit}
                          onValueChange={(v) => setPlanFormData({ ...planFormData, frequencyUnit: v })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(frequencyUnitLabels).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Tahmini Sure (dk)</Label>
                      <Input
                        type="number"
                        value={planFormData.estimatedDurationMinutes}
                        onChange={(e) => setPlanFormData({ ...planFormData, estimatedDurationMinutes: parseInt(e.target.value) || 60 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Atanan Ekip</Label>
                      <Input
                        value={planFormData.assignedTeam}
                        onChange={(e) => setPlanFormData({ ...planFormData, assignedTeam: e.target.value })}
                        placeholder="Bakim Ekibi"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Aciklama</Label>
                      <Textarea
                        value={planFormData.description}
                        onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Talimatlar</Label>
                      <Textarea
                        value={planFormData.instructions}
                        onChange={(e) => setPlanFormData({ ...planFormData, instructions: e.target.value })}
                        rows={2}
                        placeholder="Bakim adimlari..."
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Guvenlik Notlari</Label>
                      <Textarea
                        value={planFormData.safetyNotes}
                        onChange={(e) => setPlanFormData({ ...planFormData, safetyNotes: e.target.value })}
                        rows={2}
                        placeholder="Dikkat edilecek guvenlik kurallari..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setShowAddPlanDialog(false)}>
                      Iptal
                    </Button>
                    <Button onClick={handleAddPlan} disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Kaydet
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : plans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Henuz bakim plani tanimlanmamis</p>
                {canManage && (
                  <Button className="mt-4" onClick={() => setShowAddPlanDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ilk Plani Olustur
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const isOverdue = plan.nextDueAt && new Date(plan.nextDueAt) < new Date()
                return (
                  <Card key={plan.id} className={`hover:shadow-md transition-shadow ${isOverdue ? 'border-red-500 border-2' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          <CardDescription className="font-mono">
                            {plan.planCode}
                          </CardDescription>
                        </div>
                        <Badge className={plan.status === "ACTIVE" ? "bg-green-500" : "bg-gray-400"}>
                          {plan.status === "ACTIVE" ? "Aktif" : "Pasif"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Makine</span>
                          <span className="text-sm font-medium">
                            {plan.machine.machineCode}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Tip</span>
                          <Badge variant="outline">
                            {maintenanceTypeLabels[plan.maintenanceType]}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Periyot</span>
                          <span className="text-sm">
                            {plan.frequencyValue} {frequencyUnitLabels[plan.frequencyUnit]}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Sonraki</span>
                          <span className={`text-sm ${isOverdue ? 'text-red-500 font-bold' : ''}`}>
                            {plan.nextDueAt
                              ? format(new Date(plan.nextDueAt), "d MMM yyyy", { locale: tr })
                              : "-"}
                          </span>
                        </div>
                        {plan.lastPerformedAt && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Son Yapilan</span>
                            <span className="text-sm">
                              {format(new Date(plan.lastPerformedAt), "d MMM yyyy", { locale: tr })}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm text-muted-foreground">Toplam</span>
                          <span className="text-sm font-medium">
                            {plan.executionCount} kez yapildi
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleExecutePlan(plan.id)}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Calistir
                        </Button>
                        <Button variant="outline" size="sm">
                          Detay
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* İş Emirleri Tab */}
        <TabsContent value="workorders" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <Select value={woStatusFilter} onValueChange={setWoStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Durum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tum Durumlar</SelectItem>
                  {Object.entries(workOrderStatusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={woPriorityFilter} onValueChange={setWoPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Oncelik" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tum Oncelikler</SelectItem>
                  {Object.entries(priorityLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canManage && (
              <Dialog open={showAddWorkOrderDialog} onOpenChange={setShowAddWorkOrderDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Ariza Bildir
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Ariza Bildirimi</DialogTitle>
                    <DialogDescription>
                      Makine arizasi veya is emri olusturun
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Makine *</Label>
                      <Select
                        value={woFormData.machineId}
                        onValueChange={(v) => setWoFormData({ ...woFormData, machineId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Makine secin" />
                        </SelectTrigger>
                        <SelectContent>
                          {machines.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.machineCode} - {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Is Emri Tipi</Label>
                      <Select
                        value={woFormData.workOrderType}
                        onValueChange={(v) => setWoFormData({ ...woFormData, workOrderType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(workOrderTypeLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Baslik *</Label>
                      <Input
                        value={woFormData.title}
                        onChange={(e) => setWoFormData({ ...woFormData, title: e.target.value })}
                        placeholder="Motor calismiyor"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Oncelik</Label>
                      <Select
                        value={woFormData.priority}
                        onValueChange={(v) => setWoFormData({ ...woFormData, priority: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(priorityLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Atanan Ekip</Label>
                      <Input
                        value={woFormData.assignedTeam}
                        onChange={(e) => setWoFormData({ ...woFormData, assignedTeam: e.target.value })}
                        placeholder="Bakim Ekibi"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Ariza Belirtisi</Label>
                      <Input
                        value={woFormData.failureSymptom}
                        onChange={(e) => setWoFormData({ ...woFormData, failureSymptom: e.target.value })}
                        placeholder="Garip ses, duman, vs."
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Aciklama</Label>
                      <Textarea
                        value={woFormData.description}
                        onChange={(e) => setWoFormData({ ...woFormData, description: e.target.value })}
                        rows={3}
                        placeholder="Detayli aciklama..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setShowAddWorkOrderDialog(false)}>
                      Iptal
                    </Button>
                    <Button onClick={handleAddWorkOrder} disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Kaydet
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : workOrders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Henuz is emri bulunmuyor</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {workOrders.map((wo) => (
                <Card key={wo.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-muted-foreground">
                            {wo.workOrderNumber}
                          </span>
                          <Badge className={priorityColors[wo.priority]}>
                            {priorityLabels[wo.priority]}
                          </Badge>
                          <Badge className={workOrderStatusColors[wo.status]}>
                            {workOrderStatusLabels[wo.status]}
                          </Badge>
                          <Badge variant="outline">
                            {workOrderTypeLabels[wo.workOrderType]}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-lg">{wo.title}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Cog className="h-4 w-4" />
                            {wo.machine.machineCode} - {wo.machine.name}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {wo.reportedByName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(new Date(wo.createdAt), "d MMM yyyy HH:mm", { locale: tr })}
                          </span>
                        </div>
                        {wo.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {wo.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        {wo.status === "OPEN" && canManage && (
                          <Button
                            size="sm"
                            onClick={() => handleUpdateWorkOrderStatus(wo.id, "IN_PROGRESS")}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Basla
                          </Button>
                        )}
                        {wo.status === "IN_PROGRESS" && canManage && (
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleUpdateWorkOrderStatus(wo.id, "COMPLETED")}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Tamamla
                          </Button>
                        )}
                        <Button variant="outline" size="sm">
                          Detay
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* KPI Dashboard Tab */}
        <TabsContent value="dashboard">
          {stats && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* OEE Detay */}
              <Card>
                <CardHeader>
                  <CardTitle>OEE Bileşenleri</CardTitle>
                  <CardDescription>
                    Son 30 günlük ortalama değerler
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Kullanılabilirlik (A)</span>
                        <span className="text-sm font-medium">
                          {stats.oee.availability > 0 ? `%${stats.oee.availability}` : "-"}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${stats.oee.availability}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Performans (P)</span>
                        <span className="text-sm font-medium">
                          {stats.oee.performance > 0 ? `%${stats.oee.performance}` : "-"}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${stats.oee.performance}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Kalite (Q)</span>
                        <span className="text-sm font-medium">
                          {stats.oee.quality > 0 ? `%${stats.oee.quality}` : "-"}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-500"
                          style={{ width: `${stats.oee.quality}%` }}
                        />
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <div className="flex justify-between">
                        <span className="font-medium">OEE (A × P × Q)</span>
                        <span className="font-bold text-lg">
                          {stats.oee.average > 0 ? `%${stats.oee.average}` : "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bakım KPI'ları */}
              <Card>
                <CardHeader>
                  <CardTitle>Bakim Metrikleri</CardTitle>
                  <CardDescription>
                    Son 30 günlük performans
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">MTBF</p>
                        <p className="text-xl font-bold">{stats.kpis.mtbf} saat</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-500" />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">MTTR</p>
                        <p className="text-xl font-bold">{stats.kpis.mttr} dakika</p>
                      </div>
                      <Clock className="h-8 w-8 text-yellow-500" />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">PM Uyumu</p>
                        <p className="text-xl font-bold">%{stats.kpis.pmCompliance}</p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">Toplam Durus</p>
                        <p className="text-xl font-bold">{stats.kpis.totalDowntimeHours} saat</p>
                      </div>
                      <TrendingDown className="h-8 w-8 text-red-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* İş Emri Dağılımı */}
              <Card>
                <CardHeader>
                  <CardTitle>Is Emri Dagilimi</CardTitle>
                  <CardDescription>
                    Tip bazli is emirleri
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(stats.workOrders.byType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm">{type}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                    {Object.keys(stats.workOrders.byType).length === 0 && (
                      <p className="text-muted-foreground text-center py-4">
                        Veri bulunamadi
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Makine Durumları */}
              <Card>
                <CardHeader>
                  <CardTitle>Makine Durumlari</CardTitle>
                  <CardDescription>
                    Anlik durum dagilimi
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(stats.machines.byStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${statusColors[status]}`} />
                          <span className="text-sm">{statusLabels[status]}</span>
                        </div>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
