"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { ArrowLeft, Plus, Trash2, Save, Loader2, Mail, Send, Paperclip, Download, X } from "lucide-react"
import Link from "next/link"
import { ParticipantInput, ExternalParticipantInput } from "@/components/forms/ParticipantInput"
import { RecipientInput, Recipient } from "@/components/forms/RecipientInput"
import { FileUploadDropzone, type UploadedFile } from "@/components/ui/file-upload-dropzone"

interface Attachment {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
}

interface Participant {
  id?: string
  name: string
  title: string
  company: "ILERI_GROUP" | "VISITED_COMPANY"
  isFromAD?: boolean
  userId?: string
}

interface ActionItem {
  id?: string
  description: string
  responsible: string
  dueDate: string
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
}

export default function EditVisitReportPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reportNumber, setReportNumber] = useState("")

  // Form state
  const [visitDate, setVisitDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [visitTime, setVisitTime] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [visitType, setVisitType] = useState("")
  const [location, setLocation] = useState("")
  const [project, setProject] = useState("")
  const [meetingSummary, setMeetingSummary] = useState("")
  const [additionalNotes, setAdditionalNotes] = useState("")
  const [nextSteps, setNextSteps] = useState("")
  const [status, setStatus] = useState("")

  // Katilimcilar
  const [ourPeople, setOurPeople] = useState<Participant[]>([
    { name: "", title: "", company: "ILERI_GROUP" }
  ])
  const [theirPeople, setTheirPeople] = useState<Participant[]>([
    { name: "", title: "", company: "VISITED_COMPANY" }
  ])

  // Aksiyon maddeleri
  const [actionItems, setActionItems] = useState<ActionItem[]>([
    { description: "", responsible: "", dueDate: "", status: "PENDING" }
  ])

  // Alicilar
  const [recipients, setRecipients] = useState<Recipient[]>([
    { name: "", email: "" }
  ])

  // Dosya ekleri
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([])
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>([])
  const [newFiles, setNewFiles] = useState<UploadedFile[]>([])

  useEffect(() => {
    fetchReport()
  }, [id])

  async function fetchReport() {
    try {
      const res = await fetch(`/api/forms/visit-reports/${id}`)
      if (res.ok) {
        const data = await res.json()

        // Form alanlarini doldur
        setReportNumber(data.reportNumber)
        setVisitDate(data.visitDate?.split('T')[0] || "")
        setEndDate(data.endDate?.split('T')[0] || "")
        setVisitTime(data.visitTime || "")
        setCompanyName(data.companyName || "")
        setVisitType(data.visitType || "")
        setLocation(data.location || "")
        setProject(data.project || "")
        setMeetingSummary(data.meetingSummary || "")
        setAdditionalNotes(data.additionalNotes || "")
        setNextSteps(data.nextSteps || "")
        setStatus(data.status || "DRAFT")

        // Katilimcilari ayir
        const our = data.participants?.filter((p: Participant) => p.company === "ILERI_GROUP") || []
        const their = data.participants?.filter((p: Participant) => p.company === "VISITED_COMPANY") || []

        setOurPeople(our.length > 0 ? our.map((p: Participant) => ({
          ...p,
          title: p.title || ""
        })) : [{ name: "", title: "", company: "ILERI_GROUP" }])

        setTheirPeople(their.length > 0 ? their.map((p: Participant) => ({
          ...p,
          title: p.title || ""
        })) : [{ name: "", title: "", company: "VISITED_COMPANY" }])

        // Aksiyonlar
        const actions = data.actionItems || []
        setActionItems(actions.length > 0 ? actions.map((a: ActionItem) => ({
          ...a,
          dueDate: a.dueDate?.split('T')[0] || ""
        })) : [{ description: "", responsible: "", dueDate: "", status: "PENDING" }])

        // Ekleri yukle
        try {
          const attRes = await fetch(`/api/forms/visit-reports/${id}/attachments`)
          if (attRes.ok) {
            const attData = await attRes.json()
            setExistingAttachments(attData)
          }
        } catch {
          console.error("Ekler yuklenemedi")
        }
      } else {
        router.push("/forms/visit-reports")
      }
    } catch {
      console.error("Rapor yuklenemedi")
      router.push("/forms/visit-reports")
    } finally {
      setLoading(false)
    }
  }

  function addOurPerson() {
    setOurPeople([...ourPeople, { name: "", title: "", company: "ILERI_GROUP" }])
  }

  function removeOurPerson(index: number) {
    setOurPeople(ourPeople.filter((_, i) => i !== index))
  }

  function updateOurPerson(index: number, participant: Participant) {
    const updated = [...ourPeople]
    updated[index] = participant
    setOurPeople(updated)
  }

  function addTheirPerson() {
    setTheirPeople([...theirPeople, { name: "", title: "", company: "VISITED_COMPANY" }])
  }

  function removeTheirPerson(index: number) {
    setTheirPeople(theirPeople.filter((_, i) => i !== index))
  }

  function updateTheirPerson(index: number, participant: Participant) {
    const updated = [...theirPeople]
    updated[index] = participant
    setTheirPeople(updated)
  }

  function addActionItem() {
    setActionItems([...actionItems, { description: "", responsible: "", dueDate: "", status: "PENDING" }])
  }

  function removeActionItem(index: number) {
    setActionItems(actionItems.filter((_, i) => i !== index))
  }

  function updateActionItem(index: number, field: keyof ActionItem, value: string) {
    const updated = [...actionItems]
    updated[index] = { ...updated[index], [field]: value }
    setActionItems(updated)
  }

  function removeExistingAttachment(attachmentId: string) {
    setDeletedAttachmentIds(prev => [...prev, attachmentId])
    setExistingAttachments(prev => prev.filter(a => a.id !== attachmentId))
  }

  function isImageMimeType(mimeType: string) {
    return mimeType.startsWith("image/")
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function addRecipient() {
    setRecipients([...recipients, { name: "", email: "" }])
  }

  function removeRecipient(index: number) {
    setRecipients(recipients.filter((_, i) => i !== index))
  }

  function updateRecipient(index: number, recipient: Recipient) {
    const updated = [...recipients]
    updated[index] = recipient
    setRecipients(updated)
  }

  async function handleSubmit(newStatus?: "DRAFT" | "SENT") {
    if (!visitDate || !visitTime || !companyName || !visitType || !meetingSummary) {
      alert("Lutfen zorunlu alanlari doldurun")
      return
    }

    const finalStatus = newStatus || status

    // Gonderme durumunda en az bir alici gerekli
    if (finalStatus === "SENT") {
      const validRecipients = recipients.filter(r => r.email.trim())
      if (validRecipients.length === 0) {
        alert("Gondermek icin en az bir alici ekleyin")
        return
      }
    }

    setSaving(true)

    try {
      // Bos katilimcilari filtrele
      const participants = [
        ...ourPeople.filter(p => p.name.trim()),
        ...theirPeople.filter(p => p.name.trim())
      ]

      // Bos aksiyonlari filtrele
      const actions = actionItems.filter(a => a.description.trim())

      // Bos alicilari filtrele
      const validRecipients = recipients.filter(r => r.email.trim())

      const res = await fetch(`/api/forms/visit-reports/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitDate,
          endDate: endDate || null,
          visitTime,
          companyName,
          visitType,
          location: location || null,
          project: project || null,
          meetingSummary,
          additionalNotes: additionalNotes || null,
          nextSteps: nextSteps || null,
          participants,
          actionItems: actions,
          recipients: validRecipients,
          status: finalStatus
        })
      })

      if (res.ok) {
        // Silinen ekleri kaldir
        for (const attId of deletedAttachmentIds) {
          await fetch(`/api/forms/visit-reports/${id}/attachments?attachmentId=${attId}`, {
            method: 'DELETE',
          })
        }

        // Yeni dosyalari yukle
        if (newFiles.length > 0) {
          const formDataUpload = new FormData()
          for (const f of newFiles) {
            if (f.file) formDataUpload.append('files', f.file)
          }
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: formDataUpload })
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json()
            await fetch(`/api/forms/visit-reports/${id}/attachments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ files: uploadData.files }),
            })
          }
        }

        if (finalStatus === "SENT") {
          alert("Rapor basariyla gonderildi!")
        }
        router.push(`/forms/visit-reports/${id}`)
      } else {
        const data = await res.json()
        alert(data.error || "Guncelleme islemi basarisiz")
      }
    } catch {
      alert("Bir hata olustu")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/forms/visit-reports/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Raporu Duzenle</h1>
          <p className="text-muted-foreground">
            {reportNumber} - {companyName}
          </p>
        </div>
      </div>

      {/* Temel Bilgiler */}
      <Card>
        <CardHeader>
          <CardTitle>Temel Bilgiler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="visitDate">Ziyaret Tarihi *</Label>
              <Input
                id="visitDate"
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Bitis Tarihi</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visitTime">Ziyaret Saati *</Label>
              <Input
                id="visitTime"
                type="time"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Ziyaret Edilen Firma *</Label>
              <Input
                id="companyName"
                placeholder="Ornek: Roketsan A.S."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visitType">Ziyaret Turu *</Label>
              <Select value={visitType} onValueChange={setVisitType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seciniz..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOMER">Musteri Ziyareti</SelectItem>
                  <SelectItem value="SUPPLIER">Tedarikci Ziyareti</SelectItem>
                  <SelectItem value="FAIR">Fuar/Etkinlik</SelectItem>
                  <SelectItem value="TECHNICAL">Teknik Gorusme</SelectItem>
                  <SelectItem value="AUDIT">Denetim/Audit</SelectItem>
                  <SelectItem value="TRAINING">Egitim</SelectItem>
                  <SelectItem value="OTHER">Diger</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">Ziyaret Yeri / Adres</Label>
              <Input
                id="location"
                placeholder="Ornek: Roketsan Elmadag Tesisleri"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project">Ilgili Proje / Konu</Label>
              <Input
                id="project"
                placeholder="Ornek: Tasiyici Grup Projesi"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Katilimcilar */}
      <Card>
        <CardHeader>
          <CardTitle>Katilimcilar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Ileri Group'tan - AD ile autocomplete */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Ileri Group&apos;tan Gidenler</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Isim yazinca Active Directory&apos;den onerilecek
                </p>
              </div>
              {ourPeople.map((person, index) => (
                <ParticipantInput
                  key={index}
                  participant={person}
                  onChange={(p) => updateOurPerson(index, p)}
                  onRemove={() => removeOurPerson(index)}
                  canRemove={ourPeople.length > 1}
                  companyType="ILERI_GROUP"
                  placeholder="Ad Soyad yazin..."
                />
              ))}
              <Button variant="outline" size="sm" onClick={addOurPerson}>
                <Plus className="h-4 w-4 mr-2" />
                Kisi Ekle
              </Button>
            </div>

            {/* Gorusulen Kisiler - Manuel giris */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Gorusulen Kisiler</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Ziyaret edilen firmadan gorusulen kisiler
                </p>
              </div>
              {theirPeople.map((person, index) => (
                <ExternalParticipantInput
                  key={index}
                  participant={person}
                  onChange={(p) => updateTheirPerson(index, p)}
                  onRemove={() => removeTheirPerson(index)}
                  canRemove={theirPeople.length > 1}
                />
              ))}
              <Button variant="outline" size="sm" onClick={addTheirPerson}>
                <Plus className="h-4 w-4 mr-2" />
                Kisi Ekle
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gorusme Ozeti */}
      <Card>
        <CardHeader>
          <CardTitle>Gorusme Ozeti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="meetingSummary">Gorusme Konulari ve Detaylari *</Label>
            <Textarea
              id="meetingSummary"
              placeholder="Gorusme sirasinda ele alinan konulari, tartisilan hususlari ve alinan kararlari yaziniz..."
              value={meetingSummary}
              onChange={(e) => setMeetingSummary(e.target.value)}
              rows={8}
            />
          </div>
        </CardContent>
      </Card>

      {/* Aksiyon Maddeleri */}
      <Card>
        <CardHeader>
          <CardTitle>Aksiyon Maddeleri / Yapilacaklar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {actionItems.map((action, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Aksiyon maddesi..."
                  value={action.description}
                  onChange={(e) => updateActionItem(index, "description", e.target.value)}
                  className="flex-1"
                />
                {actionItems.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeActionItem(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <Input
                  placeholder="Sorumlu"
                  value={action.responsible}
                  onChange={(e) => updateActionItem(index, "responsible", e.target.value)}
                />
                <Input
                  type="date"
                  value={action.dueDate}
                  onChange={(e) => updateActionItem(index, "dueDate", e.target.value)}
                />
                <Select
                  value={action.status}
                  onValueChange={(v) => updateActionItem(index, "status", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Bekliyor</SelectItem>
                    <SelectItem value="IN_PROGRESS">Devam Ediyor</SelectItem>
                    <SelectItem value="COMPLETED">Tamamlandi</SelectItem>
                    <SelectItem value="CANCELLED">Iptal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={addActionItem}>
            <Plus className="h-4 w-4 mr-2" />
            Aksiyon Ekle
          </Button>
        </CardContent>
      </Card>

      {/* Ek Notlar */}
      <Card>
        <CardHeader>
          <CardTitle>Ek Notlar ve Sonuc</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="additionalNotes">Toplanti Notlari / Onemli Hususlar</Label>
            <Textarea
              id="additionalNotes"
              placeholder="Ek notlarinizi buraya yazabilirsiniz..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nextSteps">Sonraki Adimlar</Label>
            <Textarea
              id="nextSteps"
              placeholder="Bir sonraki gorusme/ziyaret plani, takip edilecek konular..."
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dosya / Fotograf Ekleri */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Dosya / Fotograf
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mevcut ekler */}
          {existingAttachments.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Mevcut Dosyalar</Label>
              <div className="grid gap-2">
                {existingAttachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-3 p-2 border rounded-lg bg-gray-50">
                    {isImageMimeType(att.mimeType) ? (
                      <img
                        src={att.filePath}
                        alt={att.fileName}
                        className="h-10 w-10 object-cover rounded"
                      />
                    ) : (
                      <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center">
                        <Paperclip className="h-5 w-5 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.fileName}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(att.fileSize)}</p>
                    </div>
                    <a href={att.filePath} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" type="button">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={() => removeExistingAttachment(att.id)}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Yeni dosya ekleme */}
          <div className="space-y-2">
            {existingAttachments.length > 0 && (
              <Label className="text-sm font-medium">Yeni Dosya Ekle</Label>
            )}
            <FileUploadDropzone
              files={newFiles}
              onFilesChange={setNewFiles}
              maxFiles={10}
              maxSizeMB={10}
            />
          </div>
        </CardContent>
      </Card>

      {/* Alicilar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Raporu Gonder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-base font-semibold">Alicilar</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Isim yazinca Active Directory&apos;den onerilecek, email otomatik gelecek. Manuel de ekleyebilirsiniz.
            </p>
          </div>
          {recipients.map((recipient, index) => (
            <RecipientInput
              key={index}
              recipient={recipient}
              onChange={(r) => updateRecipient(index, r)}
              onRemove={() => removeRecipient(index)}
              canRemove={recipients.length > 1}
            />
          ))}
          <Button variant="outline" size="sm" onClick={addRecipient}>
            <Plus className="h-4 w-4 mr-2" />
            Alici Ekle
          </Button>
        </CardContent>
      </Card>

      {/* Butonlar */}
      <div className="flex justify-end gap-4">
        <Link href={`/forms/visit-reports/${id}`}>
          <Button variant="outline">
            Iptal
          </Button>
        </Link>
        <Button variant="secondary" onClick={() => handleSubmit()} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Kaydet
        </Button>
        <Button onClick={() => handleSubmit("SENT")} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Gonder
        </Button>
      </div>
    </div>
  )
}
