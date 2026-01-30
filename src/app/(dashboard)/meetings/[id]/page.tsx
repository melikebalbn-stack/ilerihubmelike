"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { UserSearchCombobox, ADUser } from "@/components/user-search-combobox"
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  FileText,
  User,
  Edit,
  Save,
  CheckCircle2,
  PlayCircle,
  XCircle,
  Check,
  X,
  FileDown,
  ClipboardList,
  MessageSquare,
  Target,
} from "lucide-react"

interface MeetingAttendee {
  id: string
  userId: string | null
  externalName: string | null
  externalEmail: string | null
  externalCompany: string | null
  externalTitle: string | null
  role: string
  inviteStatus: string
  attendanceStatus: string
  absenceReason: string | null
  arrivalTime: string | null
  departureTime: string | null
  user: {
    id: string
    name: string
    email: string
    department: string | null
    jobTitle: string | null
  } | null
}

interface MeetingAgendaItem {
  id: string
  orderNo: number
  title: string
  description: string | null
  presenterId: string | null
  presenterName: string | null
  plannedDuration: number | null
  actualDuration: number | null
  discussionNotes: string | null
  outcome: string | null
  outcomeNotes: string | null
  status: string
  presenter: {
    id: string
    name: string
  } | null
}

interface MeetingDecision {
  id: string
  decisionNumber: string
  title: string
  description: string | null
  responsibleId: string | null
  dueDate: string | null
  priority: string
  status: string
  completedAt: string | null
  notes: string | null
  responsible: {
    id: string
    name: string
    email: string
  } | null
}

interface Meeting {
  id: string
  meetingNumber: string
  title: string
  description: string | null
  meetingType: string
  scheduledDate: string
  startTime: string | null
  endTime: string | null
  location: string | null
  isOnline: boolean
  onlineLink: string | null
  status: string
  department: string | null
  openingRemarks: string | null
  closingRemarks: string | null
  generalNotes: string | null
  minutesApproved: boolean
  minutesApprovedAt: string | null
  organizer: {
    id: string
    name: string
    email: string
    department: string | null
    jobTitle: string | null
  }
  chairman: {
    id: string
    name: string
    email: string
    department: string | null
  } | null
  rapporteur: {
    id: string
    name: string
    email: string
    department: string | null
  } | null
  minutesApprovedBy: {
    id: string
    name: string
  } | null
  attendees: MeetingAttendee[]
  agendaItems: MeetingAgendaItem[]
  decisions: MeetingDecision[]
}

const meetingTypeLabels: Record<string, string> = {
  BOARD: "Yonetim Kurulu",
  DEPARTMENT: "Departman",
  PROJECT: "Proje",
  TRAINING: "Egitim",
  REVIEW: "Gozden Gecirme",
  AUDIT: "Denetim",
  CUSTOMER: "Musteri",
  SUPPLIER: "Tedarikci",
  SAFETY: "Guvenlik Komitesi",
  QUALITY: "Kalite",
  OTHER: "Diger",
}

const statusLabels: Record<string, string> = {
  PLANNED: "Planli",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandi",
  CANCELLED: "Iptal Edildi",
  POSTPONED: "Ertelendi",
}

const statusColors: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  POSTPONED: "bg-gray-100 text-gray-800",
}

const attendanceStatusLabels: Record<string, string> = {
  UNKNOWN: "Bilinmiyor",
  PRESENT: "Katildi",
  ABSENT: "Katilmadi",
  LATE: "Gec Geldi",
  LEFT_EARLY: "Erken Ayrildi",
}

const attendanceStatusColors: Record<string, string> = {
  UNKNOWN: "bg-gray-100 text-gray-800",
  PRESENT: "bg-green-100 text-green-800",
  ABSENT: "bg-red-100 text-red-800",
  LATE: "bg-yellow-100 text-yellow-800",
  LEFT_EARLY: "bg-orange-100 text-orange-800",
}

const agendaOutcomeLabels: Record<string, string> = {
  APPROVED: "Onaylandi",
  REJECTED: "Reddedildi",
  POSTPONED: "Ertelendi",
  NEEDS_REVIEW: "Inceleme Gerekiyor",
  NOTED: "Not Alindi",
}

const decisionPriorityLabels: Record<string, string> = {
  LOW: "Dusuk",
  MEDIUM: "Orta",
  HIGH: "Yuksek",
  URGENT: "Acil",
}

