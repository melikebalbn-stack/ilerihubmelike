"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect as Select } from "@/components/ui/select"
import { Clock, ChevronRight, ChevronLeft, Search, X, Users, Check, Save, Send, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BOLUMLER, SERVIS_GUZERGAHLARI, MESAI_TURLERI } from "@/lib/overtime-constants"
import { APPROVAL_CHAIN } from "@/lib/overtime-approval-chain"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  id: string
  name: string
  email: string
  department: string | null
  jobTitle: string | null
  serviceRoute: string | null
  mobilePhone: string | null
  employeeId: string | null
}

interface PersonnelDetail {
  workDepartment: string
  serviceRoute: string
  targetProduction: string
  actualProduction: string
}

type OvertimeType = "SATURDAY" | "SUNDAY" | "WEEKDAY_EXTRA" | "HOLIDAY"

const TYPE_CARD_COLORS: Record<OvertimeType, { idle: string; active: string }> = {
  SATURDAY: {
    idle: "border-blue-200 hover:border-blue-400 hover:bg-blue-50",
    active: "border-blue-500 bg-blue-50 ring-2 ring-blue-300",
  },
  SUNDAY: {
    idle: "border-purple-200 hover:border-purple-400 hover:bg-purple-50",
    active: "border-purple-500 bg-purple-50 ring-2 ring-purple-300",
  },
  WEEKDAY_EXTRA: {
    idle: "border-amber-200 hover:border-amber-400 hover:bg-amber-50",
    active: "border-amber-500 bg-amber-50 ring-2 ring-amber-300",
  },
  HOLIDAY: {
    idle: "border-red-200 hover:border-red-400 hover:bg-red-50",
    active: "border-red-500 bg-red-50 ring-2 ring-red-300",
  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewOvertimeFormPage() {
  const router = useRouter()

  // Wizard step
  const [step, setStep] = useState(1)

  // Step 1 state
  const [overtimeType, setOvertimeType] = useState<OvertimeType | "">("")
  const [date, setDate] = useState("")
  const [isFullDay, setIsFullDay] = useState(true)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [description, setDescription] = useState("")

  // Step 2 state
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("")
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [personnelDetails, setPersonnelDetails] = useState<Record<string, PersonnelDetail>>({})

  // Step 3 state
  const [sendToGM, setSendToGM] = useState(false)
  const [saving, setSaving] = useState(false)

  // Auto-switch to time range for weekday extra
  useEffect(() => {
    if (overtimeType === "WEEKDAY_EXTRA") {
      setIsFullDay(false)
      setStartTime("17:00")
      setEndTime("20:30")
    }
  }, [overtimeType])

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await fetch("/api/users?source=db")
      if (!res.ok) throw new Error("Kullanıcılar yüklenemedi")
      const data: User[] = await res.json()
      setUsers(data)
    } catch {
      toast.error("Personel listesi yüklenirken hata oluştu")
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Filtered user list
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchesDept = !departmentFilter || u.department === departmentFilter
    return matchesSearch && matchesDept
  })

  // Toggle user selection
  function toggleUser(user: User) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(user.id)) {
        next.delete(user.id)
        setPersonnelDetails((pd) => {
          const copy = { ...pd }
          delete copy[user.id]
          return copy
        })
      } else {
        next.add(user.id)
        setPersonnelDetails((pd) => ({
          ...pd,
          [user.id]: {
            workDepartment: user.department || BOLUMLER[0],
            serviceRoute: user.serviceRoute || "",
            targetProduction: "",
            actualProduction: "",
          },
        }))
      }
      return next
    })
  }

  function removeUser(userId: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      next.delete(userId)
      return next
    })
    setPersonnelDetails((pd) => {
      const copy = { ...pd }
      delete copy[userId]
      return copy
    })
  }

  function updateDetail(userId: string, field: keyof PersonnelDetail, value: string) {
    setPersonnelDetails((pd) => ({
      ...pd,
      [userId]: { ...pd[userId], [field]: value },
    }))
  }

  // Selected user objects in selection order
  const selectedUsers = users.filter((u) => selectedUserIds.has(u.id))

  // Current overtime type meta
  const currentTypeMeta = MESAI_TURLERI.find((t) => t.value === overtimeType)

  // Helpers
  const canProceedStep1 = overtimeType !== "" && date !== ""
  const canProceedStep2 = selectedUserIds.size > 0

  // ---------------------------------------------------------------------------
  // Save / Submit
  // ---------------------------------------------------------------------------

  async function handleSave(submit: boolean) {
    setSaving(true)
    try {
      const body = {
        overtimeType,
        date,
        isFullDay,
        startTime: isFullDay ? null : startTime,
        endTime: isFullDay ? null : endTime,
        description: description || null,
        sendToGM,
        personnel: selectedUsers.map((u) => ({
          userId: u.id,
          workDepartment: personnelDetails[u.id]?.workDepartment || BOLUMLER[0],
          serviceRoute: personnelDetails[u.id]?.serviceRoute || null,
          targetProduction: personnelDetails[u.id]?.targetProduction || null,
        })),
      }

      const res = await fetch("/api/overtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "Kaydetme başarısız")
      }

      const created = await res.json()

      if (submit) {
        const submitRes = await fetch(`/api/overtime/${created.id}/submit`, { method: "POST" })
        if (!submitRes.ok) {
          const submitErr = await submitRes.json().catch(() => null)
          throw new Error(submitErr?.error || "Onaya gönderme başarısız")
        }
        toast.success("Mesai formu onaya gönderildi")
      } else {
        toast.success("Mesai formu taslak olarak kaydedildi")
      }

      router.push("/forms/overtime")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bir hata oluştu"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Step Indicator
  // ---------------------------------------------------------------------------

  const steps = [
    { num: 1, label: "Bilgiler" },
    { num: 2, label: "Personel" },
    { num: 3, label: "Önizleme" },
  ]

  function StepIndicator() {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Clock className="h-6 w-6 text-teal-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">MESAİ FORMU</h1>
            <p className="text-sm text-gray-500">Fazla Mesai Talep Sistemi</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (s.num < step) setStep(s.num)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  step === s.num
                    ? "bg-teal-600 text-white"
                    : step > s.num
                      ? "bg-teal-100 text-teal-700 cursor-pointer hover:bg-teal-200"
                      : "bg-gray-100 text-gray-400"
                }`}
                disabled={s.num > step}
              >
                {step > s.num ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs">
                    {s.num}
                  </span>
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-gray-300" />
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Step 1: Mesai Bilgileri
  // ---------------------------------------------------------------------------

  function Step1() {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          Mesai formunu doldurmadan önce mesai türünü, tarihini ve saatlerini belirleyin.
        </div>

        {/* Overtime type cards */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Mesai Türü</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MESAI_TURLERI.map((t) => {
              const colors = TYPE_CARD_COLORS[t.value]
              const isActive = overtimeType === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setOvertimeType(t.value)}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    isActive ? colors.active : colors.idle
                  }`}
                >
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {/* Work mode toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Çalışma Modu</label>
          <div className="flex gap-2 mb-3">
            <Button
              type="button"
              variant={isFullDay ? "default" : "outline"}
              size="sm"
              onClick={() => setIsFullDay(true)}
              className={isFullDay ? "bg-teal-600 hover:bg-teal-700" : ""}
            >
              Tam Gün
            </Button>
            <Button
              type="button"
              variant={!isFullDay ? "default" : "outline"}
              size="sm"
              onClick={() => setIsFullDay(false)}
              className={!isFullDay ? "bg-teal-600 hover:bg-teal-700" : ""}
            >
              Saat Aralığı
            </Button>
          </div>
          {!isFullDay && (
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Başlangıç</label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-32"
                />
              </div>
              <span className="mt-5 text-gray-400">-</span>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bitiş</label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Açıklama <span className="text-gray-400 font-normal">(isteğe bağlı)</span>
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mesai sebebi veya ek bilgi..."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        {/* Next button */}
        <div className="flex justify-end">
          <Button
            onClick={() => setStep(2)}
            disabled={!canProceedStep1}
            className="bg-teal-600 hover:bg-teal-700"
          >
            Personel Seçimine Geç
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Step 2: Personel Seçimi
  // ---------------------------------------------------------------------------

  function Step2() {
    return (
      <div className="space-y-4">
        {/* Summary bar */}
        <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap items-center gap-3 text-sm">
          {currentTypeMeta && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${currentTypeMeta.color}`}>
              {currentTypeMeta.label}
            </span>
          )}
          <span className="text-gray-600">{date}</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">{isFullDay ? "Tam Gün" : `${startTime} - ${endTime}`}</span>
          <button
            onClick={() => setStep(1)}
            className="ml-auto text-teal-600 hover:text-teal-800 text-xs font-medium"
          >
            Değiştir
          </button>
        </div>

        {/* Two-panel layout */}
        <div className="grid lg:grid-cols-5 gap-4">
          {/* Left panel: Personnel selection */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Personel Seçimi
              </h2>
            </div>

            <div className="p-3 border-b space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="İsim veya email ile ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="">Tüm Bölümler</option>
                {BOLUMLER.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {usersLoading ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Yükleniyor...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  Sonuç bulunamadı
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.has(user.id)
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleUser(user)}
                      className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors ${
                        isSelected
                          ? "bg-teal-50 border-l-4 border-l-teal-500"
                          : "hover:bg-gray-50 border-l-4 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {user.department || "-"} {user.jobTitle ? `/ ${user.jobTitle}` : ""}
                          </p>
                          {user.serviceRoute && (
                            <p className="text-xs text-teal-600 truncate">
                              Servis: {user.serviceRoute}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-teal-600 flex-shrink-0 ml-2" />
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            <div className="p-3 border-t bg-gray-50 text-xs text-gray-500">
              {filteredUsers.length} personel · {selectedUserIds.size} seçili
            </div>
          </div>

          {/* Right panel: Selected personnel details */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">
                Seçili Personel ({selectedUserIds.size})
              </h2>
            </div>

            <div className="p-4 space-y-4 max-h-[32rem] overflow-y-auto">
              {selectedUsers.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                  Soldaki listeden personel seçin
                </div>
              ) : (
                selectedUsers.map((user) => {
                  const detail = personnelDetails[user.id]
                  if (!detail) return null
                  return (
                    <div
                      key={user.id}
                      className="border rounded-lg p-4 space-y-3 bg-gray-50/50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.department || "-"}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUser(user.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Kaldır
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Mesai Yapacak Bölüm
                          </label>
                          <Select
                            value={detail.workDepartment}
                            onChange={(e) => updateDetail(user.id, "workDepartment", e.target.value)}
                          >
                            {BOLUMLER.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Servis Güzergahı
                          </label>
                          <Select
                            value={detail.serviceRoute}
                            onChange={(e) => updateDetail(user.id, "serviceRoute", e.target.value)}
                          >
                            <option value="">Seçiniz...</option>
                            {SERVIS_GUZERGAHLARI.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Hedef Üretim
                          </label>
                          <Input
                            placeholder="Ör: KR09-8041-8042"
                            value={detail.targetProduction}
                            onChange={(e) => updateDetail(user.id, "targetProduction", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Gerçekleşen Üretim
                          </label>
                          <Input
                            placeholder="Mesai sonrası girilecek"
                            value={detail.actualProduction}
                            onChange={(e) => updateDetail(user.id, "actualProduction", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer buttons */}
            <div className="p-4 border-t flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Geri
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="bg-teal-600 hover:bg-teal-700"
              >
                Önizleme
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Step 3: Önizleme ve Onay
  // ---------------------------------------------------------------------------

  function Step3() {
    const visibleChain = sendToGM
      ? APPROVAL_CHAIN
      : APPROVAL_CHAIN.filter((s) => s.position !== "GM")

    return (
      <div className="space-y-4">
        {/* Preview header */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 p-5 text-white">
            <div className="flex flex-wrap items-center gap-3">
              {currentTypeMeta && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/20">
                  {currentTypeMeta.label}
                </span>
              )}
              <span className="text-sm opacity-90">{date}</span>
              <span className="text-sm opacity-70">|</span>
              <span className="text-sm opacity-90">
                {isFullDay ? "Tam Gün" : `${startTime} - ${endTime}`}
              </span>
            </div>
            {description && (
              <p className="mt-2 text-sm opacity-80">{description}</p>
            )}
          </div>

          {/* Personnel table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 w-10">#</th>
                  <th className="px-4 py-3">Sicil No</th>
                  <th className="px-4 py-3">Mesai Yapacak Bölüm</th>
                  <th className="px-4 py-3">Personel Adı</th>
                  <th className="px-4 py-3">Telefon</th>
                  <th className="px-4 py-3">Departman</th>
                  <th className="px-4 py-3">Ünvan</th>
                  <th className="px-4 py-3">Servis Güzergahı</th>
                  <th className="px-4 py-3">Hedef Üretim</th>
                </tr>
              </thead>
              <tbody>
                {selectedUsers.map((user, idx) => {
                  const detail = personnelDetails[user.id]
                  return (
                    <tr
                      key={user.id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                    >
                      <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{user.employeeId || "-"}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {detail?.workDepartment || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{user.name}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{user.mobilePhone || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{user.department || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{user.jobTitle || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{detail?.serviceRoute || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{detail?.targetProduction || "-"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Approval chain */}
        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Onay Süreci</h3>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            Form gönderildiğinde aşağıdaki sıraya göre onay sürecine girer.
          </div>

          <div className="flex flex-wrap items-center gap-2 py-2">
            {visibleChain.map((s, i) => (
              <div key={s.step} className="flex items-center gap-2">
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-xs font-medium text-teal-800 whitespace-nowrap">
                  {s.step}. {s.role}
                </div>
                {i < visibleChain.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendToGM}
              onChange={(e) => setSendToGM(e.target.checked)}
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700">Genel Müdür onayına da gönder</span>
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <Button variant="outline" onClick={() => setStep(2)}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Personel Düzenle
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              Taslak Kaydet
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              Onaya Gönder
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="py-6">
      {StepIndicator()}

      {step === 1 && Step1()}
      {step === 2 && Step2()}
      {step === 3 && Step3()}
    </div>
  )
}
