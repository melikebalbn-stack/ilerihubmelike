"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  GraduationCap,
  Plus,
  Calendar,
  Users,
  Clock,
  MapPin,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  Search,
  Send,
  UserPlus,
  Award,
  Play,
  Upload,
  File,
  X,
  Download,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

const TRAINING_TYPES: Record<string, { label: string; color: string }> = {
  AWARENESS: { label: "Farkindalik Egitimi", color: "bg-blue-100 text-blue-700" },
  TECHNICAL: { label: "Teknik Egitim", color: "bg-purple-100 text-purple-700" },
  ORIENTATION: { label: "Oryantasyon", color: "bg-green-100 text-green-700" },
  REFRESHER: { label: "Yenileme Egitimi", color: "bg-orange-100 text-orange-700" },
  SPECIALIZED: { label: "Ozel Egitim", color: "bg-pink-100 text-pink-700" },
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  PLANNED: { label: "Planlandi", color: "bg-yellow-100 text-yellow-700", icon: Calendar },
  IN_PROGRESS: { label: "Devam Ediyor", color: "bg-blue-100 text-blue-700", icon: Clock },
  COMPLETED: { label: "Tamamlandi", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  CANCELLED: { label: "Iptal Edildi", color: "bg-red-100 text-red-700", icon: AlertCircle },
}

interface Participant {
  id?: string
  name: string
  title?: string
  department?: string
  email?: string
  attended: boolean
}

interface Training {
  id: string
  trainingNumber: string
  title: string
  description?: string
  trainingType: string
  duration: number
  location?: string
  trainerName: string
  trainerTitle?: string
  trainerEmail?: string
  trainingDate: string
  controlId?: string
  status: string
  documentUrl?: string
  signatureUrl?: string
  contentUrl?: string
  contentType?: string
  isOnline?: boolean
  participants: Participant[]
  createdAt: string
  _count?: {
    assignments: number
  }
}

interface UserOption {
  id: string
  name: string | null
  email: string
  department: string | null
  jobTitle: string | null
}

interface TrainingAssignment {
  id: string
  userId: string
  status: string
  progress: number
  signedAt: string | null
  user: {
    id: string
    name: string | null
    email: string
    department: string | null
  }
}

export default function TrainingsPage() {
  const [trainings, setTrainings] = useState<Training[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null)
  const [saving, setSaving] = useState(false)

  // Atama icin state'ler
  const [users, setUsers] = useState<UserOption[]>([])
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [assignDeadline, setAssignDeadline] = useState("")
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [assigning, setAssigning] = useState(false)

  // PDF yukleme state'leri
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadingPDF, setUploadingPDF] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    trainingType: "AWARENESS",
    duration: 60,
    location: "",
    trainerName: "",
    trainerTitle: "",
    trainerEmail: "",
    trainingDate: new Date().toISOString().split("T")[0],
    controlId: "A.6.3",
    status: "COMPLETED",
    participants: [] as Participant[],
  })

  const [newParticipant, setNewParticipant] = useState({
    name: "",
    title: "",
  })

  useEffect(() => {
    fetchTrainings()
  }, [])

  const fetchTrainings = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/iso27001/trainings")
      if (res.ok) {
        const data = await res.json()
        setTrainings(data)
      }
    } catch (error) {
      toast.error("Egitimler yuklenemedi")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.title || !formData.trainerName || !formData.trainingDate) {
      toast.error("Egitim konusu, egitimci ve tarih zorunludur")
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/iso27001/trainings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success("Egitim kaydedildi")
        setShowDialog(false)
        resetForm()
        fetchTrainings()
      } else {
        const data = await res.json()
        toast.error(data.error || "Egitim kaydedilemedi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Bu egitimi silmek istediginizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/iso27001/trainings/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Egitim silindi")
        fetchTrainings()
      } else {
        toast.error("Egitim silinemedi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    }
  }

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      trainingType: "AWARENESS",
      duration: 60,
      location: "",
      trainerName: "",
      trainerTitle: "",
      trainerEmail: "",
      trainingDate: new Date().toISOString().split("T")[0],
      controlId: "A.6.3",
      status: "COMPLETED",
      participants: [],
    })
    setNewParticipant({ name: "", title: "" })
  }

  const addParticipant = () => {
    if (!newParticipant.name) return
    setFormData({
      ...formData,
      participants: [
        ...formData.participants,
        { name: newParticipant.name, title: newParticipant.title, attended: true },
      ],
    })
    setNewParticipant({ name: "", title: "" })
  }

  const removeParticipant = (index: number) => {
    const updated = [...formData.participants]
    updated.splice(index, 1)
    setFormData({ ...formData, participants: updated })
  }

  // Kullanicilari getir
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true)
      const res = await fetch("/api/users?limit=500")
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error("Kullanicilar yuklenemedi:", error)
    } finally {
      setLoadingUsers(false)
    }
  }

  // Egitim atamalarini getir
  const fetchAssignments = async (trainingId: string) => {
    try {
      const res = await fetch(`/api/iso27001/trainings/assign?trainingId=${trainingId}`)
      if (res.ok) {
        const data = await res.json()
        setAssignments(data || [])
      }
    } catch (error) {
      console.error("Atamalar yuklenemedi:", error)
    }
  }

  // Egitimi kullanicilara ata
  const handleAssign = async () => {
    if (selectedUsers.length === 0) {
      toast.error("En az bir kullanici secin")
      return
    }

    if (!selectedTraining) return

    try {
      setAssigning(true)
      const res = await fetch("/api/iso27001/trainings/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainingId: selectedTraining.id,
          userIds: selectedUsers,
          deadline: assignDeadline || null,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success(data.message || "Egitim atandi")
        setSelectedUsers([])
        setAssignDeadline("")
        fetchAssignments(selectedTraining.id)
        fetchTrainings()
      } else {
        toast.error(data.error || "Atama yapilamadi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    } finally {
      setAssigning(false)
    }
  }

  // Atama dialog'unu ac
  const openAssignDialog = (training: Training) => {
    setSelectedTraining(training)
    setShowAssignDialog(true)
    fetchUsers()
    fetchAssignments(training.id)
  }

  // PDF yukleme dialog'unu ac
  const openUploadDialog = (training: Training) => {
    setSelectedTraining(training)
    setSelectedFile(null)
    setShowUploadDialog(true)
  }

  // PDF yukle
  const handleUploadPDF = async () => {
    if (!selectedFile || !selectedTraining) return

    try {
      setUploadingPDF(true)
      const formData = new FormData()
      formData.append("file", selectedFile)

      const res = await fetch(`/api/iso27001/trainings/${selectedTraining.id}/content`, {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        toast.success("PDF basariyla yuklendi")
        setShowUploadDialog(false)
        setSelectedFile(null)
        fetchTrainings()
      } else {
        toast.error(data.error || "PDF yuklenemedi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    } finally {
      setUploadingPDF(false)
    }
  }

  // PDF sil
  const handleDeletePDF = async (training: Training) => {
    if (!confirm("PDF icerigini silmek istediginizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/iso27001/trainings/${training.id}/content`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("PDF silindi")
        fetchTrainings()
      } else {
        toast.error("PDF silinemedi")
      }
    } catch (error) {
      toast.error("Bir hata olustu")
    }
  }

  const handleDownloadPDF = async (trainingId: string) => {
    try {
      toast.info("PDF hazirlaniyor...")
      const res = await fetch(`/api/iso27001/trainings/${trainingId}/pdf`)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || "PDF olusturulamadi")
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.headers.get("content-disposition")?.split("filename=")[1]?.replace(/"/g, "") || "egitim-formu.pdf"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success("PDF indirildi")
    } catch {
      toast.error("PDF indirilirken bir hata olustu")
    }
  }

  const filteredTrainings = trainings.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.trainerName.toLowerCase().includes(search.toLowerCase()) ||
      t.trainingNumber.toLowerCase().includes(search.toLowerCase())
  )

  // Atanmamis kullanicilari filtrele
  const availableUsers = users.filter(
    (u) => !assignments.some((a) => a.userId === u.id)
  )

  // Istatistikler
  const stats = {
    total: trainings.length,
    completed: trainings.filter((t) => t.status === "COMPLETED").length,
    planned: trainings.filter((t) => t.status === "PLANNED").length,
    totalParticipants: trainings.reduce((acc, t) => acc + t.participants.length, 0),
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Baslik */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">BGYS Egitim Kayitlari</h1>
          <p className="text-muted-foreground">
            ISO 27001 A.6.3 - Bilgi guvenligi farkindalik egitimleri
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Yeni Egitim
        </Button>
      </div>

      {/* Istatistikler */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Toplam Egitim</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tamamlanan</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Planlanan</CardTitle>
            <Calendar className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.planned}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Toplam Katilimci</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalParticipants}</div>
          </CardContent>
        </Card>
      </div>

      {/* Arama */}
      <Card>
        <CardHeader>
          <CardTitle>Egitim Listesi</CardTitle>
          <CardDescription>Tum BGYS egitim kayitlari</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Egitim ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Yukleniyor...</div>
          ) : filteredTrainings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Henuz egitim kaydi yok
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Egitim No</TableHead>
                  <TableHead>Konu</TableHead>
                  <TableHead>Tur</TableHead>
                  <TableHead>Egitimci</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>PDF</TableHead>
                  <TableHead>Katilimci</TableHead>
                  <TableHead>Dijital Atama</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Islemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrainings.map((training) => {
                  const typeInfo = TRAINING_TYPES[training.trainingType] || TRAINING_TYPES.AWARENESS
                  const statusInfo = STATUS_MAP[training.status] || STATUS_MAP.COMPLETED
                  const StatusIcon = statusInfo.icon

                  return (
                    <TableRow key={training.id}>
                      <TableCell className="font-mono text-sm">
                        {training.trainingNumber}
                      </TableCell>
                      <TableCell className="font-medium">{training.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={typeInfo.color}>
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{training.trainerName}</TableCell>
                      <TableCell>
                        {new Date(training.trainingDate).toLocaleDateString("tr-TR")}
                      </TableCell>
                      <TableCell>
                        {training.contentUrl ? (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              <File className="mr-1 h-3 w-3" />
                              PDF
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleDeletePDF(training)}
                              title="PDF'i Sil"
                            >
                              <X className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6"
                            onClick={() => openUploadDialog(training)}
                            title="PDF Yukle"
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Yukle
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <Users className="mr-1 h-3 w-3" />
                          {training.participants.length}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {training._count?.assignments ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700">
                            <Send className="mr-1 h-3 w-3" />
                            {training._count.assignments} kisi
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAssignDialog(training)}
                            title="Kullanicilara Ata"
                          >
                            <UserPlus className="h-4 w-4 text-purple-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTraining(training)
                              setShowViewDialog(true)
                              fetchAssignments(training.id)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(training.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Yeni Egitim Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Egitim Kaydi</DialogTitle>
            <DialogDescription>
              BGYS farkindalik egitimi bilgilerini girin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Egitim Bilgileri */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Egitim Konusu *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="BGYS Farkindalik Egitimi"
                />
              </div>
              <div className="space-y-2">
                <Label>Egitim Turu</Label>
                <Select
                  value={formData.trainingType}
                  onValueChange={(v) => setFormData({ ...formData, trainingType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRAINING_TYPES).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        {val.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Aciklama</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Egitim icerigi hakkinda bilgi..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Tarih *</Label>
                <Input
                  type="date"
                  value={formData.trainingDate}
                  onChange={(e) => setFormData({ ...formData, trainingDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sure (dk)</Label>
                <Input
                  type="number"
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Yer</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="1. Toplanti Odasi"
                />
              </div>
            </div>

            {/* Egitimci Bilgileri */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Egitimci Bilgileri</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Ad Soyad *</Label>
                  <Input
                    value={formData.trainerName}
                    onChange={(e) => setFormData({ ...formData, trainerName: e.target.value })}
                    placeholder="Hasan Engin"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unvan</Label>
                  <Input
                    value={formData.trainerTitle}
                    onChange={(e) => setFormData({ ...formData, trainerTitle: e.target.value })}
                    placeholder="IT Uzmani"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-posta</Label>
                  <Input
                    type="email"
                    value={formData.trainerEmail}
                    onChange={(e) => setFormData({ ...formData, trainerEmail: e.target.value })}
                    placeholder="trainer@example.com"
                  />
                </div>
              </div>
            </div>

            {/* Katilimcilar */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Katilimcilar</h4>
              <div className="flex gap-2 mb-3">
                <Input
                  value={newParticipant.name}
                  onChange={(e) =>
                    setNewParticipant({ ...newParticipant, name: e.target.value })
                  }
                  placeholder="Ad Soyad"
                  className="flex-1"
                />
                <Input
                  value={newParticipant.title}
                  onChange={(e) =>
                    setNewParticipant({ ...newParticipant, title: e.target.value })
                  }
                  placeholder="Gorev/Unvan"
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addParticipant}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {formData.participants.length > 0 && (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ad Soyad</TableHead>
                        <TableHead>Gorev</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.participants.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>{p.title || "-"}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeParticipant(i)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Iliskili Kontrol */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Iliskili Kontrol</Label>
                <Select
                  value={formData.controlId}
                  onValueChange={(v) => setFormData({ ...formData, controlId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A.6.3">A.6.3 - Bilgi guvenligi farkindalik egitimi</SelectItem>
                    <SelectItem value="A.6.1">A.6.1 - Tarama</SelectItem>
                    <SelectItem value="A.6.2">A.6.2 - Istihdam hukum ve kosullari</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Durum</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_MAP).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        {val.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Iptal
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Goruntuleme Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Egitim Detaylari</DialogTitle>
            <DialogDescription>{selectedTraining?.trainingNumber}</DialogDescription>
          </DialogHeader>

          {selectedTraining && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground text-xs">Egitim Konusu</Label>
                  <p className="font-medium">{selectedTraining.title}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Egitim Turu</Label>
                  <Badge className={TRAINING_TYPES[selectedTraining.trainingType]?.color}>
                    {TRAINING_TYPES[selectedTraining.trainingType]?.label}
                  </Badge>
                </div>
              </div>

              {selectedTraining.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Aciklama</Label>
                  <p className="text-sm">{selectedTraining.description}</p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {new Date(selectedTraining.trainingDate).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedTraining.duration} dakika</span>
                </div>
                {selectedTraining.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedTraining.location}</span>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Egitimci</h4>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {selectedTraining.trainerName}
                    {selectedTraining.trainerTitle && ` - ${selectedTraining.trainerTitle}`}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">
                  Katilimcilar ({selectedTraining.participants.length})
                </h4>
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Ad Soyad</TableHead>
                        <TableHead>Gorev</TableHead>
                        <TableHead>Katilim</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTraining.participants.map((p, i) => (
                        <TableRow key={p.id || i}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{p.title || "-"}</TableCell>
                          <TableCell>
                            {p.attended ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Dijital Atamalar */}
              {assignments.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Send className="h-4 w-4 text-purple-500" />
                    Dijital Atamalar ({assignments.length})
                  </h4>
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kullanici</TableHead>
                          <TableHead>Departman</TableHead>
                          <TableHead>Durum</TableHead>
                          <TableHead>Ilerleme</TableHead>
                          <TableHead>Imza Tarihi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignments.map((assignment) => (
                          <TableRow key={assignment.id}>
                            <TableCell className="font-medium">
                              {assignment.user.name || assignment.user.email}
                            </TableCell>
                            <TableCell>{assignment.user.department || "-"}</TableCell>
                            <TableCell>
                              {assignment.status === "SIGNED" ? (
                                <Badge className="bg-emerald-100 text-emerald-700">
                                  <Award className="mr-1 h-3 w-3" />
                                  Imzalandi
                                </Badge>
                              ) : assignment.status === "COMPLETED" ? (
                                <Badge className="bg-green-100 text-green-700">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Tamamlandi
                                </Badge>
                              ) : assignment.status === "IN_PROGRESS" ? (
                                <Badge className="bg-blue-100 text-blue-700">
                                  <Play className="mr-1 h-3 w-3" />
                                  Devam Ediyor
                                </Badge>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-700">
                                  <Clock className="mr-1 h-3 w-3" />
                                  Bekliyor
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{assignment.progress}%</TableCell>
                            <TableCell>
                              {assignment.signedAt
                                ? new Date(assignment.signedAt).toLocaleDateString("tr-TR")
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 flex items-center justify-between">
                <div>
                  <Label className="text-muted-foreground text-xs">Iliskili Kontrol</Label>
                  <Badge variant="outline">{selectedTraining.controlId || "A.6.3"}</Badge>
                </div>
                <Badge className={STATUS_MAP[selectedTraining.status]?.color}>
                  {STATUS_MAP[selectedTraining.status]?.label}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="default"
              onClick={() => selectedTraining && handleDownloadPDF(selectedTraining.id)}
            >
              <Download className="mr-2 h-4 w-4" />
              PDF Indir
            </Button>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kullanicilara Atama Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Egitimi Kullanicilara Ata
            </DialogTitle>
            <DialogDescription>
              {selectedTraining?.title} - {selectedTraining?.trainingNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Mevcut Atamalar */}
            {assignments.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Mevcut Atamalar ({assignments.length})</h4>
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kullanici</TableHead>
                        <TableHead>Departman</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead>Ilerleme</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">
                            {assignment.user.name || assignment.user.email}
                          </TableCell>
                          <TableCell>{assignment.user.department || "-"}</TableCell>
                          <TableCell>
                            {assignment.status === "SIGNED" ? (
                              <Badge className="bg-emerald-100 text-emerald-700">
                                <Award className="mr-1 h-3 w-3" />
                                Imzalandi
                              </Badge>
                            ) : assignment.status === "COMPLETED" ? (
                              <Badge className="bg-green-100 text-green-700">
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Tamamlandi
                              </Badge>
                            ) : assignment.status === "IN_PROGRESS" ? (
                              <Badge className="bg-blue-100 text-blue-700">
                                <Play className="mr-1 h-3 w-3" />
                                Devam Ediyor
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-700">
                                <Clock className="mr-1 h-3 w-3" />
                                Bekliyor
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{assignment.progress}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Yeni Atama */}
            <div>
              <h4 className="font-medium mb-3">Yeni Kullanici Ata</h4>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Son Tamamlama Tarihi (Opsiyonel)</Label>
                  <Input
                    type="date"
                    value={assignDeadline}
                    onChange={(e) => setAssignDeadline(e.target.value)}
                  />
                </div>

                {loadingUsers ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Kullanicilar yukleniyor...
                  </div>
                ) : availableUsers.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Tum kullanicilara atama yapilmis
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Kullanicilar ({availableUsers.length})</Label>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => {
                          if (selectedUsers.length === availableUsers.length) {
                            setSelectedUsers([])
                          } else {
                            setSelectedUsers(availableUsers.map((u) => u.id))
                          }
                        }}
                      >
                        {selectedUsers.length === availableUsers.length
                          ? "Tum Secimi Kaldir"
                          : "Tumunu Sec"}
                      </Button>
                    </div>

                    <div className="border rounded-md max-h-64 overflow-y-auto">
                      {availableUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selectedUsers.includes(user.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedUsers([...selectedUsers, user.id])
                              } else {
                                setSelectedUsers(selectedUsers.filter((id) => id !== user.id))
                              }
                            }}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{user.name || user.email}</p>
                            <p className="text-sm text-muted-foreground">
                              {user.department || "-"} {user.jobTitle && `• ${user.jobTitle}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedUsers.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {selectedUsers.length} kullanici secildi
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Kapat
            </Button>
            <Button
              onClick={handleAssign}
              disabled={assigning || selectedUsers.length === 0}
            >
              {assigning ? "Ataniyor..." : `${selectedUsers.length} Kisiye Ata`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Yukleme Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Egitim PDF Yukle
            </DialogTitle>
            <DialogDescription>
              {selectedTraining?.title} icin egitim materyali yukleyin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                id="pdf-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    if (file.type !== "application/pdf") {
                      toast.error("Sadece PDF dosyalari kabul edilir")
                      return
                    }
                    if (file.size > 50 * 1024 * 1024) {
                      toast.error("Dosya boyutu 50MB'dan buyuk olamaz")
                      return
                    }
                    setSelectedFile(file)
                  }
                }}
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <File className="mx-auto h-12 w-12 text-green-500" />
                  <p className="font-medium px-2 break-all" title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Degistir
                  </Button>
                </div>
              ) : (
                <label htmlFor="pdf-upload" className="cursor-pointer space-y-2 block">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="font-medium">PDF dosyasi secin</p>
                  <p className="text-sm text-muted-foreground">
                    veya buraya surukleyip birakin (max 50MB)
                  </p>
                </label>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">
                <strong>Bilgi:</strong> Yuklediginiz PDF, kullanicilara online egitim olarak
                sunulacaktir. Kullanicilar tum sayfalari goruntulemedikce egitimi
                tamamlayamayacaktir.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Iptal
            </Button>
            <Button
              onClick={handleUploadPDF}
              disabled={uploadingPDF || !selectedFile}
            >
              {uploadingPDF ? "Yukleniyor..." : "PDF Yukle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
