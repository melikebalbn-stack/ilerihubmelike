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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Target,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  FileText,
  ClipboardList,
  Eye,
  Pencil,
  Trash2,
  ExternalLink,
  Users,
  X,
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"

const MEETING_STATUS: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  DRAFT: { label: "Taslak", color: "bg-gray-100 text-gray-700", icon: Clock },
  PLANNED: { label: "Planlandi", color: "bg-blue-100 text-blue-700", icon: Calendar },
  IN_PROGRESS: { label: "Devam Ediyor", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  COMPLETED: { label: "Tamamlandi", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  APPROVED: { label: "Onaylandi", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  CANCELLED: { label: "Iptal", color: "bg-red-100 text-red-700", icon: AlertTriangle },
}

interface Attendee {
  name: string
  title: string
  role: string
}

interface Decision {
  id?: string
  decision: string
  responsible: string
  dueDate: string | null
  status: string
  priority?: string
}

interface ActionItem {
  id?: string
  action: string
  responsible: string
  dueDate: string | null
  status: string
  notes: string | null
}

interface ManagementReview {
  id: string
  reviewNumber: string
  title: string
  meetingDate: string
  attendees: string[] | Attendee[]
  status: string
  chairperson: string | null
  // Girdiler
  auditResults: string | null
  riskAssessment: string | null
  incidentSummary: string | null
  improvementStatus: string | null
  resourceNeeds: string | null
  feedbacks: string | null
  objectivesStatus: string | null
  previousActions: string | null
  changes: string | null
  // Ciktilar
  decisions: Decision[]
  actionItems: ActionItem[]
  // Dokuman
  minutesUrl: string | null
  createdAt: string
}

interface ReviewDetail extends ManagementReview {
  attendees: Attendee[]
  approvedByName: string | null
  approvedAt: string | null
  updatedAt: string | null
}

export default function Iso27001ManagementReviewPage() {
  const { data: session } = useSession()
  const [reviews, setReviews] = useState<ManagementReview[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [selectedReview, setSelectedReview] = useState<ReviewDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")

  // Create form
  const [createForm, setCreateForm] = useState({
    title: "",
    meetingDate: "",
    attendees: "",
    chairperson: "",
  })

  // Edit form
  const [editForm, setEditForm] = useState({
    title: "",
    meetingDate: "",
    chairperson: "",
    status: "",
    auditResults: "",
    feedbacks: "",
    incidentSummary: "",
    riskAssessment: "",
    objectivesStatus: "",
    previousActions: "",
    changes: "",
    improvementStatus: "",
    resourceNeeds: "",
  })

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/iso27001/management-review")
      if (res.ok) {
        const data = await res.json()
        setReviews(data)
      }
    } catch (error) {
      console.error("Toplantilar yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  // Detay yukle
  const loadDetail = async (id: string) => {
    try {
      setDetailLoading(true)
      const res = await fetch(`/api/iso27001/management-review/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedReview(data)
        return data
      } else {
        toast.error("Toplanti detayi alinamadi")
        return null
      }
    } catch {
      toast.error("Bir hata olustu")
      return null
    } finally {
      setDetailLoading(false)
    }
  }

  // Detay ac
  const handleOpenDetail = async (id: string) => {
    const data = await loadDetail(id)
    if (data) setIsDetailDialogOpen(true)
  }

  // Duzenle ac
  const handleOpenEdit = async (id: string) => {
    const data = await loadDetail(id)
    if (data) {
      setEditForm({
        title: data.title || "",
        meetingDate: data.meetingDate ? new Date(data.meetingDate).toISOString().split("T")[0] : "",
        chairperson: data.chairperson || "",
        status: data.status || "DRAFT",
        auditResults: data.auditResults || "",
        feedbacks: data.feedbacks || "",
        incidentSummary: data.incidentSummary || "",
        riskAssessment: data.riskAssessment || "",
        objectivesStatus: data.objectivesStatus || "",
        previousActions: data.previousActions || "",
        changes: data.changes || "",
        improvementStatus: data.improvementStatus || "",
        resourceNeeds: data.resourceNeeds || "",
      })
      setIsEditDialogOpen(true)
    }
  }

  // Tutanak onizle
  const handlePreview = (url: string) => {
    setPreviewUrl(url)
    setIsPreviewOpen(true)
  }

  // Yeni toplanti olustur
  const handleCreate = async () => {
    if (!createForm.title || !createForm.meetingDate) {
      toast.error("Baslik ve toplanti tarihi zorunludur")
      return
    }
    try {
      setSaving(true)
      const res = await fetch("/api/iso27001/management-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          attendees: createForm.attendees.split(",").map(a => a.trim()).filter(Boolean),
        }),
      })
      if (res.ok) {
        toast.success("Toplanti olusturuldu")
        setIsCreateDialogOpen(false)
        setCreateForm({ title: "", meetingDate: "", attendees: "", chairperson: "" })
        fetchReviews()
      } else {
        const error = await res.json()
        toast.error(error.error || "Toplanti olusturulamadi")
      }
    } catch {
      toast.error("Bir hata olustu")
    } finally {
      setSaving(false)
    }
  }

  // Toplanti guncelle
  const handleUpdate = async () => {
    if (!selectedReview) return
    try {
      setSaving(true)
      const res = await fetch(`/api/iso27001/management-review/${selectedReview.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        toast.success("Toplanti guncellendi")
        setIsEditDialogOpen(false)
        fetchReviews()
      } else {
        const error = await res.json()
        toast.error(error.error || "Guncellenemedi")
      }
    } catch {
      toast.error("Bir hata olustu")
    } finally {
      setSaving(false)
    }
  }

  // Toplanti sil
  const handleDelete = async (id: string) => {
    if (!confirm("Bu toplantiyi silmek istediginize emin misiniz?")) return
    try {
      setDeleting(true)
      const res = await fetch(`/api/iso27001/management-review/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success("Toplanti silindi")
        setIsDetailDialogOpen(false)
        fetchReviews()
      } else {
        toast.error("Silinemedi")
      }
    } catch {
      toast.error("Bir hata olustu")
    } finally {
      setDeleting(false)
    }
  }

  const stats = useMemo(() => ({
    total: reviews.length,
    draft: reviews.filter(r => r.status === "DRAFT").length,
    completed: reviews.filter(r => r.status === "COMPLETED" || r.status === "APPROVED").length,
    thisYear: reviews.filter(r => new Date(r.meetingDate).getFullYear() === new Date().getFullYear()).length,
  }), [reviews])

  const getAttendeeName = (att: string | Attendee): string => {
    if (typeof att === "string") return att
    return att.name || ""
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Yonetim Gozden Gecirme
          </h1>
          <p className="text-muted-foreground">
            ISO 27001 Yonetim Gozden Gecirme Toplantilari (Madde 9.3)
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Toplanti
        </Button>
      </div>

      {/* Istatistikler */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Toplam Toplanti</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
            <p className="text-sm text-muted-foreground">Taslak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-sm text-muted-foreground">Tamamlanan</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{stats.thisYear}</div>
            <p className="text-sm text-muted-foreground">Bu Yil</p>
          </CardContent>
        </Card>
      </div>

      {/* ISO 27001 Bilgi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ISO 27001 Yonetim Gozden Gecirme Gereksinimleri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Girdi Konulari (Madde 9.3)
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Onceki yonetim gozden gecirmelerinden alinan aksiyonlarin durumu</li>
                <li>BGYS ile ilgili ic ve dis konulardaki degisiklikler</li>
                <li>Uygunsuzluklar ve duzeltici faaliyetler dahil BGYS performansi</li>
                <li>Izleme ve olcum sonuclari</li>
                <li>Denetim sonuclari</li>
                <li>Bilgi guvenligi hedeflerinin yerine getirilmesi</li>
                <li>Ilgili taraflardan geri bildirimler</li>
                <li>Risk degerlendirme sonuclari ve risk isleme planinin durumu</li>
                <li>Surekli iyilestirme firsatlari</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-green-600" />
                Cikti Konulari
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Surekli iyilestirme firsatlari ile ilgili kararlar</li>
                <li>BGYS&apos;de yapilmasi gereken degisiklikler</li>
                <li>Kaynak ihtiyaclari</li>
                <li>Aksiyon kalemleri ve sorumlular</li>
                <li>Sonraki gozden gecirme tarihi</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toplanti Listesi */}
      <Card>
        <CardHeader>
          <CardTitle>Yonetim Gozden Gecirme Toplantilari</CardTitle>
          <CardDescription>Tum yonetim gozden gecirme kayitlari</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Toplantilar yukleniyor...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Toplanti Bulunamadi</h3>
              <p className="text-muted-foreground mb-4">
                Henuz yonetim gozden gecirme toplantisi planlanmamis.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ilk Toplantiyi Planla
              </Button>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {reviews.map((review) => {
                const statusInfo = MEETING_STATUS[review.status] || MEETING_STATUS.DRAFT
                const StatusIcon = statusInfo.icon

                return (
                  <AccordionItem key={review.id} value={review.id} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-4 text-left w-full">
                        <Badge variant="outline" className="font-mono text-xs">
                          {review.reviewNumber}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{review.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(review.meetingDate), "d MMMM yyyy", { locale: tr })}
                            {review.chairperson && ` — Baskan: ${review.chairperson}`}
                          </p>
                        </div>
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        {/* Katilimcilar */}
                        {review.attendees && review.attendees.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" /> Katilimcilar
                            </Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {review.attendees.map((att, i) => (
                                <Badge key={i} variant="outline">{getAttendeeName(att)}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Ozet bilgiler */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {review.auditResults && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Denetim Sonuclari</Label>
                              <p className="text-sm line-clamp-2">{review.auditResults}</p>
                            </div>
                          )}
                          {review.riskAssessment && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Risk Durumu</Label>
                              <p className="text-sm line-clamp-2">{review.riskAssessment}</p>
                            </div>
                          )}
                          {review.incidentSummary && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Olay Ozeti</Label>
                              <p className="text-sm line-clamp-2">{review.incidentSummary}</p>
                            </div>
                          )}
                          {review.resourceNeeds && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Kaynak Ihtiyaclari</Label>
                              <p className="text-sm line-clamp-2">{review.resourceNeeds}</p>
                            </div>
                          )}
                        </div>

                        {/* Kararlar */}
                        {review.decisions && review.decisions.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Kararlar ({review.decisions.length})</Label>
                            <ul className="text-sm mt-1 space-y-1">
                              {review.decisions.slice(0, 3).map((d, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CheckCircle2 className="h-3 w-3 mt-1 text-green-600 shrink-0" />
                                  <span className="line-clamp-1">{d.decision}</span>
                                </li>
                              ))}
                              {review.decisions.length > 3 && (
                                <li className="text-xs text-muted-foreground">
                                  +{review.decisions.length - 3} karar daha...
                                </li>
                              )}
                            </ul>
                          </div>
                        )}

                        {/* Butonlar */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDetail(review.id)}
                            disabled={detailLoading}
                          >
                            {detailLoading ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Eye className="h-3 w-3 mr-1" />
                            )}
                            Detay
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(review.id)}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Duzenle
                          </Button>
                          {review.minutesUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePreview(review.minutesUrl!)}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Tutanak Onizle
                            </Button>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* ========== YENI TOPLANTI DIALOG ========== */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Yonetim Gozden Gecirme Toplantisi</DialogTitle>
            <DialogDescription>
              Yeni bir yonetim gozden gecirme toplantisi planlayin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Toplanti Basligi *</Label>
              <Input
                value={createForm.title}
                onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ornegin: 2026 Q1 Yonetim Gozden Gecirme"
              />
            </div>
            <div className="space-y-2">
              <Label>Toplanti Tarihi *</Label>
              <Input
                type="date"
                value={createForm.meetingDate}
                onChange={(e) => setCreateForm(prev => ({ ...prev, meetingDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Toplanti Baskani</Label>
              <Input
                value={createForm.chairperson}
                onChange={(e) => setCreateForm(prev => ({ ...prev, chairperson: e.target.value }))}
                placeholder="Ornegin: Halit Ileri"
              />
            </div>
            <div className="space-y-2">
              <Label>Katilimcilar</Label>
              <Input
                value={createForm.attendees}
                onChange={(e) => setCreateForm(prev => ({ ...prev, attendees: e.target.value }))}
                placeholder="Virgul ile ayirin: Genel Mudur, IT Muduru, BGYS Temsilcisi"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Iptal
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Olustur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== DETAY DIALOG ========== */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedReview && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl">{selectedReview.title}</DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="font-mono">{selectedReview.reviewNumber}</Badge>
                      <span>{format(new Date(selectedReview.meetingDate), "d MMMM yyyy", { locale: tr })}</span>
                      <Badge className={(MEETING_STATUS[selectedReview.status] || MEETING_STATUS.DRAFT).color}>
                        {(MEETING_STATUS[selectedReview.status] || MEETING_STATUS.DRAFT).label}
                      </Badge>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Toplanti Bilgileri */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Toplanti Baskani</Label>
                    <p className="text-sm font-medium">{selectedReview.chairperson || "-"}</p>
                  </div>
                  {selectedReview.approvedByName && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Onaylayan</Label>
                      <p className="text-sm font-medium">{selectedReview.approvedByName}</p>
                      {selectedReview.approvedAt && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(selectedReview.approvedAt), "d MMMM yyyy", { locale: tr })}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Katilimcilar */}
                {selectedReview.attendees && selectedReview.attendees.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      <Users className="h-3 w-3 inline mr-1" />
                      Katilimcilar ({selectedReview.attendees.length})
                    </Label>
                    <div className="border rounded-lg divide-y">
                      {selectedReview.attendees.map((att, i) => (
                        <div key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                          <span className="font-medium">{att.name}</span>
                          <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            {att.title && <span>{att.title}</span>}
                            {att.role && <Badge variant="outline" className="text-xs">{att.role}</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Girdiler */}
                <div>
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Gozden Gecirme Girdileri
                  </h4>
                  <div className="space-y-3">
                    {selectedReview.previousActions && (
                      <DetailField label="Onceki Aksiyonlarin Durumu" value={selectedReview.previousActions} />
                    )}
                    {selectedReview.changes && (
                      <DetailField label="Ic/Dis Degisiklikler" value={selectedReview.changes} />
                    )}
                    {selectedReview.auditResults && (
                      <DetailField label="Denetim Sonuclari" value={selectedReview.auditResults} />
                    )}
                    {selectedReview.objectivesStatus && (
                      <DetailField label="Hedeflerin Durumu" value={selectedReview.objectivesStatus} />
                    )}
                    {selectedReview.riskAssessment && (
                      <DetailField label="Risk Degerlendirme" value={selectedReview.riskAssessment} />
                    )}
                    {selectedReview.incidentSummary && (
                      <DetailField label="Olay Ozeti" value={selectedReview.incidentSummary} />
                    )}
                    {selectedReview.feedbacks && (
                      <DetailField label="Geri Bildirimler" value={selectedReview.feedbacks} />
                    )}
                    {selectedReview.improvementStatus && (
                      <DetailField label="Iyilestirme Durum" value={selectedReview.improvementStatus} />
                    )}
                    {!selectedReview.previousActions && !selectedReview.auditResults && !selectedReview.riskAssessment && !selectedReview.incidentSummary && !selectedReview.feedbacks && !selectedReview.improvementStatus && !selectedReview.objectivesStatus && !selectedReview.changes && (
                      <p className="text-sm text-muted-foreground italic">Girdi bilgisi girilmemis</p>
                    )}
                  </div>
                </div>

                {/* Kararlar */}
                {selectedReview.decisions && selectedReview.decisions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-green-600" />
                      Kararlar ({selectedReview.decisions.length})
                    </h4>
                    <div className="border rounded-lg divide-y">
                      {selectedReview.decisions.map((d, i) => (
                        <div key={i} className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{d.decision}</p>
                            {d.priority && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {d.priority}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            {d.responsible && <span>Sorumlu: {d.responsible}</span>}
                            {d.dueDate && <span>Termin: {d.dueDate}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Aksiyon Kalemleri */}
                {selectedReview.actionItems && selectedReview.actionItems.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4 text-orange-600" />
                      Aksiyon Kalemleri ({selectedReview.actionItems.length})
                    </h4>
                    <div className="border rounded-lg divide-y">
                      {selectedReview.actionItems.map((a, i) => (
                        <div key={i} className="p-3">
                          <p className="text-sm font-medium">{a.action}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            {a.responsible && <span>Sorumlu: {a.responsible}</span>}
                            {a.dueDate && <span>Termin: {a.dueDate}</span>}
                            {a.status && <Badge variant="outline" className="text-xs">{a.status}</Badge>}
                          </div>
                          {a.notes && <p className="text-xs text-muted-foreground mt-1">{a.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Kaynak Ihtiyaclari */}
                {selectedReview.resourceNeeds && (
                  <DetailField label="Kaynak Ihtiyaclari" value={selectedReview.resourceNeeds} />
                )}
              </div>

              {/* Alt butonlar */}
              <DialogFooter className="mt-6 flex-row gap-2">
                {selectedReview.minutesUrl && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDetailDialogOpen(false)
                      handlePreview(selectedReview.minutesUrl!)
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Tutanak Onizle
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailDialogOpen(false)
                    handleOpenEdit(selectedReview.id)
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Duzenle
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(selectedReview.id)}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                  Sil
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ========== DUZENLEME DIALOG ========== */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Toplantiyi Duzenle</DialogTitle>
            <DialogDescription>
              {selectedReview?.reviewNumber} - {selectedReview?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {/* Temel Bilgiler */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Toplanti Basligi *</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Toplanti Tarihi *</Label>
                <Input
                  type="date"
                  value={editForm.meetingDate}
                  onChange={(e) => setEditForm(prev => ({ ...prev, meetingDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Toplanti Baskani</Label>
                <Input
                  value={editForm.chairperson}
                  onChange={(e) => setEditForm(prev => ({ ...prev, chairperson: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Durum</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.status}
                  onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="DRAFT">Taslak</option>
                  <option value="COMPLETED">Tamamlandi</option>
                  <option value="APPROVED">Onaylandi</option>
                </select>
              </div>
            </div>

            {/* Girdi Konulari */}
            <div>
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2 border-b pb-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Gozden Gecirme Girdileri (Madde 9.3)
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Onceki Aksiyonlarin Durumu</Label>
                  <Textarea
                    value={editForm.previousActions}
                    onChange={(e) => setEditForm(prev => ({ ...prev, previousActions: e.target.value }))}
                    rows={2}
                    placeholder="Onceki toplantida alinan kararlarin/aksiyonlarin mevcut durumu..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Ic/Dis Degisiklikler</Label>
                  <Textarea
                    value={editForm.changes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, changes: e.target.value }))}
                    rows={2}
                    placeholder="BGYS ile ilgili ic ve dis konulardaki degisiklikler..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Denetim Sonuclari</Label>
                  <Textarea
                    value={editForm.auditResults}
                    onChange={(e) => setEditForm(prev => ({ ...prev, auditResults: e.target.value }))}
                    rows={2}
                    placeholder="Ic ve dis denetim sonuclari..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Hedeflerin Durumu</Label>
                  <Textarea
                    value={editForm.objectivesStatus}
                    onChange={(e) => setEditForm(prev => ({ ...prev, objectivesStatus: e.target.value }))}
                    rows={2}
                    placeholder="Bilgi guvenligi hedeflerinin yerine getirilme durumu..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Risk Degerlendirme</Label>
                  <Textarea
                    value={editForm.riskAssessment}
                    onChange={(e) => setEditForm(prev => ({ ...prev, riskAssessment: e.target.value }))}
                    rows={2}
                    placeholder="Risk degerlendirme sonuclari ve risk isleme planinin durumu..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Olay Ozeti</Label>
                  <Textarea
                    value={editForm.incidentSummary}
                    onChange={(e) => setEditForm(prev => ({ ...prev, incidentSummary: e.target.value }))}
                    rows={2}
                    placeholder="Bilgi guvenligi olaylari ozeti..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Geri Bildirimler</Label>
                  <Textarea
                    value={editForm.feedbacks}
                    onChange={(e) => setEditForm(prev => ({ ...prev, feedbacks: e.target.value }))}
                    rows={2}
                    placeholder="Ilgili taraflardan gelen geri bildirimler..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Iyilestirme Durumu</Label>
                  <Textarea
                    value={editForm.improvementStatus}
                    onChange={(e) => setEditForm(prev => ({ ...prev, improvementStatus: e.target.value }))}
                    rows={2}
                    placeholder="Surekli iyilestirme firsatlari..."
                  />
                </div>
              </div>
            </div>

            {/* Cikti - Kaynak Ihtiyaci */}
            <div>
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2 border-b pb-2">
                <ClipboardList className="h-4 w-4 text-green-600" />
                Cikti Konulari
              </h4>
              <div className="space-y-2">
                <Label className="text-xs">Kaynak Ihtiyaclari</Label>
                <Textarea
                  value={editForm.resourceNeeds}
                  onChange={(e) => setEditForm(prev => ({ ...prev, resourceNeeds: e.target.value }))}
                  rows={2}
                  placeholder="Ek kaynak talepleri..."
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Iptal
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== TUTANAK ONIZLEME DIALOG ========== */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-5xl h-[90vh] p-0 gap-0">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="font-medium text-sm">Toplanti Tutanagi</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(previewUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Yeni Sekmede Ac
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPreviewOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <iframe
            src={previewUrl}
            className="w-full flex-1 border-0"
            title="Toplanti Tutanagi Onizleme"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Detay alani yardimci bileşeni
function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm mt-1 whitespace-pre-wrap">{value}</p>
    </div>
  )
}
