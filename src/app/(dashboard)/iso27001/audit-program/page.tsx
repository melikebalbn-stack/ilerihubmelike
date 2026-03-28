"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Calendar,
  Shield,
  Users,
  ClipboardList,
  FileText,
  CheckCircle2,
  Plus,
  Loader2,
  Award,
  Target,
  ExternalLink,
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"

interface Auditor {
  id: string
  name: string
  role: string
  title: string | null
  certifications: string[]
  experienceYears: number | null
  email: string | null
  sortOrder: number
}

interface PlanItem {
  id: string
  itemNumber: string
  auditArea: string
  scope: string | null
  plannedDate: string | null
  leadAuditorName: string
  duration: string | null
  status: string
  auditId: string | null
  sortOrder: number
}

interface AuditProgram {
  id: string
  programNumber: string
  title: string
  revision: string
  publishDate: string
  year: number
  periodStart: string
  periodEnd: string
  periodLabel: string | null
  purpose: string | null
  auditApproach: string[]
  status: string
  preparedByName: string
  preparedByTitle: string | null
  reviewedByName: string | null
  reviewedByTitle: string | null
  reviewedAt: string | null
  approvedByName: string | null
  approvedByTitle: string | null
  approvedAt: string | null
  createdAt: string
  auditors: Auditor[]
  planItems: PlanItem[]
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Taslak", variant: "secondary" },
  PUBLISHED: { label: "Yayınlandı", variant: "outline" },
  APPROVED: { label: "Onaylandı", variant: "default" },
  ARCHIVED: { label: "Arşivlendi", variant: "destructive" },
}

const PLAN_STATUS_COLORS: Record<string, string> = {
  "Planlandı": "bg-blue-100 text-blue-800",
  "Tamamlandı": "bg-green-100 text-green-800",
  "İptal": "bg-red-100 text-red-800",
}

