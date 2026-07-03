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
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import { TicketDetail } from "./_components/ticket-detail"
import { CategoryBadge } from "./_components/category-badge"
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

export default function ITSupportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [categories, setCategories] = useState<TicketCategory[]>([])
  const [stats, setStats] = useState<TicketStats | null>(null)
  const [loading, setLoading] = useState(true)
  // Sonsuz-loading sigortası: session gelmezse / hata olursa spinner kesilip bu ekran gösterilir.
  const [loadError, setLoadError] = useState(false)
  const initialLoadedRef = useRef(false)
  // Detay modal: seçili ticket id (URL değişmez — sayfa yerine overlay).
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("my")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

  // Yeni ticket dialog
  const [showNewTicket, setShowNewTicket] = useState(false)
  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    categoryId: "",
    location: "",
    assetInfo: "",
  })
  const [submitting, setSubmitting] = useState(false)

  // Ticket detay

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN"

  // PR-Y9c: saf RBAC, helpdesk.admin permission. Eski legacy (role/dept/ou fallback) kaldırıldı.
  const isITStaff = session?.user?.permissions?.includes("helpdesk.admin") ?? false

  // Verileri yukle
  const fetchData = async () => {
    setLoading(true)
    try {
      const [ticketsRes, categoriesRes, statsRes] = await Promise.all([
        fetch(`/api/tickets?viewMode=${activeTab}`),
        fetch("/api/tickets/categories"),
        fetch("/api/tickets/stats"),
      ])

      if (ticketsRes.ok) {
        setTickets(await ticketsRes.json())
        setLoadError(false)
      }
      if (categoriesRes.ok) {
        setCategories(await categoriesRes.json())
      }
      if (statsRes.ok) {
        setStats(await statsRes.json())
      }
    } catch (error) {
      console.error("Veri yuklenemedi:", error)
    } finally {
      setLoading(false)
      initialLoadedRef.current = true
    }
  }

  // İlk yükleme — session STATUS'una göre (sonsuz spinner fix, messages ile aynı desen):
  //   loading → bekle; unauthenticated → login'e; authenticated+email → çek;
  //   authenticated ama email yok → spinner'ı kes + hata ekranı.
  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status === "authenticated" && session?.user?.email) {
      fetchData()
    } else {
      setLoading(false)
      setLoadError(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.email, activeTab])

  // Güvenlik timeout'u: 10sn içinde ilk yükleme tamamlanmazsa spinner'ı kes + hata ekranı
  // (session hiç gelmese bile sonsuz dönmesin).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!initialLoadedRef.current) {
        setLoading(false)
        setLoadError(true)
      }
    }, 10000)
    return () => clearTimeout(timer)
  }, [])

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
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTicket),
      })

      if (response.ok) {
        setShowNewTicket(false)
        setNewTicket({
          subject: "",
          description: "",
          categoryId: "",
          location: "",
          assetInfo: "",
        })
        fetchData()
      }
    } catch (error) {
      console.error("Ticket olusturulamadi:", error)
    } finally {
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
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
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
                    <Input
                      placeholder="Bilgisayar adi, yazici modeli, vs."
                      value={newTicket.assetInfo}
                      onChange={(e) => setNewTicket({ ...newTicket, assetInfo: e.target.value })}
                    />
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
                    {isITStaff && (
                      <>
                        <TabsTrigger value="assigned">Bana Atanan</TabsTrigger>
                        <TabsTrigger value="all">Tumu</TabsTrigger>
                        <TabsTrigger value="open">Aciklar</TabsTrigger>
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
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : loadError ? (
                <div className="text-center py-12">
                  <Headphones className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Talepler yüklenemedi. Oturumunuz sonlanmış olabilir.</p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button variant="outline" onClick={() => { setLoadError(false); setLoading(true); initialLoadedRef.current = false; fetchData() }}>
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
                            <div>{acik.map((t) => row(t, false))}</div>
                          </div>
                        )}
                        {kapali.length > 0 && (
                          <div className="rounded-lg border overflow-hidden opacity-60">
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/40 border-b">
                              Çözülmüş / kapalı ({kapali.length})
                            </div>
                            <div>{kapali.map((t) => row(t, false))}</div>
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
