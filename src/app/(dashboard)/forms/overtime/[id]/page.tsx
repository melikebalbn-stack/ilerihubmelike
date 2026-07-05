"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect as Select } from "@/components/ui/select"
import { Clock, ArrowLeft, Check, X, MessageSquare, Loader2, Users, Send, FlaskConical, Plus, Trash2, Search, Pencil, Save } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { formatVardiyaHafta } from "@/lib/vardiya-hafta"
import { toast } from "sonner"
import { MESAI_TURLERI, OVERTIME_STATUS_LABELS, OVERTIME_STATUS_COLORS } from "@/lib/overtime-constants"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { apiFetch } from "@/lib/api-fetch"
import { useDepartments } from "@/lib/use-departments"
import { useSession } from "next-auth/react"

interface Personnel {
  id: string
  personnelId: string | null
  workDepartment: string
  serviceRoute: string | null
  targetProduction: string | null
  hedefAdet: number | null
  gerceklesenAdet: number | null
  gerceklesenNote: string | null
  mesaiNedeni: string | null
  personnel: {
    id: string
    sicilNo: string
    adSoyad: string
    bolum: string
    gorev: string
    telefon: string | null
    serviceRoute: string | null
  } | null
}

interface Approval {
  id: string
  step: number
  role: string
  decision: "APPROVED" | "REJECTED" | "RETURNED" | "FORWARDED" | null
  comment: string | null
  decidedAt: string | null
  forwardToGM: boolean
  approver: {
    id: string
    name: string
    email: string
    department: string | null
    jobTitle: string | null
  } | null
  // Çift-onaycı: adım eskale olduysa yedek onaycı (asıl onaycıyla birlikte onaylayabilir).
  escalatedTo: {
    id: string
    name: string
    email: string
  } | null
}

interface OvertimeFormDetail {
  id: string
  formNo: string
  formTipi?: "MESAI" | "VARDIYA"
  overtimeType: "SATURDAY" | "SUNDAY" | "WEEKDAY_EXTRA" | "HOLIDAY"
  date: string
  vardiyaHaftaMi?: boolean
  isFullDay: boolean
  startTime: string | null
  endTime: string | null
  description: string | null
  status: string
  currentStep: number
  sendToGM: boolean
  createdAt: string
  createdBy: {
    id: string
    name: string
    email: string
    department: string | null
    jobTitle: string | null
  }
  personnel: Personnel[]
  approvals: Approval[]
  // Gerçekleşen adet satır-bazlı yetki: kullanıcının omurga bölümleri.
  // null = tüm bölümler (admin/report.all); [adlar] = sadece o bölümler; [] = hiçbiri.
  currentUserAllowedDepts: string[] | null
}

function getOvertimeTypeInfo(type: string) {
  return MESAI_TURLERI.find((m) => m.value === type)
}

function pName(p: Personnel): string {
  return p.personnel?.adSoyad || "—"
}
function pSicilNo(p: Personnel): string {
  return p.personnel?.sicilNo || "—"
}
function pTelefon(p: Personnel): string {
  return p.personnel?.telefon || "—"
}
function pBolum(p: Personnel): string {
  return p.personnel?.bolum || "—"
}
function pGorev(p: Personnel): string {
  return p.personnel?.gorev || "—"
}

