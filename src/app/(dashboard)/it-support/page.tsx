"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Headphones,
  Plus,
  Search,
  CheckCircle2,
  Loader2,
  User,
  Filter,
  RefreshCw,
  Send,
  Clock,
  ChevronUp,
  ChevronDown,
  X,
  BarChart3,
  Info,
  BookOpen,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cihazSecimEtiketi } from "@/lib/tickets/cihaz-etiket"
import { useAuthenticatedData } from "@/hooks/use-authenticated-data"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import { TicketDetail } from "./_components/ticket-detail"
import { CategoryBadge } from "./_components/category-badge"
import { KpiDashboard } from "./_components/kpi-dashboard"
import { KullanimKilavuzu } from "./_components/kullanim-kilavuzu"
import { UserSearchCombobox } from "@/components/user-search-combobox"
import { ticketAge, resolutionTime, isOpenStatus } from "./_lib/ticket-age"

interface TicketCategory {
  id: string
  name: string
  color: string | null
  icon: string | null
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
  assetInfo: string | null
  slaResponseDue: string | null
  slaResolutionDue: string | null
  slaResponseBreached: boolean
  slaResolutionBreached: boolean
  createdAt: string
  closedAt: string | null
  resolvedAt: string | null
  category: TicketCategory | null
  _count?: { comments: number }
}

interface TicketComment {
  id: string
  authorEmail: string
  authorName: string
  content: string
  isInternal: boolean
  isResolution: boolean
  createdAt: string
}

interface TicketStats {
  summary: {
    totalOpen: number
    totalNew: number
    myOpenTickets: number
    assignedToMe: number
    slaBreached: number
  }
}

/** /api/tickets/cihazlarim — oturum sahibinin AKTİF + ONAYLANMIŞ zimmetleri. */
interface Cihaz {
  id: string
  tur: string
  turDiger: string | null
  marka: string | null
  model: string | null
  seriNumarasi: string | null
  pcAdi: string | null
  verilisTarihi: string | null
}

/**
 * "Listede yok / başka cihaz" seçeneğinin değeri. Radix Select boş string'i
 * değer olarak kabul etmediği için nöbetçi (sentinel) bir sabit gerekiyor.
 * Sunucuya ASLA gönderilmez — gönderimde null'a çevrilir.
 */
const CIHAZ_SERBEST = "__serbest__"

// ── Liste sıralama (client-side) ──
type SortKey = "date" | "priority" | "wait" | "status"
type SortState = { key: SortKey; dir: "asc" | "desc" }
// Öncelik şiddet sırası (enum bildirim sırasıyla aynı; sıralama için sayısal rank)
const PRIO_RANK: Record<string, number> = { TICKET_LOW: 0, NORMAL: 1, TICKET_HIGH: 2, TICKET_CRITICAL: 3 }
// Durum iş-akışı sırası (görsel gruplama için)
const STATUS_RANK: Record<string, number> = {
  NEW: 0, REOPENED: 1, ASSIGNED: 2, IN_PROGRESS: 3, PENDING: 4, ON_HOLD: 5,
  RESOLVED: 6, CLOSED: 7, CANCELLED: 8,
}
const ts = (d?: string | null) => (d ? new Date(d).getTime() : 0)

