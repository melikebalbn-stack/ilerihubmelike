"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Briefcase,
  GraduationCap,
  Shield,
  Globe,
  Monitor,
  Users,
  CheckCircle2,
  Trash2,
  Printer,
  History,
  ClipboardList,
  XCircle,
  AlertTriangle,
  Clock,
  UserCheck,
  Pencil,
  RotateCcw,
} from "lucide-react"
import { format, differenceInCalendarDays } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"
import { JobApplicationSensitiveSections } from "@/components/job-application/JobApplicationSensitiveSections"
import { JobApplicationStatusBadge, SinavSonucBadge } from "@/components/recruitment/JobApplicationStatusBadge"
import { MudurKarariBadge } from "@/components/recruitment/MudurKarariBadge"
import { Badge } from "@/components/ui/badge"
import { BasvuruDuzeltmeDialog } from "@/components/recruitment/BasvuruDuzeltmeDialog"
import { PersoneleDonusturDialog } from "@/components/recruitment/PersoneleDonusturDialog"
// Geri gönderme modalındaki alan seçimi BEYAZ LİSTEDEN gelir — liste burada KOPYALANMAZ.
// (Sunucu da aynı listeyle süzer: adaya-geri-gonder.ts)
import { ALAN_ETIKETLERI, DUZENLENEBILIR_ALANLAR } from "@/lib/recruitment/basvuru-duzeltme-alanlari"
import { BasvuruDuzeltmeGecmisi } from "@/components/recruitment/BasvuruDuzeltmeGecmisi"
import { STATUS_LABELS_TR, roluKademedeMi, emekliMi } from "@/lib/recruitment/transitions"
import type { JobApplicationStatus } from "@/generated/prisma"

const educationLevelLabels: Record<string, string> = {
  PRIMARY_SCHOOL: "Ilkogretim",
  HIGH_SCHOOL: "Lise",
  ASSOCIATE: "Onlisans",
  BACHELOR: "Lisans",
  MASTER: "Yuksek Lisans",
  DOCTORATE: "Doktora",
}

const genderLabels: Record<string, string> = {
  MALE: "Bay",
  FEMALE: "Bayan",
}

const militaryStatusLabels: Record<string, string> = {
  COMPLETED: "Tamamlandi",
  DEFERRED: "Tecilli",
  EXEMPT: "Muaf",
  NOT_APPLICABLE: "Uygulanamaz",
}

const maritalStatusLabels: Record<string, string> = {
  SINGLE: "Bekar",
  MARRIED: "Evli",
  DIVORCED: "Bosanmis",
  WIDOWED: "Dul",
}

const bloodTypeLabels: Record<string, string> = {
  A_POSITIVE: "A Rh+",
  A_NEGATIVE: "A Rh-",
  B_POSITIVE: "B Rh+",
  B_NEGATIVE: "B Rh-",
  AB_POSITIVE: "AB Rh+",
  AB_NEGATIVE: "AB Rh-",
  O_POSITIVE: "0 Rh+",
  O_NEGATIVE: "0 Rh-",
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null
  return (
    <tr className="border-b border-gray-200 print:border-gray-300">
      <td className="py-1.5 pr-4 text-xs text-muted-foreground print:text-gray-500 whitespace-nowrap align-top" style={{ width: "180px" }}>{label}</td>
      <td className="py-1.5 text-xs font-medium print:text-black">{value}</td>
    </tr>
  )
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-bold border-b-2 border-primary print:border-black pb-1 mb-3 print:text-black">
      <Icon className="h-4 w-4" />
      {title}
    </h2>
  )
}

// Onaylar kartı satırı. tarih verilmezse (müdür görünümü) yalnız Alındı/Alınmadı.
function OnayRow({ label, alindi, tarih }: { label: string; alindi: boolean; tarih?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-600">{label}</span>
      {alindi ? (
        <span className="font-medium text-green-700">
          Alındı{tarih ? ` · ${format(new Date(tarih), "d MMM yyyy", { locale: tr })}` : ""}
        </span>
      ) : (
        <span className="font-medium text-slate-400">Alınmadı</span>
      )}
    </div>
  )
}

// Aynı adayın diğer başvuruları — sunucudan gelir (mukerrer-basvuru.ts · digerBasvurular).
// Yalnız İK yanıtında bulunur; müdür yanıtında alan HİÇ yok.
type DigerBasvuruSatiri = {
  id: string
  applicationNumber: string
  status: string
  createdAt: string
  rejectionReason: string | null
  onceki: boolean
}

// stage-log ucundan dönen workflow bağlamı (izinler SUNUCUDA hesaplanır; client türetmez).
type WorkflowCtx = {
  currentStatus: string
  roles: string[]
  allowedTargets: string[]
  isTerminal: boolean
  // Faz 5 — isTerminal "benim islemim yok", surecBitti "surec bitti" demektir (bkz. stage-log ucu).
  surecBitti?: boolean
  assignedManagerId: string | null
  requiresManagerTargets: string[]
  requiresReasonTargets: string[]
  requiresAssessmentTargets: string[]
  // Otomatik atamalı hedefler: kişi SORULMAZ, kime gideceği bilgi olarak gösterilir.
  // hazir=false → departman/kişi tanımsız; geçiş denenirse sunucu 400 döner.
  otomatikAtamaHedefleri?: Record<string, { ad: string | null; hazir: boolean }>
}
// "Kimde bekliyor" — SUNUCUDAN gelir (src/lib/recruitment/bekleyen.ts). Client kural yürütmez.
// siz: karar ŞU AN bu kullanıcıda mı (Faz 5) — sunucuda hesaplanır (bekleyen.ts · kararSizdeMi).
type BekleyenCtx = {
  tip: "MUDUR" | "IK" | "ADAY"
  ad: string
  kisa: string
  beri: string | null
  siz?: boolean
}
type AssessmentOption = { id: string; title: string; durationMin: number; passingScore: number; soruSayisi: number }
type OturumOzeti = {
  id: string; assessmentId: string; assessmentTitle: string; durum: string; puan: number | null; gecmeNotu: number
  gecti: boolean | null; atanmaTarihi: string; baslamaTarihi: string | null
  tamamlanmaTarihi: string | null; sonGecerlilik: string; sinavLink?: string
}
const sinavDurumLabel: Record<string, string> = {
  ATANDI: "Atandı", BASLADI: "Başladı", TAMAMLANDI: "Tamamlandı", SURESI_DOLDU: "Süresi Doldu", IPTAL: "İptal",
}
const sinavDurumRenk: Record<string, string> = {
  ATANDI: "bg-blue-100 text-blue-800", BASLADI: "bg-amber-100 text-amber-800",
  TAMAMLANDI: "bg-emerald-100 text-emerald-800", SURESI_DOLDU: "bg-slate-100 text-slate-600", IPTAL: "bg-slate-100 text-slate-600",
}
// note/changedByName/changedByTitle: saf müdür (İK yetkisi yok) yanıtında SUNUCU bunları
// HİÇ göndermez (bkz. stage-log/route.ts · SAF MÜDÜR KISITI) — bu yüzden opsiyonel.
// kendiSatirim: yalnız kısıtlı yanıtta gelir; kullanıcının KENDİ yazdığı satırı işaretler.
type StageLogRow = {
  id: string
  fromStatus: string | null
  toStatus: string
  note?: string | null
  createdAt: string
  changedByName?: string | null
  changedByTitle?: string | null
  kendiSatirim?: boolean
}

// Aşama geçmişini "değerlendirme turlarına" böler (SALT GÖRÜNTÜLEME — veri değişmez).
// Yeni tur: kapalı statüden (REJECTED/ACCEPTED/ISE_BASLADI/HIRED) aktif statüye
// re-open geçişi. Amaç: aynı başvuruda birden çok tur olunca ileri-geri zıplama
// görsel olarak "N. tur" halinde anlaşılsın. Tek turlu başvurularda tur başlığı gizli.
const CLOSED_STATUSES = new Set(["REJECTED", "ACCEPTED", "ISE_BASLADI", "HIRED"])
type StageRound = { round: number; reopenAt: string | null; logs: StageLogRow[] }