export default function OvertimeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const id = params.id as string
  const { departments } = useDepartments()

  const [form, setForm] = useState<OvertimeFormDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [comment, setComment] = useState("")
  const [forwardToGM, setForwardToGM] = useState(false)
  const [actionLoading, setActionLoading] = useState<"approve" | "reject" | "return" | "test" | null>(null)

  // Personnel editing state
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [allPersonnelItems, setAllPersonnelItems] = useState<{ id: string; sicilNo: string; adSoyad: string; bolum: string; gorev: string; serviceRoute: string | null; telefon: string | null }[]>([])
  const [personnelItemsLoading, setPersonnelItemsLoading] = useState(false)
  const [personnelSearch, setPersonnelSearch] = useState("")
  const [addWorkDept, setAddWorkDept] = useState("")
  const [addHedefAdet, setAddHedefAdet] = useState("")

  // Bölümler yüklenince varsayılan workDept seç
  useEffect(() => {
    if (!addWorkDept && departments.length > 0) {
      setAddWorkDept(departments[0])
    }
  }, [departments, addWorkDept])
  const [addingId, setAddingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Actual production editing state
  const [isAuthorizedUser, setIsAuthorizedUser] = useState(false)
  // Gerçekleşen adet satır-bazlı yetki — yalnız GET'ten set edilir; form mutasyonları
  // (add/remove/actual PUT yanıtları bu alanı taşımaz) bunu bozmasın diye ayrı state.
  // null = tüm bölümler (admin/report.all); [adlar] = sadece o bölümler; [] = hiçbiri.
  const [allowedDepts, setAllowedDepts] = useState<string[] | null>(null)
  const [editingActual, setEditingActual] = useState(false)
  const [actualValues, setActualValues] = useState<
    Record<string, { gerceklesenAdet: string; gerceklesenNote: string }>
  >({})
  const [savingActual, setSavingActual] = useState(false)

  const fetchAllPersonnelItems = useCallback(async () => {
    if (allPersonnelItems.length > 0) return
    setPersonnelItemsLoading(true)
    try {
      const res = await apiFetch("/api/overtime/personnel-list")
      if (res.__authHandled) return
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAllPersonnelItems(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Personel listesi yüklenemedi")
    } finally {
      setPersonnelItemsLoading(false)
    }
  }, [allPersonnelItems.length])

  async function handleAddPersonnel(personnelItemId: string) {
    setAddingId(personnelItemId)
    try {
      const targetPerson = allPersonnelItems.find((p) => p.id === personnelItemId)
      const res = await apiFetch(`/api/overtime/${id}/personnel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personnelId: personnelItemId,
          workDepartment: addWorkDept,
          serviceRoute: targetPerson?.serviceRoute || null,
          // FIX: sonradan eklenen personel için hedef adet (boşsa null).
          hedefAdet: addHedefAdet ? Number(addHedefAdet) : null,
        }),
      })
      if (res.__authHandled) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Personel eklenemedi")
      }
      const updated = await res.json()
      setForm(updated)
      setAddHedefAdet("")
      toast.success("Personel eklendi")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setAddingId(null)
    }
  }

  async function handleRemovePersonnel(personnelId: string) {
    if (!window.confirm("Bu personeli formdan çıkarmak istediğinize emin misiniz?")) return
    setRemovingId(personnelId)
    try {
      const res = await apiFetch(`/api/overtime/${id}/personnel`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personnelId }),
      })
      if (res.__authHandled) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Personel çıkarılamadı")
      }
      const updated = await res.json()
      setForm(updated)
      toast.success("Personel çıkarıldı")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setRemovingId(null)
    }
  }

  function startEditingActual() {
    if (!form) return
    const values: Record<
      string,
      { gerceklesenAdet: string; gerceklesenNote: string }
    > = {}
    form.personnel.forEach((p) => {
      values[p.id] = {
        gerceklesenAdet: p.gerceklesenAdet != null ? String(p.gerceklesenAdet) : "",
        gerceklesenNote: p.gerceklesenNote || "",
      }
    })
    setActualValues(values)
    setEditingActual(true)
  }

  async function saveActualProduction() {
    if (!form) return
    setSavingActual(true)
    try {
      const personnelData = Object.entries(actualValues).map(([overtimePersonnelId, v]) => ({
        overtimePersonnelId,
        gerceklesenAdet: v.gerceklesenAdet,
        gerceklesenNote: v.gerceklesenNote,
      }))
      const res = await apiFetch(`/api/overtime/${id}/personnel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personnel: personnelData }),
      })
      if (res.__authHandled) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Güncelleme başarısız")
      }
      const updated = await res.json()
      setForm(updated)
      setEditingActual(false)
      toast.success("Gerçekleşen üretim bilgileri güncellendi")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setSavingActual(false)
    }
  }

  async function fetchForm() {
    try {
      setLoading(true)
      const res = await apiFetch(`/api/overtime/${id}`)
      if (res.__authHandled) return
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Form yüklenemedi")
      }
      const data = await res.json()
      setForm(data)
      setAllowedDepts(data.currentUserAllowedDepts ?? null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Form yüklenirken bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Check if current user is authorized for overtime forms
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await apiFetch("/api/overtime/authorized-users?check=me")
        if (res.__authHandled) return
        if (res.ok) {
          const data = await res.json()
          setIsAuthorizedUser(data.authorized === true)
        }
      } catch {
        // ignore
      }
    }
    checkAuth()
  }, [])

  async function handleSubmit() {
    if (!window.confirm("Formu onaya göndermek istediğinize emin misiniz?")) return
    try {
      setSubmitting(true)
      const res = await apiFetch(`/api/overtime/${id}/submit`, { method: "POST" })
      if (res.__authHandled) return
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Form gönderilemedi")
      }
      toast.success("Form onaya gönderildi")
      fetchForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprovalAction(decision: "APPROVED" | "REJECTED" | "RETURNED") {
    // RETURNED (düzeltmeye iade) için açıklama zorunlu
    if (decision === "RETURNED" && !comment.trim()) {
      toast.error("Düzeltme göndermek için açıklama girin")
      return
    }
    const label =
      decision === "APPROVED" ? "onaylamak" : decision === "REJECTED" ? "reddetmek" : "düzeltmeye göndermek"
    if (!window.confirm(`Bu formu ${label} istediğinize emin misiniz?`)) return

    try {
      setActionLoading(decision === "APPROVED" ? "approve" : decision === "REJECTED" ? "reject" : "return")
      const body: Record<string, unknown> = { decision }
      if (comment.trim()) body.comment = comment.trim()
      if (forwardToGM) body.forwardToGM = true

      const res = await apiFetch(`/api/overtime/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.__authHandled) return

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "İşlem başarısız")
      }

      toast.success(
        decision === "APPROVED"
          ? "Form onaylandı"
          : decision === "REJECTED"
          ? "Form reddedildi"
          : "Form düzeltmeye gönderildi"
      )
      setComment("")
      setForwardToGM(false)
      fetchForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleTestApproveAll() {
    if (!window.confirm("Test modu: Tüm onay adımları otomatik geçilecek. Emin misiniz?")) return

    try {
      setActionLoading("test")
      const res = await apiFetch(`/api/overtime/${id}/test-approve-all`, {
        method: "POST",
      })
      if (res.__authHandled) return

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "İşlem başarısız")
      }

      toast.success("Tüm onaylar test modunda geçildi")
      fetchForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setActionLoading(null)
    }
  }

  function canUserApprove(): boolean {
    if (!form || !session?.user?.email) return false
    if (form.status !== "PENDING" && form.status !== "IN_PROGRESS") return false

    // Karar verilmemiş ilk onay kaydını bul
    const currentApproval = form.approvals.find(
      (a) => a.decision === null
    )
    if (!currentApproval) return false

    if (currentApproval.approver?.email === session.user.email) return true
    // Çift-onaycı: adım eskale olduysa yedek onaycı da onaylayabilir.
    if (currentApproval.escalatedTo?.email === session.user.email) return true

    const userRole = (session.user as Record<string, unknown>).role as string | undefined
    if (userRole === "ADMIN" || userRole === "SUPER_ADMIN") return true

    return false
  }

  function isSuperAdmin(): boolean {
    const userRole = (session?.user as Record<string, unknown>)?.role as string | undefined
    return userRole === "SUPER_ADMIN"
  }

  function getCurrentStepForUser(): number | null {
    if (!form || !session?.user?.email) return null
    const currentApproval = form.approvals.find(
      (a) => a.decision === null
    )
    return currentApproval ? currentApproval.step : null
  }

  function isGMYStep(): boolean {
    const step = getCurrentStepForUser()
    return step === 6
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Yükleniyor...</span>
        </div>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Clock className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-lg">Form bulunamadı</p>
          <Link href="/forms/overtime">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Formlara Dön
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const typeInfo = getOvertimeTypeInfo(form.overtimeType)
  const isCreator = session?.user?.email === form.createdBy.email
  const showApprovalActions = canUserApprove()
  // Özellik B: kullanıcı bu adımı zaten karara bağladıysa (artık buton görünmez)
  // butonun yerine bilgi kartı göster. canUserApprove ile AYNI email-eşleşme deseni
  // (id/email karışımı yok); session email yoksa hesaplanmaz.
  const sessionEmail = session?.user?.email
  const myDecided = sessionEmail
    ? form.approvals.find(
        (a) =>
          a.approver?.email === sessionEmail &&
          a.decision !== null &&
          a.decidedAt
      )
    : undefined
  const showTestMode = isSuperAdmin() && ["PENDING", "IN_PROGRESS"].includes(form.status)
  const canEditPersonnel = showApprovalActions || (form.status === "DRAFT" && isCreator)
  const userRole = (session?.user as Record<string, unknown>)?.role as string | undefined
  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN"
  // Gerçekleşen adet yetkisi (backend PUT ile BİREBİR aynı mantık):
  // fullAccess = admin/creator/global-authorized/omurga-tümü (currentUserAllowedDepts===null).
  // Kısıtlı sorumlu → sadece kendi bölümü (allowedDeptSet) satırları.
  const normDept = (s?: string | null) => (s ?? "").trim().toLocaleUpperCase("tr-TR")
  const fullActualAccess = isCreator || isAdmin || isAuthorizedUser || allowedDepts === null
  const allowedDeptSet = new Set((allowedDepts ?? []).map(normDept))
  const canEditActualRow = (p: Personnel): boolean =>
    fullActualAccess || allowedDeptSet.has(normDept(p.workDepartment))
  const canEditActual =
    form.status === "APPROVED" && (fullActualAccess || form.personnel.some(canEditActualRow))
  const existingPersonnelIds = new Set(form.personnel.map((p) => p.personnelId).filter(Boolean))
  const filteredAddPersonnel = allPersonnelItems.filter((pi) => {
    if (existingPersonnelIds.has(pi.id)) return false
    const q = personnelSearch.toLowerCase()
    return !q || pi.adSoyad.toLowerCase().includes(q) || pi.sicilNo.toLowerCase().includes(q)
  })

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={form?.formTipi === "VARDIYA" ? "/forms/vardiya" : "/forms/overtime"}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {form?.formTipi === "VARDIYA" ? "Vardiya" : "Mesai"} Formları
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{form.formNo}</h1>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                OVERTIME_STATUS_COLORS[form.status] || "bg-gray-100 text-gray-700"
              }`}
            >
              {OVERTIME_STATUS_LABELS[form.status] || form.status}
            </span>
          </div>
        </div>
        {form.status === "DRAFT" && isCreator && (
          <div className="flex items-center gap-2">
            <Link href={`${form?.formTipi === "VARDIYA" ? "/forms/vardiya" : "/forms/overtime"}/${form.id}/edit`}>
              <Button variant="outline" size="sm">
                Düzenle
              </Button>
            </Link>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Onaya Gönder
            </Button>
          </div>
        )}
      </div>

      {/* Form Info Card */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Form Bilgileri</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
          <div>
            <p className="text-sm text-muted-foreground">Mesai Türü</p>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1 ${
                typeInfo?.color || "bg-gray-100 text-gray-800"
              }`}
            >
              {typeInfo?.label || form.overtimeType}
            </span>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{form.vardiyaHaftaMi ? "Vardiya Haftası" : "Tarih"}</p>
            <p className="font-medium mt-1">
              {form.vardiyaHaftaMi
                ? formatVardiyaHafta(form.date)
                : format(new Date(form.date), "dd MMMM yyyy EEEE", { locale: tr })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Çalışma Şekli</p>
            <p className="font-medium mt-1">
              {form.isFullDay
                ? "Tam Gün"
                : `${form.startTime || "—"} - ${form.endTime || "—"}`}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Oluşturan</p>
            <p className="font-medium mt-1">{form.createdBy.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Departman</p>
            <p className="font-medium mt-1">{form.createdBy.department || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Oluşturulma Tarihi</p>
            <p className="font-medium mt-1">
              {format(new Date(form.createdAt), "dd MMM yyyy HH:mm", { locale: tr })}
            </p>
          </div>
          {form.description && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-sm text-muted-foreground">Açıklama</p>
              <p className="font-medium mt-1">{form.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Personnel Table Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              Personel Listesi ({form.personnel.length} kişi)
            </h2>
          </div>
          {canEditPersonnel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddPanel(!showAddPanel)
                if (!showAddPanel) fetchAllPersonnelItems()
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Personel Ekle
            </Button>
          )}
        </div>

        {/* Add Personnel Panel */}
        {showAddPanel && canEditPersonnel && (
          <div className="mb-4 border rounded-lg p-4 bg-muted/30 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="İsim veya sicil no ile ara..."
                  value={personnelSearch}
                  onChange={(e) => setPersonnelSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={addWorkDept}
                onChange={(e) => setAddWorkDept(e.target.value)}
                className="w-48"
              >
                {departments.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="Hedef Adet"
                value={addHedefAdet}
                onChange={(e) => setAddHedefAdet(e.target.value)}
                className="w-32"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddPanel(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto border rounded-md bg-background">
              {personnelItemsLoading ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Yükleniyor...
                </div>
              ) : filteredAddPersonnel.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  {personnelSearch ? "Sonuç bulunamadı" : "Eklenecek personel yok"}
                </div>
              ) : (
                filteredAddPersonnel.slice(0, 50).map((pi) => (
                  <div
                    key={pi.id}
                    className="flex items-center justify-between px-3 py-2 border-b last:border-0 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{pi.adSoyad}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {pi.bolum} {pi.gorev ? `/ ${pi.gorev}` : ""}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">{pi.sicilNo}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-green-600 hover:text-green-800 hover:bg-green-50 h-8 px-2 flex-shrink-0"
                      onClick={() => handleAddPersonnel(pi.id)}
                      disabled={addingId !== null}
                    >
                      {addingId === pi.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">#</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Sicil No</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Personel Adı</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Telefon</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Departman</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Mesai Nedeni</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Mesai Yapacak Bölüm</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Servis Güzergahı</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Hedef Üretim</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Hedef Adet</th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    Gerçekleşen Adet
                    {canEditActual && !editingActual && (
                      <button
                        onClick={startEditingActual}
                        className="text-blue-500 hover:text-blue-700"
                        title="Düzenle"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {editingActual && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={saveActualProduction}
                          disabled={savingActual}
                          className="text-green-600 hover:text-green-800"
                          title="Kaydet"
                        >
                          {savingActual ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => setEditingActual(false)}
                          className="text-red-500 hover:text-red-700"
                          title="İptal"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </th>
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Açıklama</th>
                {canEditPersonnel && (
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground w-16"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {form.personnel.map((p, index) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-3 px-2 text-muted-foreground">{index + 1}</td>
                  <td className="py-3 px-2 font-mono text-xs">{pSicilNo(p)}</td>
                  <td className="py-3 px-2 font-medium">{pName(p)}</td>
                  <td className="py-3 px-2 text-xs">{pTelefon(p)}</td>
                  <td className="py-3 px-2">{pBolum(p)}</td>
                  <td className="py-3 px-2">{p.mesaiNedeni || pGorev(p)}</td>
                  <td className="py-3 px-2">{p.workDepartment}</td>
                  <td className="py-3 px-2">{p.serviceRoute || "—"}</td>
                  <td className="py-3 px-2">{p.targetProduction || "—"}</td>
                  <td className="py-3 px-2">{p.hedefAdet != null ? p.hedefAdet : "—"}</td>
                  <td className="py-3 px-2">
                    {editingActual && canEditActualRow(p) ? (
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={actualValues[p.id]?.gerceklesenAdet || ""}
                        onChange={(e) =>
                          setActualValues((prev) => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], gerceklesenAdet: e.target.value },
                          }))
                        }
                        placeholder="Ör: 42"
                        className="h-8 w-24 text-sm"
                      />
                    ) : p.gerceklesenAdet != null ? (
                      p.gerceklesenAdet
                    ) : form.status === "APPROVED" ? (
                      <span className="text-muted-foreground italic">Henüz girilmedi</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 px-2">
                    {editingActual && canEditActualRow(p) ? (
                      <Input
                        value={actualValues[p.id]?.gerceklesenNote || ""}
                        onChange={(e) =>
                          setActualValues((prev) => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], gerceklesenNote: e.target.value },
                          }))
                        }
                        placeholder="Açıklama (ör. tezgah arızası)"
                        className="h-8 w-40 text-sm"
                      />
                    ) : (
                      p.gerceklesenNote || "—"
                    )}
                  </td>
                  {canEditPersonnel && (
                    <td className="py-3 px-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleRemovePersonnel(p.id)}
                        disabled={removingId !== null}
                        title="Personeli çıkar"
                      >
                        {removingId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Timeline Card */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-6">Onay Süreci</h2>
        <div className="relative">
          {[...form.approvals]
            .sort((a, b) => a.step - b.step)
            .map((approval, index, sortedApprovals) => {
            // Timeline GERÇEK onay zincirinden çizilir: etiket = approval.role (stored),
            // sıra = approval.step. Statik APPROVAL_CHAIN step→başlık template'i KULLANILMAZ
            // (eski sıra ile etiket kaymasına yol açıyordu).
            const firstPendingApproval = sortedApprovals.find((a) => a.decision === null)
            const isCurrentStep = firstPendingApproval ? firstPendingApproval.id === approval.id : false
            const isPending =
              (form.status === "PENDING" || form.status === "IN_PROGRESS") && isCurrentStep
            const isDecided = approval.decision !== null && approval.decision !== undefined
            const isApproved = approval.decision === "APPROVED"
            const isRejected = approval.decision === "REJECTED"

            let circleColor = "bg-gray-200 text-gray-500"
            if (isApproved) circleColor = "bg-green-500 text-white"
            else if (isRejected) circleColor = "bg-red-500 text-white"
            else if (isPending) circleColor = "bg-blue-500 text-white"

            // Görsel sıra: ardışık 1..N (gerçek step boşlukları 1,2,5,7 gösterilmez)
            const displayNo = index + 1
            const isLast = index === sortedApprovals.length - 1

            return (
              <div key={approval.id} className="relative flex gap-4">
                {/* Vertical line */}
                {!isLast && (
                  <div
                    className={`absolute left-5 top-10 w-0.5 h-full ${
                      isApproved ? "bg-green-300" : "bg-gray-200"
                    }`}
                  />
                )}

                {/* Step circle */}
                <div
                  className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 text-sm font-bold ${circleColor}`}
                >
                  {isApproved ? (
                    <Check className="h-5 w-5" />
                  ) : isRejected ? (
                    <X className="h-5 w-5" />
                  ) : (
                    displayNo
                  )}
                </div>

                {/* Step content */}
                <div className="pb-8 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">
                      {approval.role}
                    </p>
                    {isDecided && approval && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          isApproved
                            ? "bg-green-100 text-green-700"
                            : isRejected
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {approval.decision === "APPROVED" && "Onaylandı"}
                        {approval.decision === "REJECTED" && "Reddedildi"}
                        {approval.decision === "RETURNED" && "Düzeltmeye Gönderildi"}
                        {approval.decision === "FORWARDED" && "Yönlendirildi"}
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-blue-600">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                        </span>
                        Onay bekliyor
                      </span>
                    )}
                  </div>

                  {isDecided && approval?.approver && (
                    <div className="mt-1 text-sm text-muted-foreground">
                      <span>{approval.approver.name}</span>
                      {approval.decidedAt && (
                        <span className="ml-2">
                          — {format(new Date(approval.decidedAt), "dd MMM yyyy HH:mm", { locale: tr })}
                        </span>
                      )}
                    </div>
                  )}

                  {isDecided && approval?.comment && (
                    <div className="mt-2 flex items-start gap-2 text-sm bg-muted/50 rounded-md p-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-muted-foreground">{approval.comment}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Approval Action Card */}
      {showApprovalActions && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Onay İşlemi</h2>

          {/* Vardiya Faz 2: GM adımı + VARDIYA + 10+ kişi → dinamik servis notu (N güncel) */}
          {form.formTipi === "VARDIYA" &&
            form.personnel.length > 10 &&
            form.approvals.find((a) => a.decision === null)?.role?.trim() === "Genel Müdür" && (
              <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900">
                <AlertTitle>Servis Bilgisi</AlertTitle>
                <AlertDescription className="text-amber-800">
                  Vardiya 10 kişiyi geçtiği için servis ayarlanacaktır. Vardiya&apos;da {form.personnel.length} kişi olacaktır.
                </AlertDescription>
              </Alert>
            )}

          {isGMYStep() && (
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={forwardToGM}
                onChange={(e) => setForwardToGM(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">Genel Müdür onayına da gönder</span>
            </label>
          )}

          <div className="mb-4">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Yorum ekleyin (düzeltme göndermek için zorunlu)..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => handleApprovalAction("APPROVED")}
              disabled={actionLoading !== null}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {actionLoading === "approve" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Onayla
            </Button>
            <Button
              onClick={() => handleApprovalAction("REJECTED")}
              disabled={actionLoading !== null}
              variant="destructive"
            >
              {actionLoading === "reject" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Reddet
            </Button>
            <Button
              onClick={() => handleApprovalAction("RETURNED")}
              disabled={actionLoading !== null}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {actionLoading === "return" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4 mr-2" />
              )}
              Düzeltme Gönder
            </Button>
          </div>
        </div>
      )}

      {/* Özellik B: kendi kararını vermiş kullanıcıya buton yerine bilgi kartı.
          showApprovalActions FALSE (artık sıradaki onaycı değil) + kendi kararı varsa. */}
      {!showApprovalActions &&
        myDecided &&
        (myDecided.decision === "APPROVED" || myDecided.decision === "REJECTED") && (
          <div
            className={`rounded-lg border p-4 ${
              myDecided.decision === "APPROVED"
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-center gap-2">
              {myDecided.decision === "APPROVED" ? (
                <Check className="h-5 w-5 text-green-600" />
              ) : (
                <X className="h-5 w-5 text-red-600" />
              )}
              <p
                className={`text-sm font-medium ${
                  myDecided.decision === "APPROVED"
                    ? "text-green-800"
                    : "text-red-800"
                }`}
              >
                {myDecided.decision === "APPROVED"
                  ? `Bu formu ${format(new Date(myDecided.decidedAt!), "dd MMM yyyy HH:mm", { locale: tr })} tarihinde onayladınız.`
                  : `Bu formu ${format(new Date(myDecided.decidedAt!), "dd MMM yyyy HH:mm", { locale: tr })} tarihinde reddettiniz.`}
              </p>
            </div>
            {myDecided.comment && (
              <p className="text-xs text-muted-foreground mt-2 ml-7">
                Notunuz: {myDecided.comment}
              </p>
            )}
          </div>
        )}

      {/* Test Mode Card - Only for SUPER_ADMIN */}
      {showTestMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                Test Modu
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Tüm onay adımlarını otomatik olarak geçer. Sadece test amaçlıdır.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={handleTestApproveAll}
              disabled={actionLoading !== null}
            >
              {actionLoading === "test" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4 mr-2" />
              )}
              Tümünü Onayla (Test)
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
