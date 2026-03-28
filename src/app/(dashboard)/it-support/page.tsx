"use client"

import { useState, useEffect } from "react"
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
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  User,
  Calendar,
  Tag,
  MessageSquare,
  Filter,
  RefreshCw,
  Send,
  Paperclip,
  X,
  ArrowLeft,
  UserPlus,
  Settings2,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"

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
  const { data: session } = useSession()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [categories, setCategories] = useState<TicketCategory[]>([])
  const [stats, setStats] = useState<TicketStats | null>(null)
  const [loading, setLoading] = useState(true)
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
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [ticketComments, setTicketComments] = useState<TicketComment[]>([])
  const [newComment, setNewComment] = useState("")
  const [sendingComment, setSendingComment] = useState(false)
  const [updatingTicket, setUpdatingTicket] = useState(false)

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN"

  // IT Ekibi kontrolü: IT_MANAGER/ADMIN rolü VEYA Sistem Geliştirme OU'sunda
  // ou alanı AD'den gelen güncel bilgidir, department eski kalabilir
  const userOu = (session?.user?.ou || "").toLowerCase()
  const userDept = (session?.user?.department || "").toLowerCase()
  const isITStaff = session?.user?.role === "IT_MANAGER" ||
    session?.user?.role === "ADMIN" ||
    session?.user?.role === "SUPER_ADMIN" ||
    userOu.includes("sistem") ||
    userOu.includes("bilgi teknoloji") ||
    userOu.includes("information") ||
    userOu.includes("it") ||
    // Geriye uyumluluk için department kontrolü (ou boşsa)
    (!userOu && (userDept.includes("sistem") || userDept.includes("bilgi teknoloji") || userDept.includes("information")))

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
    }
  }

  useEffect(() => {
    if (session?.user?.email) {
      fetchData()
    }
  }, [session?.user?.email, activeTab])

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
  const loadTicketDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket)
    try {
      const response = await fetch(`/api/tickets/${ticket.id}/comments`)
      if (response.ok) {
        setTicketComments(await response.json())
      }
    } catch (error) {
      console.error("Yorumlar yuklenemedi:", error)
    }
  }

  // Yorum gonder
  const handleSendComment = async () => {
    if (!newComment.trim() || !selectedTicket) return

    setSendingComment(true)
    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      })

      if (response.ok) {
        const comment = await response.json()
        setTicketComments([...ticketComments, comment])
        setNewComment("")
      }
    } catch (error) {
      console.error("Yorum gonderilemedi:", error)
    } finally {
      setSendingComment(false)
    }
  }

  // Ticket guncelle (IT ekibi icin)
  const handleUpdateTicket = async (updates: Partial<Ticket>) => {
    if (!selectedTicket) return

    setUpdatingTicket(true)
    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const updatedTicket = await response.json()
        setSelectedTicket({ ...selectedTicket, ...updatedTicket })
        // Liste de guncelle
        setTickets(tickets.map(t =>
          t.id === selectedTicket.id ? { ...t, ...updatedTicket } : t
        ))
        fetchData() // Istatistikleri yenile
      }
    } catch (error) {
      console.error("Ticket guncellenemedi:", error)
    } finally {
      setUpdatingTicket(false)
    }
  }

  // Kendine ata
  const handleAssignToMe = () => {
    if (!session?.user?.email || !session?.user?.name) return
    handleUpdateTicket({
      assignedTo: session.user.email,
      assignedToName: session.user.name,
    } as Partial<Ticket>)
  }

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
  const getTicketTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      INCIDENT: "Olay",
      SERVICE_REQUEST: "Hizmet Talebi",
      PROBLEM: "Problem",
      CHANGE_REQUEST: "Degisiklik Talebi",
    }
    return types[type] || type
  }

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

      {/* Main Content */}
      <div className={`grid gap-6 ${selectedTicket ? "lg:grid-cols-5" : "lg:grid-cols-1"}`}>
        {/* Ticket List */}
        <div className={selectedTicket ? "lg:col-span-2" : ""}>
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
                  <div className="space-y-2">
                    {filteredTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        onClick={() => loadTicketDetail(ticket)}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedTicket?.id === ticket.id ? "border-primary bg-muted/30" : ""
                        } ${ticket.slaResolutionBreached ? "border-l-4 border-l-red-500" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-mono text-muted-foreground">
                                {ticket.ticketNumber}
                              </span>
                              {getPriorityBadge(ticket.priority)}
                              {getStatusBadge(ticket.status)}
                            </div>
                            <h4 className="font-medium truncate">{ticket.subject}</h4>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {ticket.requesterName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(ticket.createdAt), {
                                  addSuffix: true,
                                  locale: tr,
                                })}
                              </span>
                              {ticket._count && ticket._count.comments > 0 && (
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {ticket._count.comments}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ticket Detail */}
        {selectedTicket && (
          <div className="lg:col-span-3">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      onClick={() => setSelectedTicket(null)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {selectedTicket.ticketNumber}
                        {getStatusBadge(selectedTicket.status)}
                      </CardTitle>
                      <CardDescription>{selectedTicket.subject}</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedTicket(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Ticket Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm text-muted-foreground">Talep Eden</p>
                    <p className="font-medium">{selectedTicket.requesterName}</p>
                    <p className="text-sm text-muted-foreground">{selectedTicket.requesterDept}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Atanan</p>
                    <p className="font-medium">{selectedTicket.assignedToName || "Atanmadi"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tip</p>
                    <p className="font-medium">{getTicketTypeLabel(selectedTicket.ticketType)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Oncelik</p>
                    {getPriorityBadge(selectedTicket.priority)}
                  </div>
                  {selectedTicket.location && (
                    <div>
                      <p className="text-sm text-muted-foreground">Lokasyon</p>
                      <p className="font-medium">{selectedTicket.location}</p>
                    </div>
                  )}
                  {selectedTicket.assetInfo && (
                    <div>
                      <p className="text-sm text-muted-foreground">Ilgili Cihaz</p>
                      <p className="font-medium">{selectedTicket.assetInfo}</p>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <h4 className="font-medium mb-2">Aciklama</h4>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 p-4 rounded-lg">
                    {selectedTicket.description}
                  </p>
                </div>

                {/* IT Ekibi Kontrolleri */}
                {isITStaff && (
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      IT Ekibi Kontrolleri
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Durum Degistir */}
                      <div>
                        <Label className="text-xs">Durum</Label>
                        <Select
                          value={selectedTicket.status}
                          onValueChange={(value) => handleUpdateTicket({ status: value } as Partial<Ticket>)}
                          disabled={updatingTicket}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NEW">Yeni</SelectItem>
                            <SelectItem value="ASSIGNED">Atandi</SelectItem>
                            <SelectItem value="IN_PROGRESS">Islemde</SelectItem>
                            <SelectItem value="PENDING">Beklemede</SelectItem>
                            <SelectItem value="ON_HOLD">Askida</SelectItem>
                            <SelectItem value="RESOLVED">Cozuldu</SelectItem>
                            <SelectItem value="CLOSED">Kapatildi</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Oncelik Degistir */}
                      <div>
                        <Label className="text-xs">Oncelik</Label>
                        <Select
                          value={selectedTicket.priority}
                          onValueChange={(value) => handleUpdateTicket({ priority: value } as Partial<Ticket>)}
                          disabled={updatingTicket}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TICKET_LOW">Dusuk</SelectItem>
                            <SelectItem value="NORMAL">Normal</SelectItem>
                            <SelectItem value="TICKET_HIGH">Yuksek</SelectItem>
                            <SelectItem value="TICKET_CRITICAL">Kritik</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Talep Tipi Degistir */}
                      <div>
                        <Label className="text-xs">Talep Tipi</Label>
                        <Select
                          value={selectedTicket.ticketType}
                          onValueChange={(value) => handleUpdateTicket({ ticketType: value } as Partial<Ticket>)}
                          disabled={updatingTicket}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INCIDENT">Olay</SelectItem>
                            <SelectItem value="SERVICE_REQUEST">Hizmet Talebi</SelectItem>
                            <SelectItem value="PROBLEM">Problem</SelectItem>
                            <SelectItem value="CHANGE_REQUEST">Degisiklik</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Kendine Ata Butonu */}
                    {!selectedTicket.assignedTo && (
                      <Button
                        className="w-full mt-3"
                        variant="outline"
                        onClick={handleAssignToMe}
                        disabled={updatingTicket}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Kendime Ata
                      </Button>
                    )}

                    {selectedTicket.assignedTo && selectedTicket.assignedTo !== session?.user?.email && (
                      <Button
                        className="w-full mt-3"
                        variant="outline"
                        onClick={handleAssignToMe}
                        disabled={updatingTicket}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Devral
                      </Button>
                    )}
                  </div>
                )}

                {/* SLA Info */}
                {(selectedTicket.slaResponseBreached || selectedTicket.slaResolutionBreached) && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">SLA Ihlali</span>
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div>
                  <h4 className="font-medium mb-3">Yorumlar & Aktivite</h4>
                  <ScrollArea className="h-[200px] mb-4">
                    {ticketComments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Henuz yorum yok
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {ticketComments.map((comment) => (
                          <div
                            key={comment.id}
                            className={`p-3 rounded-lg ${
                              comment.isInternal
                                ? "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800"
                                : comment.isResolution
                                ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                                : "bg-muted/30"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{comment.authorName}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.createdAt), {
                                  addSuffix: true,
                                  locale: tr,
                                })}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                            {comment.isInternal && (
                              <Badge variant="outline" className="mt-2 text-yellow-600">
                                Dahili Not
                              </Badge>
                            )}
                            {comment.isResolution && (
                              <Badge variant="outline" className="mt-2 text-green-600">
                                Cozum
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Add Comment */}
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Yorum yazin..."
                      rows={2}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                    <Button
                      onClick={handleSendComment}
                      disabled={!newComment.trim() || sendingComment}
                    >
                      {sendingComment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
