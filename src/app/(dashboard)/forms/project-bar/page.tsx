"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { BarChart3, Plus, Calendar, User, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"

interface ProjectPlan {
  id: string
  planNumber: string
  title: string
  description: string | null
  label1: string
  label2: string
  label3: string
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED"
  createdBy: {
    id: string
    name: string | null
    email: string
  }
  _count: {
    items: number
  }
  totalConsultant: number
  totalTarget: number
  totalActual: number
  createdAt: string
}

const statusLabels: Record<string, string> = {
  ACTIVE: "Aktif",
  COMPLETED: "Tamamlandı",
  ARCHIVED: "Arşivlendi"
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  COMPLETED: "bg-sky-50 text-sky-700 border-sky-200",
  ARCHIVED: "bg-gray-50 text-gray-700 border-gray-200"
}

export default function ProjectBarPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<ProjectPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newPlan, setNewPlan] = useState({
    title: "", description: "",
    label1: "Danışman", label2: "Hedef", label3: "Gerçekleşen"
  })

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/project-plans")
      if (res.ok) {
        const data = await res.json()
        setPlans(data)
      }
    } catch (error) {
      console.error("Planlar yüklenirken hata:", error)
      toast.error("Planlar yüklenirken hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePlan = async () => {
    if (!newPlan.title.trim()) {
      toast.error("Plan başlığı zorunludur")
      return
    }

    setCreating(true)
    try {
      const res = await fetch("/api/project-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newPlan.title,
          description: newPlan.description || null,
          label1: newPlan.label1,
          label2: newPlan.label2,
          label3: newPlan.label3,
          items: []
        })
      })

      if (res.ok) {
        const plan = await res.json()
        toast.success("Plan oluşturuldu")
        setCreateDialogOpen(false)
        setNewPlan({ title: "", description: "", label1: "Danışman", label2: "Hedef", label3: "Gerçekleşen" })
        router.push(`/forms/project-bar/${plan.id}`)
      } else {
        const error = await res.json()
        toast.error(error.error || "Plan oluşturulamadı")
      }
    } catch (error) {
      console.error("Plan oluşturulurken hata:", error)
      toast.error("Plan oluşturulurken hata oluştu")
    } finally {
      setCreating(false)
    }
  }

  const getProgressPercentage = (actual: number, target: number) => {
    if (target === 0) return 0
    return Math.round((actual / target) * 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold">Proje Planları</h1>
            <p className="text-xs text-muted-foreground">Adam/Gün Karşılaştırması</p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Plan
        </Button>
      </div>

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">Henüz proje planı oluşturulmamış</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              İlk Planı Oluştur
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/forms/project-bar/${plan.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{plan.planNumber}</p>
                    <CardTitle className="text-base">{plan.title}</CardTitle>
                  </div>
                  <Badge variant="outline" className={statusColors[plan.status]}>
                    {statusLabels[plan.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {plan.description}
                  </p>
                )}

                {/* Mini Progress Bars */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-rose-500 w-16 truncate" title={plan.label1}>{plan.label1}</span>
                    <div className="flex-1 h-2 bg-rose-50 rounded overflow-hidden">
                      <div
                        className="h-full bg-rose-300 rounded"
                        style={{ width: `${plan.totalConsultant > 0 ? 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-rose-500 w-8 text-right">{plan.totalConsultant}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-sky-500 w-16 truncate" title={plan.label2}>{plan.label2}</span>
                    <div className="flex-1 h-2 bg-sky-50 rounded overflow-hidden">
                      <div
                        className="h-full bg-sky-300 rounded"
                        style={{
                          width: `${plan.totalConsultant > 0 ? (plan.totalTarget / plan.totalConsultant) * 100 : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-sky-500 w-8 text-right">{plan.totalTarget}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-500 w-16 truncate" title={plan.label3}>{plan.label3}</span>
                    <div className="flex-1 h-2 bg-emerald-50 rounded overflow-hidden">
                      <div
                        className="h-full bg-emerald-300 rounded"
                        style={{
                          width: `${plan.totalConsultant > 0 ? (plan.totalActual / plan.totalConsultant) * 100 : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-emerald-500 w-8 text-right">{plan.totalActual}</span>
                  </div>
                </div>

                {/* Progress Badge */}
                {plan.totalTarget > 0 && (
                  <div className="mb-3">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        plan.totalActual <= plan.totalTarget
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                          : "bg-rose-50 text-rose-600 border-rose-200"
                      }`}
                    >
                      {getProgressPercentage(plan.totalActual, plan.totalTarget)}% tamamlandı
                    </Badge>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{plan.createdBy.name || plan.createdBy.email}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(plan.createdAt), "dd MMM yyyy", { locale: tr })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Proje Planı</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Plan Başlığı *</label>
              <Input
                value={newPlan.title}
                onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                placeholder="Örn: IFS Projesi"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Açıklama</label>
              <Textarea
                value={newPlan.description}
                onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                placeholder="Plan hakkında kısa açıklama..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Sütun Etiketleri</label>
              <p className="text-xs text-muted-foreground mb-2">Her sütunun başlığını belirleyin</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-rose-500">1. Sütun</label>
                  <Input
                    value={newPlan.label1}
                    onChange={(e) => setNewPlan({ ...newPlan, label1: e.target.value })}
                    placeholder="Danışman"
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-sky-500">2. Sütun</label>
                  <Input
                    value={newPlan.label2}
                    onChange={(e) => setNewPlan({ ...newPlan, label2: e.target.value })}
                    placeholder="Hedef"
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-emerald-500">3. Sütun</label>
                  <Input
                    value={newPlan.label3}
                    onChange={(e) => setNewPlan({ ...newPlan, label3: e.target.value })}
                    placeholder="Gerçekleşen"
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreatePlan} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