export default function AuditProgramPage() {
  const { data: session } = useSession()
  const [programs, setPrograms] = useState<AuditProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<string>("all")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Create form
  const [formData, setFormData] = useState({
    programNumber: "",
    title: "",
    revision: "Rev.01",
    publishDate: "",
    year: new Date().getFullYear(),
    periodStart: "",
    periodEnd: "",
    periodLabel: "",
    purpose: "",
    preparedByName: "",
    preparedByTitle: "",
    approvedByName: "",
    approvedByTitle: "",
  })

  const fetchPrograms = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedYear !== "all") {
        params.set("year", selectedYear)
      }
      const res = await fetch(`/api/iso27001/audit-program?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPrograms(data)
      }
    } catch {
      toast.error("Programlar yüklenemedi")
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => {
    fetchPrograms()
  }, [fetchPrograms])

  const handleCreate = async () => {
    if (!formData.title || !formData.year || !formData.publishDate || !formData.preparedByName) {
      toast.error("Zorunlu alanları doldurun")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/iso27001/audit-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          periodStart: formData.periodStart || `${formData.year}-01-01`,
          periodEnd: formData.periodEnd || `${formData.year}-12-31`,
        }),
      })
      if (res.ok) {
        toast.success("Program oluşturuldu")
        setCreateDialogOpen(false)
        fetchPrograms()
        setFormData({
          programNumber: "",
          title: "",
          revision: "Rev.01",
          publishDate: "",
          year: new Date().getFullYear(),
          periodStart: "",
          periodEnd: "",
          periodLabel: "",
          purpose: "",
          preparedByName: "",
          preparedByTitle: "",
          approvedByName: "",
          approvedByTitle: "",
        })
      } else {
        const err = await res.json()
        toast.error(err.error || "Oluşturulamadı")
      }
    } catch {
      toast.error("Bir hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateStatus = async (programId: string, status: string) => {
    try {
      const res = await fetch(`/api/iso27001/audit-program/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "APPROVED" ? { approvedAt: new Date().toISOString() } : {}),
          ...(status === "PUBLISHED" ? { reviewedAt: new Date().toISOString() } : {}),
        }),
      })
      if (res.ok) {
        toast.success("Durum güncellendi")
        fetchPrograms()
      }
    } catch {
      toast.error("Güncelleme hatası")
    }
  }

  const getStatusBadge = (status: string) => {
    const s = STATUS_LABELS[status] || { label: status, variant: "secondary" as const }
    return <Badge variant={s.variant}>{s.label}</Badge>
  }

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-7 w-7 text-blue-600" />
            İç Denetim Programı
          </h1>
          <p className="text-gray-500 mt-1">
            ISO 27001 iç denetim planlama ve yıllık program yönetimi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full sm:w-[130px]">
              <SelectValue placeholder="Yıl" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Program
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : programs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Calendar className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700">Henüz program yok</h3>
            <p className="text-gray-500 mt-1">Yeni bir iç denetim programı oluşturun</p>
            <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Program Oluştur
            </Button>
          </CardContent>
        </Card>
      ) : (
        programs.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            onStatusUpdate={handleUpdateStatus}
            getStatusBadge={getStatusBadge}
          />
        ))
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni İç Denetim Programı</DialogTitle>
            <DialogDescription>
              Yeni bir yıllık iç denetim programı oluşturun
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Program Numarası</Label>
                <Input
                  placeholder="BGYS-DNT-001"
                  value={formData.programNumber}
                  onChange={(e) => setFormData({ ...formData, programNumber: e.target.value })}
                />
              </div>
              <div>
                <Label>Yıl *</Label>
                <Input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || currentYear })}
                />
              </div>
            </div>
            <div>
              <Label>Başlık *</Label>
              <Input
                placeholder="2025 Yılı İç Denetim Programı"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Revizyon</Label>
                <Input
                  value={formData.revision}
                  onChange={(e) => setFormData({ ...formData, revision: e.target.value })}
                />
              </div>
              <div>
                <Label>Yayın Tarihi *</Label>
                <Input
                  type="date"
                  value={formData.publishDate}
                  onChange={(e) => setFormData({ ...formData, publishDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Dönem Etiketi</Label>
              <Input
                placeholder="Ocak - Aralık 2025"
                value={formData.periodLabel}
                onChange={(e) => setFormData({ ...formData, periodLabel: e.target.value })}
              />
            </div>
            <div>
              <Label>Amaç ve Kapsam</Label>
              <Textarea
                rows={3}
                placeholder="Bu program, İleri Group BGYS kapsamında..."
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Hazırlayan *</Label>
                <Input
                  placeholder="Ad Soyad"
                  value={formData.preparedByName}
                  onChange={(e) => setFormData({ ...formData, preparedByName: e.target.value })}
                />
              </div>
              <div>
                <Label>Hazırlayan Ünvanı</Label>
                <Input
                  placeholder="BGYS Sorumlusu"
                  value={formData.preparedByTitle}
                  onChange={(e) => setFormData({ ...formData, preparedByTitle: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Onaylayan</Label>
                <Input
                  placeholder="Ad Soyad"
                  value={formData.approvedByName}
                  onChange={(e) => setFormData({ ...formData, approvedByName: e.target.value })}
                />
              </div>
              <div>
                <Label>Onaylayan Ünvanı</Label>
                <Input
                  placeholder="Genel Müdür"
                  value={formData.approvedByTitle}
                  onChange={(e) => setFormData({ ...formData, approvedByTitle: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Program Card Component
function ProgramCard({
  program,
  onStatusUpdate,
  getStatusBadge,
}: {
  program: AuditProgram
  onStatusUpdate: (id: string, status: string) => void
  getStatusBadge: (status: string) => React.ReactNode
}) {
  const completedCount = program.planItems.filter((p) => p.status === "Tamamlandı").length
  const totalCount = program.planItems.length

  return (
    <div className="space-y-4">
      {/* Program Bilgileri */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Shield className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <CardTitle className="text-lg">{program.title}</CardTitle>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                  <span>{program.programNumber}</span>
                  <span>|</span>
                  <span>{program.revision}</span>
                  <span>|</span>
                  <span>{program.periodLabel || `${program.year}`}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(program.status)}
              {program.status === "DRAFT" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStatusUpdate(program.id, "APPROVED")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Onayla
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Doküman Bilgileri */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-500 font-medium">Doküman No</p>
              <p className="text-sm font-semibold">{program.programNumber}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Revizyon</p>
              <p className="text-sm font-semibold">{program.revision}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Yayın Tarihi</p>
              <p className="text-sm font-semibold">
                {format(new Date(program.publishDate), "d MMMM yyyy", { locale: tr })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Denetim Dönemi</p>
              <p className="text-sm font-semibold">{program.periodLabel || `${program.year}`}</p>
            </div>
          </div>

          {/* Amaç ve Kapsam */}
          {program.purpose && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4" />
                Amaç ve Kapsam
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed pl-6">
                {program.purpose}
              </p>
            </div>
          )}

          {/* Denetim Yaklaşımı */}
          {program.auditApproach.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                <Target className="h-4 w-4" />
                Denetim Yaklaşımı
              </h4>
              <ul className="list-disc list-inside space-y-1 pl-6">
                {program.auditApproach.map((item, i) => (
                  <li key={i} className="text-sm text-gray-600">{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* İlerleme */}
          {totalCount > 0 && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-blue-700">
                    Denetim İlerlemesi
                  </span>
                  <span className="text-sm font-bold text-blue-800">
                    {completedCount}/{totalCount}
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${(completedCount / totalCount) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Denetçi Yetkinlikleri */}
      {program.auditors.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-600" />
              Denetçi Yetkinlikleri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Denetçi</TableHead>
                  <TableHead>Yetkinlik</TableHead>
                  <TableHead>Sertifika</TableHead>
                  <TableHead className="text-center">Deneyim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {program.auditors.map((auditor) => (
                  <TableRow key={auditor.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{auditor.name}</p>
                        {auditor.email && (
                          <p className="text-xs text-gray-500">{auditor.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{auditor.role}</p>
                        {auditor.title && auditor.title !== auditor.role && (
                          <p className="text-xs text-gray-500">{auditor.title}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {auditor.certifications.map((cert, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {cert}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {auditor.experienceYears ? `${auditor.experienceYears} yıl` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Denetim Planı */}
      {program.planItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-indigo-600" />
              {program.year} Yılı Denetim Planı
              <Badge variant="secondary" className="ml-2">
                {program.planItems.length} Denetim
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">No</TableHead>
                  <TableHead>Denetim Alanı</TableHead>
                  <TableHead>Kapsam</TableHead>
                  <TableHead>Planlanan Tarih</TableHead>
                  <TableHead>Baş Denetçi</TableHead>
                  <TableHead className="text-center">Süre</TableHead>
                  <TableHead className="text-center">Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {program.planItems.map((item) => (
                  <TableRow key={item.id} className={item.auditId ? "cursor-pointer hover:bg-blue-50" : ""}>
                    <TableCell className="font-bold text-blue-700">
                      {item.itemNumber}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{item.auditArea}</span>
                        {item.auditId && (
                          <ExternalLink className="h-3 w-3 text-blue-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                      {item.scope || "-"}
                    </TableCell>
                    <TableCell className="text-sm">{item.plannedDate || "-"}</TableCell>
                    <TableCell className="text-sm">{item.leadAuditorName}</TableCell>
                    <TableCell className="text-center text-sm">{item.duration || "-"}</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${PLAN_STATUS_COLORS[item.status] || "bg-gray-100 text-gray-800"}`}>
                        {item.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Onay Bölümü */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600" />
            Onay
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Hazırlayan */}
            <div className={`p-4 rounded-lg border-2 ${program.preparedByName ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Hazırlayan</p>
              {program.preparedByName ? (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-green-800">{program.preparedByName}</span>
                  </div>
                  {program.preparedByTitle && (
                    <p className="text-xs text-green-700 ml-6">{program.preparedByTitle}</p>
                  )}
                  <p className="text-xs text-green-600 ml-6 mt-1">
                    {format(new Date(program.publishDate), "dd.MM.yyyy", { locale: tr })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Bekliyor</p>
              )}
            </div>

            {/* Kontrol Eden */}
            <div className={`p-4 rounded-lg border-2 ${program.reviewedByName ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Kontrol Eden</p>
              {program.reviewedByName ? (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-green-800">{program.reviewedByName}</span>
                  </div>
                  {program.reviewedByTitle && (
                    <p className="text-xs text-green-700 ml-6">{program.reviewedByTitle}</p>
                  )}
                  {program.reviewedAt && (
                    <p className="text-xs text-green-600 ml-6 mt-1">
                      {format(new Date(program.reviewedAt), "dd.MM.yyyy", { locale: tr })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Bekliyor</p>
              )}
            </div>

            {/* Onaylayan */}
            <div className={`p-4 rounded-lg border-2 ${program.approvedByName ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Onaylayan</p>
              {program.approvedByName ? (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-green-800">{program.approvedByName}</span>
                  </div>
                  {program.approvedByTitle && (
                    <p className="text-xs text-green-700 ml-6">{program.approvedByTitle}</p>
                  )}
                  {program.approvedAt && (
                    <p className="text-xs text-green-600 ml-6 mt-1">
                      {format(new Date(program.approvedAt), "dd.MM.yyyy", { locale: tr })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Bekliyor</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