function groupLogsIntoRounds(logs: StageLogRow[]): StageRound[] {
  const sorted = [...logs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  const rounds: StageRound[] = []
  for (const log of sorted) {
    const isReopen =
      !!log.fromStatus && CLOSED_STATUSES.has(log.fromStatus) && !CLOSED_STATUSES.has(log.toStatus)
    if (rounds.length === 0) {
      rounds.push({ round: 1, reopenAt: null, logs: [log] })
    } else if (isReopen) {
      rounds.push({ round: rounds.length + 1, reopenAt: log.createdAt, logs: [log] })
    } else {
      rounds[rounds.length - 1].logs.push(log)
    }
  }
  return rounds
}

type ManagerOption = {
  id: string; name: string; departmentName: string | null; isDeputy: boolean
  // Faz 4 — bu kişi mülakatçı seçilirse üst amiri kim olur? atlanir=true ise 2. kademe
  // ATLANIR ve karar İV'ye döner (sunucuda hesaplanır — managers ucu).
  ustAmir?: { atlanir: boolean; ad: string | null; yol: "MUDUR_YRD" | "MUDUR" | null }
}
type UnmatchedManager = { personnelId: string; adSoyad: string | null; departmentName: string | null; isDeputy: boolean }
type ManagersResp = { onerilenler: ManagerOption[]; tumAktif: ManagerOption[]; unmatchedManagers: UnmatchedManager[] }
type RejectionReasonOption = { id: string; category: string; name: string }
// Faz 4 — teknik mülakat onay zinciri satırı (sunucudan; ham approver id dönmez).
type OnayAdimi = {
  step: number; kademe: string; role: string; onaycıAdi?: string | null
  decision: "APPROVED" | "REJECTED" | "RETURNED" | "FORWARDED" | null
  comment?: string | null; decidedAt: string | null; createdAt: string
}

export default function JobApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [app, setApp] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // İK düzeltme modu + kaydet sonrası geçmişi tazeleme sayacı.
  const [duzeltmeAcik, setDuzeltmeAcik] = useState(false)
  // Faz 6 — Personele Dönüştür formu (yalnız EVRAK_HAZIRLIK statüsünde açılır).
  const [donusumAcik, setDonusumAcik] = useState(false)
  const [gecmisTazele, setGecmisTazele] = useState(0)

  // Workflow: aşama geçmişi + izin bağlamı (stage-log ucundan).
  const [workflow, setWorkflow] = useState<WorkflowCtx | null>(null)
  const [logs, setLogs] = useState<StageLogRow[]>([])
  const [bekleyen, setBekleyen] = useState<BekleyenCtx | null>(null)
  // Faz 4 — teknik mülakat onay zinciri (stage-log ucundan gelir).
  const [onayZinciri, setOnayZinciri] = useState<OnayAdimi[]>([])

  // Geçiş modalı state'i.
  const [txTarget, setTxTarget] = useState<string | null>(null)
  // 2026-08 — müdür kademesi kararı. İki buton da REVIEWING'e gider; hedef statü kararı
  // ayırt etmediği için seçilen karar ayrıca taşınır.
  const [txMudurKarari, setTxMudurKarari] = useState<"APPROVED" | "REJECTED" | null>(null)
  const [txNote, setTxNote] = useState("")
  const [txManagerId, setTxManagerId] = useState("")
  const [txReasonId, setTxReasonId] = useState("")
  const [txSubmitting, setTxSubmitting] = useState(false)
  const [managers, setManagers] = useState<ManagersResp | null>(null)
  const [reasons, setReasons] = useState<RejectionReasonOption[]>([])
  const [assessments, setAssessments] = useState<AssessmentOption[]>([])
  const [txAssessmentId, setTxAssessmentId] = useState("")
  const [txAssessmentSearch, setTxAssessmentSearch] = useState("")
  // Adaya geri gönderme: İK'nın işaretlediği alan ADLARI (etikete çevirme SUNUCUDA).
  const [txAlanlar, setTxAlanlar] = useState<string[]>([])
  const [txAlanAra, setTxAlanAra] = useState("")
  // Faz 4 — kademe kararı yorumu. OLUMSUZ görüşte ZORUNLU (sunucu da doğruluyor).
  const [txKademeYorumu, setTxKademeYorumu] = useState("")
  // SINAV geçişi sonrası aktif oturumun sinavLink'i — İK kopyalayıp adaya iletebilsin.
  const [sinavLink, setSinavLink] = useState<string | null>(null)

  const id = params.id as string

  useEffect(() => {
    if (id) {
      fetchDetail()
      fetchWorkflow()
    }
  }, [id])

  const fetchDetail = async () => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${id}`)
      if (res.ok) {
        const data = await res.json()
        setApp(data)
      } else {
        toast.error("Basvuru bulunamadi")
        router.push("/strategic-hr/recruitment")
      }
    } catch {
      toast.error("Basvuru yuklenirken hata olustu")
    } finally {
      setLoading(false)
    }
  }

  // Aşama geçmişi + izin bağlamı. Geçişten sonra da çağrılır (timeline + butonlar bayat kalmasın).
  const fetchWorkflow = async () => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${id}/stage-log`)
      if (res.ok) {
        const data = await res.json()
        setWorkflow(data.workflow)
        setLogs(data.logs)
        setBekleyen(data.bekleyen ?? null)
        setOnayZinciri(data.onayZinciri ?? [])
      }
    } catch {
      // sessiz — timeline/aksiyon kartı yoksa sayfa yine de CV'yi gösterir
    }
  }

  const requiresManager = !!txTarget && !!workflow?.requiresManagerTargets.includes(txTarget)
  const requiresReason = !!txTarget && !!workflow?.requiresReasonTargets.includes(txTarget)
  const requiresAssessment = !!txTarget && !!workflow?.requiresAssessmentTargets.includes(txTarget)
  // Otomatik atanan kademe (Üretim Müdür Yrd. / Fabrika Müdürü) — modal kişi sormaz.
  const otomatikAtama = txTarget ? workflow?.otomatikAtamaHedefleri?.[txTarget] : undefined
  // Kişi seçimi etiketi: mavi yaka zincirinde seçilen kişi müdür OLMAYABİLİR (mavi/gri yaka
  // çalışan da olabilir), o yüzden "Mudur" yerine hedefe göre etiket.
  const secimEtiketi =
    txTarget === "DEGERLENDIRICI" ? "Degerlendirici"
    : txTarget === "TEKNIK_MULAKAT" ? "Teknik mulakatci"
    : "Mudur"
  // Faz 4 — teknik kademe kararı mı veriliyor? (rol sunucudan geliyor)
  const teknikKademe =
    !!workflow &&
    ((workflow.roles.includes("TEKNIK_MULAKATCI") && workflow.currentStatus === "TEKNIK_MULAKAT") ||
      (workflow.roles.includes("TEKNIK_UST_AMIR") && workflow.currentStatus === "TEKNIK_MULAKAT_UST_ONAY"))
  // Faz 5 — müdür kademe kararı. Statü listesi GÖMÜLMEZ: sunucudaki guard ile AYNI
  // türetim (roluKademedeMi, transitions.ts) burada da kullanılır.
  const mudurKademe =
    !!workflow &&
    workflow.roles.includes("MUDUR") &&
    roluKademedeMi(workflow.currentStatus as JobApplicationStatus, "MUDUR")
  // Karar yorumu isteyen her kademe (teknik + müdür) — olumsuz görüşte yorum ZORUNLU.
  const kademeKarari = teknikKademe || mudurKademe
  // Olumsuz görüş = yorumu ZORUNLU kılan durum. Teknik kademede REVIEWING'e dönüş
  // tek başına olumsuzdur; müdürde ise iki karar da REVIEWING'e gittiği için SEÇİLEN
  // karara bakılır (olumlu → yorum opsiyonel, olumsuz → zorunlu).
  const olumsuzGorus =
    (teknikKademe && txTarget === "REVIEWING") ||
    (mudurKademe && txTarget === "REVIEWING" && txMudurKarari === "REJECTED")
  // Seçilen mülakatçının üst amir önizlemesi (2. kademe atlanacak mı).
  const secilenMulakatci =
    txTarget === "TEKNIK_MULAKAT" && txManagerId
      ? [...(managers?.onerilenler ?? []), ...(managers?.tumAktif ?? [])].find((m) => m.id === txManagerId)
      : undefined
  // Adaya geri gönderme modalı mı? (hedef bayrak kapalıyken zaten allowedTargets'ta yok)
  const isGeriGonder = txTarget === "ADAYA_GERI_GONDERILDI"
  // RET GERİ ALMA (2026-09): REJECTED → REVIEWING. Gerekçe ZORUNLU (sunucu da guard'lar).
  const retGeriAlma = workflow?.currentStatus === "REJECTED" && txTarget === "REVIEWING"
  // Başlık rozeti: aktif oturum varsa o, yoksa EN YENİ geçmiş oturum (gecmis zaten
  // createdAt DESC sıralı — assessment-session.ts). Yeni uç çağrılmaz, mevcut DTO kullanılır.
  const rozetOturumu = app?.sinavlar?.aktif ?? app?.sinavlar?.gecmis?.[0] ?? null
  const basliktakiSinavRozeti = rozetOturumu
    ? {
        durum: rozetOturumu.durum,
        puan: rozetOturumu.puan,
        gecmeNotu: rozetOturumu.gecmeNotu,
        gecti: rozetOturumu.gecti,
      }
    : null
  // Kaçıncı kez geri gönderiliyor — StageLog'dan TÜRETİLİR, yeni kolon YOK.
  const geriGondermeSayisi = logs.filter((l) => l.toStatus === "ADAYA_GERI_GONDERILDI").length

  // Aksiyon butonuna basınca modalı hazırla — hedef ek girdi istiyorsa ilgili listeyi çek.
  const openTransition = async (target: string, mudurKarari?: "APPROVED" | "REJECTED") => {
    setTxTarget(target)
    setTxMudurKarari(mudurKarari ?? null)
    setTxNote("")
    setTxManagerId("")
    setTxReasonId("")
    // Sınav değiştirme: aktif oturumun sınavı seçili gelsin (yoksa boş).
    setTxAssessmentId(target === "SINAV" ? (app.sinavlar?.aktif?.assessmentId ?? "") : "")
    setTxAssessmentSearch("")
    setTxAlanlar([])
    setTxAlanAra("")
    setTxKademeYorumu("")
    if (workflow?.requiresManagerTargets.includes(target) && !managers) {
      try {
        const res = await fetch(`/api/recruitment/managers`)
        if (res.ok) setManagers(await res.json())
      } catch { /* modalda liste boş kalır, onay disabled */ }
    }
    if (workflow?.requiresReasonTargets.includes(target) && reasons.length === 0) {
      try {
        const res = await fetch(`/api/strategic-hr/recruitment/rejection-reasons?activeOnly=1`)
        if (res.ok) setReasons(await res.json())
      } catch { /* modalda liste boş kalır, onay disabled */ }
    }
    if (workflow?.requiresAssessmentTargets.includes(target) && assessments.length === 0) {
      try {
        const res = await fetch(`/api/strategic-hr/recruitment/assessments/secilebilir`)
        if (res.ok) setAssessments(await res.json())
      } catch { /* modalda liste boş kalır, onay disabled */ }
    }
  }

  const closeTransition = () => {
    if (txSubmitting) return
    setTxTarget(null)
  }

  const submitTransition = async () => {
    if (!txTarget) return
    setTxSubmitting(true)
    try {
      const wasSinav = requiresAssessment
      const body: Record<string, unknown> = { toStatus: txTarget }
      if (txNote.trim()) body.note = txNote.trim()
      if (requiresManager && txManagerId) body.assignedManagerId = txManagerId
      if (requiresReason && txReasonId) body.rejectionReasonId = txReasonId
      if (requiresAssessment && txAssessmentId) body.assessmentId = txAssessmentId
      // Alan ADLARI gider; etikete çevirme + beyaz liste süzmesi SUNUCUDA yapılır.
      if (isGeriGonder && txAlanlar.length) body.duzeltilecekAlanlar = txAlanlar
      if (kademeKarari && txKademeYorumu.trim()) body.kademeYorumu = txKademeYorumu.trim()
      if (mudurKademe && txMudurKarari) body.mudurKarari = txMudurKarari
      const res = await fetch(`/api/recruitment/applications/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setTxTarget(null)
        toast.success("Durum guncellendi")
        // Statü + timeline + izinli hedefler yeniden yüklensin (bayat kalmasın).
        await Promise.all([fetchDetail(), fetchWorkflow()])
        // SINAV'a geçildiyse aktif oturumun sinavLink'ini çek → İK adaya elle iletebilsin.
        if (wasSinav) {
          try {
            const r = await fetch(`/api/strategic-hr/recruitment/assessments/sessions?publicJobApplicationId=${id}`)
            if (r.ok) {
              const oturumlar: { sinavLink: string | null }[] = await r.json()
              const link = oturumlar.find((o) => o.sinavLink)?.sinavLink ?? null
              setSinavLink(link)
            }
          } catch { /* link gösterilemezse sessiz — geçiş yine de başarılı */ }
        }
      } else {
        const err = await res.json().catch(() => ({}))
        // API izin verilen hedefleri döndürdüyse kullanıcıya anlaşılır TR mesaj göster.
        if (Array.isArray(err.allowedTargets)) {
          const izinli = err.allowedTargets.map((t: string) => STATUS_LABELS_TR[t as keyof typeof STATUS_LABELS_TR] || t)
          toast.error(
            izinli.length
              ? `Bu gecise izin yok. Izin verilen hedefler: ${izinli.join(", ")}`
              : "Bu basvuru icin gecis yetkiniz yok"
          )
        } else {
          toast.error(err.error || "Durum guncellenemedi")
        }
      }
    } catch {
      toast.error("Bir hata olustu")
    } finally {
      setTxSubmitting(false)
    }
  }

  const handleNotesUpdate = async (notes: string) => {
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      })
      if (res.ok) toast.success("Notlar kaydedildi")
    } catch {
      toast.error("Notlar kaydedilemedi")
    }
  }

  const handleDelete = async () => {
    if (!confirm("Bu basvuruyu silmek istediginizden emin misiniz?")) return
    try {
      const res = await fetch(`/api/strategic-hr/recruitment/job-applications/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success("Basvuru silindi")
        router.push("/strategic-hr/recruitment")
      } else {
        const err = await res.json()
        toast.error(err.error || "Silinemedi")
      }
    } catch {
      toast.error("Bir hata olustu")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!app) return null

  const educationHistory = app.educationHistory as any[] | null
  const workExperience = app.workExperience as any[] | null
  const foreignLanguages = app.foreignLanguages as any[] | null
  const computerSkills = app.computerSkills as any[] | null
  const coursesAndSeminars = app.coursesAndSeminars as any[] | null
  const references = app.references as any[] | null

  return (
    <>
      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except print content */
          body > * { visibility: hidden !important; }

          /* Layout resets */
          nav, header, aside, footer,
          [data-sidebar], .sidebar,
          [class*="BottomNav"], [class*="bottom-nav"] {
            display: none !important;
          }

          /* Make main content full width */
          .flex.h-screen { display: block !important; height: auto !important; overflow: visible !important; }
          .lg\\:pl-64 { padding-left: 0 !important; }
          main { overflow: visible !important; padding: 0 !important; height: auto !important; }

          /* Show print area */
          #cv-print-area, #cv-print-area * { visibility: visible !important; }
          #cv-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            font-size: 11px !important;
            line-height: 1.4 !important;
          }

          /* Page setup */
          @page {
            size: A4;
            margin: 12mm 15mm;
          }

          /* Section breaks */
          .cv-section {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 8px !important;
          }

          /* Table styling for print */
          .cv-section table {
            width: 100% !important;
          }

          /* Colors */
          .print\\:text-black { color: black !important; }
          .print\\:text-gray-500 { color: #666 !important; }
          .print\\:border-black { border-color: black !important; }
          .print\\:border-gray-300 { border-color: #ccc !important; }

          /* Hide no-print elements */
          .no-print { display: none !important; }

          /* PR-JOBAPP-UX-FIXES: Print images (foto + imza dataURL) */
          img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Screen-only header with buttons */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/strategic-hr/recruitment")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{app.fullName}</h1>
              <JobApplicationStatusBadge status={app.status} />
              {/* Sınav rozeti — başlıkta, statünün yanında. İV kartı açmadan sonucu görür.
                  Liste ile AYNI bileşen ve AYNI kaynak alanlar (aktif oturum yoksa en yeni
                  geçmiş oturum). Oturum hiç yoksa bileşen null döner. */}
              <SinavSonucBadge rozet={basliktakiSinavRozeti} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Basvuru No: {app.applicationNumber} | {format(new Date(app.createdAt), "d MMMM yyyy HH:mm", { locale: tr })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Yazdir
          </Button>
          {/* Düzeltme yalnız İK — PATCH zaten recruitment.admin; müdür görünümünde gizli.
              Aday gönderimden sonra kendi kaydına dokunamıyor (consent-guard DRAFT_STATUSES),
              bu buton o boşluğun tek meşru kapağı. */}
          {!app._restrictedView && (
            <Button variant="outline" size="sm" onClick={() => setDuzeltmeAcik(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Duzelt
            </Button>
          )}
          {/* Silme yalnız İK — kısıtlı (müdür) görünümde gizli */}
          {!app._restrictedView && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Sil
            </Button>
          )}
        </div>
      </div>

      {/* Saf müdür (İK yetkisi yok) — kısıtlı görünüm bilgi satırı */}
      {app._restrictedView && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 no-print">
          <Shield className="h-4 w-4 shrink-0" />
          Bu görünüm size atanmış başvuruyla sınırlıdır. Hassas kişisel bilgiler (kimlik,
          sağlık, KVKK, iletişim vb.) gösterilmez.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - printable */}
        <div className="lg:col-span-2" id="cv-print-area">
          {/* Print header - only visible when printing */}
          <div className="hidden print:block mb-4" style={{ borderBottom: "2px solid black", paddingBottom: "8px" }}>
            <div className="flex items-start gap-4">
              {app.photoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={app.photoUrl}
                  alt={app.fullName}
                  style={{
                    width: "80px",
                    height: "100px",
                    objectFit: "cover",
                    border: "1px solid #666",
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                  }}
                />
              )}
              <div className="flex-1 flex items-start justify-between">
                <div>
                  <h1 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "2px" }}>{app.fullName}</h1>
                  <p style={{ fontSize: "11px", color: "#666" }}>
                    Basvuru No: {app.applicationNumber} | Tarih: {format(new Date(app.createdAt), "d MMMM yyyy", { locale: tr })}
                  </p>
                  {app.requestedPosition && (
                    <p style={{ fontSize: "12px", fontWeight: "600", marginTop: "2px" }}>
                      Pozisyon: {app.requestedPosition}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: "right", fontSize: "11px", color: "#666" }}>
                  {app.mobilePhone && <div>Tel: {app.mobilePhone}</div>}
                  {app.email && <div>{app.email}</div>}
                  <div style={{ marginTop: "4px" }}>
                    <strong>Durum: {STATUS_LABELS_TR[app.status as keyof typeof STATUS_LABELS_TR] || app.status}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 print:space-y-2">
            {/* Kisisel Bilgiler */}
            <div className="cv-section">
              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:p-0 print:pb-0">
                  <SectionTitle icon={User} title="Kisisel Bilgiler" />
                </CardHeader>
                <CardContent className="print:p-0">
                  <table className="w-full">
                    <tbody>
                      <InfoRow label="Ad Soyad" value={app.fullName} />
                      <InfoRow label="Dogum Yeri" value={app.birthPlace} />
                      <InfoRow label="Dogum Tarihi" value={app.birthDate ? format(new Date(app.birthDate), "d MMMM yyyy", { locale: tr }) : null} />
                      <InfoRow label="T.C. Kimlik No" value={app.tcKimlikNo} />
                      <InfoRow label="Uyruk" value={app.nationality} />
                      <InfoRow label="Cinsiyet" value={app.gender ? genderLabels[app.gender] || app.gender : null} />
                      <InfoRow label="Kan Grubu" value={app.bloodType ? bloodTypeLabels[app.bloodType] || app.bloodType : null} />
                      <InfoRow label="Medeni Durum" value={app.maritalStatus ? maritalStatusLabels[app.maritalStatus] || app.maritalStatus : null} />
                      <InfoRow label="Cocuk Sayisi" value={app.numberOfChildren} />
                      <InfoRow label="Es Calisiyor mu?" value={app.spouseWorking === true ? "Evet" : app.spouseWorking === false ? "Hayir" : null} />
                      <InfoRow label="Esin Meslegi" value={app.spouseOccupation} />
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Iletisim */}
            <div className="cv-section">
              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:p-0 print:pb-0">
                  <SectionTitle icon={Phone} title="Iletisim Bilgileri" />
                </CardHeader>
                <CardContent className="print:p-0">
                  <table className="w-full">
                    <tbody>
                      <InfoRow label="Cep Telefonu" value={app.mobilePhone} />
                      <InfoRow label="Is Telefonu" value={app.workPhone} />
                      <InfoRow label="Ev Telefonu" value={app.homePhone} />
                      <InfoRow label="E-posta" value={app.email} />
                      <InfoRow label="Ev Adresi" value={app.homeAddress} />
                      <InfoRow label="Bakmakla Yukumlu" value={app.dependents} />
                      <InfoRow label="Bize Nasil Ulasti" value={app.referralSourceDef?.name ?? null} />
                      {app.referralSourceOther && <InfoRow label="Kaynak Detay" value={app.referralSourceOther} />}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Askerlik ve Ehliyet */}
            <div className="cv-section">
              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:p-0 print:pb-0">
                  <SectionTitle icon={Shield} title="Askerlik ve Ehliyet" />
                </CardHeader>
                <CardContent className="print:p-0">
                  <table className="w-full">
                    <tbody>
                      <InfoRow label="Askerlik Durumu" value={app.militaryStatus ? militaryStatusLabels[app.militaryStatus] || app.militaryStatus : null} />
                      <InfoRow label="Tecil Tarihi" value={app.militaryPostponeDate ? format(new Date(app.militaryPostponeDate), "d MMMM yyyy", { locale: tr }) : null} />
                      <InfoRow label="Surucu Belgesi" value={app.hasDriverLicense === true ? "Var" : app.hasDriverLicense === false ? "Yok" : null} />
                      <InfoRow label="Ehliyet Sinifi" value={app.driverLicenseClass} />
                      <InfoRow label="Ehliyet Tarihi" value={app.driverLicenseDate ? format(new Date(app.driverLicenseDate), "d MMMM yyyy", { locale: tr }) : null} />
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Is Tercihleri */}
            <div className="cv-section">
              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:p-0 print:pb-0">
                  <SectionTitle icon={Briefcase} title="Is Tercihleri" />
                </CardHeader>
                <CardContent className="print:p-0">
                  <table className="w-full">
                    <tbody>
                      <InfoRow label="Talep Edilen Pozisyon" value={app.requestedPosition} />
                      <InfoRow label="Beklenen Maas" value={app.expectedSalary ? `${app.expectedSalary.toLocaleString()} TL` : null} />
                      <InfoRow label="Ise Baslama Tarihi" value={app.availableStartDate ? format(new Date(app.availableStartDate), "d MMMM yyyy", { locale: tr }) : null} />
                      <InfoRow label="Daha Once Calisti mi?" value={app.previouslyWorkedHere === true ? "Evet" : app.previouslyWorkedHere === false ? "Hayir" : null} />
                      <InfoRow label="Seyahat Engeli" value={app.hasTravelRestriction === true ? "Var" : app.hasTravelRestriction === false ? "Yok" : null} />
                      <InfoRow label="Vardiyali Calisabilir" value={app.canWorkShifts === true ? "Evet" : app.canWorkShifts === false ? "Hayir" : null} />
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Egitim Durumu */}
            <div className="cv-section">
              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:p-0 print:pb-0">
                  <SectionTitle icon={GraduationCap} title="Egitim Durumu" />
                </CardHeader>
                <CardContent className="print:p-0">
                  <table className="w-full">
                    <tbody>
                      <InfoRow label="En Yuksek Egitim" value={app.educationLevel ? educationLevelLabels[app.educationLevel] || app.educationLevel : null} />
                    </tbody>
                  </table>
                  {educationHistory && educationHistory.length > 0 && (
                    <div className="mt-3 print:mt-1">
                      <h4 className="text-sm font-semibold mb-2 print:text-black">Egitim Gecmisi</h4>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-1 font-semibold print:text-black">Okul</th>
                            <th className="text-left py-1 font-semibold print:text-black">Bolum</th>
                            <th className="text-left py-1 font-semibold print:text-black">Seviye</th>
                            <th className="text-left py-1 font-semibold print:text-black">Mezuniyet</th>
                          </tr>
                        </thead>
                        <tbody>
                          {educationHistory.map((edu: any, i: number) => (
                            <tr key={i} className="border-b border-gray-200">
                              <td className="py-1 print:text-black">{edu.schoolName || edu.institution}</td>
                              <td className="py-1 print:text-black">{edu.department || "-"}</td>
                              <td className="py-1 print:text-black">{edu.level ? educationLevelLabels[edu.level] || edu.level : "-"}</td>
                              <td className="py-1 print:text-black">{edu.graduationYear || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Is Tecrubesi */}
            {workExperience && workExperience.length > 0 && (
              <div className="cv-section">
                <Card className="print:border-0 print:shadow-none">
                  <CardHeader className="print:p-0 print:pb-0">
                    <SectionTitle icon={Briefcase} title="Is Tecrubesi" />
                  </CardHeader>
                  <CardContent className="print:p-0">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-1 font-semibold print:text-black">Firma</th>
                          <th className="text-left py-1 font-semibold print:text-black">Pozisyon</th>
                          <th className="text-left py-1 font-semibold print:text-black">Baslangic</th>
                          <th className="text-left py-1 font-semibold print:text-black">Bitis</th>
                          <th className="text-left py-1 font-semibold print:text-black">Ayrilma Nedeni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workExperience.map((exp: any, i: number) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td className="py-1 print:text-black">{exp.company}</td>
                            <td className="py-1 print:text-black">{exp.position}</td>
                            <td className="py-1 print:text-black">{exp.startDate || "-"}</td>
                            <td className="py-1 print:text-black">{exp.endDate || "-"}</td>
                            <td className="py-1 print:text-black">{exp.leavingReason || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Yabanci Dil */}
            {foreignLanguages && foreignLanguages.length > 0 && (
              <div className="cv-section">
                <Card className="print:border-0 print:shadow-none">
                  <CardHeader className="print:p-0 print:pb-0">
                    <SectionTitle icon={Globe} title="Yabanci Dil Bilgisi" />
                  </CardHeader>
                  <CardContent className="print:p-0">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-1 font-semibold print:text-black">Dil</th>
                          <th className="text-left py-1 font-semibold print:text-black">Okuma</th>
                          <th className="text-left py-1 font-semibold print:text-black">Yazma</th>
                          <th className="text-left py-1 font-semibold print:text-black">Konusma</th>
                          <th className="text-left py-1 font-semibold print:text-black">Ogrendigi Yer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {foreignLanguages.map((lang: any, i: number) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td className="py-1 print:text-black">{lang.language}</td>
                            <td className="py-1 print:text-black">{lang.reading || "-"}</td>
                            <td className="py-1 print:text-black">{lang.writing || "-"}</td>
                            <td className="py-1 print:text-black">{lang.speaking || "-"}</td>
                            <td className="py-1 print:text-black">{lang.learnedAt || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Bilgisayar Bilgisi */}
            {computerSkills && computerSkills.length > 0 && (
              <div className="cv-section">
                <Card className="print:border-0 print:shadow-none">
                  <CardHeader className="print:p-0 print:pb-0">
                    <SectionTitle icon={Monitor} title="Bilgisayar Bilgisi" />
                  </CardHeader>
                  <CardContent className="print:p-0">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-1 font-semibold print:text-black">Program</th>
                          <th className="text-left py-1 font-semibold print:text-black">Seviye</th>
                          <th className="text-left py-1 font-semibold print:text-black">Ogrendigi Yer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {computerSkills.map((skill: any, i: number) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td className="py-1 print:text-black">{skill.program}</td>
                            <td className="py-1 print:text-black">{skill.level || "-"}</td>
                            <td className="py-1 print:text-black">{skill.learnedAt || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Kurslar ve Seminerler */}
            {coursesAndSeminars && coursesAndSeminars.length > 0 && (
              <div className="cv-section">
                <Card className="print:border-0 print:shadow-none">
                  <CardHeader className="print:p-0 print:pb-0">
                    <SectionTitle icon={GraduationCap} title="Kurslar ve Seminerler" />
                  </CardHeader>
                  <CardContent className="print:p-0">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-1 font-semibold print:text-black">Kurum</th>
                          <th className="text-left py-1 font-semibold print:text-black">Konu</th>
                          <th className="text-left py-1 font-semibold print:text-black">Sure</th>
                          <th className="text-left py-1 font-semibold print:text-black">Tarih</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coursesAndSeminars.map((course: any, i: number) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td className="py-1 print:text-black">{course.institution}</td>
                            <td className="py-1 print:text-black">{course.subject}</td>
                            <td className="py-1 print:text-black">{course.duration || "-"}</td>
                            <td className="py-1 print:text-black">{course.attendanceDate || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Referanslar */}
            {references && references.length > 0 && (
              <div className="cv-section">
                <Card className="print:border-0 print:shadow-none">
                  <CardHeader className="print:p-0 print:pb-0">
                    <SectionTitle icon={Users} title="Referanslar" />
                  </CardHeader>
                  <CardContent className="print:p-0">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-300">
                          <th className="text-left py-1 font-semibold print:text-black">Ad Soyad</th>
                          <th className="text-left py-1 font-semibold print:text-black">Firma</th>
                          <th className="text-left py-1 font-semibold print:text-black">Pozisyon</th>
                          <th className="text-left py-1 font-semibold print:text-black">Telefon</th>
                        </tr>
                      </thead>
                      <tbody>
                        {references.map((ref: any, i: number) => (
                          <tr key={i} className="border-b border-gray-200">
                            <td className="py-1 print:text-black">{ref.name}</td>
                            <td className="py-1 print:text-black">{ref.company || "-"}</td>
                            <td className="py-1 print:text-black">{ref.position || "-"}</td>
                            <td className="py-1 print:text-black">{ref.phone || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Diger Bilgiler */}
            <div className="cv-section">
              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:p-0 print:pb-0">
                  <SectionTitle icon={Shield} title="Diger Bilgiler" />
                </CardHeader>
                <CardContent className="print:p-0">
                  <table className="w-full">
                    <tbody>
                      <InfoRow label="Adli Sicil Kaydi" value={app.hasCriminalRecord === true ? "Var" : app.hasCriminalRecord === false ? "Yok" : null} />
                      <InfoRow label="Hukum Giydi mi?" value={app.hasConviction === true ? "Evet" : app.hasConviction === false ? "Hayir" : null} />
                      <InfoRow label="Dava Detayi" value={app.convictionDetails} />
                      <InfoRow label="Devam Eden Dava" value={app.hasOngoingCase === true ? "Var" : app.hasOngoingCase === false ? "Yok" : null} />
                      <InfoRow label="Boy (cm)" value={app.height} />
                      <InfoRow label="Kilo (kg)" value={app.weight} />
                      <InfoRow label="Ayakkabi No" value={app.shoeSize} />
                      <InfoRow label="Ust Beden" value={app.clothingSizeUpper} />
                      <InfoRow label="Alt Beden" value={app.clothingSizeLower} />
                      <InfoRow label="Hobiler" value={app.hobbies} />
                      <InfoRow label="Uyelikler" value={app.memberships} />
                      <InfoRow label="Firmada Akraba/Tanidik" value={app.hasRelativesInCompany === true ? `Evet - ${app.relativeName || ""}` : app.hasRelativesInCompany === false ? "Hayir" : null} />
                      <InfoRow label="Son Isveren Temasi" value={app.canContactLastEmployer === true ? "Evet" : app.canContactLastEmployer === false ? "Hayir" : null} />
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Dijital Imza — PR-JOBAPP-ADMIN-SIGNATURE: backward-compat */}
            {app.digitalSignature && (
              <div className="cv-section">
                <Card className="print:border-0 print:shadow-none">
                  <CardContent className="pt-6 print:p-0 print:pt-2">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 print:bg-transparent print:border-gray-400 print:p-2">
                      <div className="flex items-center gap-2 text-green-700 print:text-black">
                        <CheckCircle2 className="w-5 h-5 print:w-4 print:h-4" />
                        <span className="font-medium">Dijital Imza</span>
                      </div>
                      <p className="text-sm text-green-600 mt-1 print:text-black">
                        {app.fullName} tarafindan {app.signatureDate} tarihinde dijital olarak imzalanmistir.
                      </p>
                      {/* PR-JOBAPP-RENDERER sonrası canvas pad PNG; öncesinde "Name|date|ts" string */}
                      {app.digitalSignature.startsWith('data:image') ? (
                        <div className="mt-3 inline-block bg-white border border-slate-200 rounded p-2 print:border-gray-400">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={app.digitalSignature}
                            alt="Dijital imza"
                            className="max-w-[400px] max-h-[150px] object-contain"
                          />
                        </div>
                      ) : (
                        <div className="mt-3 text-xs font-mono text-slate-600 border border-slate-200 rounded p-2 bg-slate-50 print:bg-transparent print:border-gray-400 print:text-black break-all">
                          {app.digitalSignature}
                          <div className="text-[10px] text-slate-400 mt-1 print:text-gray-500">
                            (eski format başvuru)
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Faz 3: KVKK onayı + Sağlık beyanı (yalnız yetkili rolde render edilir).
                Kısıtlı (müdür) görünümde hiç render edilmez — bu veriler müdüre kapalı. */}
            {!app._restrictedView && <JobApplicationSensitiveSections applicationId={id} />}
          </div>
        </div>

        {/* Right column - screen only */}
        <div className="space-y-6 no-print">
          {/* Fotograf */}
          {app.photoUrl && (
            <Card>
              <CardContent className="pt-6 flex justify-center">
                <img
                  src={app.photoUrl}
                  alt={app.fullName}
                  className="w-48 h-48 object-cover rounded-lg border"
                />
              </CardContent>
            </Card>
          )}

          {/* Durum ve Notlar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Durum Yonetimi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Aşama şeridi — GEÇİLMİŞ yeşil / ŞU ANKİ amber / SIRADAKİ gri, REJECTED kırmızı.
                  Sabit aşama sırası GÖMÜLMEZ: geçilmişler StageLog'dan (o statüye bir kez
                  girilmişse geçilmiş), sıradakiler sunucudan gelen allowedTargets'tan türetilir.
                  Geçiş matrisi doğrusal değil (geri alma kenarları var), bu yüzden "ileriki
                  aşamalar" = bu durumdan gidilebilecek hedefler. */}
              {workflow && (() => {
                // EMEKLİ STATÜLER ŞERİTTE ÇİZİLMEZ (2026-08-18). Kaynak TEK: transitions.ts
                // (EMEKLI_STATULER/emekliMi) — etikete "(kullanımdan kaldırıldı)" yazma
                // yöntemi KALKTI, etiketler artık temiz. TEK İSTİSNA: kayıt HÂLİHAZIRDA o
                // statüdeyse (currentStatus) çizilmeye devam eder, yoksa nerede olduğu kaybolur.
                const gecilmis: string[] = []
                for (const l of logs) {
                  if (l.toStatus === workflow.currentStatus) continue
                  if (emekliMi(l.toStatus)) continue
                  if (!gecilmis.includes(l.toStatus)) gecilmis.push(l.toStatus)
                }
                // AYNI STATÜ İKİ KEZ ÇİZİLMESİN (2026-08-18). Matris doğrusal değil: geri
                // alma kenarları yüzünden bir statü hem "geçilmiş" (yeşil) hem "sıradaki"
                // (gri) listesine düşebiliyordu — ekranda Müdür Değerlendirmesi / İV Havuzu /
                // İK Mülakatı ikişer kez görünüyordu. Geçmiş bilgisi daha değerli olduğu için
                // YEŞİL olan kalır, gri kopya düşer.
                const siradaki = workflow.allowedTargets.filter(
                  (t) =>
                    t !== "REJECTED" &&
                    !emekliMi(t) &&
                    t !== workflow.currentStatus &&
                    !gecilmis.includes(t),
                )
                const reddedildi = workflow.currentStatus === "REJECTED"
                const chip = (etiket: string, sinif: string, key: string) => (
                  <span key={key} className={`rounded px-2 py-0.5 text-xs font-medium ${sinif}`}>
                    {etiket}
                  </span>
                )
                const etiketle = (t: string) => STATUS_LABELS_TR[t as keyof typeof STATUS_LABELS_TR] || t
                return (
                  <div>
                    <Label>Asamalar</Label>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {gecilmis.map((t) =>
                        chip(etiketle(t), "bg-emerald-100 text-emerald-800", `g-${t}`),
                      )}
                      {chip(
                        etiketle(workflow.currentStatus),
                        reddedildi
                          ? "bg-red-100 text-red-800 ring-1 ring-red-300"
                          : "bg-amber-100 text-amber-800 ring-1 ring-amber-300",
                        `c-${workflow.currentStatus}`,
                      )}
                      {siradaki.map((t) =>
                        chip(etiketle(t), "bg-slate-100 text-slate-500", `s-${t}`),
                      )}
                    </div>
                  </div>
                )
              })()}

              <div>
                <Label>Islemler</Label>
                {/* Butonlar SUNUCUDAN gelen izinli hedeflerden türetilir — client yetki hesaplamaz.
                    Sabit buton listesi yok; allowedTargets değişince buton kümesi de değişir. */}
                {/* Faz 6 — Personele Dönüştür. Statü EVRAK_HAZIRLIK ise ve kullanıcı İK
                    hedeflerini görebiliyorsa çıkar. Bayrak kapalıyken bu statüye HİÇ
                    gelinemez (EVRAK_HAZIRLIK hedefi allowedTargets'tan düşer). */}
                {workflow?.currentStatus === "EVRAK_HAZIRLIK" && workflow.roles.includes("IK") && (
                  <Button
                    size="sm"
                    className="mt-2 w-full justify-start"
                    onClick={() => setDonusumAcik(true)}
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Personele Donustur
                  </Button>
                )}
                {workflow?.isTerminal ? (
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    {workflow.surecBitti === false
                      ? `Bu asamada sizin yapabileceginiz bir islem yok. Karar simdi ${bekleyen?.ad ?? "Insan Varliklari"}'nda.`
                      : "Bu basvuru sonuclandi. Yeni durum gecisi yapilamaz."}
                  </div>
                ) : workflow && workflow.allowedTargets.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-2">
                    {workflow.allowedTargets.map((target) => {
                      // 2026-08 — müdür kademesinde REVIEWING tek hedeftir ama İKİ karar
                      // taşır: olumlu/olumsuz. Bu yüzden tek hedef İKİ butona açılır.
                      if (mudurKademe && target === "REVIEWING") {
                        return (
                          <div key={target} className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start border-green-300 text-green-800 hover:bg-green-50"
                              onClick={() => openTransition(target, "APPROVED")}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Olumlu — IV'ye gonder
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start border-red-300 text-red-800 hover:bg-red-50"
                              onClick={() => openTransition(target, "REJECTED")}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Olumsuz — IV'ye gonder
                            </Button>
                            <p className="text-xs text-muted-foreground">
                              Basvuru IV'ye doner, sizden islem beklenmez.
                            </p>
                          </div>
                        )
                      }
                      const isReject = target === "REJECTED"
                      // SINAV hedefi + zaten aktif oturum varsa: "Sınavı Değiştir" (aynı-statü değişim).
                      const sinavDegistir = target === "SINAV" && !!app.sinavlar?.aktif
                      // Faz 5 — karar kademesindeki kişi için REVIEWING "geri alma" değil
                      // OLUMSUZ GÖRÜŞ'tür. "İV Havuzu" ham etiketi bu kişiye anlamsız gelir.
                      const olumsuzButonu = kademeKarari && target === "REVIEWING"
                      // RET GERİ ALMA: REJECTED'dan REVIEWING'e dönüş "İV Havuzu'na geçir"
                      // değil, bir karar İPTALİdir — etiket bunu söylemeli.
                      const geriAlButonu =
                        workflow?.currentStatus === "REJECTED" && target === "REVIEWING"
                      const label = sinavDegistir
                        ? "Sınavı Değiştir"
                        : geriAlButonu
                          ? "Yeniden Degerlendirmeye Al"
                          : olumsuzButonu
                            ? "Olumsuz gorus (IV'ye dondur)"
                            : STATUS_LABELS_TR[target as keyof typeof STATUS_LABELS_TR] || target
                      return (
                        <Button
                          key={target}
                          variant={isReject ? "destructive" : "outline"}
                          size="sm"
                          className="justify-start"
                          onClick={() => openTransition(target)}
                        >
                          {geriAlButonu ? (
                            <RotateCcw className="h-4 w-4 mr-2" />
                          ) : isReject || olumsuzButonu ? (
                            <XCircle className="h-4 w-4 mr-2" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                          )}
                          {label}
                        </Button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Bu durum icin islem yetkiniz yok.
                  </div>
                )}
              </div>
              {/* SINAV geçişi sonrası aktif oturum linki — aday gittiyse İK elle iletebilsin */}
              {sinavLink && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                  <Label className="text-emerald-800">Aday Sinav Linki</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input readOnly value={sinavLink} className="text-xs" onFocus={(e) => e.target.select()} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { navigator.clipboard?.writeText(sinavLink); toast.success("Link kopyalandi") }}
                    >
                      Kopyala
                    </Button>
                  </div>
                </div>
              )}
              {/* İK notu yalnız İK — kısıtlı (müdür) görünümde gizli (PATCH zaten admin-only) */}
              {!app._restrictedView && (
                <div>
                  <Label>IK Notlari</Label>
                  <Textarea
                    defaultValue={app.notes || ""}
                    placeholder="Bu basvuru hakkinda notlariniz..."
                    rows={5}
                    onBlur={(e) => handleNotesUpdate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Düzeltme geçmişi — yalnız İK (uç 403 döner, bileşen kendini gizler).
              Kayıt yoksa hiç render edilmez. */}
          {!app._restrictedView && (
            <BasvuruDuzeltmeGecmisi applicationId={id} yenile={gecmisTazele} />
          )}

          {/* Onaylar — KVKK + sağlık beyanı + beyan kabulü. Müdür görünümünde yalnız
              "Alındı/Alınmadı" (tarih/içerik SUNUCUDAN gelmez); İK'da tarihler de gösterilir. */}
          {app.onaylar && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Onaylar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <OnayRow label="KVKK Onayı" alindi={app.onaylar.kvkkAlindi} tarih={app.onaylar.kvkkTarih} />
                <OnayRow label="Sağlık Beyanı" alindi={app.onaylar.saglikBeyaniAlindi} tarih={app.onaylar.saglikTarih} />
                <OnayRow label="Beyan Kabulü" alindi={app.onaylar.beyanKabul} tarih={app.onaylar.beyanTarih} />
              </CardContent>
            </Card>
          )}

          {/* Müdür kararı — karar verilmemişse kart HİÇ çizilmez (rozetle aynı ilke).
              Karar + gerekçe + kim + ne zaman. İV bu kartla müdürün görüşünü görür. */}
          {(app.mudurKarari === "APPROVED" || app.mudurKarari === "REJECTED") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Müdür Kararı
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <MudurKarariBadge karar={app.mudurKarari} />
                {app.mudurKarariNotu && (
                  <p className="whitespace-pre-line text-slate-700">{app.mudurKarariNotu}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {app.mudurKarariVerenAd
                    ? `${app.mudurKarariVerenAd}${app.mudurKarariVerenSicil ? ` (${app.mudurKarariVerenSicil})` : ""}`
                    : "—"}
                  {app.mudurKarariTarihi
                    ? ` · ${new Date(app.mudurKarariTarihi).toLocaleString("tr-TR")}`
                    : ""}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Aynı adayın DİĞER başvuruları. Kart YALNIZ sunucu bu alanı gönderdiyse
              çıkar; atanan müdür yanıtında alan HİÇ YOK (adayın geçmişi İV'nin bilgisi),
              tek başvurulu adayda ise dizi boş → kart çizilmez. */}
          {Array.isArray(app.oncekiBasvurular) && app.oncekiBasvurular.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Bu adayin diger basvurulari ({app.oncekiBasvurular.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(app.oncekiBasvurular as DigerBasvuruSatiri[]).map((o) => (
                  <Link
                    key={o.id}
                    href={`/strategic-hr/recruitment/job-applications/${o.id}`}
                    className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm hover:bg-slate-50"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {o.applicationNumber}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString("tr-TR")}
                    </span>
                    <JobApplicationStatusBadge status={o.status} />
                    <Badge variant="outline" className="text-xs">
                      {o.onceki ? "onceki" : "sonraki"}
                    </Badge>
                    {o.rejectionReason && (
                      <span className="text-xs text-red-700">Ret: {o.rejectionReason}</span>
                    )}
                  </Link>
                ))}
                <p className="text-xs text-muted-foreground">
                  Ayni TC ile gonderilmis, taslak olmayan basvurular. Tekrar basvuru
                  ENGELLENMEZ — bu liste yalniz bilgi amaclidir.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Faz 4 — TEKNİK MÜLAKAT ONAY ZİNCİRİ. Satır yoksa kart hiç çıkmaz.
              Olumsuz görüş satırı SİLİNMEZ; İV neden döndüğünü burada görür. */}
          {!app._restrictedView && onayZinciri.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Teknik Mulakat Onay Zinciri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {onayZinciri.map((o) => {
                  const bekliyor = o.decision === null
                  const olumsuz = o.decision === "REJECTED"
                  // FORWARDED = İV 1. kademeyi atladı; mülakatçı görüşü ALINMADI.
                  // "Bekliyor"dan da "Olumlu"dan da AYRI gösterilir — kimse beklemiyor,
                  // ama kimse olumlu da demedi.
                  const atlandi = o.decision === "FORWARDED"
                  return (
                    <div
                      key={o.step}
                      className={`rounded-md border p-3 ${
                        bekliyor
                          ? "border-slate-200 bg-slate-50"
                          : atlandi
                            ? "border-amber-200 bg-amber-50"
                            : olumsuz
                              ? "border-red-200 bg-red-50"
                              : "border-green-200 bg-green-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-slate-900">
                          {o.step}. Kademe ·{" "}
                          {o.kademe === "TEKNIK_MULAKATCI" ? "Teknik Mulakatci" : "Ust Amir"}
                        </div>
                        <Badge
                          className={
                            bekliyor
                              ? "bg-slate-100 text-slate-700"
                              : atlandi
                                ? "bg-amber-100 text-amber-800"
                                : olumsuz
                                  ? "bg-red-100 text-red-800"
                                  : "bg-green-100 text-green-800"
                          }
                        >
                          {bekliyor ? "Bekliyor" : atlandi ? "Atlandi" : olumsuz ? "Olumsuz" : "Olumlu"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-slate-700">
                        {o.onaycıAdi ?? "(atanmamis)"}
                        {o.role ? <span className="text-muted-foreground"> · {o.role}</span> : null}
                      </div>
                      {o.comment && (
                        <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                          {o.comment}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {o.decidedAt
                          ? `${atlandi ? "Atlandi" : "Karar"}: ${format(new Date(o.decidedAt), "d MMMM yyyy HH:mm", { locale: tr })}`
                          : `Atandi: ${format(new Date(o.createdAt), "d MMMM yyyy HH:mm", { locale: tr })}`}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Sınav kartı — oturum yoksa hiç çıkmaz. sinavLink yalnız İK+aktif (sunucudan) */}
          {app.sinavlar && (app.sinavlar.aktif || app.sinavlar.gecmis.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Sınav
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[app.sinavlar.aktif, ...app.sinavlar.gecmis].filter(Boolean).map((o: OturumOzeti) => (
                  <div key={o.id} className="rounded-md border border-slate-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{o.assessmentTitle}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${sinavDurumRenk[o.durum] || "bg-slate-100 text-slate-700"}`}>
                        {sinavDurumLabel[o.durum] || o.durum}
                      </span>
                    </div>
                    {o.durum === "TAMAMLANDI" && o.puan != null && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-semibold">{o.puan} puan</span>
                        <span className="text-xs text-muted-foreground">geçme notu {o.gecmeNotu}</span>
                        <span className={`text-xs font-semibold ${o.gecti ? "text-emerald-600" : "text-red-600"}`}>
                          {o.gecti ? "GEÇTİ" : "KALDI"}
                        </span>
                      </div>
                    )}
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      <div>Atanma: {format(new Date(o.atanmaTarihi), "d MMM yyyy HH:mm", { locale: tr })}</div>
                      {o.baslamaTarihi && <div>Başlama: {format(new Date(o.baslamaTarihi), "d MMM yyyy HH:mm", { locale: tr })}</div>}
                      {o.tamamlanmaTarihi && <div>Tamamlanma: {format(new Date(o.tamamlanmaTarihi), "d MMM yyyy HH:mm", { locale: tr })}</div>}
                      <div>Son geçerlilik: {format(new Date(o.sonGecerlilik), "d MMM yyyy HH:mm", { locale: tr })}</div>
                    </div>
                    {o.sinavLink && (
                      <div className="mt-2 flex items-center gap-2">
                        <Input readOnly value={o.sinavLink} className="text-xs" onFocus={(e) => e.target.select()} />
                        <Button
                          type="button" variant="outline" size="sm"
                          onClick={() => { navigator.clipboard?.writeText(o.sinavLink!); toast.success("Link kopyalandi") }}
                        >
                          Kopyala
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Asama Gecmisi (Timeline) — stage-log ucundan + sinav olaylari (session'dan turetilir) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-4 w-4" />
                Asama Gecmisi
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-sm text-muted-foreground">Henuz asama gecisi yok.</div>
              ) : (() => {
                // (a) kronolojik ASC + (b) turlara böl (saf fonksiyon, veri değişmez)
                const rounds = groupLogsIntoRounds(logs)
                const cokTur = rounds.length > 1 // (c) tek turda tur başlığı gizli
                return (
                  <div className="space-y-5">
                    {rounds.map((r) => (
                      <div key={r.round}>
                        {cokTur && (
                          <div className="mb-2 flex items-center gap-2">
                            <span
                              className={`text-xs font-semibold ${
                                r.round === 1 ? "text-slate-500" : "text-amber-600"
                              }`}
                            >
                              {r.round === 1
                                ? "1. Değerlendirme Turu"
                                : `🔄 ${r.round}. Değerlendirme Turu (yeniden açıldı · ${format(
                                    new Date(r.reopenAt!),
                                    "d MMM HH:mm",
                                    { locale: tr },
                                  )})`}
                            </span>
                            <div className="h-px flex-1 bg-slate-200" />
                          </div>
                        )}
                        <ol className="space-y-4">
                          {r.logs.map((log) => (
                            <li key={log.id} className="relative border-l-2 border-slate-200 pl-4">
                              {/* (c) timeline noktası */}
                              <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-slate-300" />
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium text-slate-700">
                                  {format(new Date(log.createdAt), "d MMM yyyy HH:mm", { locale: tr })}
                                </span>
                                {/* Kişi adı yalnız İK görünümünde. Saf müdürde sunucu zaten
                                    göndermiyor; kapı burada da açıkça duruyor (çift emniyet). */}
                                {!app._restrictedView && log.changedByName && (
                                  <>
                                    {" · "}
                                    <span className="font-medium text-slate-600">{log.changedByName}</span>
                                    {log.changedByTitle ? ` (${log.changedByTitle})` : ""}
                                  </>
                                )}
                                {app._restrictedView && log.kendiSatirim && (
                                  <>{" · "}<span className="font-medium text-slate-600">Siz</span></>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                                {log.fromStatus ? (
                                  <JobApplicationStatusBadge status={log.fromStatus} />
                                ) : (
                                  <span className="text-xs text-muted-foreground">Basvuru olusturuldu</span>
                                )}
                                <span className="text-muted-foreground">&rarr;</span>
                                <JobApplicationStatusBadge status={log.toStatus} />
                              </div>
                              {/* Not: İK'da hepsi. Saf müdürde YALNIZ kendi yazdığı not
                                  (sunucu diğerlerini zaten göndermiyor). */}
                              {log.note && (!app._restrictedView || log.kendiSatirim) && (
                                <div className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">{log.note}</div>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                )
              })()}
              {/* Sınav olayları — session'dan TÜRETİLİR (StageLog'a yazılmaz), bilgi satırı */}
              {app.sinavlar && (app.sinavlar.aktif || app.sinavlar.gecmis.length > 0) && (() => {
                const oturumlar = [app.sinavlar.aktif, ...app.sinavlar.gecmis].filter(Boolean) as OturumOzeti[]
                const olaylar: { t: string; text: string }[] = []
                for (const o of oturumlar) {
                  olaylar.push({ t: o.atanmaTarihi, text: `Sınav atandı: ${o.assessmentTitle}` })
                  if (o.baslamaTarihi) olaylar.push({ t: o.baslamaTarihi, text: `Sınav başladı: ${o.assessmentTitle}` })
                  if (o.tamamlanmaTarihi) olaylar.push({ t: o.tamamlanmaTarihi, text: `Sınav tamamlandı: ${o.assessmentTitle} — ${o.puan} puan (${o.gecti ? "geçti" : "kaldı"})` })
                }
                olaylar.sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime())
                return (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">Sınav olayları</div>
                    <ol className="space-y-2">
                      {olaylar.map((e, i) => (
                        <li key={i} className="border-l-2 border-emerald-200 pl-4">
                          <div className="text-xs text-muted-foreground">{format(new Date(e.t), "d MMM yyyy HH:mm", { locale: tr })}</div>
                          <div className="text-sm text-slate-700">{e.text}</div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )
              })()}

              {/* "Kimde bekliyor" — SUNUCUDAN gelen bekleyen bağlamı (kural: bekleyen.ts).
                  Terminal statüde (işe başladı / reddedildi) sunucu null döner, satır çıkmaz. */}
              {bekleyen && (
                <div
                  className={`mt-4 rounded-md border p-3 ${
                    bekleyen.siz ? "ring-2 ring-amber-400 " : ""
                  }${
                    bekleyen.tip === "MUDUR"
                      ? "border-amber-200 bg-amber-50"
                      : bekleyen.tip === "ADAY"
                        ? "border-sky-200 bg-sky-50"
                        : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Clock
                      className={`h-4 w-4 shrink-0 mt-0.5 ${
                        bekleyen.tip === "MUDUR"
                          ? "text-amber-600"
                          : bekleyen.tip === "ADAY"
                            ? "text-sky-600"
                            : "text-slate-500"
                      }`}
                    />
                    <div className="text-sm">
                      <div
                        className={`font-medium ${
                          bekleyen.tip === "MUDUR"
                            ? "text-amber-900"
                            : bekleyen.tip === "ADAY"
                              ? "text-sky-900"
                              : "text-slate-700"
                        }`}
                      >
                        {/* Faz 5 — karar BU kullanıcıdaysa vurgulanır. Bilgi SUNUCUDAN
                            gelir (bekleyen.siz → kararSizdeMi); client rol/statü kuralı
                            yürütmez, sabit statü listesi tutmaz. */}
                        {bekleyen.siz
                          ? "Bu basvuru SIZIN kararinizi bekliyor"
                          : bekleyen.tip === "MUDUR"
                            ? `Su an ${bekleyen.ad}'da bekliyor`
                            : bekleyen.tip === "ADAY"
                              ? "Su an adayda bekliyor (duzeltme gonderecek)"
                              : `Su an ${bekleyen.ad}'nda bekliyor`}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {workflow
                          ? STATUS_LABELS_TR[workflow.currentStatus as keyof typeof STATUS_LABELS_TR] ||
                            workflow.currentStatus
                          : ""}
                        {bekleyen.beri && (
                          <>
                            {" · "}
                            {(() => {
                              const gun = differenceInCalendarDays(new Date(), new Date(bekleyen.beri))
                              return gun <= 0 ? "bugun" : `${gun} gundur`
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Geri gönderme sayacı — StageLog'dan TÜRETİLİR (yeni kolon yok).
                  Sert sınır YOK; 2 ve üzeri için uyarı tonu. */}
              {geriGondermeSayisi > 0 && (
                <div
                  className={`mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                    geriGondermeSayisi >= 2
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-sky-200 bg-sky-50 text-sky-800"
                  }`}
                >
                  {geriGondermeSayisi >= 2 ? (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>
                    Adaya <strong>{geriGondermeSayisi} kez</strong> geri gonderildi
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ozet Bilgiler */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hizli Bilgiler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {app.mobilePhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${app.mobilePhone}`} className="text-blue-600 hover:underline">{app.mobilePhone}</a>
                </div>
              )}
              {app.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${app.email}`} className="text-blue-600 hover:underline">{app.email}</a>
                </div>
              )}
              {app.requestedPosition && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>{app.requestedPosition}</span>
                </div>
              )}
              {app.educationLevel && (
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <span>{educationLevelLabels[app.educationLevel] || app.educationLevel}</span>
                </div>
              )}
              {app.expectedSalary && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-medium">TL</span>
                  <span>{app.expectedSalary.toLocaleString()} TL</span>
                </div>
              )}
              {app.referralSourceDef?.name && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Kaynak:</span>
                  <span>{app.referralSourceDef.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gecis modalı — hedefe göre müdür / ret nedeni alanı + opsiyonel not */}
      <Dialog open={!!txTarget} onOpenChange={(o) => { if (!o) closeTransition() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {!txTarget
                ? ""
                : retGeriAlma
                  ? "Yeniden degerlendirmeye al"
                  : olumsuzGorus
                    ? "Olumsuz gorus bildir"
                    : `${STATUS_LABELS_TR[txTarget as keyof typeof STATUS_LABELS_TR] || txTarget} asamasina gecir`}
            </DialogTitle>
            <DialogDescription>
              {retGeriAlma
                ? "Ret geri alinir ve basvuru IV Havuzu'na doner. Ret kaydi SILINMEZ, tarihcede kalir. Gerekce ZORUNLU."
                : olumsuzGorus
                ? "Basvuru IV Havuzu'na doner. Nihai reddi yalnizca IV verebilir; gerekce ZORUNLU."
                : isGeriGonder
                  ? "Duzeltilecek alanlari isaretleyin. Aday YALNIZ alan adlarini gorur; notunuz ic kayittir."
                  : requiresReason
                    ? "Ret nedeni secimi zorunludur."
                    : requiresManager
                      ? "Degerlendirmeyi yapacak kisiyi secin."
                      : requiresAssessment
                        ? "Atanacak sinavi secin — gecisle birlikte aday sinav oturumu acilir."
                        : otomatikAtama
                          ? "Bu asamada atama otomatik yapilir — kisi secmeniz gerekmez."
                          : "Gecisi onaylayin."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* ── Adaya geri gönder: alan işaretleme ──────────────────────────────
                Seçenekler DUZENLENEBILIR_ALANLAR beyaz listesinden gelir; etiketler
                ALAN_ETIKETLERI'nden. Sunucu aynı listeyle tekrar süzer — buradan
                beyaz liste dışı bir ad gönderilse bile not'a yazılmaz. */}
            {isGeriGonder && (
              <>
                {geriGondermeSayisi >= 2 && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Bu basvuru daha once <strong>{geriGondermeSayisi} kez</strong> adaya geri
                      gonderildi. Sert sinir yok, ama aday ile dogrudan iletisim daha hizli olabilir.
                    </span>
                  </div>
                )}
                <div>
                  <Label>
                    Duzeltilecek alanlar{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({txAlanlar.length} secili)
                    </span>
                  </Label>
                  <Input
                    placeholder="Alan ara..."
                    value={txAlanAra}
                    onChange={(e) => setTxAlanAra(e.target.value)}
                    className="mt-1 mb-2"
                  />
                  <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                    {DUZENLENEBILIR_ALANLAR.filter((a) =>
                      ALAN_ETIKETLERI[a]
                        .toLocaleLowerCase("tr")
                        .includes(txAlanAra.toLocaleLowerCase("tr")),
                    ).map((a) => {
                      const secili = txAlanlar.includes(a)
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() =>
                            setTxAlanlar((prev) =>
                              prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
                            )
                          }
                          className={`flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-slate-50 ${
                            secili ? "bg-sky-50" : ""
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              secili ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300"
                            }`}
                          >
                            {secili && <CheckCircle2 className="h-3 w-3" />}
                          </span>
                          {ALAN_ETIKETLERI[a]}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Alan secilmezse adaya yalnizca &quot;duzeltme bekleniyor&quot; bilgisi gider.
                  </p>
                </div>
              </>
            )}
            {/* Otomatik atama — kişi seçimi YOK, yalnız kime gideceği bilgisi.
                hazir=false ise geçiş sunucuda 400 döner; kullanıcı sebebini önden görsün. */}
            {otomatikAtama && (
              otomatikAtama.hazir ? (
                <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                  <UserCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Basvuru otomatik olarak <strong>{otomatikAtama.ad}</strong> kisisine atanacak.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Bu asama icin otomatik atanacak kisi bulunamadi. Departman tanimindaki
                    mudur/mudur yardimcisi ve aktif kullanici hesabi kontrol edilmeli — gecis su an basarisiz olur.
                  </span>
                </div>
              )
            )}

            {/* Müdür seçimi — iki grup ayrı gösterilir */}
            {requiresManager && (
              <div>
                <Label>{secimEtiketi}</Label>
                <Select value={txManagerId} onValueChange={setTxManagerId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={`${secimEtiketi} secin`} />
                  </SelectTrigger>
                  <SelectContent>
                    {managers && managers.onerilenler.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Onerilen mudurler</div>
                        {managers.onerilenler.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}{m.departmentName ? ` — ${m.departmentName}${m.isDeputy ? " (Yrd.)" : ""}` : ""}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {managers && managers.tumAktif.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Tum aktif kullanicilar</div>
                        {managers.tumAktif.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                {managers && managers.unmatchedManagers.length > 0 && (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Kullanici hesabi olmayan mudurler atanamaz:{" "}
                      {managers.unmatchedManagers.map((u) => u.adSoyad || u.personnelId).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Faz 4 — seçilen mülakatçının ÜST AMİRİ önizlemesi. Uyarı SEÇİM ANINDA
                çıkar; geçiş anında sürpriz olmasın. */}
            {txTarget === "TEKNIK_MULAKAT" && secilenMulakatci && (
              secilenMulakatci.ustAmir?.atlanir ? (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Ust amir bulunamadi, karar IV&apos;ye donecek.</strong> Secilen kisi kendi
                    boluminde ust amir konumunda; kendisini onaylayamaz. 1. kademe olumlu
                    sonuclanirsa 2. kademe ATLANIR ve basvuru IV Havuzu&apos;na doner.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                  <UserCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    1. kademe olumlu sonuclanirsa 2. kademe{" "}
                    <strong>{secilenMulakatci.ustAmir?.ad ?? "ust amir"}</strong>
                    {secilenMulakatci.ustAmir?.yol === "MUDUR_YRD" ? " (mudur yardimcisi)" : " (mudur)"}
                    {" "}kisisine otomatik atanacak.
                  </span>
                </div>
              )
            )}

            {/* Faz 4 — kademe karar yorumu. Olumsuz goruste ZORUNLU (sunucu da dogruluyor). */}
            {kademeKarari && (
              <div>
                <Label>
                  {olumsuzGorus ? "Olumsuz gorus gerekcesi (ZORUNLU)" : "Degerlendirme notu (opsiyonel)"}
                </Label>
                <Textarea
                  value={txKademeYorumu}
                  onChange={(e) => setTxKademeYorumu(e.target.value)}
                  placeholder={
                    olumsuzGorus
                      ? "Neden olumsuz? Bu metin onay zincirinde ve asama gecmisinde kalir."
                      : "Degerlendirmeniz hakkinda kisa not"
                  }
                  rows={3}
                  className="mt-1"
                />
                {olumsuzGorus && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Olumsuz gorus adayi REDDETMEZ — basvuru IV Havuzu&apos;na doner, nihai karari IV verir.
                  </p>
                )}
              </div>
            )}

            {/* Ret nedeni seçimi */}
            {requiresReason && (
              <div>
                <Label>Ret Nedeni</Label>
                <Select value={txReasonId} onValueChange={setTxReasonId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Ret nedeni secin" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasons.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Sınav seçimi — aranabilir liste; her satırda ad, soru sayısı, süre, geçme notu */}
            {requiresAssessment && (
              <div>
                <Label>Sinav</Label>
                <Input
                  value={txAssessmentSearch}
                  onChange={(e) => setTxAssessmentSearch(e.target.value)}
                  placeholder="Sinav ara..."
                  className="mt-1"
                />
                <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-200 divide-y">
                  {assessments.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground">Aktif sinav bulunamadi.</div>
                  )}
                  {assessments
                    .filter((a) => a.title.toLocaleLowerCase("tr").includes(txAssessmentSearch.toLocaleLowerCase("tr")))
                    .map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setTxAssessmentId(a.id)}
                        className={`w-full text-left p-3 text-sm hover:bg-slate-50 ${txAssessmentId === a.id ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""}`}
                      >
                        <div className="font-medium">{a.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {a.soruSayisi} soru · {a.durationMin} dk · gecme {a.passingScore}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div>
              <Label>
                {retGeriAlma
                  ? "Geri alma gerekcesi (ZORUNLU)"
                  : isGeriGonder
                    ? "Ic not (adaya GITMEZ, opsiyonel)"
                    : "Not (opsiyonel)"}
              </Label>
              <Textarea
                value={txNote}
                onChange={(e) => setTxNote(e.target.value)}
                placeholder={
                  isGeriGonder
                    ? "Ornek: telefonu okunmuyor, teyit edilecek — bu metin yalniz IV kaydinda kalir"
                    : "Bu gecis hakkinda aciklama..."
                }
                rows={3}
                className="mt-1"
              />
              {isGeriGonder && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Adaya yalnizca isaretledigin alan adlari gonderilir; bu not asama gecmisinde kalir.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeTransition} disabled={txSubmitting}>
              Vazgec
            </Button>
            <Button
              onClick={submitTransition}
              disabled={
                txSubmitting ||
                (requiresManager && !txManagerId) ||
                (requiresReason && !txReasonId) ||
                (requiresAssessment && !txAssessmentId) ||
                (olumsuzGorus && !txKademeYorumu.trim()) ||
                (retGeriAlma && !txNote.trim())
              }
            >
              {txSubmitting ? "Kaydediliyor..." : "Onayla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PersoneleDonusturDialog
        open={donusumAcik}
        onOpenChange={setDonusumAcik}
        applicationId={id}
        onDone={() => { fetchDetail(); fetchWorkflow() }}
      />

      {/* İK düzeltme modu — beyaz listedeki alanlar. Kaydet sonrası kayıt yeniden
          çekilir ve düzeltme geçmişi tazelenir. */}
      {!app._restrictedView && (
        <BasvuruDuzeltmeDialog
          open={duzeltmeAcik}
          onOpenChange={setDuzeltmeAcik}
          applicationId={id}
          app={app}
          onSaved={() => {
            fetchDetail()
            setGecmisTazele((v) => v + 1)
          }}
        />
      )}
    </>
  )
}
