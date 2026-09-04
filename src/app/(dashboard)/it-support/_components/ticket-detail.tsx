"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useAuthenticatedData } from "@/hooks/use-authenticated-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, X, AlertTriangle, Loader2, Send, UserPlus, Settings2, Headphones, Clock, CheckCircle2, Paperclip, FileText, Sparkles, ThumbsUp, RotateCcw, Link2, Unlink, Plus } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import { ticketAge, resolutionTime, isOpenStatus } from "../_lib/ticket-age"
import { CategoryBadge } from "./category-badge"
import { MemnuniyetKarti, MemnuniyetSonucu } from "./memnuniyet-karti"
import { puanlayabilirMi } from "@/lib/tickets/memnuniyet"
import { ITIRAZ_SURESI_GUN, kalanItirazGunu, cozulebilirMi } from "@/lib/tickets/cozum"
import { ZIMMET_TUR_LABELS } from "@/lib/tickets/cihaz-etiket"
import { toast } from "sonner"

// Durum okunaklı TR etiketleri — toast geri bildiriminde kullanılır.
const STATUS_TR: Record<string, string> = {
  NEW: "Yeni", ASSIGNED: "Atandı", IN_PROGRESS: "İşlemde", PENDING: "Beklemede",
  ON_HOLD: "Askıda", RESOLVED: "Çözüldü", CLOSED: "Kapatıldı", CANCELLED: "İptal",
  REOPENED: "Yeniden Açıldı",
}

interface Ticket {
  id: string
  ticketNumber: string
  subject: string
  description: string
  ticketType: string
  priority: string
  status: string
  requesterEmail: string
  requesterName: string
  requesterDept: string | null
  assignedTo: string | null
  assignedToName: string | null
  location: string | null
  /**
   * Seçim anının anlık görüntüsü (cihaz seçildiyse SUNUCUDA üretilir) ya da
   * kullanıcının yazdığı serbest metin. Cihaz sonradan pasifleşse/silinse bile
   * burası okunabilir kalır.
   */
  assetInfo: string | null
  zimmetFormuId?: string | null
  zimmetFormu?: {
    id: string
    tur: string
    turDiger: string | null
    marka: string | null
    model: string | null
    seriNumarasi: string | null
    pcAdi: string | null
    cihazDurumu: string
  } | null
  slaResponseBreached?: boolean
  slaResolutionBreached?: boolean
  satisfactionRating?: number | null
  satisfactionComment?: string | null
  // Çözüm akışı (Faz 1)
  resolvedByName?: string | null
  autoCloseAt?: string | null
  objectionCount?: number | null
  // Kronik sorun bağı (Faz 1.5) — bağ IT ekibi tarafından kurulur.
  kronikSorunId?: string | null
  kronikSorun?: { id: string; baslik: string; durum: string } | null
  createdAt: string
  closedAt?: string | null
  resolvedAt?: string | null
  category?: { name: string; color: string | null; icon: string | null } | null
  // HAVUZ (Faz 3): ticket bir takıma düşmüşse. Bayraklar SUNUCUDA hesaplanır
  // (üye e-postaları istemciye gönderilmez).
  /** JSON metin: [{url,name,size,type}] — DB'de Text, istemcide parse edilir. */
  attachments?: string | null
  assignedTeamId?: string | null
  assignedTeam?: { id: string; name: string } | null
  currentUserIsTeamMember?: boolean
  currentUserCanClaim?: boolean
  comments?: TicketComment[]
  timeline?: TicketTimelineEntry[]
}

interface TicketEk {
  url: string
  name: string
  size: number
  type: string
}

interface TicketComment {
  id: string
  authorName: string
  content: string
  isInternal: boolean
  isResolution: boolean
  createdAt: string
}

// GET /api/tickets/[id] → timeline: sistem olayları (atama, durum, öncelik…).
interface TicketTimelineEntry {
  id: string
  action: string
  description: string
  performedByName: string
  createdAt: string
}

// Yorum + sistem olayını tek kronolojik akışta birleştirmek için ayrık union.
type ActivityItem =
  | { kind: "comment"; id: string; createdAt: string; comment: TicketComment }
  | { kind: "event"; id: string; createdAt: string; event: TicketTimelineEntry }

function eventIcon(action: string) {
  if (action === "assigned") return <UserPlus className="h-3 w-3" />
  if (action === "status_changed") return <CheckCircle2 className="h-3 w-3" />
  if (action === "priority_changed") return <AlertTriangle className="h-3 w-3" />
  return <Settings2 className="h-3 w-3" />
}

interface KronikSecenek {
  id: string
  baslik: string
  durum: string
  bagliTalep: number
}

