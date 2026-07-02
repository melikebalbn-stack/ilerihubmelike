"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  MessageSquare,
  Send,
  Search,
  Plus,
  Users,
  Check,
  CheckCheck,
  Loader2,
  ArrowLeft,
  X,
  UserPlus,
  MoreVertical,
  Trash2,
  Eraser,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { toast } from "sonner"

interface Conversation {
  id: string
  name: string
  isGroup: boolean
  participants: Array<{
    userEmail: string
    userName: string
    userDepartment: string | null
  }>
  unreadCount: number
  lastMessage: {
    content: string
    senderName: string
    createdAt: string
  } | null
  lastMessageAt: string | null
}

interface Message {
  id: string
  senderEmail: string
  senderName: string
  content: string
  messageType: string
  createdAt: string
  replyTo?: {
    id: string
    content: string
    senderName: string
  } | null
}

interface LdapUser {
  email: string
  displayName: string
  department?: string
}

export default function MessagesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  // Sonsuz-loading sigortası: session gelmezse / hata olursa spinner kesilip bu ekran gösterilir.
  const [loadError, setLoadError] = useState(false)
  const initialLoadedRef = useRef(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [ldapUsers, setLdapUsers] = useState<LdapUser[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Grup oluşturma state'leri
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [selectedMembers, setSelectedMembers] = useState<LdapUser[]>([])
  const [groupSearchQuery, setGroupSearchQuery] = useState("")
  const [creatingGroup, setCreatingGroup] = useState(false)

  // Sohbet işlemleri state'leri
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [deletingConversation, setDeletingConversation] = useState(false)
  const [clearingMessages, setClearingMessages] = useState(false)

  // Scroll kontrolü için
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const lastMessageCountRef = useRef(0)

  // Konusmalari yukle
  const fetchConversations = async (isPolling = false) => {
    try {
      const response = await fetch("/api/messages/conversations")
      if (response.ok) {
        const data = await response.json()
        setConversations(data)
        setLoadError(false)

        // Seçili konuşmayı da güncelle (unread count vs için)
        if (selectedConversation) {
          const updatedSelected = data.find((c: Conversation) => c.id === selectedConversation.id)
          if (updatedSelected) {
            setSelectedConversation(updatedSelected)
          }
        }
      }
    } catch (error) {
      console.error("Konusmalar yuklenemedi:", error)
    } finally {
      if (!isPolling) {
        setLoading(false)
        initialLoadedRef.current = true
      }
    }
  }

  // Mesajlari yukle
  const fetchMessages = async (conversationId: string, isPolling = false) => {
    try {
      const response = await fetch(`/api/messages/conversations/${conversationId}/messages`)
      if (response.ok) {
        const data = await response.json()
        const newMessages = data.messages

        // Yeni mesaj geldi mi kontrol et
        const hasNewMessages = newMessages.length > lastMessageCountRef.current
        lastMessageCountRef.current = newMessages.length

        setMessages(newMessages)

        // Sadece ilk yükleme veya yeni mesaj geldiğinde scroll yap
        if (!isPolling || hasNewMessages) {
          scrollToBottom()
        }
      }
    } catch (error) {
      console.error("Mesajlar yuklenemedi:", error)
    }
  }

  // LDAP kullanicilari ara
  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setLdapUsers([])
      return
    }

    setSearchingUsers(true)
    try {
      const response = await fetch(`/api/users?search=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        // API'den gelen format: { email, name, department }
        setLdapUsers(data.map((u: { email: string; name: string; department?: string }) => ({
          email: u.email,
          displayName: u.name,
          department: u.department,
        })).slice(0, 10))
      }
    } catch (error) {
      console.error("Kullanici aranamadi:", error)
    } finally {
      setSearchingUsers(false)
    }
  }

  // Mesaj gonder
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return

    setSendingMessage(true)
    try {
      const response = await fetch(
        `/api/messages/conversations/${selectedConversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newMessage }),
        }
      )

      if (response.ok) {
        const message = await response.json()
        setMessages((prev) => [...prev, message])
        setNewMessage("")
        scrollToBottom()

        // Konusma listesini guncelle
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? {
                  ...c,
                  lastMessage: {
                    content: message.content,
                    senderName: message.senderName,
                    createdAt: message.createdAt,
                  },
                  lastMessageAt: message.createdAt,
                }
              : c
          )
        )
      }
    } catch (error) {
      console.error("Mesaj gonderilemedi:", error)
    } finally {
      setSendingMessage(false)
    }
  }

  // Yeni konusma baslat
  const startConversation = async (user: LdapUser) => {
    try {
      const response = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantEmails: [user.email],
          isGroup: false,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setShowNewConversation(false)
        setSearchQuery("")
        setLdapUsers([])

        // Konusmalari yeniden yukle ve sec
        await fetchConversations()
        const conv = conversations.find((c) => c.id === data.id) || {
          id: data.id,
          name: user.displayName,
          isGroup: false,
          participants: [{ userEmail: user.email, userName: user.displayName, userDepartment: user.department || null }],
          unreadCount: 0,
          lastMessage: null,
          lastMessageAt: null,
        }
        setSelectedConversation(conv)
        fetchMessages(data.id)
      }
    } catch (error) {
      console.error("Konusma baslatilamadi:", error)
    }
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }
      }
    }, 100)
  }

  // Sohbeti sil (konuşmadan ayrıl)
  const deleteConversation = async () => {
    if (!selectedConversation) return

    setDeletingConversation(true)
    try {
      const response = await fetch(`/api/messages/conversations/${selectedConversation.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Sohbet silindi")
        setShowDeleteDialog(false)
        setSelectedConversation(null)
        setMessages([])
        lastMessageCountRef.current = 0
        fetchConversations()
      } else {
        toast.error("Sohbet silinemedi")
      }
    } catch (error) {
      console.error("Sohbet silinemedi:", error)
      toast.error("Bir hata oluştu")
    } finally {
      setDeletingConversation(false)
    }
  }

  // Mesajları temizle
  const clearMessages = async () => {
    if (!selectedConversation) return

    setClearingMessages(true)
    try {
      const response = await fetch(`/api/messages/conversations/${selectedConversation.id}/clear`, {
        method: "POST",
      })

      if (response.ok) {
        toast.success("Mesajlar temizlendi")
        setShowClearDialog(false)
        setMessages([])
        lastMessageCountRef.current = 0
      } else {
        toast.error("Mesajlar temizlenemedi")
      }
    } catch (error) {
      console.error("Mesajlar temizlenemedi:", error)
      toast.error("Bir hata oluştu")
    } finally {
      setClearingMessages(false)
    }
  }

  // Grup arama
  const searchUsersForGroup = async (query: string) => {
    if (query.length < 2) {
      setLdapUsers([])
      return
    }

    setSearchingUsers(true)
    try {
      const response = await fetch(`/api/users?search=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setLdapUsers(data.map((u: { email: string; name: string; department?: string }) => ({
          email: u.email,
          displayName: u.name,
          department: u.department,
        })).slice(0, 10))
      }
    } catch (error) {
      console.error("Kullanici aranamadi:", error)
    } finally {
      setSearchingUsers(false)
    }
  }

  // Gruba üye ekle
  const addMemberToGroup = (user: LdapUser) => {
    if (!selectedMembers.find(m => m.email === user.email)) {
      setSelectedMembers([...selectedMembers, user])
    }
    setGroupSearchQuery("")
    setLdapUsers([])
  }

  // Gruptan üye çıkar
  const removeMemberFromGroup = (email: string) => {
    setSelectedMembers(selectedMembers.filter(m => m.email !== email))
  }

  // Grup oluştur
  const createGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Grup adı gerekli")
      return
    }
    if (selectedMembers.length < 1) {
      toast.error("En az 1 üye seçmelisiniz")
      return
    }

    setCreatingGroup(true)
    try {
      const response = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantEmails: selectedMembers.map(m => m.email),
          name: groupName.trim(),
          isGroup: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success("Grup oluşturuldu!")
        setShowCreateGroup(false)
        setGroupName("")
        setSelectedMembers([])
        setGroupSearchQuery("")

        // Konuşmaları yeniden yükle ve grubu seç
        await fetchConversations()
        const newConv: Conversation = {
          id: data.id,
          name: groupName.trim(),
          isGroup: true,
          participants: selectedMembers.map(m => ({
            userEmail: m.email,
            userName: m.displayName,
            userDepartment: m.department || null,
          })),
          unreadCount: 0,
          lastMessage: null,
          lastMessageAt: null,
        }
        setSelectedConversation(newConv)
        fetchMessages(data.id)
      } else {
        toast.error("Grup oluşturulamadı")
      }
    } catch (error) {
      console.error("Grup olusturulamadi:", error)
      toast.error("Bir hata oluştu")
    } finally {
      setCreatingGroup(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // İlk yükleme — session STATUS'una göre (sonsuz spinner fix):
  //   loading → bekle; unauthenticated → login'e; authenticated+email → çek;
  //   authenticated ama email yok → spinner'ı kes + hata ekranı.
  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status === "authenticated" && session?.user?.email) {
      fetchConversations()
    } else {
      setLoading(false)
      setLoadError(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.email])

  // Güvenlik timeout'u: 10sn içinde ilk yükleme tamamlanmazsa spinner'ı kes,
  // "yeniden dene" ekranı göster (session hiç gelmese bile sonsuz dönmesin).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!initialLoadedRef.current) {
        setLoading(false)
        setLoadError(true)
      }
    }, 10000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (selectedConversation) {
      lastMessageCountRef.current = 0 // Reset for new conversation
      fetchMessages(selectedConversation.id)
    }
  }, [selectedConversation?.id])

  // Polling - her 3 saniyede mesajlari ve konuşmaları kontrol et
  useEffect(() => {
    if (!session?.user?.email) return

    // Konuşma listesi polling (her 3 saniye)
    const conversationsInterval = setInterval(() => {
      fetchConversations(true)
    }, 3000)

    return () => clearInterval(conversationsInterval)
  }, [session?.user?.email, selectedConversation?.id])

  // Seçili konuşma için mesaj polling (her 3 saniye)
  useEffect(() => {
    if (!selectedConversation) return

    const interval = setInterval(() => {
      fetchMessages(selectedConversation.id, true) // polling = true
    }, 3000)

    return () => clearInterval(interval)
  }, [selectedConversation?.id])

  return (
    <div className="h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3">
            <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
            Mesajlar
          </h1>
          <p className="text-sm text-muted-foreground">
            Calisma arkadaslarinizla iletisim kurun
          </p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {/* Yeni Mesaj Dialog */}
          <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Yeni Mesaj
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Mesaj</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Kisi ara..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      searchUsers(e.target.value)
                    }}
                  />
                </div>

                {searchingUsers ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : ldapUsers.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {ldapUsers
                      .filter((u) => u.email !== session?.user?.email)
                      .map((user) => (
                        <button
                          key={user.email}
                          onClick={() => startConversation(user)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                        >
                          <Avatar>
                            <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.displayName}</p>
                            <p className="text-sm text-muted-foreground">{user.department || user.email}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                ) : searchQuery.length >= 2 ? (
                  <p className="text-center text-muted-foreground py-4">Kullanici bulunamadi</p>
                ) : (
                  <p className="text-center text-muted-foreground py-4">En az 2 karakter girin</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Yeni Grup Dialog */}
          <Dialog open={showCreateGroup} onOpenChange={(open) => {
            setShowCreateGroup(open)
            if (!open) {
              setGroupName("")
              setSelectedMembers([])
              setGroupSearchQuery("")
              setLdapUsers([])
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Users className="h-4 w-4 mr-2" />
                Yeni Grup
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Yeni Grup Oluştur
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {/* Grup Adı */}
                <div>
                  <Label htmlFor="groupName">Grup Adı *</Label>
                  <Input
                    id="groupName"
                    placeholder="Örn: IT Ekibi, Proje Takımı..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>

                {/* Seçilen Üyeler */}
                {selectedMembers.length > 0 && (
                  <div>
                    <Label>Seçilen Üyeler ({selectedMembers.length})</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedMembers.map((member) => (
                        <Badge
                          key={member.email}
                          variant="secondary"
                          className="flex items-center gap-1 py-1 px-2"
                        >
                          {member.displayName}
                          <button
                            onClick={() => removeMemberFromGroup(member.email)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Üye Ara */}
                <div>
                  <Label>Üye Ekle</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Kişi ara..."
                      className="pl-9"
                      value={groupSearchQuery}
                      onChange={(e) => {
                        setGroupSearchQuery(e.target.value)
                        searchUsersForGroup(e.target.value)
                      }}
                    />
                  </div>

                  {searchingUsers ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : ldapUsers.length > 0 ? (
                    <div className="space-y-1 max-h-[200px] overflow-y-auto mt-2 border rounded-lg">
                      {ldapUsers
                        .filter((u) =>
                          u.email !== session?.user?.email &&
                          !selectedMembers.find(m => m.email === u.email)
                        )
                        .map((user) => (
                          <button
                            key={user.email}
                            onClick={() => addMemberToGroup(user)}
                            className="w-full flex items-center gap-3 p-2 hover:bg-muted transition-colors text-left"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">{getInitials(user.displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{user.displayName}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.department || user.email}</p>
                            </div>
                            <UserPlus className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                    </div>
                  ) : groupSearchQuery.length >= 2 ? (
                    <p className="text-center text-sm text-muted-foreground py-3">Kullanıcı bulunamadı</p>
                  ) : null}
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setShowCreateGroup(false)}>
                  İptal
                </Button>
                <Button
                  onClick={createGroup}
                  disabled={!groupName.trim() || selectedMembers.length < 1 || creatingGroup}
                >
                  {creatingGroup ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Oluşturuluyor...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      Grup Oluştur
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100%-80px)]">
        {/* Conversations List */}
        <Card className={`col-span-1 flex flex-col ${selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
          <CardHeader className="py-3 px-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Konusmalarda ara..." className="pl-9 h-8" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : loadError ? (
                <div className="text-center py-8 px-4">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Konuşmalar yüklenemedi. Oturumunuz sonlanmış olabilir.</p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => { setLoadError(false); setLoading(true); initialLoadedRef.current = false; fetchConversations() }}>
                      Yeniden dene
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push("/login")}>
                      Giriş yap
                    </Button>
                  </div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Henuz konusmaniz yok</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowNewConversation(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Yeni Mesaj Baslat
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left ${
                        selectedConversation?.id === conv.id ? "bg-muted" : ""
                      }`}
                    >
                      <Avatar>
                        <AvatarFallback>
                          {conv.isGroup ? <Users className="h-4 w-4" /> : getInitials(conv.name || "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{conv.name}</p>
                          {conv.lastMessageAt && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false, locale: tr })}
                            </span>
                          )}
                        </div>
                        {conv.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessage.senderName === session?.user?.name ? "Siz: " : ""}
                            {conv.lastMessage.content}
                          </p>
                        )}
                      </div>
                      {conv.unreadCount > 0 && (
                        <Badge className="bg-blue-500">{conv.unreadCount}</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Messages Area */}
        <Card className={`col-span-1 lg:col-span-2 flex flex-col overflow-hidden ${!selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <CardHeader className="py-3 px-4 border-b flex-row items-center gap-3">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSelectedConversation(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar>
                  <AvatarFallback>
                    {selectedConversation.isGroup ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      getInitials(selectedConversation.name || "")
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-base">{selectedConversation.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.isGroup
                      ? `${selectedConversation.participants.length + 1} katilimci`
                      : selectedConversation.participants[0]?.userDepartment || ""}
                  </p>
                </div>

                {/* Sohbet Menüsü */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowClearDialog(true)}>
                      <Eraser className="h-4 w-4 mr-2" />
                      Mesajları Temizle
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Sohbeti Sil
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 p-4 overflow-hidden min-h-0">
                <ScrollArea className="h-full" ref={scrollAreaRef}>
                  <div className="space-y-4 pr-4">
                    {messages.map((message) => {
                      const isOwn = message.senderEmail === session?.user?.email

                      return (
                        <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[70%] ${isOwn ? "order-2" : ""}`}>
                            {!isOwn && (
                              <p className="text-xs text-muted-foreground mb-1">{message.senderName}</p>
                            )}
                            <div
                              className={`rounded-lg px-4 py-2 ${
                                isOwn
                                  ? "bg-blue-500 text-white rounded-br-none"
                                  : "bg-muted rounded-bl-none"
                              }`}
                            >
                              {message.replyTo && (
                                <div
                                  className={`text-xs mb-2 pb-2 border-b ${
                                    isOwn ? "border-blue-400" : "border-gray-300"
                                  }`}
                                >
                                  <p className="font-medium">{message.replyTo.senderName}</p>
                                  <p className="truncate opacity-80">{message.replyTo.content}</p>
                                </div>
                              )}
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            </div>
                            <div className={`flex items-center gap-1 mt-1 text-xs text-muted-foreground ${isOwn ? "justify-end" : ""}`}>
                              <span>
                                {new Date(message.createdAt).toLocaleTimeString("tr-TR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {isOwn && <CheckCheck className="h-3 w-3" />}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Message Input */}
              <div className="border-t p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    sendMessage()
                  }}
                  className="flex gap-2"
                >
                  <Input
                    placeholder="Mesajinizi yazin..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sendingMessage}
                  />
                  <Button type="submit" disabled={!newMessage.trim() || sendingMessage}>
                    {sendingMessage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium text-lg">Mesajlariniz</h3>
                <p className="text-muted-foreground mt-1">
                  Bir konusma secin veya yeni bir mesaj baslatin
                </p>
                <Button className="mt-4" onClick={() => setShowNewConversation(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Mesaj
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Sohbeti Sil Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sohbeti Sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu sohbeti silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve sohbet listenizden kaldırılır.
              {selectedConversation?.isGroup && " Gruptan ayrılacaksınız."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingConversation}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteConversation}
              disabled={deletingConversation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingConversation ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Siliniyor...
                </>
              ) : (
                "Sil"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mesajları Temizle Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mesajları Temizle</AlertDialogTitle>
            <AlertDialogDescription>
              Tüm mesajları temizlemek istediğinizden emin misiniz? Bu işlem sadece sizin için geçerlidir, diğer katılımcılar mesajları görmeye devam edecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingMessages}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearMessages}
              disabled={clearingMessages}
            >
              {clearingMessages ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Temizleniyor...
                </>
              ) : (
                "Temizle"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
