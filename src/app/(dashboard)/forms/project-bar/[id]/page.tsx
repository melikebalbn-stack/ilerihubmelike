"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  BarChart3,
  Plus,
  Trash2,
  Save,
  Edit2,
  ArrowLeft,
  Loader2,
  MoreVertical,
  Archive,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Target,
  Clock,
} from "lucide-react"
import { toast } from "sonner"

interface ProjectPlanItem {
  id?: string
  orderNo: number
  name: string
  consultant: number
  target: number
  actual: number
}

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
  items: ProjectPlanItem[]
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

export default function ProjectPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [plan, setPlan] = useState<ProjectPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [items, setItems] = useState<ProjectPlanItem[]>([])
  const [newItem, setNewItem] = useState({ name: "", consultant: 0, target: 0, actual: 0 })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    fetchPlan()
  }, [resolvedParams.id])

  const fetchPlan = async () => {
    try {
      const res = await fetch(`/api/project-plans/${resolvedParams.id}`)
      if (res.ok) {
        const data = await res.json()
        setPlan(data)
        setItems(data.items || [])
      } else {
        toast.error("Plan bulunamadı")
        router.push("/forms/project-bar")
      }
    } catch (error) {
      console.error("Plan yüklenirken hata:", error)
      toast.error("Plan yüklenirken hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/project-plans/${resolvedParams.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      })

      if (res.ok) {
        const data = await res.json()
        setPlan(data)
        setItems(data.items || [])
        setEditMode(false)
        toast.success("Değişiklikler kaydedildi")
      } else {
        const error = await res.json()
        toast.error(error.error || "Kaydetme başarısız")
      }
    } catch (error) {
      console.error("Kaydetme hatası:", error)
      toast.error("Kaydetme sırasında hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/project-plans/${resolvedParams.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })

      if (res.ok) {
        const data = await res.json()
        setPlan(data)
        toast.success("Durum güncellendi")
      } else {
        toast.error("Durum güncellenemedi")
      }
    } catch (error) {
      console.error("Durum güncelleme hatası:", error)
      toast.error("Durum güncellenirken hata oluştu")
    }
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/project-plans/${resolvedParams.id}`, {
        method: "DELETE"
      })

      if (res.ok) {
        toast.success("Plan silindi")
        router.push("/forms/project-bar")
      } else {
        toast.error("Plan silinemedi")
      }
    } catch (error) {
      console.error("Silme hatası:", error)
      toast.error("Silme sırasında hata oluştu")
    }
  }

  const updateItem = (index: number, field: keyof ProjectPlanItem, value: string | number) => {
    setItems(items.map((item, i) =>
      i === index ? { ...item, [field]: field === "name" ? value : Number(value) } : item
    ))
  }

  const addItem = () => {
    if (!newItem.name.trim()) return
    setItems([...items, { ...newItem, orderNo: items.length + 1 }])
    setNewItem({ name: "", consultant: 0, target: 0, actual: 0 })
  }

  const deleteItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const getBarWidth = (value: number, itemMax: number) => {
    if (itemMax === 0) return 0
    return (value / itemMax) * 100
  }

  const totalConsultant = items.reduce((sum, d) => sum + d.consultant, 0)
  const totalTarget = items.reduce((sum, d) => sum + d.target, 0)
  const totalActual = items.reduce((sum, d) => sum + d.actual, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!plan) {
    return null
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/forms/project-bar")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <BarChart3 className="h-5 w-5 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{plan.title}</h1>
              <Badge variant="outline" className={statusColors[plan.status]}>
                {statusLabels[plan.status]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{plan.planNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => {
                setItems(plan.items || [])
                setEditMode(false)
              }}>
                İptal
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <Save className="h-4 w-4 mr-1" />
                Kaydet
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditMode(true)}
                disabled={plan.status !== "ACTIVE"}
              >
                <Edit2 className="h-4 w-4 mr-1" />
                Düzenle
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {plan.status === "ACTIVE" && (
                    <DropdownMenuItem onClick={() => handleStatusChange("COMPLETED")}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Tamamlandı Olarak İşaretle
                    </DropdownMenuItem>
                  )}
                  {plan.status !== "ARCHIVED" && (
                    <DropdownMenuItem onClick={() => handleStatusChange("ARCHIVED")}>
                      <Archive className="h-4 w-4 mr-2" />
                      Arşivle
                    </DropdownMenuItem>
                  )}
                  {plan.status === "ARCHIVED" && (
                    <DropdownMenuItem onClick={() => handleStatusChange("ACTIVE")}>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Aktif Yap
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Sil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {plan.description && (
        <p className="text-sm text-muted-foreground">{plan.description}</p>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded bg-rose-300" />
          <span>{plan.label1}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded bg-sky-300" />
          <span>{plan.label2}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded bg-emerald-300" />
          <span>{plan.label3}</span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-rose-50 border border-rose-200 rounded p-2">
          <p className="text-xs text-rose-500">{plan.label1}</p>
          <p className="text-xl font-bold text-rose-600">{totalConsultant}</p>
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded p-2">
          <p className="text-xs text-sky-500">{plan.label2}</p>
          <p className="text-xl font-bold text-sky-600">{totalTarget}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
          <p className="text-xs text-emerald-500">{plan.label3}</p>
          <p className="text-xl font-bold text-emerald-600">{totalActual}</p>
        </div>
      </div>

      {/* Karlılık Göstergeleri */}
      {items.length > 0 && totalConsultant > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Karlılık Göstergeleri</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Planlanan Tasarruf */}
              <div className="text-center p-2 rounded bg-violet-50 border border-violet-200">
                <TrendingDown className="h-4 w-4 mx-auto mb-1 text-violet-500" />
                <p className="text-[10px] text-violet-500 mb-0.5">Planlanan Tasarruf</p>
                <p className="text-lg font-bold text-violet-700">
                  {totalConsultant - totalTarget}
                </p>
                <p className="text-[10px] text-violet-500">
                  %{Math.round(((totalConsultant - totalTarget) / totalConsultant) * 100)} daha az
                </p>
              </div>

              {/* Hedef Kullanım */}
              <div className="text-center p-2 rounded bg-amber-50 border border-amber-200">
                <Target className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                <p className="text-[10px] text-amber-500 mb-0.5">Hedef Kullanım</p>
                <p className="text-lg font-bold text-amber-700">
                  %{totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0}
                </p>
                <p className="text-[10px] text-amber-500">
                  {totalActual} / {totalTarget} gün
                </p>
              </div>

              {/* Kalan Bütçe */}
              <div className={`text-center p-2 rounded ${
                totalTarget - totalActual >= 0
                  ? "bg-sky-50 border border-sky-200"
                  : "bg-rose-50 border border-rose-200"
              }`}>
                <Clock className="h-4 w-4 mx-auto mb-1 text-sky-500" />
                <p className={`text-[10px] mb-0.5 ${
                  totalTarget - totalActual >= 0 ? "text-sky-500" : "text-rose-500"
                }`}>Kalan Bütçe</p>
                <p className={`text-lg font-bold ${
                  totalTarget - totalActual >= 0 ? "text-sky-700" : "text-rose-700"
                }`}>
                  {totalTarget - totalActual}
                </p>
                <p className={`text-[10px] ${
                  totalTarget - totalActual >= 0 ? "text-sky-500" : "text-rose-500"
                }`}>
                  {totalTarget - totalActual >= 0 ? "gün kaldı" : "gün aşıldı"}
                </p>
              </div>

              {/* Gerçekleşen Tasarruf */}
              <div className="text-center p-2 rounded bg-emerald-50 border border-emerald-200">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                <p className="text-[10px] text-emerald-500 mb-0.5">Toplam Tasarruf</p>
                <p className="text-lg font-bold text-emerald-700">
                  {totalConsultant - totalActual}
                </p>
                <p className="text-[10px] text-emerald-500">
                  %{Math.round(((totalConsultant - totalActual) / totalConsultant) * 100)} tasarruf
                </p>
              </div>
            </div>

            {/* Genel İlerleme Barı */}
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Genel İlerleme</span>
                <span className="font-medium">
                  %{totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0}
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    totalTarget > 0 && totalActual / totalTarget > 1
                      ? "bg-rose-400"
                      : totalTarget > 0 && totalActual / totalTarget > 0.8
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                  style={{
                    width: `${Math.min(totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0, 100)}%`
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>0</span>
                <span>{plan.label2}: {totalTarget}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add New Item */}
      {editMode && (
        <Card className="border-dashed">
          <CardContent className="p-3">
            <div className="grid grid-cols-5 gap-2 items-end">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Madde Adı</label>
                <Input
                  value={newItem.name}
                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                  placeholder="Yeni madde..."
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-rose-500">{plan.label1}</label>
                <Input
                  type="number"
                  value={newItem.consultant}
                  onChange={(e) => setNewItem({...newItem, consultant: Number(e.target.value)})}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-sky-500">{plan.label2}</label>
                <Input
                  type="number"
                  value={newItem.target}
                  onChange={(e) => setNewItem({...newItem, target: Number(e.target.value)})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex gap-1">
                <div className="flex-1">
                  <label className="text-xs text-emerald-500">{plan.label3}</label>
                  <Input
                    type="number"
                    value={newItem.actual}
                    onChange={(e) => setNewItem({...newItem, actual: Number(e.target.value)})}
                    className="h-8 text-sm"
                  />
                </div>
                <Button size="sm" className="h-8 mt-4" onClick={addItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Henüz madde eklenmemiş</p>
              {!editMode && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setEditMode(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Madde Ekle
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          items.map((item, index) => {
            const itemMax = Math.max(item.consultant, item.target, item.actual)

            return (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-3">
                  {/* Item Header */}
                  <div className="flex items-center justify-between mb-2">
                    {editMode ? (
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(index, "name", e.target.value)}
                        className="h-7 text-sm font-medium max-w-[250px]"
                      />
                    ) : (
                      <span className="text-sm font-medium">{item.name}</span>
                    )}
                    {editMode && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-rose-400"
                        onClick={() => deleteItem(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {/* Bars */}
                  <div className="space-y-1">
                    {/* Consultant Bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-rose-500 w-16 truncate" title={plan.label1}>{plan.label1}</span>
                      <div className="flex-1 h-4 bg-rose-50 rounded overflow-hidden">
                        <div
                          className="h-full bg-rose-300 rounded transition-all"
                          style={{ width: `${getBarWidth(item.consultant, itemMax)}%` }}
                        />
                      </div>
                      {editMode ? (
                        <Input
                          type="number"
                          value={item.consultant}
                          onChange={(e) => updateItem(index, "consultant", e.target.value)}
                          className="h-6 w-14 text-xs text-right"
                        />
                      ) : (
                        <span className="text-xs text-rose-500 w-8 text-right">{item.consultant}</span>
                      )}
                    </div>

                    {/* Target Bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-sky-500 w-16 truncate" title={plan.label2}>{plan.label2}</span>
                      <div className="flex-1 h-4 bg-sky-50 rounded overflow-hidden">
                        <div
                          className="h-full bg-sky-300 rounded transition-all"
                          style={{ width: `${getBarWidth(item.target, itemMax)}%` }}
                        />
                      </div>
                      {editMode ? (
                        <Input
                          type="number"
                          value={item.target}
                          onChange={(e) => updateItem(index, "target", e.target.value)}
                          className="h-6 w-14 text-xs text-right"
                        />
                      ) : (
                        <span className="text-xs text-sky-500 w-8 text-right">{item.target}</span>
                      )}
                    </div>

                    {/* Actual Bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-500 w-16 truncate" title={plan.label3}>{plan.label3}</span>
                      <div className="flex-1 h-4 bg-emerald-50 rounded overflow-hidden">
                        <div
                          className="h-full bg-emerald-300 rounded transition-all"
                          style={{ width: `${getBarWidth(item.actual, itemMax)}%` }}
                        />
                      </div>
                      {editMode ? (
                        <Input
                          type="number"
                          value={item.actual}
                          onChange={(e) => updateItem(index, "actual", e.target.value)}
                          className="h-6 w-14 text-xs text-right"
                        />
                      ) : (
                        <span className="text-xs text-emerald-500 w-8 text-right">{item.actual}</span>
                      )}
                    </div>
                  </div>

                  {/* Progress indicator */}
                  {item.target > 0 && item.actual > 0 && (
                    <div className="mt-1 text-right">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1 py-0 ${
                          item.actual <= item.target
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                            : "bg-rose-50 text-rose-600 border-rose-200"
                        }`}
                      >
                        {Math.round((item.actual / item.target) * 100)}% kullanıldı
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Planı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{plan.title}&quot; planını silmek istediğinizden emin misiniz?
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
