"use client"

import { useState, useEffect } from "react"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  CheckCircle2,
  FileText,
  MoreHorizontal,
  Eye,
  Trash2,
  Play,
} from "lucide-react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"
import { TalepBilgisiEkSection } from "./TalepBilgisiEkSection"
import { ArananYetkinliklerSection } from "./ArananYetkinliklerSection"
import { InsanVarliklariSection } from "./InsanVarliklariSection"

export interface PersonnelRequest {
  id: string
  requestNumber: string
  requesterName: string
  requesterEmail: string
  department: string
  title: string
  requestType: string
  headcount: number
  employmentType: string
  justification: string
  responsibilities: string | null
  requirements: string | null
  preferredStartDate: string | null
  location: string | null
  workModel: string | null
  salaryMin: number | null
  salaryMax: number | null
  hasBudget: boolean
  status: string
  priority: string
  approvedByName: string | null
  approvedAt: string | null
  approvalNotes: string | null
  rejectedByName: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  approvals?: {
    id: string
    step: number
    kademe: string
    role: string
    decision: "APPROVED" | "REJECTED" | "RETURNED" | "FORWARDED" | null
    comment: string | null
    decidedAt: string | null
    approver: { id: string; name: string | null; email: string | null } | null
  }[]
  jobOpening: {
    id: string
    title: string
    code: string
    status: string
  } | null
  createdAt: string
  // IV-FR-24 İnsan Varlıkları kapanış alanları (yalnız İK doldurur)
  adayKaynaklari?: string[] | null
  ilanPortallari?: string | null
  adayKaynagiDiger?: string | null
  kadroDoldurulmaTarihi?: string | null
  iseBaslayanPersonelAdi?: string | null
  ivOnayId?: string | null
  ivOnayTarihi?: string | null
}

const employmentTypeLabels: Record<string, string> = {
  FULL_TIME: "Tam Zamanli",
  PART_TIME: "Yari Zamanli",
  CONTRACT: "Sozlesmeli",
  INTERN: "Stajyer",
  TEMPORARY: "Gecici"
}

const priorityLabels: Record<string, string> = {
  LOW: "Dusuk",
  MEDIUM: "Orta",
  HIGH: "Yuksek",
  URGENT: "Acil"
}

const priorityColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800"
}

const requestTypeLabels: Record<string, string> = {
  NEW_POSITION: "Yeni Pozisyon",
  REPLACEMENT: "Yenileme",
  EXPANSION: "Kadro Genisletme",
  TEMPORARY: "Gecici",
  INTERN: "Stajyer"
}

const requestStatusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  PENDING: "Onay Bekliyor",
  APPROVED: "Onaylandi",
  REJECTED: "Reddedildi",
  IN_PROGRESS: "Islemde",
  COMPLETED: "Tamamlandi",
  CANCELLED: "Iptal"
}

const requestStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-purple-100 text-purple-800",
  CANCELLED: "bg-gray-100 text-gray-800"
}