const decisionStatusLabels: Record<string, string> = {
  PENDING: "Bekliyor",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandi",
  CANCELLED: "Iptal Edildi",
  OVERDUE: "Gecikti",
}

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit states
  const [editingNotes, setEditingNotes] = useState(false)
  const [openingRemarks, setOpeningRemarks] = useState("")
  const [closingRemarks, setClosingRemarks] = useState("")
  const [generalNotes, setGeneralNotes] = useState("")

  // Agenda item edit
  const [editingAgendaId, setEditingAgendaId] = useState<string | null>(null)
  const [editingAgendaNotes, setEditingAgendaNotes] = useState("")
  const [editingAgendaOutcome, setEditingAgendaOutcome] = useState("")
  const [editingAgendaOutcomeNotes, setEditingAgendaOutcomeNotes] = useState("")

  // Decision dialog
  const [showDecisionDialog, setShowDecisionDialog] = useState(false)
  const [newDecisionTitle, setNewDecisionTitle] = useState("")
  const [newDecisionDescription, setNewDecisionDescription] = useState("")
  const [newDecisionResponsible, setNewDecisionResponsible] = useState<ADUser | null>(null)
  const [newDecisionDueDate, setNewDecisionDueDate] = useState("")
  const [newDecisionPriority, setNewDecisionPriority] = useState("MEDIUM")
  const [savingDecision, setSavingDecision] = useState(false)

  useEffect(() => {
    fetchMeeting()
  }, [resolvedParams.id])

  const fetchMeeting = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/meetings/${resolvedParams.id}`)
      if (res.ok) {
        const data = await res.json()
        setMeeting(data)
        setOpeningRemarks(data.openingRemarks || "")
        setClosingRemarks(data.closingRemarks || "")
        setGeneralNotes(data.generalNotes || "")
      } else {
        const errorData = await res.json().catch(() => ({}))
        if (res.status === 403) {
          toast.error(errorData.error || "Bu toplantıyı görüntüleme yetkiniz yok")
        } else if (res.status === 404) {
          toast.error("Toplantı bulunamadı")
        } else if (res.status === 401) {
          toast.error("Oturum süreniz dolmuş, lütfen tekrar giriş yapın")
        } else {
          toast.error(errorData.error || "Toplantı yüklenemedi")
        }
        router.push("/meetings")
      }
    } catch (error) {
      console.error("Toplanti yuklenirken hata:", error)
      toast.error("Toplanti yuklenemedi")
    } finally {
      setLoading(false)
    }
  }

  const updateMeetingStatus = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/meetings/${resolvedParams.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        toast.success("Toplanti durumu guncellendi")
        fetchMeeting()
      } else {
        toast.error("Durum guncellenemedi")
      }
    } catch (error) {
      console.error("Durum guncellenirken hata:", error)
      toast.error("Durum guncellenemedi")
    }
  }

  const saveNotes = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/meetings/${resolvedParams.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingRemarks,
          closingRemarks,
          generalNotes,
        }),
      })

      if (res.ok) {
        toast.success("Notlar kaydedildi")
        setEditingNotes(false)
        fetchMeeting()
      } else {
        toast.error("Notlar kaydedilemedi")
      }
    } catch (error) {
      console.error("Notlar kaydedilirken hata:", error)
      toast.error("Notlar kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  const updateAttendanceStatus = async (attendeeId: string, status: string) => {
    try {
      const res = await fetch(`/api/meetings/${resolvedParams.id}/attendees`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeId, attendanceStatus: status }),
      })

      if (res.ok) {
        toast.success("Katilim durumu guncellendi")
        fetchMeeting()
      } else {
        toast.error("Katilim durumu guncellenemedi")
      }
    } catch (error) {
      console.error("Katilim durumu guncellenirken hata:", error)
      toast.error("Katilim durumu guncellenemedi")
    }
  }

  const startEditingAgenda = (item: MeetingAgendaItem) => {
    setEditingAgendaId(item.id)
    setEditingAgendaNotes(item.discussionNotes || "")
    setEditingAgendaOutcome(item.outcome || "")
    setEditingAgendaOutcomeNotes(item.outcomeNotes || "")
  }

  const saveAgendaItem = async () => {
    if (!editingAgendaId) return

    try {
      const res = await fetch(`/api/meetings/${resolvedParams.id}/agenda-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              id: editingAgendaId,
              discussionNotes: editingAgendaNotes,
              outcome: editingAgendaOutcome || null,
              outcomeNotes: editingAgendaOutcomeNotes,
              status: editingAgendaOutcome ? "COMPLETED" : "IN_PROGRESS",
            },
          ],
        }),
      })

      if (res.ok) {
        toast.success("Gundem maddesi guncellendi")
        setEditingAgendaId(null)
        fetchMeeting()
      } else {
        toast.error("Gundem maddesi guncellenemedi")
      }
    } catch (error) {
      console.error("Gundem maddesi guncellenirken hata:", error)
      toast.error("Gundem maddesi guncellenemedi")
    }
  }

  const addDecision = async () => {
    if (!newDecisionTitle.trim()) {
      toast.error("Karar basligi zorunludur")
      return
    }

    setSavingDecision(true)
    try {
      const res = await fetch(`/api/meetings/${resolvedParams.id}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newDecisionTitle,
          description: newDecisionDescription || null,
          responsibleId: newDecisionResponsible?.id || null,
          dueDate: newDecisionDueDate
            ? new Date(newDecisionDueDate).toISOString()
            : null,
          priority: newDecisionPriority,
        }),
      })

      if (res.ok) {
        toast.success("Karar eklendi")
        setShowDecisionDialog(false)
        setNewDecisionTitle("")
        setNewDecisionDescription("")
        setNewDecisionResponsible(null)
        setNewDecisionDueDate("")
        setNewDecisionPriority("MEDIUM")
        fetchMeeting()
      } else {
        toast.error("Karar eklenemedi")
      }
    } catch (error) {
      console.error("Karar eklenirken hata:", error)
      toast.error("Karar eklenemedi")
    } finally {
      setSavingDecision(false)
    }
  }

  const approveMinutes = async () => {
    try {
      const res = await fetch(`/api/meetings/${resolvedParams.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutesApproved: true }),
      })

      if (res.ok) {
        toast.success("Tutanak onaylandi")
        fetchMeeting()
      } else {
        toast.error("Tutanak onaylanamadi")
      }
    } catch (error) {
      console.error("Tutanak onaylanirken hata:", error)
      toast.error("Tutanak onaylanamadi")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!meeting) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{meeting.title}</h1>
              <Badge className={statusColors[meeting.status]}>
                {statusLabels[meeting.status]}
              </Badge>
              {meeting.minutesApproved && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Tutanak Onaylı
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{meeting.meetingNumber}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {meeting.status !== "COMPLETED" && (
            <Button variant="outline" onClick={() => router.push(`/meetings/${meeting.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Duzenle
            </Button>
          )}
          {meeting.status === "PLANNED" && (
            <Button variant="outline" onClick={() => updateMeetingStatus("IN_PROGRESS")}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Basla
            </Button>
          )}
          {meeting.status === "IN_PROGRESS" && (
            <Button variant="outline" onClick={() => updateMeetingStatus("COMPLETED")}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Tamamla
            </Button>
          )}
          {meeting.status === "COMPLETED" && !meeting.minutesApproved && (
            <Button onClick={approveMinutes}>
              <Check className="h-4 w-4 mr-2" />
              Tutanagi Onayla
            </Button>
          )}
          <Button variant="outline" onClick={() => window.open(`/api/meetings/${meeting.id}/pdf`, '_blank')}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Detaylar</TabsTrigger>
          <TabsTrigger value="agenda">Gundem ({meeting.agendaItems.length})</TabsTrigger>
          <TabsTrigger value="attendees">Katilimcilar ({meeting.attendees.length})</TabsTrigger>
          <TabsTrigger value="decisions">Kararlar ({meeting.decisions.length})</TabsTrigger>
          <TabsTrigger value="minutes">Tutanak</TabsTrigger>
        </TabsList>

        {/* Detaylar Tab */}
        <TabsContent value="details" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Toplanti Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Tur</p>
                    <p className="font-medium">
                      {meetingTypeLabels[meeting.meetingType] || meeting.meetingType}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Departman</p>
                    <p className="font-medium">{meeting.department || "-"}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Tarih
                    </p>
                    <p className="font-medium">{formatDate(meeting.scheduledDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Saat
                    </p>
                    <p className="font-medium">
                      {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    {meeting.isOnline ? (
                      <>
                        <Video className="h-3 w-3" /> Online Link
                      </>
                    ) : (
                      <>
                        <MapPin className="h-3 w-3" /> Konum
                      </>
                    )}
                  </p>
                  <p className="font-medium">
                    {meeting.isOnline ? (
                      <a
                        href={meeting.onlineLink || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {meeting.onlineLink || "Link belirtilmemis"}
                      </a>
                    ) : (
                      meeting.location || "-"
                    )}
                  </p>
                </div>

                {meeting.description && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground">Aciklama</p>
                      <p className="text-sm">{meeting.description}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Yoneticiler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Organizator</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{meeting.organizer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {meeting.organizer.department || meeting.organizer.email}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground">Toplanti Baskani</p>
                  {meeting.chairman ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{meeting.chairman.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {meeting.chairman.department || "-"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Atanmamis</p>
                  )}
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground">Raporter</p>
                  {meeting.rapporteur ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">{meeting.rapporteur.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {meeting.rapporteur.department || "-"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Atanmamis</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Gundem Tab */}
        <TabsContent value="agenda" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Gundem Maddeleri
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meeting.agendaItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Henuz gundem maddesi eklenmemis
                </p>
              ) : (
                <div className="space-y-4">
                  {meeting.agendaItems.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-muted-foreground">
                              {item.orderNo}.
                            </span>
                            <h3 className="font-medium">{item.title}</h3>
                            {item.outcome && (
                              <Badge variant="outline">
                                {agendaOutcomeLabels[item.outcome] || item.outcome}
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {item.presenter && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {item.presenter.name}
                              </span>
                            )}
                            {item.plannedDuration && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {item.plannedDuration} dk
                              </span>
                            )}
                          </div>
                        </div>
                        {meeting.status !== "COMPLETED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditingAgenda(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {editingAgendaId === item.id ? (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          <div className="space-y-2">
                            <Label>Tartisma Notlari</Label>
                            <Textarea
                              value={editingAgendaNotes}
                              onChange={(e) => setEditingAgendaNotes(e.target.value)}
                              placeholder="Toplanti sirasinda alinan notlar..."
                              rows={3}
                            />
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Sonuc</Label>
                              <Select
                                value={editingAgendaOutcome}
                                onValueChange={setEditingAgendaOutcome}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Sonuc sec..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(agendaOutcomeLabels).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Sonuc Notlari</Label>
                              <Input
                                value={editingAgendaOutcomeNotes}
                                onChange={(e) => setEditingAgendaOutcomeNotes(e.target.value)}
                                placeholder="Varsa ek aciklamalar..."
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingAgendaId(null)}
                            >
                              Iptal
                            </Button>
                            <Button size="sm" onClick={saveAgendaItem}>
                              <Save className="h-4 w-4 mr-2" />
                              Kaydet
                            </Button>
                          </div>
                        </div>
                      ) : (
                        item.discussionNotes && (
                          <div className="mt-4 border-t pt-4">
                            <p className="text-sm text-muted-foreground mb-1">Tartisma Notlari:</p>
                            <p className="text-sm">{item.discussionNotes}</p>
                            {item.outcomeNotes && (
                              <>
                                <p className="text-sm text-muted-foreground mb-1 mt-2">
                                  Sonuc Notu:
                                </p>
                                <p className="text-sm">{item.outcomeNotes}</p>
                              </>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Katilimcilar Tab */}
        <TabsContent value="attendees" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Katilimcilar
              </CardTitle>
              <CardDescription>
                Katilim durumlarini guncellemek icin durum rozetine tiklayin
              </CardDescription>
            </CardHeader>
            <CardContent>
              {meeting.attendees.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Henuz katilimci eklenmemis
                </p>
              ) : (
                <div className="space-y-2">
                  {meeting.attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {attendee.user?.name || attendee.externalName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {attendee.user?.department ||
                                attendee.externalCompany ||
                                "Misafir"}
                            </span>
                            {attendee.user?.jobTitle && <span>- {attendee.user.jobTitle}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={attendee.attendanceStatus}
                          onValueChange={(value) => updateAttendanceStatus(attendee.id, value)}
                          disabled={meeting.status === "COMPLETED"}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(attendanceStatusLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kararlar Tab */}
        <TabsContent value="decisions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Alinan Kararlar
              </CardTitle>
              {meeting.status !== "COMPLETED" && (
                <Button size="sm" onClick={() => setShowDecisionDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Karar Ekle
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {meeting.decisions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Henuz karar alinmamis
                </p>
              ) : (
                <div className="space-y-4">
                  {meeting.decisions.map((decision) => (
                    <div key={decision.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-mono">
                              {decision.decisionNumber}
                            </Badge>
                            <h3 className="font-medium">{decision.title}</h3>
                            <Badge
                              className={
                                decision.priority === "URGENT"
                                  ? "bg-red-100 text-red-800"
                                  : decision.priority === "HIGH"
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-gray-100 text-gray-800"
                              }
                            >
                              {decisionPriorityLabels[decision.priority]}
                            </Badge>
                            <Badge variant="secondary">
                              {decisionStatusLabels[decision.status]}
                            </Badge>
                          </div>
                          {decision.description && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {decision.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            {decision.responsible && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <User className="h-3 w-3" />
                                Sorumlu: {decision.responsible.name}
                              </span>
                            )}
                            {decision.dueDate && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                Son Tarih: {formatDate(decision.dueDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tutanak Tab */}
        <TabsContent value="minutes" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Toplanti Tutanagi
              </CardTitle>
              {meeting.status !== "COMPLETED" && !editingNotes && (
                <Button variant="outline" size="sm" onClick={() => setEditingNotes(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Duzenle
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {editingNotes ? (
                <>
                  <div className="space-y-2">
                    <Label>Acilis Konusmasi</Label>
                    <Textarea
                      value={openingRemarks}
                      onChange={(e) => setOpeningRemarks(e.target.value)}
                      placeholder="Toplanti basindaki acilis konusmasi..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Genel Notlar</Label>
                    <Textarea
                      value={generalNotes}
                      onChange={(e) => setGeneralNotes(e.target.value)}
                      placeholder="Toplanti sirasinda alinan genel notlar..."
                      rows={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Kapanis Konusmasi</Label>
                    <Textarea
                      value={closingRemarks}
                      onChange={(e) => setClosingRemarks(e.target.value)}
                      placeholder="Toplanti sonundaki kapanis konusmasi..."
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditingNotes(false)}>
                      Iptal
                    </Button>
                    <Button onClick={saveNotes} disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Save className="h-4 w-4 mr-2" />
                      Kaydet
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="font-medium mb-2">Acilis Konusmasi</h3>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      {meeting.openingRemarks || "Henuz girilmemis"}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-2">Genel Notlar</h3>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg whitespace-pre-wrap">
                      {meeting.generalNotes || "Henuz girilmemis"}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-2">Kapanis Konusmasi</h3>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      {meeting.closingRemarks || "Henuz girilmemis"}
                    </p>
                  </div>

                  {meeting.minutesApproved && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-center gap-2 py-4 bg-green-50 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="text-green-700 font-medium">
                          Tutanak {meeting.minutesApprovedBy?.name} tarafindan onaylandi
                        </span>
                        <span className="text-green-600 text-sm">
                          ({meeting.minutesApprovedAt && formatDate(meeting.minutesApprovedAt)})
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Decision Dialog */}
      <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Karar Ekle</DialogTitle>
            <DialogDescription>
              Toplantida alinan karari kaydedin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Karar Basligi *</Label>
              <Input
                value={newDecisionTitle}
                onChange={(e) => setNewDecisionTitle(e.target.value)}
                placeholder="Ornek: Yeni proje baslatilacak"
              />
            </div>
            <div className="space-y-2">
              <Label>Aciklama</Label>
              <Textarea
                value={newDecisionDescription}
                onChange={(e) => setNewDecisionDescription(e.target.value)}
                placeholder="Karar hakkinda detaylar..."
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Sorumlu</Label>
                <UserSearchCombobox
                  value={newDecisionResponsible?.email}
                  onSelect={setNewDecisionResponsible}
                  placeholder="Sorumlu sec..."
                />
              </div>
              <div className="space-y-2">
                <Label>Son Tarih</Label>
                <Input
                  type="date"
                  value={newDecisionDueDate}
                  onChange={(e) => setNewDecisionDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Oncelik</Label>
              <Select value={newDecisionPriority} onValueChange={setNewDecisionPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(decisionPriorityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDecisionDialog(false)}>
              Iptal
            </Button>
            <Button onClick={addDecision} disabled={savingDecision}>
              {savingDecision && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