interface AssignableUser {
  id: string
  name: string
  email: string
}

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    NEW: { label: "Yeni", variant: "default" },
    ASSIGNED: { label: "Atandi", variant: "secondary" },
    IN_PROGRESS: { label: "Islemde", variant: "default" },
    PENDING: { label: "Beklemede", variant: "outline" },
    ON_HOLD: { label: "Askida", variant: "outline" },
    RESOLVED: { label: "Cozuldu", variant: "secondary" },
    CLOSED: { label: "Kapatildi", variant: "secondary" },
    CANCELLED: { label: "Iptal", variant: "destructive" },
    REOPENED: { label: "Yeniden Acildi", variant: "default" },
  }
  const s = map[status] || { label: status, variant: "outline" as const }
  return <Badge variant={s.variant}>{s.label}</Badge>
}

function getPriorityBadge(priority: string) {
  const map: Record<string, { label: string; className: string }> = {
    TICKET_CRITICAL: { label: "Kritik", className: "bg-red-500 text-white" },
    TICKET_HIGH: { label: "Yuksek", className: "bg-orange-500 text-white" },
    NORMAL: { label: "Normal", className: "bg-blue-500 text-white" },
    TICKET_LOW: { label: "Dusuk", className: "bg-gray-500 text-white" },
  }
  const p = map[priority] || { label: priority, className: "" }
  return <Badge className={p.className}>{p.label}</Badge>
}

function getTicketTypeLabel(type: string) {
  const types: Record<string, string> = {
    INCIDENT: "Olay", SERVICE_REQUEST: "Hizmet Talebi", PROBLEM: "Problem", CHANGE_REQUEST: "Degisiklik Talebi",
  }
  return types[type] || type
}

/**
 * Ticket detay içeriği — hem modal (onClose verilir) hem tam sayfa (onClose yok → geri butonu).
 */
