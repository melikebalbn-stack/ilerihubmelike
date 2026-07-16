"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams, useParams } from "next/navigation"
import Link from "next/link"
import { canAccessPersonnel } from "@/lib/auth/personnel-access"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect as Select } from "@/components/ui/select"
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
import { ArrowLeft, Save, Loader2, Pencil, Shield, Eye, UserX, ArrowRightLeft, History, CalendarClock } from "lucide-react"
import { periodDuration, formatDuration } from "@/lib/personnel-tenure"
import { PersonnelAutocomplete } from "@/components/ui/personnel-autocomplete"
import { PersonnelExitModal, type ExitData } from "@/components/personnel/PersonnelExitModal"
import { PersonnelTransferModal } from "@/components/personnel/department-transfer/PersonnelTransferModal"
import { PersonnelTransferHistory } from "@/components/personnel/department-transfer/PersonnelTransferHistory"
import { toast } from "sonner"
import {
  KAN_GRUBU_LABELS,
  CINSIYET_LABELS,
  YAKA_LABELS,
  YAKA_DETAYI_LABELS,
  YAKA_DETAY_MAP,
  DIREKT_ENDIREKT_LABELS,
  ASANSOR_MEKANIK_LABELS,
} from "@/lib/personnel-constants"
import { UST_BEDENLER, AYAKKABI_NOLARI, AYAK_UZUNLUK_CM, oneriAltBeden, altBedenSecenekleri } from "@/lib/envanter/beden-referans"
import type { Gender } from "@/generated/prisma"

// PR-C: İstihdam dönemi (salt görüntüleme)
type EmploymentPeriodItem = {
  id: string
  girisTarihi: string
  cikisTarihi: string | null
  exitParty: string | null
  exitCode: string | null
  exitReason: string | null
  exitRootCause: string | null
  exitTurnoverType: string | null
  exitGeneralNote: string | null
  entryRecordedAt: string | null
  exitRecordedAt: string | null
}

type PersonnelData = {
  id: string
  sicilNo: string
  adSoyad: string
  cinsiyet: string | null
  sinif: string | null
  yakaRengi: string | null
  yakaDetayi: string | null
  kanGrubu: string | null
  gorev: string | null
  bolum: string | null
  bolumDetay: string | null
  birimSorumlusu: string | null
  sorumlu2: string | null
  sorumlu3: string | null
  bolumMuduru: string | null
  direktEndirekt: string | null
  asansorMekanik: string | null
  masrafMerkezi: string | null
  iseGirisTarihi: string | null
  telefon: string | null
  interKepMail: string | null
  mailAdresi: string | null
  ikametAdresi: string | null
  serviceRoute: string | null
  serviceStop: string | null
  egitimYeri: string | null
  egitimTipi: string | null
  egitimAlani: string | null
  mezuniyetYili: string | null
  ilkYardimciBelgesi: string | null
  kalfalikBelgesi: string | null
  ustalikBelgesi: string | null
  forkliftEhliyeti: boolean
  vincEhliyeti: boolean
  yanginSertifikasi: string | null
  mykBelgesiTarihi: string | null
  eTrans: boolean
  ustaOgreticiBelgesi: boolean
  emekli: boolean
  engelli: boolean
  aktif: boolean
  denemeDegerlendirme: string | null
  altiAyDegerlendirme: string | null
  // PR-4a: Personnel.exit* + workingPeriod artık API'den dönmüyor — çıkış verisi
  // lastClosedPeriod'dan (aşağıda). Alanlar 4b'de DROP edilecek.
  // PR-C
  employmentPeriods: EmploymentPeriodItem[]
  employmentSummary: {
    years: number
    months: number
    totalMonths: number
    firstEntryDate: string | null
    periodCount: number
  } | null
  // PR-EXIT-READ-FROM-PERIODS: Çıkış Bilgileri kartı bu son kapalı dönemden beslenir.
  lastClosedPeriod: {
    girisTarihi: string | null
    cikisTarihi: string | null
    exitParty: string | null
    exitCode: string | null
    exitReason: string | null
    exitRootCause: string | null
    exitTurnoverType: string | null
    exitGeneralNote: string | null
    exitRecordedAt: string | null
    exitRecordedBy: { name: string | null; email: string } | null
    workingPeriod: { years: number; months: number; totalMonths: number } | null
  } | null
  // Envanter: personel beden profili (1-1, opsiyonel)
  bedenProfili: {
    ustBeden: string | null
    altBeden: string | null
    ayakkabiNo: string | null
    eldivenNo: string | null
    olcuTarihi: string | null
    not: string | null
  } | null
}

// Erişim: src/lib/auth/personnel-access.ts (canAccessPersonnel) — tek kaynak.
// Backend hasEditAccess ile aynı sözleşme (rol || İnsan Varlıkları departmanı).

