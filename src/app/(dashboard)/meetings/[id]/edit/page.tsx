"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UserSearchCombobox, ADUser } from "@/components/user-search-combobox"
import {
  ArrowLeft,
  Loader2,
  Calendar,
  MapPin,
  Video,
  User,
  Save,
  Users,
  Plus,
  X,
  Trash2,
} from "lucide-react"

// UUID generator that works in non-secure contexts (HTTP)
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

interface MeetingAttendee {
  id: string
  odabUserId: string | null
  externalName: string | null
  externalEmail: string | null
  externalCompany: string | null
  externalTitle: string | null
  role: string
  user: {
    id: string
    name: string
    email: string
    department: string | null
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
  department: string | null
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
  attendees: MeetingAttendee[]
}

interface AttendeeInput {
  id: string
  type: "internal" | "external"
  odabUserId?: string
  userName?: string
  userEmail?: string
  userDepartment?: string
  userJobTitle?: string
  externalName?: string
  externalEmail?: string
  externalCompany?: string
  externalTitle?: string
  role: "CHAIRMAN" | "RAPPORTEUR" | "PRESENTER" | "PARTICIPANT" | "OBSERVER"
  isNew?: boolean
  toDelete?: boolean
}

const meetingTypes = [
  { value: "BOARD", label: "Yonetim Kurulu" },
  { value: "DEPARTMENT", label: "Departman" },
  { value: "PROJECT", label: "Proje" },
  { value: "TRAINING", label: "Egitim" },
  { value: "REVIEW", label: "Gozden Gecirme" },
  { value: "AUDIT", label: "Denetim" },
  { value: "CUSTOMER", label: "Musteri" },
  { value: "SUPPLIER", label: "Tedarikci" },
  { value: "SAFETY", label: "Guvenlik Komitesi" },
  { value: "QUALITY", label: "Kalite" },
  { value: "OTHER", label: "Diger" },
]

const attendeeRoles = [
  { value: "CHAIRMAN", label: "Baskan" },
  { value: "RAPPORTEUR", label: "Raporter" },
  { value: "PRESENTER", label: "Sunucu" },
  { value: "PARTICIPANT", label: "Katilimci" },
  { value: "OBSERVER", label: "Gozlemci" },
]

export default function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [meeting, setMeeting] = useState<Meeting | null>(null)

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [meetingType, setMeetingType] = useState("OTHER")
  const [scheduledDate, setScheduledDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [location, setLocation] = useState("")
  const [isOnline, setIsOnline] = useState(false)
  const [onlineLink, setOnlineLink] = useState("")
  const [department, setDepartment] = useState("")

  // Chairman and Rapporteur
  const [chairman, setChairman] = useState<ADUser | null>(null)
  const [rapporteur, setRapporteur] = useState<ADUser | null>(null)

  // Attendees
  const [attendees, setAttendees] = useState<AttendeeInput[]>([])
  const [showAddAttendee, setShowAddAttendee] = useState(false)
  const [newAttendeeType, setNewAttendeeType] = useState<"internal" | "external">("internal")
  const [newAttendeeRole, setNewAttendeeRole] = useState<AttendeeInput["role"]>("PARTICIPANT")
  const [selectedAttendeeUser, setSelectedAttendeeUser] = useState<ADUser | null>(null)
  const [externalName, setExternalName] = useState("")
  const [externalEmail, setExternalEmail] = useState("")
  const [externalCompany, setExternalCompany] = useState("")
  const [externalTitle, setExternalTitle] = useState("")

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

        // Populate form with existing data
        setTitle(data.title || "")
        setDescription(data.description || "")
        setMeetingType(data.meetingType || "OTHER")
        setScheduledDate(data.scheduledDate ? data.scheduledDate.split("T")[0] : "")
        setStartTime(data.startTime ? new Date(data.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "")
        setEndTime(data.endTime ? new Date(data.endTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "")
        setLocation(data.location || "")
        setIsOnline(data.isOnline || false)
        setOnlineLink(data.onlineLink || "")
        setDepartment(data.department || "")

        // Set chairman and rapporteur
        if (data.chairman) {
          setChairman({
            id: data.chairman.id,
            name: data.chairman.name,
            email: data.chairman.email,
            department: data.chairman.department,
          })
        }
        if (data.rapporteur) {
          setRapporteur({
            id: data.rapporteur.id,
            name: data.rapporteur.name,
            email: data.rapporteur.email,
            department: data.rapporteur.department,
          })
        }

        // Set attendees
        if (data.attendees && data.attendees.length > 0) {
          const mappedAttendees: AttendeeInput[] = data.attendees.map((att: MeetingAttendee) => ({
            id: att.id,
            type: att.user ? "internal" : "external",
            odabUserId: att.user?.id,
            userName: att.user?.name,
            userEmail: att.user?.email,
            userDepartment: att.user?.department || undefined,
            externalName: att.externalName || undefined,
            externalEmail: att.externalEmail || undefined,
            externalCompany: att.externalCompany || undefined,
            externalTitle: att.externalTitle || undefined,
            role: att.role as AttendeeInput["role"],
            isNew: false,
            toDelete: false,
          }))
          setAttendees(mappedAttendees)
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        if (res.status === 403) {
          toast.error(errorData.error || "Bu toplantıyı düzenleme yetkiniz yok")
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

  const addAttendee = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (newAttendeeType === "internal") {
      if (!selectedAttendeeUser) {
        toast.error("Lutfen bir kullanici secin")
        return
      }
      // Check if already added
      if (attendees.some((a) => a.userEmail === selectedAttendeeUser.email && !a.toDelete)) {
        toast.error("Bu kullanici zaten eklendi")
        return
      }

      setAttendees((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "internal",
          odabUserId: selectedAttendeeUser.id,
          userName: selectedAttendeeUser.name,
          userEmail: selectedAttendeeUser.email,
          userDepartment: selectedAttendeeUser.department || undefined,
          userJobTitle: selectedAttendeeUser.jobTitle || undefined,
          role: newAttendeeRole,
          isNew: true,
        },
      ])
      toast.success("Katilimci eklendi")
    } else if (newAttendeeType === "external") {
      if (!externalName.trim()) {
        toast.error("Misafir adi zorunludur")
        return
      }
      setAttendees((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "external",
          externalName,
          externalEmail: externalEmail || undefined,
          externalCompany: externalCompany || undefined,
          externalTitle: externalTitle || undefined,
          role: newAttendeeRole,
          isNew: true,
        },
      ])
      toast.success("Misafir eklendi")
    }

    // Reset form
    setSelectedAttendeeUser(null)
    setExternalName("")
    setExternalEmail("")
    setExternalCompany("")
    setExternalTitle("")
    setNewAttendeeRole("PARTICIPANT")
    setShowAddAttendee(false)
  }

  const removeAttendee = async (attendee: AttendeeInput) => {
    if (attendee.isNew) {
      // Just remove from local state
      setAttendees(attendees.filter((a) => a.id !== attendee.id))
    } else {
      // Mark for deletion and call API
      try {
        const res = await fetch(`/api/meetings/${resolvedParams.id}/attendees?attendeeId=${attendee.id}`, {
          method: "DELETE",
        })
        if (res.ok) {
          setAttendees(attendees.filter((a) => a.id !== attendee.id))
          toast.success("Katilimci silindi")
        } else {
          toast.error("Katilimci silinemedi")
        }
      } catch (error) {
        console.error("Katilimci silinirken hata:", error)
        toast.error("Katilimci silinemedi")
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error("Toplanti basligi zorunludur")
      return
    }

    if (!scheduledDate) {
      toast.error("Toplanti tarihi zorunludur")
      return
    }

    setSaving(true)

    try {
      // First update meeting basic info
      const updateData = {
        title,
        description: description || null,
        meetingType,
        scheduledDate: new Date(scheduledDate).toISOString(),
        startTime: startTime
          ? new Date(`${scheduledDate}T${startTime}`).toISOString()
          : null,
        endTime: endTime
          ? new Date(`${scheduledDate}T${endTime}`).toISOString()
          : null,
        location: location || null,
        isOnline,
        onlineLink: isOnline ? onlineLink : null,
        chairmanEmail: chairman?.email || null,
        rapporteurEmail: rapporteur?.email || null,
        department: department || null,
      }

      const res = await fetch(`/api/meetings/${resolvedParams.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || "Toplanti guncellenemedi")
        return
      }

      // Add new attendees
      const newAttendees = attendees.filter((a) => a.isNew)
      for (const attendee of newAttendees) {
        await fetch(`/api/meetings/${resolvedParams.id}/attendees`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userEmail: attendee.type === "internal" ? attendee.userEmail : null,
            userName: attendee.type === "internal" ? attendee.userName : null,
            userDepartment: attendee.type === "internal" ? attendee.userDepartment : null,
            userJobTitle: attendee.type === "internal" ? attendee.userJobTitle : null,
            externalName: attendee.type === "external" ? attendee.externalName : null,
            externalEmail: attendee.type === "external" ? attendee.externalEmail : null,
            externalCompany: attendee.type === "external" ? attendee.externalCompany : null,
            externalTitle: attendee.type === "external" ? attendee.externalTitle : null,
            role: attendee.role,
          }),
        })
      }

      toast.success("Toplanti guncellendi")
      router.push(`/meetings/${resolvedParams.id}`)
    } catch (error) {
      console.error("Toplanti guncellenirken hata:", error)
      toast.error("Toplanti guncellenemedi")
    } finally {
      setSaving(false)
    }
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

  const activeAttendees = attendees.filter((a) => !a.toDelete)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Toplanti Duzenle</h1>
          <p className="text-muted-foreground">{meeting.meetingNumber}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sol Kolon - Temel Bilgiler */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Temel Bilgiler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Toplanti Basligi *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ornek: Q1 2026 Satis Toplantisi"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Aciklama</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Toplanti hakkinda kisa bir aciklama..."
                    rows={3}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Toplanti Turu</Label>
                    <Select value={meetingType} onValueChange={setMeetingType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {meetingTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Departman</Label>
                    <Input
                      id="department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Ornek: Bilgi Islem"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate">Tarih *</Label>
                    <Input
                      id="scheduledDate"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startTime">Baslangic Saati</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endTime">Bitis Saati</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border rounded-lg p-4">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Online Toplanti
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Toplanti online olarak yapilacak mi?
                    </p>
                  </div>
                  <Switch checked={isOnline} onCheckedChange={setIsOnline} />
                </div>

                {isOnline ? (
                  <div className="space-y-2">
                    <Label htmlFor="onlineLink">Online Toplanti Linki</Label>
                    <Input
                      id="onlineLink"
                      value={onlineLink}
                      onChange={(e) => setOnlineLink(e.target.value)}
                      placeholder="https://meet.google.com/..."
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="location" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Konum
                    </Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ornek: Toplanti Odasi 1"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sag Kolon - Yoneticiler ve Katilimcilar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Yoneticiler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Toplanti Baskani</Label>
                  <UserSearchCombobox
                    value={chairman?.email}
                    onSelect={setChairman}
                    placeholder="Baskan sec..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Raporter</Label>
                  <UserSearchCombobox
                    value={rapporteur?.email}
                    onSelect={setRapporteur}
                    placeholder="Raporter sec..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Katilimcilar */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Katilimcilar ({activeAttendees.length})
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddAttendee(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ekle
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeAttendees.length === 0 && !showAddAttendee ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Henuz katilimci eklenmedi
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeAttendees.map((attendee) => (
                      <div
                        key={attendee.id}
                        className="flex items-center justify-between p-2 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {attendee.type === "internal"
                                ? attendee.userName
                                : attendee.externalName}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {attendeeRoles.find((r) => r.value === attendee.role)?.label}
                              </Badge>
                              {attendee.type === "external" && (
                                <Badge variant="secondary" className="text-xs">
                                  Misafir
                                </Badge>
                              )}
                              {attendee.isNew && (
                                <Badge variant="default" className="text-xs bg-green-500">
                                  Yeni
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAttendee(attendee)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {showAddAttendee && (
                  <Card className="border-dashed">
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={newAttendeeType === "internal" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewAttendeeType("internal")}
                        >
                          Dahili
                        </Button>
                        <Button
                          type="button"
                          variant={newAttendeeType === "external" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewAttendeeType("external")}
                        >
                          Misafir
                        </Button>
                      </div>

                      {newAttendeeType === "internal" ? (
                        <div className="space-y-2">
                          <Label>Kullanici</Label>
                          <UserSearchCombobox
                            value={selectedAttendeeUser?.email}
                            onSelect={setSelectedAttendeeUser}
                            placeholder="Kullanici sec..."
                          />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>Ad Soyad *</Label>
                            <Input
                              value={externalName}
                              onChange={(e) => setExternalName(e.target.value)}
                              placeholder="Misafir adi"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>E-posta</Label>
                            <Input
                              value={externalEmail}
                              onChange={(e) => setExternalEmail(e.target.value)}
                              placeholder="misafir@sirket.com"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                              <Label>Sirket</Label>
                              <Input
                                value={externalCompany}
                                onChange={(e) => setExternalCompany(e.target.value)}
                                placeholder="Sirket adi"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Unvan</Label>
                              <Input
                                value={externalTitle}
                                onChange={(e) => setExternalTitle(e.target.value)}
                                placeholder="Unvan"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Rol</Label>
                        <Select
                          value={newAttendeeRole}
                          onValueChange={(v) => setNewAttendeeRole(v as AttendeeInput["role"])}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {attendeeRoles.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                          onClick={() => setShowAddAttendee(false)}
                        >
                          Iptal
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={addAttendee}
                        >
                          Ekle
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Iptal
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Kaydet
          </Button>
        </div>
      </form>
    </div>
  )
}
