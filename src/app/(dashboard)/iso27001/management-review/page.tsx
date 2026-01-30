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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Target,
  Plus,
  Calendar,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ClipboardList,
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"

// Toplanti durumu
const MEETING_STATUS = {
  PLANNED: { label: "Planlandı", color: "bg-blue-100 text-blue-700", icon: Calendar },
  IN_PROGRESS: { label: "Devam Ediyor", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  COMPLETED: { label: "Tamamlandı", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  CANCELLED: { label: "Iptal", color: "bg-red-100 text-red-700", icon: AlertTriangle },
}

// Karar durumu
const DECISION_STATUS = {
  PENDING: { label: "Bekliyor", color: "bg-yellow-100 text-yellow-700" },
  IN_PROGRESS: { label: "Isleniyor", color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Tamamlandi", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Iptal", color: "bg-gray-100 text-gray-700" },
}

interface ManagementReview {
  id: string
  reviewNumber: string
  title: string
  description: string | null
  meetingDate: string
  attendees: string[]
  agenda: string[]
  status: string
  // Girdi konulari
  auditResults: string | null
  riskAssessment: string | null
  incidentSummary: string | null
  improvementStatus: string | null
  resourceNeeds: string | null
  policyChanges: string | null
  // Cikti konulari
  decisions: Decision[]
  actionItems: ActionItem[]
  nextReviewDate: string | null
  conclusion: string | null
  createdAt: string
}

interface Decision {
  id: string
  decision: string
  responsible: string
  dueDate: string | null
  status: string
}

interface ActionItem {
  id: string
  action: string
  responsible: string
  dueDate: string | null
  status: string
  notes: string | null
}

export default function Iso27001ManagementReviewPage() {
  const { data: session } = useSession()
  const [reviews, setReviews] = useState<ManagementReview[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    meetingDate: "",
    attendees: "",
    agenda: "",
  })

  // Toplantilari yukle
  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/iso27001/management-review")
      if (res.ok) {
        const data = await res.json()
        setReviews(data)
      }
    } catch (error) {
      console.error("Toplantılar yuklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  // Yeni toplanti olustur
  const handleCreate = async () => {
    if (!formData.title || !formData.meetingDate) {
      toast.error("Baslik ve toplanti tarihi zorunludur")
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/iso27001/management-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          attendees: formData.attendees.split(",").map(a => a.trim()).filter(Boolean),
          agenda: formData.agenda.split("\n").map(a => a.trim()).filter(Boolean),
        }),
      })

      if (res.ok) {
        toast.success("Toplanti olusturuldu")
        setIsCreateDialogOpen(false)
        setFormData({
          title: "",
          description: "",
          meetingDate: "",
          attendees: "",
          agenda: "",
        })
        fetchReviews()
      } else {
        const error = await res.json()
        toast.error(error.error || "Toplanti olusturulamadi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    } finally {
      setSaving(false)
    }
  }

  // Istatistikler
  const stats = useMemo(() => ({
    total: reviews.length,
    planned: reviews.filter(r => r.status === "PLANNED").length,
    completed: reviews.filter(r => r.status === "COMPLETED").length,
    thisYear: reviews.filter(r => new Date(r.meetingDate).getFullYear() === new Date().getFullYear()).length,
  }), [reviews])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Yonetim Gozden Gecirme
          </h1>
          <p className="text-muted-foreground">
            ISO 27001 Yonetim Gozden Gecirme Toplantiları
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
            <div className="text-2xl font-bold text-blue-600">{stats.planned}</div>
            <p className="text-sm text-muted-foreground">Planlanan</p>
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

      {/* Bilgilendirme */}
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
                <li>BGYS'de yapilmasi gereken degisiklikler</li>
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
          <CardTitle>Yonetim Gozden Gecirme Toplantiları</CardTitle>
          <CardDescription>Tum yonetim gozden gecirme kayitlari</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Toplantılar yukleniyor...</p>
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
                const statusInfo = MEETING_STATUS[review.status as keyof typeof MEETING_STATUS] || MEETING_STATUS.PLANNED
                const StatusIcon = statusInfo.icon

                return (
                  <AccordionItem key={review.id} value={review.id} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-4 text-left w-full">
                        <Badge variant="outline" className="font-mono">
                          {review.reviewNumber}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-medium">{review.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(review.meetingDate), "d MMMM yyyy", { locale: tr })}
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
                        {review.description && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Aciklama</Label>
                            <p className="text-sm">{review.description}</p>
                          </div>
                        )}

                        {review.attendees && review.attendees.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Katilimcilar</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {review.attendees.map((attendee, i) => (
                                <Badge key={i} variant="outline">{attendee}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {review.agenda && review.agenda.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Gundem</Label>
                            <ul className="text-sm list-disc list-inside mt-1">
                              {review.agenda.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {review.conclusion && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Sonuc</Label>
                            <p className="text-sm">{review.conclusion}</p>
                          </div>
                        )}

                        {review.nextReviewDate && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Sonraki Gozden Gecirme</Label>
                            <p className="text-sm">
                              {format(new Date(review.nextReviewDate), "d MMMM yyyy", { locale: tr })}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm">Detay</Button>
                          <Button variant="outline" size="sm">Duzenle</Button>
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

      {/* Yeni Toplanti Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
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
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ornegin: 2026 Q1 Yonetim Gozden Gecirme"
              />
            </div>

            <div className="space-y-2">
              <Label>Aciklama</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Toplanti hakkinda ek bilgiler..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Toplanti Tarihi *</Label>
              <Input
                type="date"
                value={formData.meetingDate}
                onChange={(e) => setFormData(prev => ({ ...prev, meetingDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Katilimcilar</Label>
              <Input
                value={formData.attendees}
                onChange={(e) => setFormData(prev => ({ ...prev, attendees: e.target.value }))}
                placeholder="Virgul ile ayirin: Genel Mudur, IT Muduru, BGYS Temsilcisi"
              />
            </div>

            <div className="space-y-2">
              <Label>Gundem Maddeleri</Label>
              <Textarea
                value={formData.agenda}
                onChange={(e) => setFormData(prev => ({ ...prev, agenda: e.target.value }))}
                placeholder="Her satira bir gundem maddesi yazin..."
                rows={4}
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
    </div>
  )
}