export default function PersonnelDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const userRole = session?.user?.role as string
  const userDepartment = (session?.user as { department?: string | null } | undefined)?.department
  const isAdmin = canAccessPersonnel(userRole, userDepartment)

  const [data, setData] = useState<PersonnelData | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(searchParams.get("edit") === "true")
  const [jobTitles, setJobTitles] = useState<string[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [personnelNames, setPersonnelNames] = useState<string[]>([])
  // Alt beden "Diğer..." (serbest metin) modu — liste dışı değer yüklenince/seçilince açılır.
  const [altBedenDiger, setAltBedenDiger] = useState(false)
  // PR-PERSONEL-CIKIS-FORMU
  const [showExitModal, setShowExitModal] = useState(false)
  const [exitModalMode, setExitModalMode] = useState<"create" | "edit">("create")
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false)
  const [reactivating, setReactivating] = useState(false)
  const [reentryDate, setReentryDate] = useState(() => new Date().toISOString().slice(0, 10))
  // PR-PERSONNEL-DEPARTMENT-TRANSFER
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferRefreshKey, setTransferRefreshKey] = useState(0)

  useEffect(() => {
    fetch("/api/settings/job-titles")
      .then(r => r.ok ? r.json() : [])
      .then((data: { name: string }[]) => setJobTitles(data.map(j => j.name)))
      .catch(() => {})
    fetch("/api/settings/hr-departments")
      .then(r => r.ok ? r.json() : [])
      .then((data: { name: string }[]) => setDepartments(data.map(d => d.name)))
      .catch(() => {})
    fetch("/api/overtime/personnel-list")
      .then(r => r.ok ? r.json() : [])
      .then((data: { adSoyad: string }[]) => setPersonnelNames(data.map(p => p.adSoyad)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/personnel/${id}`)
        if (!res.ok) throw new Error("Veri yüklenemedi")
        const json = await res.json()
        setData(json)
        // Prepare form data
        const formData: Record<string, any> = {}
        Object.entries(json).forEach(([k, v]) => {
          if (k === "iseGirisTarihi" && v) {
            formData[k] = new Date(v as string).toISOString().slice(0, 10)
          } else {
            formData[k] = v ?? ""
          }
        })
        applyBedenToForm(formData, json)
        setForm(formData)
      } catch (err: any) {
        toast.error(err.message || "Veriler yüklenemedi")
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchData()
  }, [id])

  const addMonths = (iso: string, months: number): string => {
    if (!iso) return ""
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ""
    const day = d.getDate()
    d.setMonth(d.getMonth() + months)
    if (d.getDate() !== day) d.setDate(0)
    return d.toISOString().split("T")[0]
  }

  // Beden profilini (nested obje) flat form alanlarına aç. bedenProfili nested obje
  // input'lara bağlanmaz; PUT'ta da geri gönderilmez (handleSave strip eder).
  const applyBedenToForm = (fd: Record<string, any>, json: any) => {
    const bp = json?.bedenProfili
    fd.ustBeden = bp?.ustBeden ?? ""
    fd.altBeden = bp?.altBeden ?? ""
    fd.ayakkabiNo = bp?.ayakkabiNo ?? ""
    fd.eldivenNo = bp?.eldivenNo ?? ""
    fd.olcuTarihi = bp?.olcuTarihi ? new Date(bp.olcuTarihi).toISOString().slice(0, 10) : ""
    fd.bedenNot = bp?.not ?? ""
    delete fd.bedenProfili
    // Yüklenen alt beden, cinsiyetin liste seçeneklerinde yoksa "Diğer..." moduna geç.
    const opts = json?.cinsiyet ? altBedenSecenekleri(json.cinsiyet as Gender) : []
    setAltBedenDiger(!!fd.altBeden && !opts.includes(fd.altBeden))
  }

  const set = (field: string, value: string | boolean) => {
    setForm((prev) => {
      const next: Record<string, unknown> = { ...prev, [field]: value }
      // İşe giriş tarihi değişince deneme (2 ay) ve 6 ay değerlendirme tarihlerini otomatik hesapla
      if (field === "iseGirisTarihi" && typeof value === "string") {
        next.denemeDegerlendirme = addMonths(value, 2) || null
        next.altiAyDegerlendirme = addMonths(value, 6) || null
      }
      // Yaka değişince yakaDetayi'yi sıfırla (tutarsız yaka-detay kombinasyonu kalmasın).
      if (field === "yakaRengi") {
        next.yakaDetayi = ""
      }
      // Cinsiyet değişince: seçili alt beden (liste değeri) yeni listede yoksa temizle.
      // "Diğer..." (serbest) modundaki değer korunur.
      if (field === "cinsiyet" && !altBedenDiger) {
        const opts = value ? altBedenSecenekleri(value as Gender) : []
        if (next.altBeden && !opts.includes(next.altBeden as string)) {
          next.altBeden = ""
        }
      }
      return next as typeof prev
    })
  }

  const handleSave = async () => {
    if (!form.sicilNo || !form.adSoyad) {
      toast.error("Sicil No ve Ad Soyad zorunludur")
      return
    }
    // Yaka Aşama 1: aktif personelde Yaka Rengi + Yaka Detayı zorunlu (pasifte opsiyonel).
    if (data?.aktif && (!form.yakaRengi || !form.yakaDetayi)) {
      toast.error("Aktif personel için Yaka Rengi ve Yaka Detayı zorunludur")
      return
    }
    try {
      setSaving(true)
      // Beden alanlarını nested `beden` objesine topla; flat alanlar ve salt-okuma
      // bedenProfili payload'a girmez (API beden'i ayrı upsert eder).
      const { ustBeden, altBeden, ayakkabiNo, eldivenNo, olcuTarihi, bedenNot, bedenProfili, ...rest } = form
      const beden = { ustBeden, altBeden, ayakkabiNo, eldivenNo, olcuTarihi, not: bedenNot }
      const res = await fetch(`/api/personnel/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, beden }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "Güncelleme başarısız")
      }
      toast.success("Personel güncellendi")
      setEditMode(false)
      // Refresh data
      const updated = await res.json()
      setData(updated)
    } catch (err: any) {
      toast.error(err.message || "Bir hata oluştu")
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-"
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR")
    } catch {
      return "-"
    }
  }

  // PR-PERSONEL-CIKIS-FORMU: Toggle handler — modal/confirm tetikler
  const handleToggleAktif = () => {
    if (!data) return
    if (data.aktif) {
      setExitModalMode("create")
      setShowExitModal(true)
    } else {
      setShowReactivateConfirm(true)
    }
  }

  const refetchPersonnel = async () => {
    try {
      const res = await fetch(`/api/personnel/${id}`)
      if (!res.ok) return
      const json = await res.json()
      setData(json)
      const formData: Record<string, any> = {}
      Object.entries(json).forEach(([k, v]) => {
        if (k === "iseGirisTarihi" && v) {
          formData[k] = new Date(v as string).toISOString().slice(0, 10)
        } else if (k === "exitRecordedBy" || k === "workingPeriod" || k === "employmentPeriods" || k === "employmentSummary") {
          // Bu alanlar form'a girmez (salt görüntüleme / hesaplanmış)
        } else {
          formData[k] = v ?? ""
        }
      })
      applyBedenToForm(formData, json)
      setForm(formData)
    } catch {}
  }

  const saveExit = async (exitData: ExitData) => {
    const res = await fetch(`/api/personnel/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktif: false, ...exitData }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error || "Çıkış kaydı başarısız")
      throw new Error(err.error || "patch failed")
    }
    toast.success(exitModalMode === "create" ? "Personel pasife alındı" : "Çıkış bilgileri güncellendi")
    await refetchPersonnel()
  }

  const reactivate = async () => {
    if (!reentryDate) {
      toast.error("Yeniden giriş tarihi zorunludur")
      return
    }
    setReactivating(true)
    try {
      const res = await fetch(`/api/personnel/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktif: true, reentryDate }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Aktive geri alma başarısız")
        return
      }
      toast.success("Personel aktife alındı")
      setShowReactivateConfirm(false)
      await refetchPersonnel()
    } finally {
      setReactivating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p>Personel bulunamadı</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/personnel">Listeye Dön</Link>
        </Button>
      </div>
    )
  }

  // Display mode helper
  const displayValue = (value: string | null | undefined, labelsMap?: Record<string, string>) => {
    if (!value) return "-"
    if (labelsMap && labelsMap[value]) return labelsMap[value]
    return value
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/personnel">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{data.adSoyad}</h1>
            <p className="text-sm text-muted-foreground">Sicil No: {data.sicilNo}</p>
          </div>
          {editMode ? (
            <div className="flex items-center gap-2 ml-2">
              {/* PR-PERSONEL-CIKIS-FORMU: Toggle artık modal/confirm tetikler — bağımsız PATCH */}
              <button
                type="button"
                onClick={handleToggleAktif}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  data.aktif ? "bg-green-500" : "bg-gray-300"
                }`}
                title={data.aktif ? "Pasife al (çıkış formu)" : "Aktife geri al"}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  data.aktif ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
              <span className={`text-sm font-medium ${data.aktif ? "text-green-700" : "text-red-600"}`}>
                {data.aktif ? "Aktif" : "Pasif"}
              </span>
            </div>
          ) : (
            !data.aktif && <Badge variant="destructive">Pasif</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/personnel/${id}/sensitive`} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <Shield className="h-4 w-4" />
                Hassas Bilgiler
              </Link>
            </Button>
          )}
          {isAdmin && !editMode && data.aktif && (
            <Button size="sm" variant="outline" onClick={() => setShowTransferModal(true)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Bölüm Değiştir
            </Button>
          )}
          {isAdmin && !editMode && (
            <Button size="sm" onClick={() => setEditMode(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Düzenle
            </Button>
          )}
          {editMode && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                İptal
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Kaydet
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Section 1: Kimlik */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kimlik Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Sicil No *</Label>
                <Input value={form.sicilNo || ""} onChange={(e) => set("sicilNo", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ad Soyad *</Label>
                <Input value={form.adSoyad || ""} onChange={(e) => set("adSoyad", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cinsiyet</Label>
                <Select value={form.cinsiyet || ""} onChange={(e) => set("cinsiyet", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(CINSIYET_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sınıf</Label>
                <Input value={form.sinif || ""} onChange={(e) => set("sinif", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Yaka Rengi{data.aktif ? " *" : ""}</Label>
                <Select value={form.yakaRengi || ""} onChange={(e) => set("yakaRengi", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(YAKA_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Yaka Detayı{data.aktif ? " *" : ""}</Label>
                <Select
                  value={form.yakaDetayi || ""}
                  onChange={(e) => set("yakaDetayi", e.target.value)}
                  disabled={!form.yakaRengi}
                >
                  <option value="">{form.yakaRengi ? "Seçiniz" : "Önce yaka seçin"}</option>
                  {(YAKA_DETAY_MAP[form.yakaRengi as string] ?? []).map((k) => (
                    <option key={k} value={k}>{YAKA_DETAYI_LABELS[k] ?? k}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kan Grubu</Label>
                <Select value={form.kanGrubu || ""} onChange={(e) => set("kanGrubu", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(KAN_GRUBU_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><p className="text-sm text-muted-foreground">Sicil No</p><p className="font-medium">{data.sicilNo}</p></div>
              <div><p className="text-sm text-muted-foreground">Ad Soyad</p><p className="font-medium">{data.adSoyad}</p></div>
              <div><p className="text-sm text-muted-foreground">Cinsiyet</p><p className="font-medium">{displayValue(data.cinsiyet, CINSIYET_LABELS)}</p></div>
              <div><p className="text-sm text-muted-foreground">Sınıf</p><p className="font-medium">{data.sinif || "-"}</p></div>
              <div>
                <p className="text-sm text-muted-foreground">Yaka Rengi</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {data.yakaRengi === "MAVI" && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Mavi Yaka</Badge>}
                  {data.yakaRengi === "BEYAZ" && <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Beyaz Yaka</Badge>}
                  {data.yakaRengi === "GRI" && <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Gri Yaka</Badge>}
                  {!data.yakaRengi && <p className="font-medium">-</p>}
                  {data.yakaDetayi && (
                    <span className="text-xs text-muted-foreground">
                      {YAKA_DETAYI_LABELS[data.yakaDetayi] ?? data.yakaDetayi}
                    </span>
                  )}
                </div>
              </div>
              <div><p className="text-sm text-muted-foreground">Kan Grubu</p><p className="font-medium">{displayValue(data.kanGrubu, KAN_GRUBU_LABELS)}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: İstihdam */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">İstihdam Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Görev *</Label>
                <Select value={form.gorev || ""} onChange={(e) => set("gorev", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {jobTitles.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                  {form.gorev && !jobTitles.includes(form.gorev) && (
                    <option value={form.gorev}>{form.gorev} (eski)</option>
                  )}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bölüm *</Label>
                <Select value={form.bolum || ""} onChange={(e) => set("bolum", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {departments.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  {form.bolum && !departments.includes(form.bolum) && (
                    <option value={form.bolum}>{form.bolum} (eski)</option>
                  )}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bölüm Detay</Label>
                <Input value={form.bolumDetay || ""} onChange={(e) => set("bolumDetay", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>1. Sorumlu</Label>
                <PersonnelAutocomplete value={form.birimSorumlusu || ""} onChange={(v) => set("birimSorumlusu", v)} personnel={personnelNames} />
              </div>
              <div className="space-y-2">
                <Label>2. Sorumlu</Label>
                <PersonnelAutocomplete value={form.sorumlu2 || ""} onChange={(v) => set("sorumlu2", v)} personnel={personnelNames} />
              </div>
              <div className="space-y-2">
                <Label>3. Sorumlu</Label>
                <PersonnelAutocomplete value={form.sorumlu3 || ""} onChange={(v) => set("sorumlu3", v)} personnel={personnelNames} />
              </div>
              <div className="space-y-2">
                <Label>Bölüm Müdürü</Label>
                <PersonnelAutocomplete value={form.bolumMuduru || ""} onChange={(v) => set("bolumMuduru", v)} personnel={personnelNames} />
              </div>
              <div className="space-y-2">
                <Label>Direkt / Endirekt</Label>
                <Select value={form.direktEndirekt || ""} onChange={(e) => set("direktEndirekt", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(DIREKT_ENDIREKT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Asansör / Mekanik</Label>
                <Select value={form.asansorMekanik || ""} onChange={(e) => set("asansorMekanik", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {Object.entries(ASANSOR_MEKANIK_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Masraf Merkezi</Label>
                <Select value={form.masrafMerkezi || ""} onChange={(e) => set("masrafMerkezi", e.target.value)}>
                  <option value="">Seçiniz</option>
                  <option value="720.1.01">720.1.01</option>
                  <option value="750.1.01">750.1.01</option>
                  <option value="760.1.01">760.1.01</option>
                  <option value="770.1.01">770.1.01</option>
                  {form.masrafMerkezi && !["720.1.01","750.1.01","760.1.01","770.1.01"].includes(form.masrafMerkezi) && (
                    <option value={form.masrafMerkezi}>{form.masrafMerkezi} (eski)</option>
                  )}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>İşe Giriş Tarihi *</Label>
                <Input type="date" value={form.iseGirisTarihi || ""} onChange={(e) => set("iseGirisTarihi", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Servis</Label>
                <Select value={form.serviceRoute || ""} onChange={(e) => set("serviceRoute", e.target.value)}>
                  <option value="">Seçiniz</option>
                  <option value="ARAPÇEŞME">ARAPÇEŞME</option>
                  <option value="AYDOS-KURTKÖY">AYDOS-KURTKÖY</option>
                  <option value="KAVACIK-BEYKOZ">KAVACIK-BEYKOZ</option>
                  <option value="BEYLİKBAĞI GÜZELTEPE">BEYLİKBAĞI GÜZELTEPE</option>
                  <option value="BEYLİKBAĞI ULAŞTEPE">BEYLİKBAĞI ULAŞTEPE</option>
                  <option value="DARICA">DARICA</option>
                  <option value="ÇARŞI-DEVELİ">ÇARŞI-DEVELİ</option>
                  <option value="KAYNARCA-KARTAL">KAYNARCA-KARTAL</option>
                  <option value="ÜSKÜDAR">ÜSKÜDAR</option>
                  {form.serviceRoute && !["ARAPÇEŞME","AYDOS-KURTKÖY","KAVACIK-BEYKOZ","BEYLİKBAĞI GÜZELTEPE","BEYLİKBAĞI ULAŞTEPE","DARICA","ÇARŞI-DEVELİ","KAYNARCA-KARTAL","ÜSKÜDAR"].includes(form.serviceRoute) && (
                    <option value={form.serviceRoute}>{form.serviceRoute} (eski)</option>
                  )}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Durak Adı</Label>
                <Input value={form.serviceStop || ""} onChange={(e) => set("serviceStop", e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-sm text-muted-foreground">Görev</p><p className="font-medium">{data.gorev || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Bölüm</p><p className="font-medium">{data.bolum || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Bölüm Detay</p><p className="font-medium">{data.bolumDetay || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">1. Sorumlu</p><p className="font-medium">{data.birimSorumlusu || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">2. Sorumlu</p><p className="font-medium">{data.sorumlu2 || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">3. Sorumlu</p><p className="font-medium">{data.sorumlu3 || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Bölüm Müdürü</p><p className="font-medium">{data.bolumMuduru || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Direkt / Endirekt</p><p className="font-medium">{displayValue(data.direktEndirekt, DIREKT_ENDIREKT_LABELS)}</p></div>
              <div><p className="text-sm text-muted-foreground">Asansör / Mekanik</p><p className="font-medium">{displayValue(data.asansorMekanik, ASANSOR_MEKANIK_LABELS)}</p></div>
              <div><p className="text-sm text-muted-foreground">Masraf Merkezi</p><p className="font-medium">{data.masrafMerkezi || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">İşe Giriş Tarihi</p><p className="font-medium">{formatDate(data.iseGirisTarihi)}</p></div>
              <div><p className="text-sm text-muted-foreground">Servis</p><p className="font-medium">{data.serviceRoute || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Durak Adı</p><p className="font-medium">{data.serviceStop || "-"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: İletişim */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">İletişim Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={form.telefon || ""} onChange={(e) => set("telefon", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>KEP Adresi</Label>
                <Input type="email" value={form.interKepMail || ""} onChange={(e) => set("interKepMail", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Mail Adresi</Label>
                <Input type="email" value={form.mailAdresi || ""} onChange={(e) => set("mailAdresi", e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>İkamet Adresi</Label>
                <Input value={form.ikametAdresi || ""} onChange={(e) => set("ikametAdresi", e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><p className="text-sm text-muted-foreground">Telefon</p><p className="font-medium">{data.telefon || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">KEP Adresi</p><p className="font-medium">{data.interKepMail || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Mail Adresi</p><p className="font-medium">{data.mailAdresi || "-"}</p></div>
              <div className="md:col-span-3"><p className="text-sm text-muted-foreground">İkamet Adresi</p><p className="font-medium">{data.ikametAdresi || "-"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Eğitim */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Eğitim Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Eğitim Yeri</Label>
                <Input value={form.egitimYeri || ""} onChange={(e) => set("egitimYeri", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Eğitim Tipi</Label>
                <Select value={form.egitimTipi || ""} onChange={(e) => set("egitimTipi", e.target.value)}>
                  <option value="">Seçiniz</option>
                  <option value="İlköğretim">İlköğretim</option>
                  <option value="Lise">Lise</option>
                  <option value="E.M.L.">E.M.L.</option>
                  <option value="T.M.L">T.M.L</option>
                  <option value="M.Y.O.">M.Y.O.</option>
                  <option value="Üniversite">Üniversite</option>
                  <option value="ÜNİVERSİTE MH.">ÜNİVERSİTE MH.</option>
                  <option value="ÜNİVERSİTE Y.L.">ÜNİVERSİTE Y.L.</option>
                  {form.egitimTipi && !["İlköğretim","Lise","E.M.L.","T.M.L","M.Y.O.","Üniversite","ÜNİVERSİTE MH.","ÜNİVERSİTE Y.L."].includes(form.egitimTipi) && (
                    <option value={form.egitimTipi}>{form.egitimTipi} (eski)</option>
                  )}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Eğitim Alanı</Label>
                <Input value={form.egitimAlani || ""} onChange={(e) => set("egitimAlani", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Mezuniyet Yılı</Label>
                <Input value={form.mezuniyetYili || ""} onChange={(e) => set("mezuniyetYili", e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-sm text-muted-foreground">Eğitim Yeri</p><p className="font-medium">{data.egitimYeri || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Eğitim Tipi</p><p className="font-medium">{data.egitimTipi || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Eğitim Alanı</p><p className="font-medium">{data.egitimAlani || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Mezuniyet Yılı</p><p className="font-medium">{data.mezuniyetYili || "-"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Belgeler */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Belgeler</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>İlk Yardımcı Belgesi Tarihi</Label>
                <Input type="date" value={form.ilkYardimciBelgesi ? new Date(form.ilkYardimciBelgesi).toISOString().slice(0, 10) : ""} onChange={(e) => set("ilkYardimciBelgesi", e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox id="edit-kalfalikBelgesi" checked={!!form.kalfalikBelgesi} onCheckedChange={(c) => set("kalfalikBelgesi", c ? new Date().toISOString() : "")} />
                  <Label htmlFor="edit-kalfalikBelgesi" className="cursor-pointer">Kalfalık Belgesi Var</Label>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox id="edit-ustalikBelgesi" checked={!!form.ustalikBelgesi} onCheckedChange={(c) => set("ustalikBelgesi", c ? new Date().toISOString() : "")} />
                  <Label htmlFor="edit-ustalikBelgesi" className="cursor-pointer">Ustalık Belgesi Var</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Yangın Sertifikası Tarihi</Label>
                <Input type="date" value={form.yanginSertifikasi ? new Date(form.yanginSertifikasi).toISOString().slice(0, 10) : ""} onChange={(e) => set("yanginSertifikasi", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>MYK Belgesi Geçerlilik Tarihi</Label>
                <Input type="date" value={form.mykBelgesiTarihi ? new Date(form.mykBelgesiTarihi).toISOString().slice(0, 10) : ""} onChange={(e) => set("mykBelgesiTarihi", e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-6 items-center md:col-span-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="edit-forklift" checked={!!form.forkliftEhliyeti} onCheckedChange={(v) => set("forkliftEhliyeti", !!v)} />
                  <Label htmlFor="edit-forklift" className="cursor-pointer">Forklift Ehliyet</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="edit-vincEhliyeti" checked={!!form.vincEhliyeti} onCheckedChange={(v) => set("vincEhliyeti", !!v)} />
                  <Label htmlFor="edit-vincEhliyeti" className="cursor-pointer">Vinç Operatörlük Ehliyet</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="edit-etrans" checked={!!form.eTrans} onCheckedChange={(v) => set("eTrans", !!v)} />
                  <Label htmlFor="edit-etrans" className="cursor-pointer">E.Transpalet Ehliyet</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="edit-ustaogretici" checked={!!form.ustaOgreticiBelgesi} onCheckedChange={(v) => set("ustaOgreticiBelgesi", !!v)} />
                  <Label htmlFor="edit-ustaogretici" className="cursor-pointer">Usta Öğretici Belgesi</Label>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><p className="text-sm text-muted-foreground">İlk Yardımcı Belgesi</p><p className="font-medium">{formatDate(data.ilkYardimciBelgesi)}</p></div>
              <div><p className="text-sm text-muted-foreground">Kalfalık Belgesi</p><p className="font-medium">{data.kalfalikBelgesi ? "Var" : "Yok"}</p></div>
              <div><p className="text-sm text-muted-foreground">Ustalık Belgesi</p><p className="font-medium">{data.ustalikBelgesi ? "Var" : "Yok"}</p></div>
              <div><p className="text-sm text-muted-foreground">Yangın Sertifikası</p><p className="font-medium">{formatDate(data.yanginSertifikasi)}</p></div>
              <div><p className="text-sm text-muted-foreground">MYK Belgesi Geçerlilik</p><p className="font-medium">{formatDate(data.mykBelgesiTarihi)}</p></div>
              <div><p className="text-sm text-muted-foreground">Forklift Ehliyet</p><p className="font-medium">{data.forkliftEhliyeti ? "Evet" : "Hayır"}</p></div>
              <div><p className="text-sm text-muted-foreground">Vinç Operatörlük Ehliyet</p><p className="font-medium">{data.vincEhliyeti ? "Evet" : "Hayır"}</p></div>
              <div><p className="text-sm text-muted-foreground">E.Transpalet Ehliyet</p><p className="font-medium">{data.eTrans ? "Evet" : "Hayır"}</p></div>
              <div><p className="text-sm text-muted-foreground">Usta Öğretici Belgesi</p><p className="font-medium">{data.ustaOgreticiBelgesi ? "Evet" : "Hayır"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 6: Özel Durum */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Özel Durum</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Checkbox id="edit-emekli" checked={!!form.emekli} onCheckedChange={(v) => set("emekli", !!v)} />
                <Label htmlFor="edit-emekli" className="cursor-pointer">Emekli</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="edit-engelli" checked={!!form.engelli} onCheckedChange={(v) => set("engelli", !!v)} />
                <Label htmlFor="edit-engelli" className="cursor-pointer">Engelli</Label>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-6">
              <div><p className="text-sm text-muted-foreground">Emekli</p><p className="font-medium">{data.emekli ? "Evet" : "Hayır"}</p></div>
              <div><p className="text-sm text-muted-foreground">Engelli</p><p className="font-medium">{data.engelli ? "Evet" : "Hayır"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 6: Değerlendirme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Değerlendirme</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Değerlendirme tarihleri, İşe Giriş Tarihi alanından otomatik hesaplanır.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Deneme Süresi (2 Ay) Değerlendirme</Label>
                  <Input
                    type="date"
                    value={form.denemeDegerlendirme ? new Date(form.denemeDegerlendirme).toISOString().slice(0, 10) : ""}
                    readOnly
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>İlk 6 Ay Değerlendirme</Label>
                  <Input
                    type="date"
                    value={form.altiAyDegerlendirme ? new Date(form.altiAyDegerlendirme).toISOString().slice(0, 10) : ""}
                    readOnly
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-sm text-muted-foreground">Deneme Süresi (2 Ay) Değerlendirme</p><p className="font-medium">{formatDate(data.denemeDegerlendirme)}</p></div>
              <div><p className="text-sm text-muted-foreground">İlk 6 Ay Değerlendirme</p><p className="font-medium">{formatDate(data.altiAyDegerlendirme)}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Beden Bilgileri (envanter/zimmet) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Beden Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Üst Beden</Label>
                <Select value={form.ustBeden || ""} onChange={(e) => set("ustBeden", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {UST_BEDENLER.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Alt Beden</Label>
                <Select
                  value={altBedenDiger ? "__OTHER__" : (form.altBeden || "")}
                  disabled={!form.cinsiyet}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === "__OTHER__") { setAltBedenDiger(true); set("altBeden", "") }
                    else { setAltBedenDiger(false); set("altBeden", v) }
                  }}
                >
                  <option value="">{form.cinsiyet ? "Seçiniz" : "Önce cinsiyet seçin"}</option>
                  {(form.cinsiyet ? altBedenSecenekleri(form.cinsiyet as Gender) : []).map((o) => {
                    const oneri = form.ustBeden ? oneriAltBeden(form.ustBeden, form.cinsiyet as Gender) : null
                    return <option key={o} value={o}>{o === oneri ? `${o} (öneri)` : o}</option>
                  })}
                  {form.cinsiyet && <option value="__OTHER__">Diğer...</option>}
                </Select>
                {altBedenDiger && (
                  <Input
                    value={form.altBeden || ""}
                    onChange={(e) => set("altBeden", e.target.value)}
                    placeholder="Alt beden (serbest)"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Ayakkabı No</Label>
                <Select value={form.ayakkabiNo || ""} onChange={(e) => set("ayakkabiNo", e.target.value)}>
                  <option value="">Seçiniz</option>
                  {AYAKKABI_NOLARI.map((n) => (
                    <option key={n} value={n}>{`${n} (${AYAK_UZUNLUK_CM[n]} cm)`}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Eldiven No</Label>
                <Input value={form.eldivenNo || ""} onChange={(e) => set("eldivenNo", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ölçü Tarihi</Label>
                <Input type="date" value={form.olcuTarihi || ""} onChange={(e) => set("olcuTarihi", e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Açıklama</Label>
                <Textarea value={form.bedenNot || ""} onChange={(e) => set("bedenNot", e.target.value)} rows={2} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><p className="text-sm text-muted-foreground">Üst Beden</p><p className="font-medium">{data.bedenProfili?.ustBeden || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Alt Beden</p><p className="font-medium">{data.bedenProfili?.altBeden || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Ayakkabı No</p><p className="font-medium">{data.bedenProfili?.ayakkabiNo ? `${data.bedenProfili.ayakkabiNo}${AYAK_UZUNLUK_CM[data.bedenProfili.ayakkabiNo] ? ` (${AYAK_UZUNLUK_CM[data.bedenProfili.ayakkabiNo]} cm)` : ""}` : "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Eldiven No</p><p className="font-medium">{data.bedenProfili?.eldivenNo || "-"}</p></div>
              <div><p className="text-sm text-muted-foreground">Ölçü Tarihi</p><p className="font-medium">{formatDate(data.bedenProfili?.olcuTarihi ?? null)}</p></div>
              <div className="md:col-span-3"><p className="text-sm text-muted-foreground">Açıklama</p><p className="font-medium whitespace-pre-wrap">{data.bedenProfili?.not || "-"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PR-PERSONEL-CIKIS-FORMU: Pasif personel için çıkış bilgileri kartı */}
      {/* PR-EXIT-READ-FROM-PERIODS: kart en son KAPALI dönemden beslenir.
          Kişi aktifse (çıkış-giriş yapmış) kart yine görünür, "Çıkış-Giriş (aktif)"
          rozetiyle; pasifse "Ayrıldı". */}
      {data.lastClosedPeriod && (
        <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UserX className="h-5 w-5 text-amber-600" />
                Çıkış Bilgileri
                {data.aktif ? (
                  <Badge variant="outline" className="border-sky-300 text-sky-700 font-normal">
                    Çıkış-Giriş (aktif)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-slate-300 text-slate-600 font-normal">
                    Ayrıldı
                  </Badge>
                )}
              </span>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setExitModalMode("edit")
                    setShowExitModal(true)
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Düzenle
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Çıkış Tarihi</p>
              <p className="font-medium">{formatDate(data.lastClosedPeriod.cikisTarihi)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Çalışma Süresi</p>
              <p className="font-medium">
                {data.lastClosedPeriod.workingPeriod
                  ? `${data.lastClosedPeriod.workingPeriod.years} yıl ${data.lastClosedPeriod.workingPeriod.months} ay`
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Taraf</p>
              <p className="font-medium">{data.lastClosedPeriod.exitParty || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Çıkış Kodu</p>
              <p className="font-medium">{data.lastClosedPeriod.exitCode || "-"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Çıkış Nedeni</p>
              <p className="font-medium">{data.lastClosedPeriod.exitReason || "-"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Kök Neden</p>
              <p className="font-medium">{data.lastClosedPeriod.exitRootCause || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">İstenen / İstenmeyen</p>
              <p className="font-medium">{data.lastClosedPeriod.exitTurnoverType || "-"}</p>
            </div>
            {data.lastClosedPeriod.exitGeneralNote && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Açıklama</p>
                <p className="font-medium whitespace-pre-wrap">{data.lastClosedPeriod.exitGeneralNote}</p>
              </div>
            )}
            <div className="md:col-span-2 pt-2 border-t text-xs text-muted-foreground">
              Kayıt eden: <strong>{data.lastClosedPeriod.exitRecordedBy?.name ?? data.lastClosedPeriod.exitRecordedBy?.email ?? "-"}</strong>
              {data.lastClosedPeriod.exitRecordedAt && (
                <> · {new Date(data.lastClosedPeriod.exitRecordedAt).toLocaleString("tr-TR")}</>
              )}
            </div>
            {!data.aktif && isAdmin && (
              <div className="md:col-span-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setShowReactivateConfirm(true)}>
                  Aktife geri al
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PR-C: İstihdam Geçmişi (salt görüntüleme) — dönem-tabanlı kıdem */}
      {data.employmentPeriods && data.employmentPeriods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" style={{ color: "#1B4F72" }} />
              İstihdam Geçmişi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Özet */}
            {data.employmentSummary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" /> Toplam Çalışma Süresi
                  </p>
                  <p className="font-semibold text-base mt-1" style={{ color: "#1B4F72" }}>
                    {formatDuration(data.employmentSummary)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">İlk Giriş Tarihi</p>
                  <p className="font-semibold text-base mt-1">{formatDate(data.employmentSummary.firstEntryDate)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Dönem Sayısı</p>
                  <p className="font-semibold text-base mt-1">{data.employmentSummary.periodCount}</p>
                </div>
              </div>
            )}

            {/* Kronolojik dönem listesi */}
            <div className="space-y-2">
              {data.employmentPeriods.map((p, i) => {
                const open = !p.cikisTarihi
                const dur = periodDuration(p.girisTarihi, p.cikisTarihi)
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ background: "#1B4F72" }}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium flex items-center gap-1.5 flex-wrap">
                          <span>{formatDate(p.girisTarihi)}</span>
                          <span className="text-muted-foreground">→</span>
                          {open ? (
                            <Badge variant="outline" className="border-emerald-500/50 text-emerald-600">
                              Devam ediyor
                            </Badge>
                          ) : (
                            <span>{formatDate(p.cikisTarihi)}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Süre: {formatDuration(dur)}
                          {open ? " (bugüne dek)" : ""}
                        </p>
                      </div>
                    </div>
                    {!open && (p.exitParty || p.exitTurnoverType || p.exitReason) && (
                      <div className="text-xs text-muted-foreground sm:text-right sm:max-w-[45%]">
                        {(p.exitParty || p.exitTurnoverType) && (
                          <p>
                            {p.exitParty}
                            {p.exitParty && p.exitTurnoverType ? " · " : ""}
                            {p.exitTurnoverType}
                          </p>
                        )}
                        {p.exitReason && <p className="mt-0.5">{p.exitReason}</p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PR-PERSONNEL-DEPARTMENT-TRANSFER: Geçmiş kartı + Modal */}
      {isAdmin && <PersonnelTransferHistory personnelId={id} refreshKey={transferRefreshKey} />}

      <PersonnelTransferModal
        open={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onSaved={() => {
          toast.success("Bölüm değişikliği kaydedildi")
          setTransferRefreshKey((k) => k + 1)
          refetchPersonnel()
        }}
        personnelId={id}
        personnelName={data.adSoyad}
        currentBolum={data.bolum}
      />

      {/* PR-PERSONEL-CIKIS-FORMU: Modal */}
      <PersonnelExitModal
        open={showExitModal}
        onClose={() => setShowExitModal(false)}
        onSave={saveExit}
        personnelName={data.adSoyad}
        hireDate={data.iseGirisTarihi}
        mode={exitModalMode}
        initialData={
          exitModalMode === "edit" && data.lastClosedPeriod
            ? {
                exitDate: data.lastClosedPeriod.cikisTarihi
                  ? data.lastClosedPeriod.cikisTarihi.split("T")[0]
                  : "",
                exitParty: data.lastClosedPeriod.exitParty ?? "",
                exitCode: data.lastClosedPeriod.exitCode ?? "",
                exitReason: data.lastClosedPeriod.exitReason ?? "",
                exitRootCause: data.lastClosedPeriod.exitRootCause ?? "",
                exitTurnoverType: data.lastClosedPeriod.exitTurnoverType ?? "",
                exitGeneralNote: data.lastClosedPeriod.exitGeneralNote ?? "",
              }
            : undefined
        }
      />

      {/* PR-PERSONEL-CIKIS-FORMU: Reactivate confirm */}
      <AlertDialog open={showReactivateConfirm} onOpenChange={setShowReactivateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Personeli aktife geri al?</AlertDialogTitle>
            <AlertDialogDescription>
              {data.adSoyad} personelinin güncel çıkış bilgileri temizlenecek ve yeni bir
              istihdam dönemi başlatılacak. Önceki dönem (giriş–çıkış) İstihdam Geçmişi&apos;nde
              saklanmaya devam edecek.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="block text-sm font-medium mb-1">
              Yeniden Giriş Tarihi <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={reentryDate}
              onChange={(e) => setReentryDate(e.target.value)}
              disabled={reactivating}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reactivating}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={reactivate} disabled={reactivating || !reentryDate}>
              {reactivating ? "İşleniyor..." : "Evet, aktife al"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
