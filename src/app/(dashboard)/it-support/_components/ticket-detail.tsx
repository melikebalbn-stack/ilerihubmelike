"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, X, AlertTriangle, Loader2, Send, UserPlus, Settings2, Headphones, Clock, CheckCircle2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import { ticketAge, resolutionTime, isOpenStatus } from "../_lib/ticket-age"
import { CategoryBadge } from "./category-badge"

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
  slaResponseBreached?: boolean
  slaResolutionBreached?: boolean
  createdAt: string
  closedAt?: string | null
  resolvedAt?: string | null
  category?: { name: string; color: string | null; icon: string | null } | null
  comments?: TicketComment[]
}

interface TicketComment {
  id: string
  authorName: string
  content: string
  isInternal: boolean
  isResolution: boolean
  createdAt: string
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
  const { data: session, status } = useSession()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const initialLoadedRef = useRef(false)
  const [updatingTicket, setUpdatingTicket] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [sendingComment, setSendingComment] = useState(false)
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([])

  const isITStaff = session?.user?.permissions?.includes("helpdesk.admin") ?? false

  const fetchTicket = async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`)
      if (res.ok) {
        const data: Ticket = await res.json()
        setTicket(data)
        setComments(data.comments ?? [])
        setLoadError(false)
      } else {
        setLoadError(true)
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
      initialLoadedRef.current = true
    }
  }

  const fetchAssignableUsers = async () => {
    try {
      const res = await fetch("/api/tickets/assignable-users")
      if (res.ok) setAssignableUsers(await res.json())
    } catch {
      // atama listesi kritik değil
    }
  }

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status === "authenticated" && session?.user?.email) {
      fetchTicket()
      if (isITStaff) fetchAssignableUsers()
    } else {
      setLoading(false)
      setLoadError(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.email, ticketId])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!initialLoadedRef.current) {
        setLoading(false)
        setLoadError(true)
      }
    }, 10000)
    return () => clearTimeout(timer)
  }, [])

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
      }
    } catch {
      // sessiz
    } finally {
      setUpdatingTicket(false)
    }
  }

  const handleAssignToMe = () => {
    if (!session?.user?.email || !session?.user?.name) return
    handleUpdateTicket({ assignedTo: session.user.email, assignedToName: session.user.name } as Partial<Ticket>)
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
          <Button variant="outline" onClick={() => { setLoadError(false); setLoading(true); initialLoadedRef.current = false; fetchTicket() }}>
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
  const resolved = !open ? resolutionTime(ticket.createdAt, ticket.closedAt, ticket.resolvedAt) : null

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
          {ticket.assetInfo && (
            <div>
              <p className="text-sm text-muted-foreground">Ilgili Cihaz</p>
              <p className="font-medium">{ticket.assetInfo}</p>
            </div>
          )}
        </div>

        {/* Açıklama */}
        <div>
          <h4 className="font-medium mb-2">Aciklama</h4>
          <p className="text-sm whitespace-pre-wrap bg-muted/30 p-4 rounded-lg">{ticket.description}</p>
        </div>

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
                    <SelectItem value="RESOLVED">Cozuldu</SelectItem>
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
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Henuz yorum yok</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
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
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: tr })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                    {comment.isInternal && <Badge variant="outline" className="mt-2 text-yellow-600">Dahili Not</Badge>}
                    {comment.isResolution && <Badge variant="outline" className="mt-2 text-green-600">Cozum</Badge>}
                  </div>
                ))}
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
    </Card>
  )
}