// Kadro (personel) talep paneli — TEK KAYNAK. Hem İşe Alım sayfasının "requests"
// sekmesi hem de bağımsız /strategic-hr/kadro-talep sayfası bu bileşeni render eder.
export function PersonelTalepPaneli() {
  const { data: session } = useSession()

  const [requests, setRequests] = useState<PersonnelRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false)
  const [isRequestDetailOpen, setIsRequestDetailOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PersonnelRequest | null>(null)
  // İK maaş/bütçe düzenleme (talep detayı — yalnız recruitment.admin)
  const [salaryForm, setSalaryForm] = useState<{ salaryMin: string; salaryMax: string; hasBudget: boolean }>({ salaryMin: "", salaryMax: "", hasBudget: false })
  // "Onaya Gönder" gerekçe uyarısı (Elif 2. tur)
  const [submitConfirmId, setSubmitConfirmId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")

  // Personel talebi form
  const [requestForm, setRequestForm] = useState({
    title: "",
    requestType: "NEW_POSITION",
    headcount: 1,
    employmentType: "FULL_TIME",
    justification: "",
    responsibilities: "",
    requirements: "",
    preferredStartDate: "",
    location: "",
    workModel: "ONSITE",
    salaryMin: "",
    salaryMax: "",
    hasBudget: false,
    priority: "MEDIUM",
    // ── IV-FR-24 · Bölüm 1 ek + Bölüm 2 (Aranan Yetkinlikler) — talep eden doldurur ──
    formHazirlanmaTarihi: "",
    ikTeslimTarihi: "",
    ayrilanPersonelAdi: "",
    kisilikOzellikleri: "",
    egitimSeviyesi: "",
    egitimDiger: "",
    tecrubeDurumu: "",
    tecrubeSuresi: "",
    yabanciDilGerekli: false,
    yabanciDiller: "",
    bilgisayarBilgisi: "",
    kaliteSistemBilgisi: "",
    ehliyetGerekli: false,
    ehliyetSinifi: "",
    digerBelgeIhtiyaci: "",
    cinsiyetTercihi: "",
    yasAraligiMin: "",
    yasAraligiMax: "",
    askerlikGerekli: false,
  })

  // requestForm kısmi güncelleme yardımcısı (alt bileşenlere geçilir)
  const setReq = (patch: Record<string, any>) => setRequestForm((f) => ({ ...f, ...patch }))

  // İV kapanış formu (talep detayı — yalnız recruitment.admin doldurur/kaydeder)
  const [ivForm, setIvForm] = useState<Record<string, any>>({
    adayKaynaklari: [],
    ilanPortallari: "",
    adayKaynagiDiger: "",
    kadroDoldurulmaTarihi: "",
    iseBaslayanPersonelAdi: "",
  })
  const setIv = (patch: Record<string, any>) => setIvForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/strategic-hr/recruitment/personnel-requests")
      if (res.ok) {
        const data = await res.json()
        setRequests(data)
      }
    } catch (error) {
      console.error("Talepler yuklenirken hata:", error)
    } finally {
      setLoading(false)
    }
  }

  // Personel Talebi fonksiyonlari
  const handleRequestSubmit = async (e: React.FormEvent, submitForApproval: boolean = false) => {
    e.preventDefault()

    try {
      const res = await fetch("/api/strategic-hr/recruitment/personnel-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...requestForm,
          headcount: parseInt(requestForm.headcount.toString()),
          salaryMin: requestForm.salaryMin ? parseInt(requestForm.salaryMin) : null,
          salaryMax: requestForm.salaryMax ? parseInt(requestForm.salaryMax) : null,
          preferredStartDate: requestForm.preferredStartDate || null,
          // IV-FR-24: enum alanları boşsa null; yaş alanları number|null (zod bekliyor)
          egitimSeviyesi: requestForm.egitimSeviyesi || null,
          tecrubeDurumu: requestForm.tecrubeDurumu || null,
          cinsiyetTercihi: requestForm.cinsiyetTercihi || null,
          yasAraligiMin: requestForm.yasAraligiMin !== "" ? parseInt(requestForm.yasAraligiMin as any) : null,
          yasAraligiMax: requestForm.yasAraligiMax !== "" ? parseInt(requestForm.yasAraligiMax as any) : null,
          status: submitForApproval ? "PENDING" : "DRAFT"
        })
      })

      if (res.ok) {
        setIsRequestDialogOpen(false)
        fetchRequests()
        resetRequestForm()
        toast.success(submitForApproval ? "Talep onaya gonderildi" : "Talep taslak olarak kaydedildi")
      } else {
        const error = await res.json()
        toast.error(error.error || "Talep olusturulamadi")
      }
    } catch (error) {
      console.error("Talep olusturulurken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  // İK maaş/bütçe kaydet (recruitment.admin). update action → API yalnız admin'de yazar.
  const handleSalarySave = async (requestId: string) => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/personnel-requests/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          salaryMin: salaryForm.salaryMin ? parseInt(salaryForm.salaryMin) : null,
          salaryMax: salaryForm.salaryMax ? parseInt(salaryForm.salaryMax) : null,
          hasBudget: salaryForm.hasBudget,
        }),
      })
      if (res.ok) { fetchRequests(); toast.success("Maas/butce bilgileri kaydedildi") }
      else { const e = await res.json(); toast.error(e.error || "Kaydedilemedi") }
    } catch { toast.error("Bir hata olustu") }
  }

  // İV kapanış bilgilerini kaydet (recruitment.admin). Sunucu ivOnay damgasını kendi atar.
  const handleIvSave = async (requestId: string) => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/personnel-requests/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          adayKaynaklari: Array.isArray(ivForm.adayKaynaklari) ? ivForm.adayKaynaklari : [],
          ilanPortallari: ivForm.ilanPortallari || null,
          adayKaynagiDiger: ivForm.adayKaynagiDiger || null,
          kadroDoldurulmaTarihi: ivForm.kadroDoldurulmaTarihi || null,
          iseBaslayanPersonelAdi: ivForm.iseBaslayanPersonelAdi || null,
        }),
      })
      if (res.ok) { fetchRequests(); toast.success("Insan Varliklari bilgileri kaydedildi") }
      else { const e = await res.json(); toast.error(e.error || "Kaydedilemedi") }
    } catch { toast.error("Bir hata olustu") }
  }

  const handleRequestAction = async (requestId: string, action: string, data?: any) => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/personnel-requests/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data })
      })

      if (res.ok) {
        fetchRequests()
        setIsRequestDetailOpen(false)
        setRejectionReason("")
        const messages: Record<string, string> = {
          approve: "Talep onaylandi",
          reject: "Talep reddedildi",
          submit: "Talep onaya gonderildi",
          cancel: "Talep iptal edildi",
          create_opening: "Ilan olusturuldu"
        }
        toast.success(messages[action] || "Islem basarili")
      } else {
        const error = await res.json()
        toast.error(error.error || "Islem basarisiz")
      }
    } catch (error) {
      console.error("Islem hatasi:", error)
      toast.error("Bir hata olustu")
    }
  }

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm("Bu talebi silmek istediginizden emin misiniz?")) return

    try {
      const res = await fetch(`/api/strategic-hr/recruitment/personnel-requests/${requestId}`, {
        method: "DELETE"
      })

      if (res.ok) {
        fetchRequests()
        toast.success("Talep silindi")
      } else {
        const error = await res.json()
        toast.error(error.error || "Talep silinemedi")
      }
    } catch (error) {
      console.error("Talep silinirken hata:", error)
      toast.error("Bir hata olustu")
    }
  }

  const resetRequestForm = () => {
    setRequestForm({
      title: "",
      requestType: "NEW_POSITION",
      headcount: 1,
      employmentType: "FULL_TIME",
      justification: "",
      responsibilities: "",
      requirements: "",
      preferredStartDate: "",
      location: "",
      workModel: "ONSITE",
      salaryMin: "",
      salaryMax: "",
      hasBudget: false,
      priority: "MEDIUM",
      formHazirlanmaTarihi: "",
      ikTeslimTarihi: "",
      ayrilanPersonelAdi: "",
      kisilikOzellikleri: "",
      egitimSeviyesi: "",
      egitimDiger: "",
      tecrubeDurumu: "",
      tecrubeSuresi: "",
      yabanciDilGerekli: false,
      yabanciDiller: "",
      bilgisayarBilgisi: "",
      kaliteSistemBilgisi: "",
      ehliyetGerekli: false,
      ehliyetSinifi: "",
      digerBelgeIhtiyaci: "",
      cinsiyetTercihi: "",
      yasAraligiMin: "",
      yasAraligiMax: "",
      askerlikGerekli: false,
    })
  }

  // Yetki kontrolleri
  const userRole = session?.user?.role || ""
  const userDepartment = session?.user?.department || ""
  const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"]
  const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"]
  const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept))
  const hasFullAccess = fullAccessRoles.includes(userRole) || isHrDepartment

  const filteredRequests = requests

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Yukleniyor...</div>
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Personel Talepleri</CardTitle>
              <CardDescription>
                Departmanlardan gelen personel talepleri
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" onClick={() => setIsRequestDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Personel Talebi
              </Button>
              {/* Elle doldurulabilir boş IV-FR-24 formu */}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    "/api/strategic-hr/recruitment/personnel-requests/bos-form/pdf",
                    "_blank",
                  )
                }
              >
                <FileText className="h-4 w-4 mr-1" />
                Boş Form (IV-FR-24)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Henuz personel talebi yok.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Talep No</TableHead>
                  <TableHead>Pozisyon</TableHead>
                  <TableHead>Departman</TableHead>
                  <TableHead>Talep Eden</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Kisi</TableHead>
                  <TableHead>Oncelik</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-xs">{req.requestNumber}</TableCell>
                    <TableCell className="font-medium">{req.title}</TableCell>
                    <TableCell>{req.department}</TableCell>
                    <TableCell>{req.requesterName}</TableCell>
                    <TableCell>{requestTypeLabels[req.requestType]}</TableCell>
                    <TableCell>{req.headcount}</TableCell>
                    <TableCell>
                      <Badge className={priorityColors[req.priority]}>
                        {priorityLabels[req.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={requestStatusColors[req.status]}>
                        {requestStatusLabels[req.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(req.createdAt), "d MMM", { locale: tr })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Islemler</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => {
                            setSelectedRequest(req)
                            setSalaryForm({ salaryMin: req.salaryMin != null ? String(req.salaryMin) : "", salaryMax: req.salaryMax != null ? String(req.salaryMax) : "", hasBudget: req.hasBudget })
                            setIvForm({
                              adayKaynaklari: Array.isArray(req.adayKaynaklari) ? req.adayKaynaklari : [],
                              ilanPortallari: req.ilanPortallari || "",
                              adayKaynagiDiger: req.adayKaynagiDiger || "",
                              kadroDoldurulmaTarihi: req.kadroDoldurulmaTarihi ? String(req.kadroDoldurulmaTarihi).slice(0, 10) : "",
                              iseBaslayanPersonelAdi: req.iseBaslayanPersonelAdi || "",
                            })
                            setIsRequestDetailOpen(true)
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Detay Gor
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              window.open(
                                `/api/strategic-hr/recruitment/personnel-requests/${req.id}/pdf`,
                                "_blank",
                              )
                            }
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            PDF İndir (IV-FR-24)
                          </DropdownMenuItem>
                          {req.status === "DRAFT" && req.requesterEmail === session?.user?.email && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setSubmitConfirmId(req.id)}>
                                <Play className="h-4 w-4 mr-2" />
                                Onaya Gonder
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteRequest(req.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Sil
                              </DropdownMenuItem>
                            </>
                          )}
                          {req.status === "PENDING" && hasFullAccess && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleRequestAction(req.id, "approve")}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Onayla
                              </DropdownMenuItem>
                            </>
                          )}
                          {req.status === "APPROVED" && hasFullAccess && !req.jobOpening && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleRequestAction(req.id, "create_opening")}>
                                <FileText className="h-4 w-4 mr-2" />
                                Ilan Olustur
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Yeni Personel Talebi Modal */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Personel Talebi</DialogTitle>
            <DialogDescription>
              Departmaniniz icin yeni personel talebinde bulunun
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => handleRequestSubmit(e, false)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Pozisyon Adi *</Label>
                <Input
                  value={requestForm.title}
                  onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                  placeholder="Yazilim Muhendisi"
                  required
                />
              </div>

              <div>
                <Label>Talep Tipi</Label>
                <Select
                  value={requestForm.requestType}
                  onValueChange={(v) => setRequestForm({ ...requestForm, requestType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW_POSITION">Yeni Pozisyon</SelectItem>
                    <SelectItem value="REPLACEMENT">Yenileme (Ayrilan Yerine)</SelectItem>
                    <SelectItem value="EXPANSION">Kadro Genisletme</SelectItem>
                    <SelectItem value="TEMPORARY">Gecici/Donemel</SelectItem>
                    <SelectItem value="INTERN">Stajyer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Kisi Sayisi</Label>
                <Input
                  type="number"
                  min={1}
                  value={requestForm.headcount}
                  onChange={(e) => setRequestForm({ ...requestForm, headcount: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div>
                <Label>Calisma Tipi</Label>
                <Select
                  value={requestForm.employmentType}
                  onValueChange={(v) => setRequestForm({ ...requestForm, employmentType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">Tam Zamanli</SelectItem>
                    <SelectItem value="PART_TIME">Yari Zamanli</SelectItem>
                    <SelectItem value="CONTRACT">Sozlesmeli</SelectItem>
                    <SelectItem value="INTERN">Stajyer</SelectItem>
                    <SelectItem value="TEMPORARY">Gecici</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Oncelik</Label>
                <Select
                  value={requestForm.priority}
                  onValueChange={(v) => setRequestForm({ ...requestForm, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Dusuk</SelectItem>
                    <SelectItem value="MEDIUM">Orta</SelectItem>
                    <SelectItem value="HIGH">Yuksek</SelectItem>
                    <SelectItem value="URGENT">Acil</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tercih Edilen Baslama</Label>
                <Input
                  type="date"
                  value={requestForm.preferredStartDate}
                  onChange={(e) => setRequestForm({ ...requestForm, preferredStartDate: e.target.value })}
                />
              </div>

              <div>
                <Label>Lokasyon</Label>
                <Input
                  value={requestForm.location}
                  onChange={(e) => setRequestForm({ ...requestForm, location: e.target.value })}
                  placeholder="Istanbul"
                />
              </div>

              <div>
                <Label>Calisma Modeli</Label>
                <Select
                  value={requestForm.workModel}
                  onValueChange={(v) => setRequestForm({ ...requestForm, workModel: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONSITE">Ofis</SelectItem>
                    <SelectItem value="REMOTE">Uzaktan</SelectItem>
                    <SelectItem value="HYBRID">Hibrit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* IV-FR-24 · Bölüm 1 ek alanları (form tarihleri, ayrılan personel, kişilik) */}
              <TalepBilgisiEkSection form={requestForm} set={setReq} />

              {/* Maaş/bütçe TALEP FORMUNDAN çıkarıldı (Elif geri bildirimi) — birim müdürü
                  girmez; İK talep detayında girer. Alanlar şemada + İK görünümünde durur. */}

              <div className="col-span-2">
                <Label>Gerekce / Neden Ihtiyac Var? *</Label>
                <Textarea
                  value={requestForm.justification}
                  onChange={(e) => setRequestForm({ ...requestForm, justification: e.target.value })}
                  placeholder="Bu pozisyona neden ihtiyac duyuluyor? Mevcut is yukunuz, proje gereksinimleri vb."
                  rows={3}
                  required
                />
              </div>

              <div className="col-span-2">
                <Label>Gorev Tanimi</Label>
                <Textarea
                  value={requestForm.responsibilities}
                  onChange={(e) => setRequestForm({ ...requestForm, responsibilities: e.target.value })}
                  placeholder="Bu pozisyonun ana sorumlulukları..."
                  rows={3}
                />
              </div>

              <div className="col-span-2">
                <Label>Aranan Ozellikler (serbest metin)</Label>
                <Textarea
                  value={requestForm.requirements}
                  onChange={(e) => setRequestForm({ ...requestForm, requirements: e.target.value })}
                  placeholder="Egitim, deneyim, beceriler..."
                  rows={3}
                />
              </div>

            </div>

            {/* IV-FR-24 · Bölüm 2: Aranan Yetkinlikler (yapılandırılmış alanlar) */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3 text-[#1B4F72]">Aranan Yetkinlikler</h3>
              <ArananYetkinliklerSection form={requestForm} set={setReq} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsRequestDialogOpen(false)}>
                Iptal
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!requestForm.title || !requestForm.justification}
                onClick={(e) => handleRequestSubmit(e as any, false)}
              >
                Taslak Kaydet
              </Button>
              <Button
                type="button"
                disabled={!requestForm.title || !requestForm.justification}
                onClick={(e) => handleRequestSubmit(e as any, true)}
              >
                Onaya Gonder
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Talep Detay Modal */}
      <Dialog open={isRequestDetailOpen} onOpenChange={setIsRequestDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl">{selectedRequest.title}</DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1">
                      <span className="font-mono">{selectedRequest.requestNumber}</span>
                      <Badge className={requestStatusColors[selectedRequest.status]}>
                        {requestStatusLabels[selectedRequest.status]}
                      </Badge>
                    </DialogDescription>
                  </div>
                  {/* IV-FR-24 PDF çıktısı */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mr-6 shrink-0"
                    onClick={() =>
                      window.open(
                        `/api/strategic-hr/recruitment/personnel-requests/${selectedRequest.id}/pdf`,
                        "_blank",
                      )
                    }
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    PDF İndir
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Talep Eden:</span>
                    <p className="font-medium">{selectedRequest.requesterName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Departman:</span>
                    <p className="font-medium">{selectedRequest.department}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Talep Tipi:</span>
                    <p className="font-medium">{requestTypeLabels[selectedRequest.requestType]}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kisi Sayisi:</span>
                    <p className="font-medium">{selectedRequest.headcount}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Calisma Tipi:</span>
                    <p className="font-medium">{employmentTypeLabels[selectedRequest.employmentType]}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Oncelik:</span>
                    <Badge className={priorityColors[selectedRequest.priority]}>
                      {priorityLabels[selectedRequest.priority]}
                    </Badge>
                  </div>
                  {selectedRequest.location && (
                    <div>
                      <span className="text-muted-foreground">Lokasyon:</span>
                      <p className="font-medium">{selectedRequest.location}</p>
                    </div>
                  )}
                  {selectedRequest.preferredStartDate && (
                    <div>
                      <span className="text-muted-foreground">Tercih Edilen Baslama:</span>
                      <p className="font-medium">
                        {format(new Date(selectedRequest.preferredStartDate), "d MMM yyyy", { locale: tr })}
                      </p>
                    </div>
                  )}
                </div>

                {/* İK maaş/bütçe — YALNIZ recruitment.admin görür + düzenler (birim müdürü görmez) */}
                {hasFullAccess && (
                  <div className="border rounded-md p-3 bg-slate-50">
                    <h4 className="font-medium mb-2 text-sm">İK: Maaş / Bütçe (yalnız İK)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                      <div>
                        <Label className="text-xs">Min Maaş (TL)</Label>
                        <Input type="number" value={salaryForm.salaryMin} onChange={(e) => setSalaryForm({ ...salaryForm, salaryMin: e.target.value })} placeholder="—" />
                      </div>
                      <div>
                        <Label className="text-xs">Max Maaş (TL)</Label>
                        <Input type="number" value={salaryForm.salaryMax} onChange={(e) => setSalaryForm({ ...salaryForm, salaryMax: e.target.value })} placeholder="—" />
                      </div>
                      <div className="flex items-center gap-2 h-9">
                        <input type="checkbox" id="ikHasBudget" checked={salaryForm.hasBudget} onChange={(e) => setSalaryForm({ ...salaryForm, hasBudget: e.target.checked })} className="rounded border-gray-300" />
                        <Label htmlFor="ikHasBudget" className="cursor-pointer text-xs">Bütçe onayı mevcut</Label>
                      </div>
                    </div>
                    <Button size="sm" className="mt-2 bg-[#1B4F72]" onClick={() => handleSalarySave(selectedRequest.id)}>Maaş/Bütçe Kaydet</Button>
                  </div>
                )}

                {/* IV-FR-24 · Bölüm 3: İnsan Varlıkları kapanış — YALNIZ recruitment.admin (İK) */}
                {hasFullAccess && (
                  <InsanVarliklariSection form={ivForm} set={setIv} onSave={() => handleIvSave(selectedRequest.id)} />
                )}

                <div>
                  <h4 className="font-medium mb-1">Gerekce</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedRequest.justification}
                  </p>
                </div>

                {selectedRequest.responsibilities && (
                  <div>
                    <h4 className="font-medium mb-1">Gorev Tanimi</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedRequest.responsibilities}
                    </p>
                  </div>
                )}

                {selectedRequest.requirements && (
                  <div>
                    <h4 className="font-medium mb-1">Aranan Ozellikler</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedRequest.requirements}
                    </p>
                  </div>
                )}

                {selectedRequest.status === "APPROVED" && selectedRequest.approvedByName && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>Onaylayan:</strong> {selectedRequest.approvedByName}
                      {selectedRequest.approvedAt && (
                        <span> - {format(new Date(selectedRequest.approvedAt), "d MMM yyyy HH:mm", { locale: tr })}</span>
                      )}
                    </p>
                    {selectedRequest.approvalNotes && (
                      <p className="text-sm text-green-700 mt-1">{selectedRequest.approvalNotes}</p>
                    )}
                  </div>
                )}

                {selectedRequest.status === "REJECTED" && selectedRequest.rejectedByName && (
                  <div className="bg-red-50 p-3 rounded-lg">
                    <p className="text-sm text-red-800">
                      <strong>Reddeden:</strong> {selectedRequest.rejectedByName}
                      {selectedRequest.rejectedAt && (
                        <span> - {format(new Date(selectedRequest.rejectedAt), "d MMM yyyy HH:mm", { locale: tr })}</span>
                      )}
                    </p>
                    {selectedRequest.rejectionReason && (
                      <p className="text-sm text-red-700 mt-1"><strong>Sebep:</strong> {selectedRequest.rejectionReason}</p>
                    )}
                  </div>
                )}

                {selectedRequest.jobOpening && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Olusturulan Ilan:</strong> {selectedRequest.jobOpening.code} - {selectedRequest.jobOpening.title}
                    </p>
                  </div>
                )}

                {/* Onay zinciri (3 kademe: Müdür → GMY → GM) */}
                {selectedRequest.approvals && selectedRequest.approvals.length > 0 && (
                  <div className="border rounded-lg p-3">
                    <p className="text-sm font-medium mb-2">Onay Zinciri</p>
                    <div className="space-y-2">
                      {selectedRequest.approvals.map((a) => {
                        const isCurrent =
                          a.decision === null &&
                          selectedRequest.approvals?.find((x) => x.decision === null)?.id === a.id
                        return (
                          <div key={a.id} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium">{a.step}. {a.role}</span>
                              {a.approver?.name && <span className="text-slate-500"> — {a.approver.name}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {a.decision === "APPROVED" ? (
                                <Badge className="bg-green-100 text-green-700">Onayladı</Badge>
                              ) : a.decision === "REJECTED" ? (
                                <Badge className="bg-red-100 text-red-700">Reddetti</Badge>
                              ) : isCurrent ? (
                                <Badge className="bg-amber-100 text-amber-700">Sırada</Badge>
                              ) : (
                                <Badge variant="secondary">Bekliyor</Badge>
                              )}
                              {a.decidedAt && (
                                <span className="text-xs text-slate-400">
                                  {format(new Date(a.decidedAt), "d MMM HH:mm", { locale: tr })}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {/* Atlanan adımlar: talep sahibi o adımın onaycısı olduğu için
                          adım hiç oluşturulmadı (kanonik 4 kademeden eksik olanlar). */}
                      {(() => {
                        const kademeLabels: Record<string, string> = {
                          BOLUM_MUDURU: "Bölüm Müdürü",
                          DEPUTY_GM: "Genel Müdür Yardımcısı",
                          GM: "Genel Müdür",
                          HR_MANAGER: "İK Müdürü",
                        }
                        const varOlan = new Set(selectedRequest.approvals?.map((a) => a.kademe))
                        return Object.keys(kademeLabels)
                          .filter((k) => !varOlan.has(k))
                          .map((k) => (
                            <div key={k} className="flex items-center justify-between text-sm opacity-70">
                              <div>
                                <span className="font-medium">{kademeLabels[k]}</span>
                              </div>
                              <Badge variant="secondary" className="bg-slate-100 text-slate-500">
                                Talep sahibi olduğu için bu adım atlandı
                              </Badge>
                            </div>
                          ))
                      })()}
                    </div>
                  </div>
                )}

                {/* Red gerekce alani — yalnız sıradaki adımın onaycısına */}
                {selectedRequest.status === "PENDING" &&
                  selectedRequest.approvals?.find((a) => a.decision === null)?.approver?.email === session?.user?.email && (
                  <div>
                    <Label>Red Gerekcesi (red icin zorunlu)</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Talebin neden reddedildigini aciklayin..."
                      rows={2}
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                {/* Talep sahibi islemleri */}
                {selectedRequest.status === "DRAFT" && selectedRequest.requesterEmail === session?.user?.email && (
                  <>
                    <Button variant="outline" onClick={() => setSubmitConfirmId(selectedRequest.id)}>
                      Onaya Gonder
                    </Button>
                    <Button variant="destructive" onClick={() => handleDeleteRequest(selectedRequest.id)}>
                      Sil
                    </Button>
                  </>
                )}

                {selectedRequest.status === "PENDING" && selectedRequest.requesterEmail === session?.user?.email && (
                  <Button variant="outline" onClick={() => handleRequestAction(selectedRequest.id, "cancel")}>
                    Iptal Et
                  </Button>
                )}

                {/* Onay/red: YALNIZ sıradaki adımın onaycısı (admin bile başkası adına onaylayamaz) */}
                {selectedRequest.status === "PENDING" &&
                  selectedRequest.approvals?.find((a) => a.decision === null)?.approver?.email === session?.user?.email && (
                  <>
                    <Button
                      variant="destructive"
                      disabled={!rejectionReason}
                      onClick={() => handleRequestAction(selectedRequest.id, "reject", { rejectionReason })}
                    >
                      Reddet
                    </Button>
                    <Button onClick={() => handleRequestAction(selectedRequest.id, "approve")}>
                      Onayla
                    </Button>
                  </>
                )}

                {selectedRequest.status === "APPROVED" && hasFullAccess && !selectedRequest.jobOpening && (
                  <Button onClick={() => handleRequestAction(selectedRequest.id, "create_opening")}>
                    Ilan Olustur
                  </Button>
                )}

                <Button variant="outline" onClick={() => setIsRequestDetailOpen(false)}>
                  Kapat
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Onaya Gönder gerekçe uyarısı (Elif 2. tur) */}
      <Dialog open={!!submitConfirmId} onOpenChange={(o) => !o && setSubmitConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Onaya Göndermeden Önce</DialogTitle>
            <DialogDescription>
              Gerekçe alanını detaylı doldurduğunuzdan emin olun. Yetersiz görülen talepler
              reddedilir ve yeniden talep açmanız gerekir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSubmitConfirmId(null)}>Vazgeç</Button>
            <Button onClick={() => { const id = submitConfirmId; setSubmitConfirmId(null); if (id) handleRequestAction(id, "submit") }}>Onaya Gönder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
