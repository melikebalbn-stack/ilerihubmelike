"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { NativeSelect as Select } from "@/components/ui/select"
import { ArrowLeft, Save, Loader2, UserCheck, AlertTriangle, Info, X } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface UserOption {
  id: string
  name: string
  email: string
}

interface Position {
  id: string
  code: string
  title: string
  sortOrder: number
  isActive: boolean
  userId: string | null
  user: UserOption | null
  departments: string[]
}

export default function ApprovalPositionsPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([fetchPositions(), fetchUsers()])
      .finally(() => setLoading(false))
  }, [])

  async function fetchPositions() {
    try {
      const res = await fetch("/api/approval-positions")
      if (!res.ok) throw new Error("Pozisyonlar yüklenemedi")
      const data = await res.json()
      setPositions(data)
      const initial: Record<string, string> = {}
      for (const pos of data) {
        initial[pos.code] = pos.userId || ""
      }
      setAssignments(initial)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu")
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch("/api/users?source=db")
      if (!res.ok) throw new Error("Kullanıcılar yüklenemedi")
      const data = await res.json()
      const userList = Array.isArray(data) ? data : data.data || []
      setUsers(
        userList
          .filter((u: { isActive?: boolean }) => u.isActive !== false)
          .map((u: { id: string; name: string; email: string }) => ({
            id: u.id,
            name: u.name,
            email: u.email,
          }))
          .sort((a: UserOption, b: UserOption) => a.name.localeCompare(b.name, "tr"))
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kullanıcılar yüklenemedi")
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      const updates = Object.entries(assignments).map(([code, userId]) => ({
        code,
        userId: userId || null,
      }))

      const res = await fetch("/api/approval-positions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Kaydetme başarısız")
      }

      toast.success("Onay pozisyonları güncellendi")
      fetchPositions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  const unassignedCount = positions.filter(
    (p) => p.code !== "GM" && !assignments[p.code]
  ).length

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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Ayarlar
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <UserCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Onay Pozisyonları</h1>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Kaydet
        </Button>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Mesai Formu Onay Zinciri</p>
            <p className="mt-1">
              Mesai formu onay sürecinde her pozisyona bir kullanıcı atanmalıdır.
              <strong> Departman ataması olan pozisyonlar koşulludur</strong> — sadece o departmandan personel varsa onay sürecine dahil edilir.
              Departmanı boş olan pozisyonlar (İV, GMY, GM) tüm formlara dahil edilir.
            </p>
          </div>
        </div>
      </div>

      {/* Warning for unassigned */}
      {unassignedCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{unassignedCount}</strong> zorunlu pozisyona henüz kullanıcı atanmamış.
              Formlar onaya gönderilemez.
            </p>
          </div>
        </div>
      )}

      {/* Positions Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground w-12">#</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Pozisyon</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Kod</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[300px]">Atanmış Kişi</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Departmanlar</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground w-24">Durum</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const isGM = pos.code === "GM"
                const isAssigned = !!assignments[pos.code]
                const needsAssignment = !isGM && !isAssigned

                return (
                  <tr
                    key={pos.code}
                    className={`border-b last:border-0 hover:bg-muted/30 ${
                      needsAssignment ? "bg-amber-50/50" : ""
                    }`}
                  >
                    <td className="py-3 px-4 text-muted-foreground font-medium">
                      {pos.sortOrder}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pos.title}</span>
                        {isGM && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            opsiyonel
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{pos.code}</code>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Select
                          value={assignments[pos.code] || ""}
                          onChange={(e) =>
                            setAssignments((prev) => ({
                              ...prev,
                              [pos.code]: e.target.value,
                            }))
                          }
                          className="flex-1"
                        >
                          <option value="">-- Kullanıcı Seçin --</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </option>
                          ))}
                        </Select>
                        {isAssigned && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                            onClick={() =>
                              setAssignments((prev) => ({
                                ...prev,
                                [pos.code]: "",
                              }))
                            }
                            title="Atamayı kaldır"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {pos.departments && pos.departments.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {pos.departments.map((dept) => (
                            <span key={dept} className="inline-block bg-teal-50 text-teal-700 border border-teal-200 rounded px-1.5 py-0.5 text-[10px] font-medium">
                              {dept}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Tüm formlar (ortak)</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isAssigned ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                          Atandı
                        </span>
                      ) : isGM ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
                          Boş
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                          Atanmadı
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
