"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect as Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, Clock, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, Loader2, Users, CalendarDays, TrendingUp, Building2 } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { MESAI_TURLERI, OVERTIME_STATUS_LABELS, OVERTIME_STATUS_COLORS } from "@/lib/overtime-constants"
import { apiFetch } from "@/lib/api-fetch"
import { toast } from "sonner"

interface OvertimeForm {
  id: string
  formNo: string
  overtimeType: string
  date: string
  isFullDay: boolean
  startTime: string | null
  endTime: string | null
  description: string | null
  status: string
  currentStep: number
  sendToGM: boolean
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string; email: string; department: string | null }
  personnelCount: number
  currentApproval: {
    step: number
    role: string
    approverId: string
    approver: { id: string; name: string }
  } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface OvertimeStats {
  weeklyHours: number
  monthlyHours: number
  topDepartment: { name: string; hours: number }
}

const OVERTIME_TYPE_COLORS: Record<string, string> = {
  SATURDAY: "bg-blue-100 text-blue-800",
  SUNDAY: "bg-purple-100 text-purple-800",
  WEEKDAY_EXTRA: "bg-amber-100 text-amber-800",
  HOLIDAY: "bg-red-100 text-red-800",
}

// Vardiya Faz 1: mesai liste çekirdeği paylaşımlı. formTipi düz string prop (client component).
export type OvertimeListFormTipi = "MESAI" | "VARDIYA"

export default function OvertimeListView({ formTipi = "MESAI" }: { formTipi?: OvertimeListFormTipi }) {
  const isVardiya = formTipi === "VARDIYA"
  const basePath = isVardiya ? "/forms/vardiya" : "/forms/overtime"
  const kind = isVardiya ? "Vardiya" : "Mesai"
  const [forms, setForms] = useState<OvertimeForm[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 5, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [stats, setStats] = useState<OvertimeStats | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchForms = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append("page", String(page))
      params.append("limit", "5")
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (typeFilter !== "all") params.append("overtimeType", typeFilter)
      if (debouncedSearch) params.append("search", debouncedSearch)
      params.append("formTipi", formTipi)

      const res = await apiFetch(`/api/overtime?${params}`)
      if (res.__authHandled) return
      if (!res.ok) throw new Error("Veriler yüklenemedi")

      const response = await res.json()
      setForms(response.forms)
      setPagination(response.pagination)
    } catch {
      toast.error("Formlar yüklenirken bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, debouncedSearch, formTipi])

  useEffect(() => {
    fetchForms(1)
  }, [fetchForms])

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await apiFetch("/api/overtime/stats")
        if (res.__authHandled) return
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch {
        // Stats yüklenemezse sessizce devam et
      }
    }
    fetchStats()
  }, [])

  async function handleDelete(id: string) {
    if (!window.confirm("Bu mesai formunu silmek istediğinize emin misiniz?")) return
    try {
      const res = await apiFetch(`/api/overtime/${id}`, { method: "DELETE" })
      if (res.__authHandled) return
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Silme işlemi başarısız")
        return
      }
      toast.success("Mesai formu silindi")
      fetchForms(pagination.page)
    } catch {
      toast.error("Bir hata oluştu")
    }
  }

  function getOvertimeTypeLabel(type: string): string {
    const found = MESAI_TURLERI.find((m) => m.value === type)
    return found ? found.label : type
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Clock className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-xl lg:text-3xl font-bold">{kind} Formları</h1>
            <p className="text-muted-foreground">Fazla mesai taleplerini oluşturun ve takip edin</p>
          </div>
        </div>
        <Link href={`${basePath}/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Yeni {kind} Formu
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2.5">
                <CalendarDays className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Haftalık Mesai</p>
                <p className="text-2xl font-bold">
                  {stats ? `${stats.weeklyHours} saat` : "..."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2.5">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aylık Mesai</p>
                <p className="text-2xl font-bold">
                  {stats ? `${stats.monthlyHours} saat` : "..."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2.5">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En Çok Mesai Yapan Bölüm</p>
                <p className="text-lg font-bold truncate">
                  {stats ? stats.topDepartment.name : "..."}
                </p>
                {stats && stats.topDepartment.hours > 0 && (
                  <p className="text-xs text-muted-foreground">{stats.topDepartment.hours} saat</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Form no veya açıklama ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-[200px]"
            >
              <option value="all">Tümü</option>
              <option value="DRAFT">Taslak</option>
              <option value="PENDING">Onay Bekliyor</option>
              <option value="IN_PROGRESS">Onay Sürecinde</option>
              <option value="APPROVED">Onaylandı</option>
              <option value="REJECTED">Reddedildi</option>
              <option value="CANCELLED">İptal Edildi</option>
            </Select>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full sm:w-[220px]"
            >
              <option value="all">Tümü</option>
              {MESAI_TURLERI.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form No</TableHead>
                <TableHead>Mesai Türü</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Personel Sayısı</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Oluşturan</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">Yükleniyor...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : forms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Mesai formu bulunamadı</p>
                      <Link href={`${basePath}/new`}>
                        <Button variant="outline" size="sm" className="mt-2">
                          <Plus className="h-4 w-4 mr-2" />
                          İlk {kind} Formunu Oluştur
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                forms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell className="font-medium">{form.formNo}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${OVERTIME_TYPE_COLORS[form.overtimeType] || "bg-gray-100 text-gray-800"}`}>
                        {getOvertimeTypeLabel(form.overtimeType)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {format(new Date(form.date), "dd MMM yyyy", { locale: tr })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {form.personnelCount} kişi
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${OVERTIME_STATUS_COLORS[form.status] || "bg-gray-100 text-gray-700"}`}>
                        {OVERTIME_STATUS_LABELS[form.status] || form.status}
                      </span>
                    </TableCell>
                    <TableCell>{form.createdBy.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`${basePath}/${form.id}`}>
                          <Button variant="ghost" size="icon" title="Görüntüle">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {form.status === "DRAFT" && (
                          <>
                            <Link href={`${basePath}/${form.id}/edit`}>
                              <Button variant="ghost" size="icon" title="Düzenle">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Sil"
                              onClick={() => handleDelete(form.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Toplam {pagination.total} kayıt, Sayfa {pagination.page} / {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchForms(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Önceki
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchForms(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
            >
              Sonraki
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