export function TicketDetail({ ticketId, onClose }: { ticketId: string; onClose?: () => void }) {
  const router = useRouter()
  const { data: session } = useSession()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [timeline, setTimeline] = useState<TicketTimelineEntry[]>([])
  const [updatingTicket, setUpdatingTicket] = useState(false)
  const [puanGonderiliyor, setPuanGonderiliyor] = useState(false)
  const [ekYukleniyor, setEkYukleniyor] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [sendingComment, setSendingComment] = useState(false)
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([])
  // Çözüm akışı (Faz 1)
  const [cozumModalAcik, setCozumModalAcik] = useState(false)
  const [cozumMetni, setCozumMetni] = useState("")
  const [cozumGonderiliyor, setCozumGonderiliyor] = useState(false)
  const [onayGonderiliyor, setOnayGonderiliyor] = useState(false)
  // Kronik sorun bağı (Faz 1.5)
  const [kronikAcik, setKronikAcik] = useState(false)
  const [kronikListe, setKronikListe] = useState<KronikSecenek[]>([])
  const [kronikArama, setKronikArama] = useState("")
  const [kronikSeciliId, setKronikSeciliId] = useState("")
  const [kronikYeniBaslik, setKronikYeniBaslik] = useState("")
  const [kronikIsleniyor, setKronikIsleniyor] = useState(false)

  const isITStaff = session?.user?.permissions?.includes("helpdesk.admin") ?? false
  // Sunucu (PUT /api/tickets/[id]) DURUM değişikliğine izin verirken
  // `userIsITStaff || isAssignee || isTicketTeamMember` bakıyor; ekran ise
  // yalnız isITStaff'a bakıyordu → kendisine atanan talebin durumunu
  // değiştirebilecek teknisyen kontrolü GÖREMİYORDU. Aynı kurala hizalandı.
  // Atama/öncelik/talep tipi sunucuda da yalnız IT ekibinde → isITStaff'ta KALIR.
  const isAssignee =
    !!ticket?.assignedTo &&
    ticket.assignedTo.toLowerCase() === (session?.user?.email ?? "").toLowerCase()
  const durumDegistirebilir =
    isITStaff || isAssignee || (ticket?.currentUserIsTeamMember ?? false)

  // Çözüm akışı türetmeleri: onay kartı YALNIZ talep sahibine görünür
  // (sunucu da yalnız sahibi kabul ediyor — /cozum/onay 403).
  const isOwner =
    (ticket?.requesterEmail ?? "").toLowerCase() === (session?.user?.email ?? "").toLowerCase()
  const kalanGun = kalanItirazGunu(
    ticket?.autoCloseAt ? new Date(ticket.autoCloseAt) : null,
    new Date(),
  )

  // loading/error/timeout artık useAuthenticatedData'da. Hata durumunda throw eder →
  // hook loadError'ı set eder (eski !ok / catch → setLoadError(true) davranışı korunur).
  const fetchTicket = async () => {
    const res = await fetch(`/api/tickets/${ticketId}`)
    if (!res.ok) throw new Error("Talep yüklenemedi")
    const data: Ticket = await res.json()
    setTicket(data)
    setComments(data.comments ?? [])
    setTimeline(data.timeline ?? [])
  }

  const fetchAssignableUsers = async () => {
    try {
      const res = await fetch("/api/tickets/assignable-users")
      if (res.ok) setAssignableUsers(await res.json())
    } catch {
      // atama listesi kritik değil
    }
  }

  // İlk yükleme + auth-gate + timeout: ortak hook.
  // fetchAssignableUsers eski koddaki gibi bağımsız (fetchTicket başarısız olsa da çalışır);
  // loading/error'ı fetchTicket (throw ederek) belirler.
  const { loading, loadError, retry } = useAuthenticatedData(async () => {
    if (isITStaff) fetchAssignableUsers()
    await fetchTicket()
  })

  // ticketId değişince (aynı instance yeniden kullanılırsa) veriyi yeniden çek.
  const ticketIdInitRef = useRef(true)
  useEffect(() => {
    if (ticketIdInitRef.current) {
      ticketIdInitRef.current = false
      return
    }
    retry()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const handleUpdateTicket = async (updates: Partial<Ticket>) => {
    if (!ticket) return
    setUpdatingTicket(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const updated = await res.json()
        setTicket((cur) => (cur ? { ...cur, ...updated } : cur))
        // Geri bildirim: durum değişikliğinde okunaklı etiket, diğerlerinde genel.
        if (typeof updates.status === "string") {
          toast.success(`Durum güncellendi: ${STATUS_TR[updates.status] ?? updates.status}`)
        } else {
          toast.success("Güncellendi")
        }
      } else {
        // Sessiz yutma YOK: backend hata mesajını göster (403 "yetkiniz yok" vb.).
        // ticket.status değişmediği için <Select value={ticket.status}> eski değere döner.
        const data = await res.json().catch(() => null)
        toast.error(data?.error || "İşlem başarısız")
      }
    } catch {
      toast.error("İşlem başarısız — bağlantı hatası")
    } finally {
      setUpdatingTicket(false)
    }
  }

  /**
   * Memnuniyet puanı gönderir. Mevcut PUT yolu kullanılır — yeni endpoint yok.
   * Sunucu sahiplik/durum/pencere/tekrar kontrollerini KENDİ yapar; buradaki
   * görünürlük kararı yalnız kullanıcı deneyimi içindir.
   */
  const handlePuanla = async (puan: number, yorum: string) => {
    if (!ticket) return
    setPuanGonderiliyor(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          satisfactionRating: puan,
          satisfactionComment: yorum || null,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setTicket((cur) => (cur ? { ...cur, ...updated } : cur))
        toast.success("Değerlendirmeniz için teşekkürler")
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || "Değerlendirme kaydedilemedi")
      }
    } catch {
      toast.error("Değerlendirme gönderilemedi — bağlantı hatası")
    } finally {
      setPuanGonderiliyor(false)
    }
  }

  const handleAssignToMe = () => {
    if (!session?.user?.email || !session?.user?.name) return
    handleUpdateTicket({ assignedTo: session.user.email, assignedToName: session.user.name } as Partial<Ticket>)
  }

  // HAVUZ: takım üyesi havuzdaki ticket'ı üstlenir → kendisine atanır, ASSIGNED olur.
  // Mevcut PUT /api/tickets/[id] kullanılır, yeni endpoint yok.
  const handleClaim = () => {
    if (!session?.user?.email) return
    handleUpdateTicket({
      assignedTo: session.user.email,
      assignedToName: session.user.name ?? session.user.email,
      status: "ASSIGNED",
    } as Partial<Ticket>)
  }

  // ── ÇÖZÜM AKIŞI (Faz 1) ───────────────────────────────────────────────
  // Durum açılırındaki "Çözüldü" kaldırıldı: çözmenin tek yolu bu modal ve
  // arkasındaki POST /api/tickets/[id]/cozum ucu (damgaları o yazıyor).
  const handleCozumGonder = async () => {
    if (!ticket) return
    setCozumGonderiliyor(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/cozum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Metin OPSİYONEL: boş gönderim geçerli bir çözümdür.
        body: JSON.stringify({ cozum: cozumMetni.trim() }),
      })
      if (!res.ok) {
        const hata = await res.json().catch(() => ({}))
        throw new Error(hata?.error || "Çözüm kaydedilemedi")
      }
      setCozumModalAcik(false)
      setCozumMetni("")
      await fetchTicket()
      toast.success(
        cozumMetni.trim()
          ? "Çözüldü olarak işaretlendi, çözüm arşive eklendi"
          : "Çözüldü olarak işaretlendi",
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Çözüm kaydedilemedi")
    } finally {
      setCozumGonderiliyor(false)
    }
  }

  const handleOnayKarari = async (karar: "ONAYLA" | "ITIRAZ") => {
    if (!ticket) return
    setOnayGonderiliyor(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/cozum/onay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ karar }),
      })
      if (!res.ok) {
        const hata = await res.json().catch(() => ({}))
        throw new Error(hata?.error || "İşlem başarısız")
      }
      await fetchTicket()
      toast.success(
        karar === "ONAYLA"
          ? "Talep kapatıldı — dilerseniz hizmeti puanlayabilirsiniz"
          : "Talep yeniden açıldı, IT ekibi bilgilendirildi",
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız")
    } finally {
      setOnayGonderiliyor(false)
    }
  }

  // ── KRONİK SORUN BAĞI (Faz 1.5) ───────────────────────────────────────
  // Yalnız IT ekibi: "aynı sorun mu" yargısı onlara ait (sunucu da aynı kapı).
  const kronikleriGetir = async () => {
    try {
      const res = await fetch("/api/tickets/kronik?durum=AKTIF")
      if (res.ok) setKronikListe(await res.json())
    } catch {
      // liste kritik değil — yeni tanımlama yolu açık kalır
    }
  }

  const handleKronikBagla = async () => {
    if (!ticket) return
    const yeni = kronikYeniBaslik.trim()
    if (!kronikSeciliId && !yeni) return
    setKronikIsleniyor(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/kronik`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(yeni ? { baslik: yeni } : { kronikSorunId: kronikSeciliId }),
      })
      if (!res.ok) {
        const h = await res.json().catch(() => ({}))
        throw new Error(h?.error || "Bağlanamadı")
      }
      setKronikAcik(false)
      setKronikSeciliId("")
      setKronikYeniBaslik("")
      await fetchTicket()
      toast.success("Talep kronik soruna bağlandı")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bağlanamadı")
    } finally {
      setKronikIsleniyor(false)
    }
  }

  const handleKronikKaldir = async () => {
    if (!ticket) return
    setKronikIsleniyor(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/kronik`, { method: "DELETE" })
      if (!res.ok) {
        const h = await res.json().catch(() => ({}))
        throw new Error(h?.error || "Bağ kaldırılamadı")
      }
      await fetchTicket()
      toast.success("Kronik sorun bağı kaldırıldı")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bağ kaldırılamadı")
    } finally {
      setKronikIsleniyor(false)
    }
  }

  // ── Ekler ────────────────────────────────────────────────────────────
  // DB'de JSON metin; bozuk veri gelirse boş liste (ekran patlamasın).
  const ekler: TicketEk[] = (() => {
    if (!ticket?.attachments) return []
    try {
      const p = JSON.parse(ticket.attachments)
      return Array.isArray(p) ? (p as TicketEk[]).filter((e) => e && typeof e.url === "string") : []
    } catch {
      return []
    }
  })()

  // Yeni ek: upload → mevcut listeye EKLE → PUT ile tam listeyi gönder.
  const handleEkYukle = async (files: File[]) => {
    if (files.length === 0 || !ticket) return
    setEkYukleniyor(true)
    try {
      const fd = new FormData()
      files.forEach((f) => fd.append("files", f))
      const up = await fetch("/api/tickets/upload", { method: "POST", body: fd })
      if (!up.ok) {
        const err = await up.json().catch(() => ({}))
        toast.error(err.error || "Dosya yüklenemedi")
        return
      }
      const yeni: TicketEk[] = (await up.json()).files ?? []
      await handleUpdateTicket({ attachments: [...ekler, ...yeni] } as unknown as Partial<Ticket>)
      toast.success(yeni.length > 1 ? `${yeni.length} ek eklendi` : "Ek eklendi")
    } catch {
      toast.error("Dosya yüklenemedi — bağlantı hatası")
    } finally {
      setEkYukleniyor(false)
    }
  }

  const handleAssignToUser = (userId: string) => {
    const u = assignableUsers.find((x) => x.id === userId)
    if (!u) return
    handleUpdateTicket({ assignedTo: u.email, assignedToName: u.name } as Partial<Ticket>)
  }

  const handleSendComment = async () => {
    if (!newComment.trim() || !ticket) return
    setSendingComment(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      })
      if (res.ok) {
        const comment = await res.json()
        setComments((prev) => [...prev, comment])
        setNewComment("")
      }
    } catch {
      // sessiz
    } finally {
      setSendingComment(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError || !ticket) {
    return (
      <div className="text-center py-20">
        <Headphones className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">Talep yüklenemedi. Bulunamadı ya da oturumunuz sonlanmış olabilir.</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button variant="outline" onClick={retry}>
            Yeniden dene
          </Button>
          <Button variant="outline" onClick={() => (onClose ? onClose() : router.push("/it-support"))}>
            {onClose ? "Kapat" : "Listeye dön"}
          </Button>
        </div>
      </div>
    )
  }

  const open = isOpenStatus(ticket.status)
  const age = ticketAge(ticket.createdAt)

  // ── MEMNUNİYET: görünürlük kararı TEK KAYNAK (@/lib/tickets/memnuniyet).
  // Sunucu PUT'ta aynı fonksiyonu tekrar çağırır; burası yalnız çizim kararı.
  const memnuniyet = puanlayabilirMi(
    {
      requesterEmail: ticket.requesterEmail,
      status: ticket.status,
      closedAt: ticket.closedAt ? new Date(ticket.closedAt) : null,
      resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt) : null,
      satisfactionRating: ticket.satisfactionRating ?? null,
    },
    session?.user?.email,
    new Date(),
  )
  const puanlandi =
    ticket.satisfactionRating !== null && ticket.satisfactionRating !== undefined
  const resolved = !open ? resolutionTime(ticket.createdAt, ticket.closedAt, ticket.resolvedAt) : null

  // Yorumlar + sistem olayları tek kronolojik akışta (eski→yeni). 'comment_added'
  // olayları elenir: yorumun kendisi zaten ayrı kart olarak gösteriliyor (çift kayıt olmasın).
  const activity: ActivityItem[] = [
    ...comments.map((c) => ({ kind: "comment" as const, id: `c_${c.id}`, createdAt: c.createdAt, comment: c })),
    ...timeline
      .filter((t) => t.action !== "comment_added")
      .map((t) => ({ kind: "event" as const, id: `t_${t.id}`, createdAt: t.createdAt, event: t })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              {ticket.ticketNumber}
              {getStatusBadge(ticket.status)}
              {open && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${age.className}`}>
                  <Clock className="h-3 w-3" />
                  {age.label}
                </span>
              )}
            </CardTitle>
            <CardDescription>{ticket.subject}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => (onClose ? onClose() : router.push("/it-support"))}>
            {onClose ? <X className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Memnuniyet: puanlanmışsa sonuç (herkese), değilse davet (yalnız talebi açana) */}
        {puanlandi ? (
          <MemnuniyetSonucu
            puan={ticket.satisfactionRating as number}
            yorum={ticket.satisfactionComment ?? null}
          />
        ) : memnuniyet.puanlayabilir ? (
          <MemnuniyetKarti
            kalanGun={memnuniyet.kalanGun}
            gonderiliyor={puanGonderiliyor}
            onGonder={handlePuanla}
          />
        ) : null}

        {/* Bekleme göstergesi (açık ticket) */}
        {open && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${age.className}`}>
            <Clock className="h-4 w-4" />
            Açılalı {age.days >= 1 ? `${Math.floor(age.days)} gün` : "1 günden az"}, henüz {ticket.assignedTo ? "çözülmedi" : "atanmadı"}.
          </div>
        )}

        {/* Kapanma süresi (kapalı ticket) */}
        {!open && resolved && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            {resolved.label}.
          </div>
        )}

        {/* Bilgi grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
          <div>
            <p className="text-sm text-muted-foreground">Talep Eden</p>
            <p className="font-medium">{ticket.requesterName}</p>
            <p className="text-sm text-muted-foreground">{ticket.requesterDept}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Atanan</p>
            <p className="font-medium">{ticket.assignedToName || "Atanmadi"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tip</p>
            <p className="font-medium">{getTicketTypeLabel(ticket.ticketType)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Oncelik</p>
            {getPriorityBadge(ticket.priority)}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Kategori</p>
            <div className="mt-0.5"><CategoryBadge category={ticket.category ?? null} /></div>
          </div>
          {ticket.location && (
            <div>
              <p className="text-sm text-muted-foreground">Lokasyon</p>
              <p className="font-medium">{ticket.location}</p>
            </div>
          )}
          {/*
            Üç durum:
            1) Bağlı zimmet kaydı var  → yapılandırılmış cihaz künyesi
            2) Kayıt yok ama assetInfo dolu → düz metin (serbest giriş VEYA
               cihaz silindikten sonra geriye kalan anlık görüntü). Bu bir hata
               değil, tasarım gereği — "cihaz kaydı bulunamadı" BASILMAZ.
            3) İkisi de yok → blok hiç çizilmez
          */}
          {ticket.zimmetFormu ? (
            <div>
              <p className="text-sm text-muted-foreground">Ilgili Cihaz</p>
              <p className="font-medium">
                {ticket.zimmetFormu.turDiger?.trim() ||
                  ZIMMET_TUR_LABELS[ticket.zimmetFormu.tur] ||
                  ticket.zimmetFormu.tur}
                {ticket.zimmetFormu.cihazDurumu === "PASIF" && (
                  <Badge variant="outline" className="ml-2 text-xs font-normal">
                    Pasif
                  </Badge>
                )}
              </p>
              {(ticket.zimmetFormu.marka || ticket.zimmetFormu.model) && (
                <p className="text-sm">
                  {[ticket.zimmetFormu.marka, ticket.zimmetFormu.model]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              )}
              {ticket.zimmetFormu.seriNumarasi && (
                <p className="text-sm text-muted-foreground">
                  SN: {ticket.zimmetFormu.seriNumarasi}
                </p>
              )}
              {ticket.zimmetFormu.pcAdi && (
                <p className="text-sm text-muted-foreground">
                  PC: {ticket.zimmetFormu.pcAdi}
                </p>
              )}
            </div>
          ) : ticket.assetInfo ? (
            <div>
              <p className="text-sm text-muted-foreground">Ilgili Cihaz</p>
              <p className="font-medium">{ticket.assetInfo}</p>
            </div>
          ) : null}
        </div>

        {/* Açıklama */}
        <div>
          <h4 className="font-medium mb-2">Aciklama</h4>
          <p className="text-sm whitespace-pre-wrap bg-muted/30 p-4 rounded-lg">{ticket.description}</p>
        </div>

        {/* Ekler — boşsa ve ekleme yapılamıyorsa hiç render edilmez */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="font-medium text-sm">Ekler{ekler.length > 0 ? ` (${ekler.length})` : ""}</h4>
            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer rounded-md border px-2 py-1 hover:bg-accent">
              <Paperclip className="h-3.5 w-3.5" />
              {ekYukleniyor ? "Yükleniyor..." : "Ek Ekle"}
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                disabled={ekYukleniyor || updatingTicket}
                onChange={(e) => {
                  const secilen = Array.from(e.target.files ?? [])
                  e.target.value = ""
                  handleEkYukle(secilen)
                }}
              />
            </label>
          </div>
          {ekler.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ek yok</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ekler.map((ek) => {
                const resimMi = ek.type?.startsWith("image/")
                return (
                  <a
                    key={ek.url}
                    href={ek.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${ek.name} — ${(ek.size / 1024 / 1024).toFixed(2)} MB`}
                    className="group rounded-lg border overflow-hidden hover:border-primary transition-colors"
                  >
                    {resimMi ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={ek.url} alt={ek.name} className="h-20 w-20 object-cover" />
                    ) : (
                      <div className="h-20 w-20 flex flex-col items-center justify-center gap-1 bg-muted/40 p-1">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                        <span className="text-[10px] text-center truncate w-full px-1">{ek.name}</span>
                      </div>
                    )}
                  </a>
                )
              })}
            </div>
          )}
        </div>

        {/* HAVUZ — "Üstlen": ticket bir takıma düşmüş, henüz kimse üstlenmemiş ve
            ben o takımın üyesiyim. isITStaff bloğunun DIŞINDA: takım üyesi
            helpdesk-agent rolünde olabilir ve helpdesk.admin iznine sahip değildir
            (o izin yalnız it-admin/super-admin'de) — aksi halde butonu göremezdi. */}
        {ticket.currentUserCanClaim && (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium text-sm">
                  Bu talep {ticket.assignedTeam?.name ?? "takımınızın"} havuzunda
                </p>
                <p className="text-xs text-muted-foreground">
                  Henüz kimse üstlenmedi. Üstlenirsen sana atanır ve durumu &quot;Atandı&quot; olur.
                </p>
              </div>
              <Button onClick={handleClaim} disabled={updatingTicket}>
                <UserPlus className="h-4 w-4 mr-2" />
                Üstlen
              </Button>
            </div>
          </div>
        )}

        {/* Durum — atanan teknisyen / takım üyesi de değiştirebilir (sunucu da izin veriyor).
            isITStaff bloğunun DIŞINDA: helpdesk-agent'ta helpdesk.admin yoktur. */}
        {durumDegistirebilir && !isITStaff && (
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Talep Durumu
            </h4>
            <div className="max-w-xs">
              <Label className="text-xs">Durum</Label>
              <Select value={ticket.status} onValueChange={(v) => handleUpdateTicket({ status: v } as Partial<Ticket>)} disabled={updatingTicket}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">Yeni</SelectItem>
                  <SelectItem value="ASSIGNED">Atandi</SelectItem>
                  <SelectItem value="IN_PROGRESS">Islemde</SelectItem>
                  <SelectItem value="PENDING">Beklemede</SelectItem>
                  <SelectItem value="ON_HOLD">Askida</SelectItem>
                  <SelectItem value="CLOSED">Kapatildi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* KRONİK SORUN (Faz 1.5) — yalnız IT ekibi görür ve bağlar. */}
        {isITStaff && (
          <div className="p-4 rounded-lg border bg-muted/30">
            {ticket.kronikSorun ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Kronik sorun</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">
                      <Link2 className="h-3 w-3 mr-1" />
                      {ticket.kronikSorun.baslik}
                    </Badge>
                    {ticket.kronikSorun.durum === "COZULDU" && (
                      <Badge variant="outline" className="border-green-300 text-green-700 dark:text-green-400">
                        Çözüldü
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleKronikKaldir} disabled={kronikIsleniyor}>
                  {kronikIsleniyor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Unlink className="h-4 w-4 mr-2" />}
                  Bağı kaldır
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium text-sm">Bu talep tekrarlayan bir sorun mu?</p>
                  <p className="text-xs text-muted-foreground">
                    Kronik soruna bağlarsanız arşivde birlikte görünür ve tekrar sayısı anlam kazanır.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => { setKronikAcik(true); kronikleriGetir() }}
                  disabled={kronikIsleniyor}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Kronik soruna bağla
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ÇÖZÜLDÜ (Faz 1) — durum açılırında değil, ayrı eylem.
            Tek çözüm yolu: modal → POST /api/tickets/[id]/cozum. */}
        {durumDegistirebilir && cozulebilirMi(ticket.status) && (
          <div className="p-4 rounded-lg border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-medium text-sm">Bu talep çözüldü mü?</p>
              <p className="text-xs text-muted-foreground">
                İşaretlediğinizde kullanıcıya bildirim gider; {ITIRAZ_SURESI_GUN} gün itiraz gelmezse talep kendiliğinden kapanır.
              </p>
            </div>
            <Button onClick={() => setCozumModalAcik(true)} disabled={updatingTicket}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Çözüldü
            </Button>
          </div>
        )}

        {/* KULLANICI ONAYI (Faz 1) — talep sahibinin gördüğü kart. */}
        {ticket.status === "RESOLVED" && isOwner && (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-medium">Çözüldü — onayınız bekleniyor</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {ticket.resolvedByName ? `${ticket.resolvedByName} ` : ""}talebi çözüldü olarak işaretledi.
              {kalanGun !== null && kalanGun > 0
                ? ` İtiraz etmezseniz ${kalanGun} gün içinde kendiliğinden kapanacak.`
                : " İtiraz etmezseniz kendiliğinden kapanacak."}
            </p>
            <div className="flex gap-2 justify-end mt-3 flex-wrap">
              <Button
                variant="outline"
                onClick={() => handleOnayKarari("ITIRAZ")}
                disabled={onayGonderiliyor}
                className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
              >
                {onayGonderiliyor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Sorun devam ediyor
              </Button>
              <Button onClick={() => handleOnayKarari("ONAYLA")} disabled={onayGonderiliyor}>
                {onayGonderiliyor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
                Onaylıyorum, kapatılsın
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-right mt-2">
              Onaylarsanız talep kapanır ve hizmeti puanlayabilirsiniz.
            </p>
          </div>
        )}

        {/* IT Ekibi Kontrolleri */}
        {isITStaff && (
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              IT Ekibi Kontrolleri
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Durum</Label>
                <Select value={ticket.status} onValueChange={(v) => handleUpdateTicket({ status: v } as Partial<Ticket>)} disabled={updatingTicket}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">Yeni</SelectItem>
                    <SelectItem value="ASSIGNED">Atandi</SelectItem>
                    <SelectItem value="IN_PROGRESS">Islemde</SelectItem>
                    <SelectItem value="PENDING">Beklemede</SelectItem>
                    <SelectItem value="ON_HOLD">Askida</SelectItem>
                    <SelectItem value="CLOSED">Kapatildi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Oncelik</Label>
                <Select value={ticket.priority} onValueChange={(v) => handleUpdateTicket({ priority: v } as Partial<Ticket>)} disabled={updatingTicket}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TICKET_LOW">Dusuk</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="TICKET_HIGH">Yuksek</SelectItem>
                    <SelectItem value="TICKET_CRITICAL">Kritik</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Talep Tipi</Label>
                <Select value={ticket.ticketType} onValueChange={(v) => handleUpdateTicket({ ticketType: v } as Partial<Ticket>)} disabled={updatingTicket}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCIDENT">Olay</SelectItem>
                    <SelectItem value="SERVICE_REQUEST">Hizmet Talebi</SelectItem>
                    <SelectItem value="PROBLEM">Problem</SelectItem>
                    <SelectItem value="CHANGE_REQUEST">Degisiklik</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
              <div>
                <Label className="text-xs">IT ekibine ata</Label>
                <Select
                  value={assignableUsers.find((u) => u.email === ticket.assignedTo)?.id ?? ""}
                  onValueChange={handleAssignToUser}
                  disabled={updatingTicket}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Kişi seç..." /></SelectTrigger>
                  <SelectContent>
                    {assignableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {ticket.assignedTo !== session?.user?.email && (
                <Button variant="outline" onClick={handleAssignToMe} disabled={updatingTicket}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Kendime Ata
                </Button>
              )}
            </div>
          </div>
        )}

        {/* SLA */}
        {(ticket.slaResponseBreached || ticket.slaResolutionBreached) && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">SLA Ihlali</span>
            </div>
          </div>
        )}

        {/* Yorumlar */}
        <div>
          <h4 className="font-medium mb-3">Yorumlar & Aktivite</h4>
          <ScrollArea className="h-[240px] mb-4">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Henuz hareket yok</p>
            ) : (
              <div className="space-y-3">
                {activity.map((item) =>
                  item.kind === "event" ? (
                    // Sistem olayı: kompakt satır, yuvarlak ikon, soluk stil (yorumdan görsel ayrım).
                    <div key={item.id} className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {eventIcon(item.event.action)}
                      </span>
                      <span className="flex-1">
                        <span className="font-medium text-foreground/70">{item.event.description}</span>
                        {item.event.performedByName && <span> · {item.event.performedByName}</span>}
                      </span>
                      <span className="shrink-0">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: tr })}
                      </span>
                    </div>
                  ) : (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg ${
                        item.comment.isInternal
                          ? "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800"
                          : item.comment.isResolution
                          ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                          : "bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{item.comment.authorName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.comment.createdAt), { addSuffix: true, locale: tr })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{item.comment.content}</p>
                      {item.comment.isInternal && <Badge variant="outline" className="mt-2 text-yellow-600">Dahili Not</Badge>}
                      {item.comment.isResolution && <Badge variant="outline" className="mt-2 text-green-600">Cozum</Badge>}
                    </div>
                  )
                )}
              </div>
            )}
          </ScrollArea>
          <div className="flex gap-2">
            <Textarea placeholder="Yorum yazin..." rows={2} value={newComment} onChange={(e) => setNewComment(e.target.value)} />
            <Button onClick={handleSendComment} disabled={!newComment.trim() || sendingComment}>
              {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>

      {/* ÇÖZÜM MODAL'I — çözüm metni OPSİYONEL, buton her durumda aktif. */}
      <Dialog open={cozumModalAcik} onOpenChange={setCozumModalAcik}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Talebi çözüldü olarak işaretle</DialogTitle>
            <DialogDescription>
              {ticket.ticketNumber} · {ticket.subject}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="cozum-metni" className="text-sm">
                Çözüm Açıklaması{" "}
                <span className="font-normal text-muted-foreground text-xs">
                  — opsiyonel, boş bırakabilirsiniz
                </span>
              </Label>
              <Textarea
                id="cozum-metni"
                className="mt-1.5 min-h-[120px]"
                placeholder="Ne yaptığınızı birkaç cümleyle yazın…"
                value={cozumMetni}
                onChange={(e) => setCozumMetni(e.target.value)}
              />
            </div>

            <div className="flex gap-2 items-start rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
              <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Çözümü yazarsanız arşive eklenir, benzer sorunlarda ekibe yol gösterir.</span>
            </div>

            <div className="flex gap-2 items-start rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <Clock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Talep sahibinin <strong>{ITIRAZ_SURESI_GUN} gün</strong> itiraz süresi var. Bu sürede
                &quot;Sorun devam ediyor&quot; demezse talep otomatik kapanır — ayrıca kapatmanıza gerek yok.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCozumModalAcik(false)} disabled={cozumGonderiliyor}>
              Vazgeç
            </Button>
            {/* Metin boş olsa da AKTİF — çözüm açıklaması zorunlu değil. */}
            <Button onClick={handleCozumGonder} disabled={cozumGonderiliyor}>
              {cozumGonderiliyor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Çözüldü olarak işaretle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KRONİK SORUNA BAĞLA — mevcuttan seç VEYA yeni tanımla. */}
      <Dialog open={kronikAcik} onOpenChange={setKronikAcik}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Kronik soruna bağla</DialogTitle>
            <DialogDescription>
              {ticket.ticketNumber} · {ticket.subject}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm">Mevcut kronik sorunlardan seç</Label>
              <Input
                className="mt-1.5"
                placeholder="Listede ara…"
                value={kronikArama}
                onChange={(e) => setKronikArama(e.target.value)}
              />
              <div className="mt-2 max-h-[190px] overflow-auto rounded-md border divide-y">
                {kronikListe.filter((k) =>
                  k.baslik.toLowerCase().includes(kronikArama.toLowerCase()),
                ).length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    Eşleşen kayıt yok — aşağıdan yeni tanımlayabilirsiniz.
                  </p>
                ) : (
                  kronikListe
                    .filter((k) => k.baslik.toLowerCase().includes(kronikArama.toLowerCase()))
                    .map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => { setKronikSeciliId(k.id); setKronikYeniBaslik("") }}
                        className={`w-full text-left p-3 text-sm hover:bg-muted ${
                          kronikSeciliId === k.id ? "bg-muted" : ""
                        }`}
                      >
                        <span className="font-medium">{k.baslik}</span>
                        <span className="text-xs text-muted-foreground ml-2">{k.bagliTalep} talep</span>
                      </button>
                    ))
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="kronik-yeni" className="text-sm">…veya yeni tanımla</Label>
              <div className="flex gap-2 mt-1.5">
                <Plus className="h-4 w-4 mt-2.5 shrink-0 text-muted-foreground" />
                <Input
                  id="kronik-yeni"
                  placeholder="Yeni kronik sorun başlığı"
                  value={kronikYeniBaslik}
                  onChange={(e) => { setKronikYeniBaslik(e.target.value); if (e.target.value) setKronikSeciliId("") }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Açıklamayı sonra Çözüm Arşivi &gt; Kronik Sorunlar ekranından ekleyebilirsiniz.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setKronikAcik(false)} disabled={kronikIsleniyor}>
              Vazgeç
            </Button>
            <Button
              onClick={handleKronikBagla}
              disabled={kronikIsleniyor || (!kronikSeciliId && !kronikYeniBaslik.trim())}
            >
              {kronikIsleniyor && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Bağla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
