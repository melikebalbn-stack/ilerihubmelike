"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ArrowLeft, Plus, Trash2, Save, Send, Eye, Mail } from "lucide-react"
import Link from "next/link"
import { ParticipantInput, ExternalParticipantInput } from "@/components/forms/ParticipantInput"
import { RecipientInput, Recipient } from "@/components/forms/RecipientInput"
import { ReportPreviewModal } from "@/components/forms/ReportPreviewModal"
import { FileUploadDropzone, type UploadedFile } from "@/components/ui/file-upload-dropzone"

interface Participant {
  name: string
  title: string
  company: "ILERI_GROUP" | "VISITED_COMPANY"
  isFromAD?: boolean
  userId?: string
}

interface ActionItem {
  description: string
  responsible: string
  dueDate: string
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED"
}

export default function NewVisitReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

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

  // Katılımcılar
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

  // Dosyalar
  const [uploadFiles, setUploadFiles] = useState<UploadedFile[]>([])

  // Alıcılar
  const [recipients, setRecipients] = useState<Recipient[]>([
    { name: "", email: "" }
  ])

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

  function validateForm(): boolean {
    if (!visitDate || !visitTime || !companyName || !visitType || !meetingSummary) {
      alert("Lütfen zorunlu alanları doldurun")
      return false
    }

    const validRecipients = recipients.filter(r => r.email.trim())
    if (validRecipients.length === 0) {
      alert("En az bir alıcı ekleyin")
      return false
    }

    return true
  }

  function handlePreview() {
    if (!validateForm()) return
    setShowPreview(true)
  }

  async function handleSubmit(status: "DRAFT" | "SENT") {
    if (status === "SENT" && !validateForm()) return

    setLoading(true)

    try {
      // Boş katılımcıları filtrele
      const participants = [
        ...ourPeople.filter(p => p.name.trim()),
        ...theirPeople.filter(p => p.name.trim())
      ]

      // Boş aksiyonları filtrele
      const actions = actionItems.filter(a => a.description.trim())

      // Boş alıcıları filtrele
      const validRecipients = recipients.filter(r => r.email.trim())

      const res = await fetch("/api/forms/visit-reports", {
        method: "POST",
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
          status
        })
      })

      if (res.ok) {
        const data = await res.json()

        // Upload files if any
        if (uploadFiles.length > 0) {
          const formDataUpload = new FormData()
          for (const f of uploadFiles) {
            if (f.file) formDataUpload.append('files', f.file)
          }
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: formDataUpload })
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json()
            // Save attachments to the report
            await fetch(`/api/forms/visit-reports/${data.id}/attachments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ files: uploadData.files }),
            })
          }
        }

        if (status === "SENT") {
          alert("Rapor başarıyla gönderildi!")
        }
        router.push(`/forms/visit-reports/${data.id}`)
      } else {
        const data = await res.json()
        alert(data.error || "Kaydetme işlemi başarısız")
      }
    } catch {
      alert("Bir hata oluştu")
    } finally {
      setLoading(false)
      setShowPreview(false)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/forms/visit-reports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl lg:text-3xl font-bold">Yeni Ziyaret Raporu</h1>
          <p className="text-muted-foreground">
            Müşteri veya tedarikçi ziyaret raporu oluşturun
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
              <Label htmlFor="endDate">Bitiş Tarihi</Label>
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
                placeholder="Örnek: Roketsan A.Ş."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visitType">Ziyaret Türü *</Label>
              <Select value={visitType} onValueChange={setVisitType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seçiniz..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOMER">Müşteri Ziyareti</SelectItem>
                  <SelectItem value="SUPPLIER">Tedarikçi Ziyareti</SelectItem>
                  <SelectItem value="FAIR">Fuar/Etkinlik</SelectItem>
                  <SelectItem value="TECHNICAL">Teknik Görüşme</SelectItem>
                  <SelectItem value="AUDIT">Denetim/Audit</SelectItem>
                  <SelectItem value="TRAINING">Eğitim</SelectItem>
                  <SelectItem value="OTHER">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">Ziyaret Yeri / Adres</Label>
              <Input
                id="location"
                placeholder="Örnek: Roketsan Elmadağ Tesisleri"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project">İlgili Proje / Konu</Label>
              <Input
                id="project"
                placeholder="Örnek: Taşıyıcı Grup Projesi"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Katılımcılar */}
      <Card>
        <CardHeader>
          <CardTitle>Katılımcılar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* İleri Group'tan - AD ile autocomplete */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">İleri Group&apos;tan Gidenler</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  İsim yazınca Active Directory&apos;den önerilecek
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
                  placeholder="Ad Soyad yazın..."
                />
              ))}
              <Button variant="outline" size="sm" onClick={addOurPerson}>
                <Plus className="h-4 w-4 mr-2" />
                Kişi Ekle
              </Button>
            </div>

            {/* Görüşülen Kişiler - Manuel giriş */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Görüşülen Kişiler</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Ziyaret edilen firmadan görüşülen kişiler
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
                Kişi Ekle
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Görüşme Özeti */}
      <Card>
        <CardHeader>
          <CardTitle>Görüşme Özeti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="meetingSummary">Görüşme Konuları ve Detayları *</Label>
            <Textarea
              id="meetingSummary"
              placeholder="Görüşme sırasında ele alınan konuları, tartışılan hususları ve alınan kararları yazınız..."
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
          <CardTitle>Aksiyon Maddeleri / Yapılacaklar</CardTitle>
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
                    <SelectItem value="COMPLETED">Tamamlandı</SelectItem>
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
          <CardTitle>Ek Notlar ve Sonuç</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="additionalNotes">Toplantı Notları / Önemli Hususlar</Label>
            <Textarea
              id="additionalNotes"
              placeholder="Ek notlarınızı buraya yazabilirsiniz..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nextSteps">Sonraki Adımlar</Label>
            <Textarea
              id="nextSteps"
              placeholder="Bir sonraki görüşme/ziyaret planı, takip edilecek konular..."
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Alıcılar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Raporu Gönder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-base font-semibold">Alıcılar</Label>
            <p className="text-xs text-muted-foreground mt-1">
              İsim yazınca Active Directory&apos;den önerilecek, email otomatik gelecek. Manuel de ekleyebilirsiniz.
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
            Alıcı Ekle
          </Button>
        </CardContent>
      </Card>

      {/* Dosya / Fotoğraf */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dosya / Fotoğraf</CardTitle>
          <CardDescription>Ziyaret ile ilgili fotoğraf ve belgeleri ekleyin</CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadDropzone
            files={uploadFiles}
            onFilesChange={setUploadFiles}
            maxFiles={10}
            maxSizeMB={10}
          />
        </CardContent>
      </Card>

      {/* Butonlar */}
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => handleSubmit("DRAFT")}
          disabled={loading}
        >
          <Save className="h-4 w-4 mr-2" />
          Taslak Kaydet
        </Button>
        <Button
          variant="secondary"
          onClick={handlePreview}
          disabled={loading}
        >
          <Eye className="h-4 w-4 mr-2" />
          Önizle
        </Button>
        <Button
          onClick={() => handleSubmit("SENT")}
          disabled={loading}
        >
          <Send className="h-4 w-4 mr-2" />
          Gönder
        </Button>
      </div>

      {/* Preview Modal */}
      <ReportPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        onSend={() => handleSubmit("SENT")}
        loading={loading}
        data={{
          visitDate,
          endDate,
          visitTime,
          companyName,
          visitType,
          location,
          project,
          meetingSummary,
          additionalNotes,
          nextSteps,
          ourPeople,
          theirPeople,
          actionItems,
          recipients
        }}
      />
    </div>
  )
}
