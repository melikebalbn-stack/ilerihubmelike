"use client"

import { useState } from "react"

// UUID generator that works in non-secure contexts (HTTP)
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Plus,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  FileText,
  User,
  X,
} from "lucide-react"

interface AttendeeInput {
  id: string
  type: "internal" | "external"
  userId?: string
  userName?: string
  userEmail?: string
  userDepartment?: string
  userJobTitle?: string
  externalName?: string
  externalEmail?: string
  externalCompany?: string
  externalTitle?: string
  role: "CHAIRMAN" | "RAPPORTEUR" | "PRESENTER" | "PARTICIPANT" | "OBSERVER"
}

interface AgendaItemInput {
  id: string
  title: string
  description?: string
  presenterId?: string
  presenterName?: string
  plannedDuration?: number
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

export default function NewMeetingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)

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

  // Agenda Items
  const [agendaItems, setAgendaItems] = useState<AgendaItemInput[]>([])
  const [showAddAgendaItem, setShowAddAgendaItem] = useState(false)
  const [newAgendaTitle, setNewAgendaTitle] = useState("")
  const [newAgendaDescription, setNewAgendaDescription] = useState("")
  const [newAgendaPresenter, setNewAgendaPresenter] = useState<ADUser | null>(null)
  const [newAgendaDuration, setNewAgendaDuration] = useState("")

  const addAttendee = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (newAttendeeType === "internal") {
      if (!selectedAttendeeUser) {
        toast.error("Lutfen bir kullanici secin")
        return
      }
      // Check if already added
      if (attendees.some((a) => a.userId === selectedAttendeeUser.id)) {
        toast.error("Bu kullanici zaten eklendi")
        return
      }

      setAttendees((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "internal",
          userId: selectedAttendeeUser.id,
          userName: selectedAttendeeUser.name,
          userEmail: selectedAttendeeUser.email,
          userDepartment: selectedAttendeeUser.department || undefined,
          userJobTitle: selectedAttendeeUser.jobTitle || undefined,
          role: newAttendeeRole,
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

  const removeAttendee = (id: string) => {
    setAttendees(attendees.filter((a) => a.id !== id))
  }

  const addAgendaItem = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!newAgendaTitle.trim()) {
      toast.error("Gundem basligi zorunludur")
      return
    }

    const newItem = {
      id: generateId(),
      title: newAgendaTitle.trim(),
      description: newAgendaDescription.trim() || undefined,
      presenterId: newAgendaPresenter?.id,
      presenterName: newAgendaPresenter?.name,
      plannedDuration: newAgendaDuration ? parseInt(newAgendaDuration) : undefined,
    }

    setAgendaItems((prev) => [...prev, newItem])
    toast.success("Gundem maddesi eklendi")

    // Reset form
    setNewAgendaTitle("")
    setNewAgendaDescription("")
    setNewAgendaPresenter(null)
    setNewAgendaDuration("")
    setShowAddAgendaItem(false)
  }

  const removeAgendaItem = (id: string) => {
    setAgendaItems(agendaItems.filter((a) => a.id !== id))
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

    setLoading(true)

    try {
      const meetingData = {
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
        attendees: attendees.map((a) => ({
          userEmail: a.type === "internal" ? a.userEmail : null,
          userName: a.type === "internal" ? a.userName : null,
          userDepartment: a.type === "internal" ? a.userDepartment : null,
          userJobTitle: a.type === "internal" ? a.userJobTitle : null,
          externalName: a.type === "external" ? a.externalName : null,
          externalEmail: a.type === "external" ? a.externalEmail : null,
          externalCompany: a.type === "external" ? a.externalCompany : null,
          externalTitle: a.type === "external" ? a.externalTitle : null,
          role: a.role,
        })),
        agendaItems: agendaItems.map((item) => ({
          title: item.title,
          description: item.description || null,
          presenterId: item.presenterId || null,
          presenterName: item.presenterName || null,
          plannedDuration: item.plannedDuration || null,
        })),
      }

      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meetingData),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success("Toplanti olusturuldu")
        router.push(`/meetings/${data.id}`)
      } else {
        const error = await res.json()
        toast.error(error.error || "Toplanti olusturulamadi")
      }
    } catch (error) {
      console.error("Toplanti olusturulurken hata:", error)
      toast.error("Toplanti olusturulamadi")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Yeni Toplanti</h1>
          <p className="text-muted-foreground">Yeni bir toplanti planlayin</p>
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

            {/* Gundem Maddeleri */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Gundem Maddeleri
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddAgendaItem(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ekle
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {agendaItems.length === 0 && !showAddAgendaItem ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Henuz gundem maddesi eklenmedi
                  </p>
                ) : (
                  <div className="space-y-2">
                    {agendaItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-muted-foreground">
                              {index + 1}.
                            </span>
                            <span className="font-medium">{item.title}</span>
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {item.presenterName && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {item.presenterName}
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAgendaItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {showAddAgendaItem && (
                  <Card className="border-dashed">
                    <CardContent className="pt-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Gundem Basligi *</Label>
                        <Input
                          value={newAgendaTitle}
                          onChange={(e) => setNewAgendaTitle(e.target.value)}
                          placeholder="Ornek: Acilis ve Yoklama"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Aciklama</Label>
                        <Textarea
                          value={newAgendaDescription}
                          onChange={(e) => setNewAgendaDescription(e.target.value)}
                          placeholder="Gundem hakkinda detaylar..."
                          rows={2}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Sunucu</Label>
                          <UserSearchCombobox
                            value={newAgendaPresenter?.email}
                            onSelect={setNewAgendaPresenter}
                            placeholder="Sunucu sec..."
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Planlanan Sure (dk)</Label>
                          <Input
                            type="number"
                            value={newAgendaDuration}
                            onChange={(e) => setNewAgendaDuration(e.target.value)}
                            placeholder="15"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                          onClick={() => setShowAddAgendaItem(false)}
                        >
                          Iptal
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            console.log("Agenda Ekle clicked, title:", newAgendaTitle)
                            addAgendaItem(e)
                          }}
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

          {/* Sag Kolon - Katilimcilar */}
          <div className="space-y-6">
            {/* Baskan ve Raporter */}
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
                  Katilimcilar
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
                {attendees.length === 0 && !showAddAttendee ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Henuz katilimci eklenmedi
                  </p>
                ) : (
                  <div className="space-y-2">
                    {attendees.map((attendee) => (
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
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAttendee(attendee.id)}
                        >
                          <X className="h-4 w-4" />
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
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            console.log("Ekle clicked, selectedAttendeeUser:", selectedAttendeeUser)
                            addAttendee(e)
                          }}
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
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Toplanti Olustur
          </Button>
        </div>
      </form>
    </div>
  )
}