export default function ITSupportPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [categories, setCategories] = useState<TicketCategory[]>([])
  const [stats, setStats] = useState<TicketStats | null>(null)
  // Detay modal: seçili ticket id (URL değişmez — sayfa yerine overlay).
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("my")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  // Liste sıralaması — null iken grup-varsayılanı (açık: öncelik + en uzun bekleyen üstte)
  const [sort, setSort] = useState<SortState | null>(null)
  const [priorityFilter, setPriorityFilter] = useState("all")

  // Yeni ticket dialog
  const [showNewTicket, setShowNewTicket] = useState(false)
  // Kullanım kılavuzu — HERKESE açık (helpdesk.admin koşulu YOK)
  const [showGuide, setShowGuide] = useState(false)
  // Ticket eki: seçilen dosyalar Gönder'e basılana kadar İSTEMCİDE tutulur;
  // yükleme create'ten hemen önce yapılır (iptal edilirse sunucuda çöp kalmaz).
  const [ekDosyalar, setEkDosyalar] = useState<File[]>([])
  const [ekYukleniyor, setEkYukleniyor] = useState(false)
  const [cihazlar, setCihazlar] = useState<Cihaz[]>([])
  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    categoryId: "",
    location: "",
    assetInfo: "",
    zimmetFormuId: "",
    // Başkası adına kayıt (yalnız IT ekibi doldurur)
    talepEdenEmail: "",
    talepEdenAd: "",
    kanal: "PHONE" as "PHONE" | "WALK_IN" | "INTERNAL",
  })
  const [submitting, setSubmitting] = useState(false)

  // Ticket detay

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN"

  // PR-Y9c: saf RBAC, helpdesk.admin permission. Eski legacy (role/dept/ou fallback) kaldırıldı.
  const isITStaff = session?.user?.permissions?.includes("helpdesk.admin") ?? false
  // "Bana Atanan" sekmesi kişisel atamayı gösterir; helpdesk.admin ŞART DEĞİL.
  // helpdesk-agent rolündeki teknisyen kendisine atanan talebi görebilmeli —
  // sekme gizliyken API düzeltmesi tek başına yetmiyordu. Koşul API ile AYNI:
  // helpdesk.ticket.resolve (talebi işleyebilen rol). "Tumu"/"Aciklar"/"KPI"
  // isITStaff'ta KALIR (kapsam dışı).
  const banaAtananGorunur =
    isITStaff || (session?.user?.permissions?.includes("helpdesk.ticket.resolve") ?? false)

  // Verileri yukle (loading/error/timeout artık useAuthenticatedData'da)
  const fetchData = async () => {
    try {
      // KPI sekmesi bir LİSTE görünümü değil — kendi verisini
      // /api/tickets/reports'tan çeker. `viewMode=kpi` diye anlamsız bir istek
      // atılmasın diye ticket listesi bu sekmede hiç istenmez.
      const kpiSekmesi = activeTab === "kpi"
      const [ticketsRes, categoriesRes, statsRes, cihazlarRes] = await Promise.all([
        kpiSekmesi ? Promise.resolve(null) : fetch(`/api/tickets?viewMode=${activeTab}`),
        fetch("/api/tickets/categories"),
        fetch("/api/tickets/stats"),
        // Cihaz listesi İSTEĞE BAĞLI veri: uç hata verirse (403/500) ya da ağ
        // koparsa form kırılmaz, kullanıcı serbest metne düşer.
        fetch("/api/tickets/cihazlarim").catch(() => null),
      ])

      if (ticketsRes && ticketsRes.ok) {
        setTickets(await ticketsRes.json())
      }
      if (categoriesRes.ok) {
        setCategories(await categoriesRes.json())
      }
      if (statsRes.ok) {
        setStats(await statsRes.json())
      }
      if (cihazlarRes?.ok) {
        setCihazlar(await cihazlarRes.json().catch(() => []))
      } else {
        setCihazlar([])
      }
    } catch (error) {
      console.error("Veri yuklenemedi:", error)
    }
  }

  // İlk yükleme + auth-gate + timeout: ortak hook.
  const { loading, loadError, retry } = useAuthenticatedData(fetchData)

  // Sekme (activeTab) değişince veriyi yeniden çek (ilk mount hariç — onu hook yükler).
  // retry() spinner gösterip fetchData'yı güncel activeTab ile yeniden çalıştırır (eski davranış).
  const tabInitRef = useRef(true)
  useEffect(() => {
    if (tabInitRef.current) {
      tabInitRef.current = false
      return
    }
    retry()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Modal açıkken Esc ile kapat + arka plan kaydırmayı kilitle.
  useEffect(() => {
    if (!selectedTicketId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedTicketId(null) }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [selectedTicketId])

  // Yeni ticket olustur
  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      return
    }

    setSubmitting(true)
    try {
      // 1) Ekler önce yüklenir. Yükleme başarısızsa TICKET AÇILMAZ — kullanıcı
      //    ekini kaybettiğini fark etmeden talep göndermiş olmasın.
      let attachments: { url: string; name: string; size: number; type: string }[] = []
      if (ekDosyalar.length > 0) {
        setEkYukleniyor(true)
        const fd = new FormData()
        ekDosyalar.forEach((f) => fd.append("files", f))
        const up = await fetch("/api/tickets/upload", { method: "POST", body: fd })
        setEkYukleniyor(false)
        if (!up.ok) {
          const err = await up.json().catch(() => ({}))
          toast.error(err.error || "Dosya yüklenemedi")
          return
        }
        attachments = (await up.json()).files ?? []
      }

      // 2) Ticket oluştur (attachments create'te JSON'a çevrilip yazılıyor)
      // Gövde AÇIKÇA kurulur, `...newTicket` yayılmaz: nöbetçi CIHAZ_SERBEST
      // değeri sunucuya sızmasın ve boş assetInfo "" yerine null gitsin diye.
      // Sunucu bunların hepsini yeniden doğrular; burası yalnız temiz gövde.
      const cihazSecildi = !!newTicket.zimmetFormuId && newTicket.zimmetFormuId !== CIHAZ_SERBEST
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newTicket.subject,
          description: newTicket.description,
          categoryId: newTicket.categoryId,
          location: newTicket.location,
          zimmetFormuId: cihazSecildi ? newTicket.zimmetFormuId : null,
          // Cihaz seçildiyse assetInfo'yu sunucu üretir; istemci hiç göndermez.
          assetInfo: cihazSecildi ? null : newTicket.assetInfo.trim() || null,
          // Boşsa sunucu yok sayar → kişi kendi adına açmış olur (eski davranış).
          talepEdenEmail: newTicket.talepEdenEmail || undefined,
          // Kanal iki durumda gönderilir: başkası adına (PHONE/WALK_IN) ve
          // iç tespit (INTERNAL). Hiçbiri yoksa sunucu WEB_PORTAL'a düşer.
          kanal:
            newTicket.talepEdenEmail || newTicket.kanal === "INTERNAL"
              ? newTicket.kanal
              : undefined,
          attachments,
        }),
      })

      if (response.ok) {
        setShowNewTicket(false)
        setNewTicket({
          subject: "",
          description: "",
          categoryId: "",
          location: "",
          assetInfo: "",
          zimmetFormuId: "",
          talepEdenEmail: "",
          talepEdenAd: "",
          kanal: "PHONE",
        })
        setEkDosyalar([])
        retry()
      } else {
        const err = await response.json().catch(() => ({}))
        toast.error(err.error || "Talep oluşturulamadı")
      }
    } catch (error) {
      console.error("Ticket olusturulamadi:", error)
      toast.error("Talep oluşturulamadı — bağlantı hatası")
    } finally {
      setEkYukleniyor(false)
      setSubmitting(false)
    }
  }

  // Ticket detay yukle
  // Durum badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
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
    const s = statusMap[status] || { label: status, variant: "outline" as const }
    return <Badge variant={s.variant}>{s.label}</Badge>
  }

  // Oncelik badge
  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, { label: string; className: string }> = {
      TICKET_CRITICAL: { label: "Kritik", className: "bg-red-500 text-white" },
      TICKET_HIGH: { label: "Yuksek", className: "bg-orange-500 text-white" },
      NORMAL: { label: "Normal", className: "bg-blue-500 text-white" },
      TICKET_LOW: { label: "Dusuk", className: "bg-gray-500 text-white" },
    }
    const p = priorityMap[priority] || { label: priority, className: "" }
    return <Badge className={p.className}>{p.label}</Badge>
  }

  // Ticket tipi label
  // Filtrelenmis ticket'lar
  const filteredTickets = tickets.filter((ticket) => {
    if (statusFilter !== "all" && ticket.status !== statusFilter) return false
    if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !ticket.ticketNumber.toLowerCase().includes(query) &&
        !ticket.subject.toLowerCase().includes(query) &&
        !ticket.requesterName.toLowerCase().includes(query)
      ) {
        return false
      }
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Headphones className="h-8 w-8 text-green-500" />
            IT Destek Merkezi
          </h1>
          <p className="text-muted-foreground">
            Teknik destek taleplerinizi buradan yonetebilirsiniz
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* SEÇENEK B — yumuşak amber (nazik vurgu).
              Açık: amber-100 zemin + amber-800 metin = 6.37:1.
              Karanlık: amber-900 zemin + amber-100 metin = 8.15:1 (dark: varyantı
              ŞART — amber-100 zemin karanlık temada göz alırdı). */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuide(true)}
            className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 hover:text-amber-900 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-700 dark:hover:bg-amber-800"
          >
            <Info className="h-4 w-4 mr-2" />
            Kullanım Kılavuzu
          </Button>

          {/* Çözüm Arşivi — yalnız IT ekibine. Sunucu da aynı kapıyı uyguluyor
              (helpdesk.admin veya helpdesk.ticket.resolve). */}
          {(session?.user?.permissions?.includes("helpdesk.admin") ||
            session?.user?.permissions?.includes("helpdesk.ticket.resolve")) && (
            <Button variant="outline" size="sm" onClick={() => router.push("/it-support/cozum-arsivi")}>
              <BookOpen className="h-4 w-4 mr-2" />
              Çözüm Arşivi
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={retry} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </Button>

          <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Yeni Talep
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Yeni Destek Talebi</DialogTitle>
                <DialogDescription>
                  Teknik destek talebinizi asagidaki formu doldurarak iletebilirsiniz
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* BAŞKASI ADINA KAYIT — yalnız IT ekibine görünür.
                    Telefonla/yüz yüze gelen işi kaydederken talep sahibi
                    seçilir; boş bırakılırsa kişi kendi adına açmış olur
                    (bugünkü davranış aynen korunur). */}
                {isITStaff && (
                  <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                    <Label htmlFor="talep-eden" className="text-sm">
                      Talep eden{" "}
                      <span className="font-normal text-muted-foreground text-xs">
                        — opsiyonel; başkası adına kaydediyorsanız seçin
                      </span>
                    </Label>
                    <UserSearchCombobox
                      value={newTicket.talepEdenEmail}
                      placeholder="Kendi adıma açıyorum"
                      disabled={newTicket.kanal === "INTERNAL"}
                      onSelect={(u) =>
                        setNewTicket((p) => ({
                          ...p,
                          talepEdenEmail: u?.email ?? "",
                          talepEdenAd: u?.name ?? "",
                          // Kişi seçilince "kendi tespitim" düşer: ikisi bir arada
                          // çelişkili (sunucu da baskasiAdina'yı öncelikli sayıyor).
                          kanal: u?.email ? (p.kanal === "INTERNAL" ? "PHONE" : p.kanal) : p.kanal,
                        }))
                      }
                    />

                    {/* İÇ TESPİT — yalnız talep eden BOŞKEN anlamlı.
                        İşaretlenince combobox kilitlenir; iki durum aynı anda
                        seçilemez, akış tek yönlü kalır. */}
                    {!newTicket.talepEdenEmail && (
                      <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-[#1B4F72]"
                          checked={newTicket.kanal === "INTERNAL"}
                          onChange={(e) =>
                            setNewTicket((p) => ({ ...p, kanal: e.target.checked ? "INTERNAL" : "PHONE" }))
                          }
                        />
                        <span>
                          Bu talebi kendim tespit ettim
                          <span className="block text-[11px] text-muted-foreground">
                            Kullanıcı bildirmedi; proaktif iş olarak kaydedilir (KPI&apos;da ayrı sayılır).
                          </span>
                        </span>
                      </label>
                    )}
                    {newTicket.talepEdenEmail && (
                      <div className="flex items-center gap-4 flex-wrap pt-1">
                        <span className="text-xs text-muted-foreground">Nasıl geldi?</span>
                        {(["PHONE", "WALK_IN"] as const).map((k) => (
                          <label key={k} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="kanal"
                              value={k}
                              checked={newTicket.kanal === k}
                              onChange={() => setNewTicket((p) => ({ ...p, kanal: k }))}
                              className="accent-[#1B4F72]"
                            />
                            {k === "PHONE" ? "Telefon" : "Yüz yüze"}
                          </label>
                        ))}
                      </div>
                    )}
                    {newTicket.talepEdenEmail && (
                      <p className="text-[11px] text-muted-foreground">
                        Talebin sahibi {newTicket.talepEdenAd || newTicket.talepEdenEmail} olacak;
                        bildirimler ve puanlama ona gider. Kaydeden olarak siz görünürsünüz.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="subject">Konu *</Label>
                  <Input
                    id="subject"
                    placeholder="Sorununuzu kisa bir baslik ile belirtin"
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Kategori</Label>
                  <Select
                    value={newTicket.categoryId}
                    onValueChange={(v) => setNewTicket({ ...newTicket, categoryId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kategori secin" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Lokasyon</Label>
                    <Input
                      placeholder="Kat, oda no, vs."
                      value={newTicket.location}
                      onChange={(e) => setNewTicket({ ...newTicket, location: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Ilgili Cihaz/Ekipman</Label>
                    {/*
                      Zimmetinde AKTİF+ONAYLANMIŞ cihazı olan kullanıcı listeden
                      seçer; olmayan (ya da uç hata verdiyse herkes) doğrudan
                      serbest metin yazar. "Listede yok" seçilirse serbest metin
                      alanı açılır ve zimmetFormuId null gider.
                    */}
                    {cihazlar.length > 0 ? (
                      <>
                        <Select
                          value={newTicket.zimmetFormuId}
                          onValueChange={(v) =>
                            setNewTicket({
                              ...newTicket,
                              zimmetFormuId: v,
                              // Cihaz seçildiği anda daha önce yazılmış serbest
                              // metin temizlenir; sunucu zaten yok sayacak.
                              assetInfo: v === CIHAZ_SERBEST ? newTicket.assetInfo : "",
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Cihaz secin" />
                          </SelectTrigger>
                          <SelectContent>
                            {cihazlar.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {cihazSecimEtiketi(c)}
                              </SelectItem>
                            ))}
                            <SelectItem value={CIHAZ_SERBEST}>Listede yok / baska cihaz</SelectItem>
                          </SelectContent>
                        </Select>
                        {newTicket.zimmetFormuId === CIHAZ_SERBEST && (
                          <Input
                            placeholder="Bilgisayar adi, yazici modeli, vs."
                            maxLength={200}
                            value={newTicket.assetInfo}
                            onChange={(e) => setNewTicket({ ...newTicket, assetInfo: e.target.value })}
                          />
                        )}
                      </>
                    ) : (
                      <Input
                        placeholder="Bilgisayar adi, yazici modeli, vs."
                        maxLength={200}
                        value={newTicket.assetInfo}
                        onChange={(e) => setNewTicket({ ...newTicket, assetInfo: e.target.value })}
                      />
                    )}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Aciklama *</Label>
                  <Textarea
                    id="description"
                    placeholder="Sorununuzu detayli olarak aciklayiniz..."
                    rows={5}
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  />
                </div>

                {/* Ekler — telefonda accept="image/*" kamera+galeri sunar.
                    capture KULLANILMIYOR: eklenirse galeriden seçme kaybolur. */}
                <div className="grid gap-2">
                  <Label htmlFor="ticket-ekler">Ekler (resim veya PDF, en fazla 10MB)</Label>
                  <Input
                    id="ticket-ekler"
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    disabled={submitting}
                    onChange={(e) => {
                      const secilen = Array.from(e.target.files ?? [])
                      if (secilen.length > 0) setEkDosyalar((o) => [...o, ...secilen])
                      // input'u sıfırla ki aynı dosya tekrar seçilebilsin
                      e.target.value = ""
                    }}
                  />
                  {ekDosyalar.length > 0 && (
                    <div className="space-y-1">
                      {ekDosyalar.map((f, i) => (
                        <div
                          key={`${f.name}-${i}`}
                          className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs"
                        >
                          <span className="truncate">{f.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-muted-foreground">
                              {(f.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                            <button
                              type="button"
                              onClick={() => setEkDosyalar((o) => o.filter((_, j) => j !== i))}
                              className="text-red-600 hover:text-red-700"
                              aria-label="Eki kaldır"
                              disabled={submitting}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNewTicket(false)}>
                    Iptal
                  </Button>
                  <Button
                    onClick={handleCreateTicket}
                    disabled={submitting || !newTicket.subject.trim() || !newTicket.description.trim()}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gonderiliyor...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Talebi Gonder
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className={`grid gap-4 md:grid-cols-2 ${isITStaff ? "lg:grid-cols-5" : "lg:grid-cols-2"}`}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Benim Taleplerim</CardDescription>
              <CardTitle className="text-xl sm:text-3xl">{stats.summary.myOpenTickets}</CardTitle>
            </CardHeader>
          </Card>
          {isITStaff && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Acik Talepler</CardDescription>
                  <CardTitle className="text-xl sm:text-3xl">{stats.summary.totalOpen}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Yeni</CardDescription>
                  <CardTitle className="text-xl sm:text-3xl text-blue-500">{stats.summary.totalNew}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Bana Atanan</CardDescription>
                  <CardTitle className="text-xl sm:text-3xl text-green-500">{stats.summary.assignedToMe}</CardTitle>
                </CardHeader>
              </Card>
              {stats.summary.slaBreached > 0 && (
                <Card className="border-red-300">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-red-500">SLA Ihlali</CardDescription>
                    <CardTitle className="text-xl sm:text-3xl text-red-500">{stats.summary.slaBreached}</CardTitle>
                  </CardHeader>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Main Content — liste tam genişlik (detay ayrı sayfada) */}
      <div>
        {/* Ticket List */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between">
                  <TabsList className="flex-wrap h-auto gap-1">
                    <TabsTrigger value="my">Taleplerim</TabsTrigger>
                    {banaAtananGorunur && <TabsTrigger value="assigned">Bana Atanan</TabsTrigger>}
                    {isITStaff && (
                      <>
                        <TabsTrigger value="all">Tumu</TabsTrigger>
                        <TabsTrigger value="open">Aciklar</TabsTrigger>
                        <TabsTrigger value="kpi">
                          <BarChart3 className="h-3.5 w-3.5 mr-1" />
                          KPI
                        </TabsTrigger>
                      </>
                    )}
                  </TabsList>
                </div>
              </Tabs>

              {/* Filters */}
              <div className="flex flex-wrap gap-2 mt-4">
                <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ticket no, konu veya isim ara..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Durum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tum Durumlar</SelectItem>
                    <SelectItem value="NEW">Yeni</SelectItem>
                    <SelectItem value="ASSIGNED">Atandi</SelectItem>
                    <SelectItem value="IN_PROGRESS">Islemde</SelectItem>
                    <SelectItem value="PENDING">Beklemede</SelectItem>
                    <SelectItem value="RESOLVED">Cozuldu</SelectItem>
                    <SelectItem value="CLOSED">Kapatildi</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Oncelik" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tum Oncelikler</SelectItem>
                    <SelectItem value="TICKET_CRITICAL">Kritik</SelectItem>
                    <SelectItem value="TICKET_HIGH">Yuksek</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="TICKET_LOW">Dusuk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent>
              {/* KPI sekmesi kendi verisini ve kendi yükleniyor/hata durumunu
                  yönetir; liste filtreleri ve sayfanın loading'i onu ilgilendirmez. */}
              {activeTab === "kpi" ? (
                <KpiDashboard />
              ) : loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : loadError ? (
                <div className="text-center py-12">
                  <Headphones className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Talepler yüklenemedi. Oturumunuz sonlanmış olabilir.</p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button variant="outline" onClick={retry}>
                      Yeniden dene
                    </Button>
                    <Button variant="outline" onClick={() => router.push("/login")}>
                      Giriş yap
                    </Button>
                  </div>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-12">
                  <Headphones className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Henuz destek talebi yok</p>
                  <Button className="mt-4" onClick={() => setShowNewTicket(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Yeni Talep Olustur
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  {(() => {
                    // Client-side gruplama (sıra B3 korunur — API'den geliyor). Açık üstte, kapalı altta soluk.
                    const acikSet = new Set(["NEW", "ASSIGNED", "IN_PROGRESS", "PENDING", "ON_HOLD", "REOPENED"])
                    const acik = filteredTickets.filter((t) => acikSet.has(t.status))
                    const kapali = filteredTickets.filter((t) => !acikSet.has(t.status))

                    // Client-side sıralama. sort===null → grup varsayılanı:
                    //   açık: öncelik desc + en uzun bekleyen üstte (createdAt asc)
                    //   kapalı: en son işlem göreni üstte (closedAt/resolvedAt/createdAt desc)
                    const sortTickets = (list: Ticket[], isAcik: boolean): Ticket[] => {
                      const arr = [...list]
                      if (sort) {
                        const mul = sort.dir === "asc" ? 1 : -1
                        arr.sort((a, b) => {
                          let d = 0
                          if (sort.key === "date") d = ts(a.createdAt) - ts(b.createdAt)
                          else if (sort.key === "priority") d = (PRIO_RANK[a.priority] ?? 1) - (PRIO_RANK[b.priority] ?? 1)
                          else if (sort.key === "wait") d = ts(b.createdAt) - ts(a.createdAt) // uzun bekleyen = eski createdAt
                          else if (sort.key === "status") d = (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99)
                          return d !== 0 ? d * mul : ts(a.createdAt) - ts(b.createdAt)
                        })
                        return arr
                      }
                      if (isAcik) {
                        arr.sort((a, b) => {
                          const p = (PRIO_RANK[b.priority] ?? 1) - (PRIO_RANK[a.priority] ?? 1)
                          return p !== 0 ? p : ts(a.createdAt) - ts(b.createdAt)
                        })
                      } else {
                        arr.sort((a, b) => ts(b.closedAt ?? b.resolvedAt ?? b.createdAt) - ts(a.closedAt ?? a.resolvedAt ?? a.createdAt))
                      }
                      return arr
                    }
                    const acikSorted = sortTickets(acik, true)
                    const kapaliSorted = sortTickets(kapali, false)

                    const toggleSort = (k: SortKey) =>
                      setSort((s) => (s?.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }))
                    // Tıklanabilir başlık (nested-component lint'i tetiklemesin diye fonksiyon çağrısı)
                    const sortTh = (label: string, k?: SortKey, className?: string) => (
                      <button
                        type="button"
                        onClick={k ? () => toggleSort(k) : undefined}
                        className={`flex items-center gap-1 text-left ${k ? "hover:text-foreground" : "cursor-default"} ${className ?? ""}`}
                      >
                        {label}
                        {k && sort?.key === k && (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </button>
                    )
                    const sortHeader = (
                      <div className="grid items-center gap-3 px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b bg-muted/20 grid-cols-[80px_minmax(0,1fr)_auto] md:grid-cols-[96px_minmax(0,1fr)_150px_140px_90px_80px_90px]">
                        <span>No</span>
                        <span>Konu</span>
                        <span className="hidden md:block">Kategori</span>
                        {sortTh("Bekleme", "wait", "hidden md:flex")}
                        {sortTh("Durum", "status")}
                        {sortTh("Öncelik", "priority", "hidden md:flex")}
                        {sortTh("Tarih", "date", "hidden md:flex")}
                      </div>
                    )

                    const row = (ticket: Ticket, faded: boolean) => {
                      const open = isOpenStatus(ticket.status)
                      const age = open ? ticketAge(ticket.createdAt) : null
                      const resolved = !open ? resolutionTime(ticket.createdAt, ticket.closedAt, ticket.resolvedAt) : null
                      return (
                        <div
                          key={ticket.id}
                          onClick={() => setSelectedTicketId(ticket.id)}
                          className={`grid items-center gap-3 px-3 py-2 border-b cursor-pointer transition-colors hover:bg-muted/50 grid-cols-[80px_minmax(0,1fr)_auto] md:grid-cols-[96px_minmax(0,1fr)_150px_140px_90px_80px_90px] ${
                            ticket.slaResolutionBreached ? "border-l-2 border-l-red-500" : ""
                          } ${faded ? "opacity-60" : ""}`}
                        >
                          {/* no */}
                          <span className="text-xs font-mono text-muted-foreground truncate">
                            {ticket.ticketNumber}
                          </span>
                          {/* başlık + kişi */}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{ticket.subject}</p>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">{ticket.requesterName}</span>
                            </span>
                          </div>
                          {/* kategori */}
                          <div className="hidden md:flex items-center min-w-0">
                            <CategoryBadge category={ticket.category} />
                          </div>
                          {/* sayaç: bekliyor / çözüldü */}
                          <div className="hidden md:flex items-center min-w-0">
                            {age && (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${age.className}`}>
                                <Clock className="h-3 w-3" />
                                {age.label}
                              </span>
                            )}
                            {resolved && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
                                <CheckCircle2 className="h-3 w-3" />
                                {resolved.label}
                              </span>
                            )}
                          </div>
                          {/* durum (mobilde de görünür) */}
                          <div className="flex items-center">
                            {getStatusBadge(ticket.status)}
                          </div>
                          {/* öncelik */}
                          <div className="hidden md:flex items-center">
                            {getPriorityBadge(ticket.priority)}
                          </div>
                          {/* tarih */}
                          <span className="hidden md:block text-xs text-muted-foreground truncate">
                            {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: tr })}
                          </span>
                        </div>
                      )
                    }

                    return (
                      <div className="space-y-4">
                        {acik.length > 0 && (
                          <div className="rounded-lg border overflow-hidden">
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/40 border-b">
                              Açık talepler ({acik.length})
                            </div>
                            {sortHeader}
                            <div>{acikSorted.map((t) => row(t, false))}</div>
                          </div>
                        )}
                        {kapali.length > 0 && (
                          <div className="rounded-lg border overflow-hidden opacity-60">
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/40 border-b">
                              Çözülmüş / kapalı ({kapali.length})
                            </div>
                            {sortHeader}
                            <div>{kapaliSorted.map((t) => row(t, false))}</div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Kullanım kılavuzu — Maliyet Kılavuzu deseni (shadcn Dialog, renkli bölümler) */}
      <KullanimKilavuzu open={showGuide} onOpenChange={setShowGuide} />

      {/* Detay modal — inline overlay div (portal/Dialog değil). URL değişmez. */}
      {selectedTicketId && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:p-6"
          onClick={() => setSelectedTicketId(null)}
        >
          <div
            className="w-full max-w-4xl my-4 rounded-lg bg-background shadow-xl border"
            onClick={(e) => e.stopPropagation()}
          >
            <TicketDetail ticketId={selectedTicketId} onClose={() => setSelectedTicketId(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
