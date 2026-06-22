"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  Plus,
  Loader2,
  Calendar,
  Clock,
  Users,
  MapPin,
  Video,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Search,
  Filter,
  FileText,
  CheckCircle2,
  PlayCircle,
  XCircle,
  ClipboardList,
} from "lucide-react"

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
  organizer: {
    id: string
    name: string
    email: string
    department: string | null
  }
  chairman: {
    id: string
    name: string
  } | null
  _count: {
    attendees: number
    agendaItems: number
    decisions: number
  }
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

const statusIcons: Record<string, React.ReactNode> = {
  PLANNED: <Calendar className="h-3 w-3" />,
  IN_PROGRESS: <PlayCircle className="h-3 w-3" />,
  COMPLETED: <CheckCircle2 className="h-3 w-3" />,
  CANCELLED: <XCircle className="h-3 w-3" />,
  POSTPONED: <Clock className="h-3 w-3" />,
}

export default function MeetingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchMeetings()
  }, [statusFilter, typeFilter])

  const fetchMeetings = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append("limit", "100")
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      if (typeFilter && typeFilter !== "all") {
        params.append("type", typeFilter)
      }
      if (searchQuery) {
        params.append("search", searchQuery)
      }

      const res = await fetch(`/api/meetings?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setMeetings(data.meetings || [])
      } else {
        toast.error("Toplantilar yuklenemedi")
      }
    } catch (error) {
      console.error("Toplantilar yuklenirken hata:", error)
      toast.error("Toplantilar yuklenemedi")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchMeetings()
  }

  const handleDeleteClick = (meeting: Meeting) => {
    setMeetingToDelete(meeting)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!meetingToDelete) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/meetings/${meetingToDelete.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Toplanti silindi")
        fetchMeetings()
      } else {
        const data = await res.json()
        toast.error(data.error || "Toplanti silinemedi")
      }
    } catch (error) {
      console.error("Toplanti silinirken hata:", error)
      toast.error("Toplanti silinemedi")
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setMeetingToDelete(null)
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

  const filteredMeetings = meetings.filter((meeting) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        meeting.title.toLowerCase().includes(query) ||
        meeting.meetingNumber.toLowerCase().includes(query) ||
        meeting.organizer.name.toLowerCase().includes(query)
      )
    }
    return true
  })

  // Durumlara gore grupla
  const plannedMeetings = filteredMeetings.filter((m) => m.status === "PLANNED")
  const inProgressMeetings = filteredMeetings.filter((m) => m.status === "IN_PROGRESS")
  const completedMeetings = filteredMeetings.filter((m) => m.status === "COMPLETED")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Toplanti Yonetimi</h1>
          <p className="text-muted-foreground">
            Toplantilarinizi planlayın, yonetin ve tutanak olusturun
          </p>
        </div>
        <Button onClick={() => router.push("/meetings/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Toplanti
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Toplanti ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Durumlar</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Turler</SelectItem>
                {Object.entries(meetingTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="secondary">
              <Filter className="h-4 w-4 mr-2" />
              Filtrele
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Toplam Toplanti</p>
                <p className="text-2xl font-bold">{meetings.length}</p>
              </div>
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Planli</p>
                <p className="text-2xl font-bold text-blue-600">{plannedMeetings.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Devam Eden</p>
                <p className="text-2xl font-bold text-yellow-600">{inProgressMeetings.length}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tamamlanan</p>
                <p className="text-2xl font-bold text-green-600">{completedMeetings.length}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meetings List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filteredMeetings.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium">Henuz toplanti yok</h3>
              <p className="text-muted-foreground mb-4">
                Yeni bir toplanti olusturarak baslayin
              </p>
              <Button onClick={() => router.push("/meetings/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Yeni Toplanti
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all">Tumu ({filteredMeetings.length})</TabsTrigger>
            <TabsTrigger value="planned">Planli ({plannedMeetings.length})</TabsTrigger>
            <TabsTrigger value="in_progress">Devam Eden ({inProgressMeetings.length})</TabsTrigger>
            <TabsTrigger value="completed">Tamamlanan ({completedMeetings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <MeetingsTable
              meetings={filteredMeetings}
              onView={(id) => router.push(`/meetings/${id}`)}
              onEdit={(id) => router.push(`/meetings/${id}/edit`)}
              onDelete={handleDeleteClick}
            />
          </TabsContent>

          <TabsContent value="planned" className="mt-4">
            <MeetingsTable
              meetings={plannedMeetings}
              onView={(id) => router.push(`/meetings/${id}`)}
              onEdit={(id) => router.push(`/meetings/${id}/edit`)}
              onDelete={handleDeleteClick}
            />
          </TabsContent>

          <TabsContent value="in_progress" className="mt-4">
            <MeetingsTable
              meetings={inProgressMeetings}
              onView={(id) => router.push(`/meetings/${id}`)}
              onEdit={(id) => router.push(`/meetings/${id}/edit`)}
              onDelete={handleDeleteClick}
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            <MeetingsTable
              meetings={completedMeetings}
              onView={(id) => router.push(`/meetings/${id}`)}
              onEdit={(id) => router.push(`/meetings/${id}/edit`)}
              onDelete={handleDeleteClick}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Toplantiyi Sil</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{meetingToDelete?.title}&quot; toplantisini silmek istediginizden emin misiniz?
              Bu islem geri alinamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Iptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function MeetingsTable({
  meetings,
  onView,
  onEdit,
  onDelete,
}: {
  meetings: Meeting[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (meeting: Meeting) => void
}) {
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

  if (meetings.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Bu kategoride toplanti yok</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Toplanti</TableHead>
            <TableHead>Tur</TableHead>
            <TableHead>Tarih/Saat</TableHead>
            <TableHead>Konum</TableHead>
            <TableHead>Organizator</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Katilimci</TableHead>
            <TableHead className="text-right">Islemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {meetings.map((meeting) => (
            <TableRow
              key={meeting.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onView(meeting.id)}
            >
              <TableCell>
                <div>
                  <p className="font-medium">{meeting.title}</p>
                  <p className="text-sm text-muted-foreground">{meeting.meetingNumber}</p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {meetingTypeLabels[meeting.meetingType] || meeting.meetingType}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(meeting.scheduledDate)}
                  </span>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(meeting.startTime)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {meeting.isOnline ? (
                    <>
                      <Video className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Online</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{meeting.location || "-"}</span>
                    </>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <p className="text-sm">{meeting.organizer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {meeting.organizer.department || "-"}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={statusColors[meeting.status]}>
                  <span className="flex items-center gap-1">
                    {statusIcons[meeting.status]}
                    {statusLabels[meeting.status]}
                  </span>
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{meeting._count.attendees}</span>
                </div>
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(meeting.id)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Goruntule
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(meeting.id)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Duzenle
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(meeting)}
                      className="text-red-600"
                      disabled={meeting.status === "COMPLETED"}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Sil
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
