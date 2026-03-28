"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Megaphone,
  Search,
  Plus,
  Pin,
  MessageSquare,
  Eye,
  Heart,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  Circle
} from "lucide-react"

interface Category {
  id: string
  name: string
  color: string | null
  icon: string | null
}

interface Announcement {
  id: string
  title: string
  summary: string | null
  content: string
  categoryId: string | null
  category: Category | null
  priority: string
  status: string
  isPinned: boolean
  publishedAt: string | null
  createdAt: string
  requireAcknowledgment: boolean
  authorName: string
  viewCount: number
  isRead: boolean
  isAcknowledged: boolean
  survey: {
    id: string
    title: string
    status: string
  } | null
  _count: {
    reads: number
    comments: number
    reactions: number
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const priorityConfig: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  LOW: { label: "Dusuk", color: "bg-gray-100 text-gray-800", icon: Circle },
  NORMAL: { label: "Normal", color: "bg-blue-100 text-blue-800", icon: Circle },
  HIGH: { label: "Yuksek", color: "bg-orange-100 text-orange-800", icon: AlertTriangle },
  URGENT: { label: "Acil", color: "bg-red-100 text-red-800", icon: AlertTriangle }
}

export default function AnnouncementsPage() {
  const { data: session } = useSession()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")

  const userEmail = session?.user?.email?.toLowerCase() || ""
  const userRole = session?.user?.role || "EMPLOYEE"
  const isAdmin = userEmail === "melih.dilben@ilerigroup.com" ||
                  userRole === "ADMIN" ||
                  userRole === "SUPER_ADMIN"

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchAnnouncements()
  }, [pagination.page, categoryFilter, priorityFilter])

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/announcements/categories")
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error("Kategoriler yüklenirken hata:", error)
    }
  }

  const fetchAnnouncements = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })

      if (categoryFilter !== "all") {
        params.set("categoryId", categoryFilter)
      }
      if (priorityFilter !== "all") {
        params.set("priority", priorityFilter)
      }
      if (search) {
        params.set("search", search)
      }

      const res = await fetch(`/api/announcements?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAnnouncements(data.announcements)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error("Duyurular yüklenirken hata:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchAnnouncements()
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return ""
    return new Date(dateString).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Duyurular</h1>
            <p className="text-sm text-muted-foreground">
              Sirket duyurularini ve haberleri takip edin
            </p>
          </div>
        </div>

        {isAdmin && (
          <Button asChild>
            <Link href="/announcements/manage" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Yeni Duyuru</span>
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Duyuru ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Kategoriler</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Oncelik" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Oncelikler</SelectItem>
                <SelectItem value="URGENT">Acil</SelectItem>
                <SelectItem value="HIGH">Yuksek</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="LOW">Dusuk</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleSearch}>
              <Filter className="h-4 w-4 mr-2" />
              Filtrele
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Announcements List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="classic-spinner" />
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Duyuru Bulunamadi</h3>
            <p className="text-sm text-muted-foreground">
              Henuz duyuru yok veya filtrelere uygun duyuru bulunamadi.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => {
            const priority = priorityConfig[announcement.priority]
            const PriorityIcon = priority?.icon || Circle

            return (
              <Link key={announcement.id} href={`/announcements/${announcement.id}`}>
                <Card className={`hover:shadow-md transition-shadow cursor-pointer ${
                  !announcement.isRead ? "border-l-4 border-l-primary" : ""
                } ${announcement.priority === "URGENT" ? "border-red-300 bg-red-50/50 dark:bg-red-950/20" : ""}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      {/* Left side */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {announcement.isPinned && (
                            <Badge variant="secondary" className="gap-1">
                              <Pin className="h-3 w-3" />
                              Sabitlenmis
                            </Badge>
                          )}
                          {announcement.category && (
                            <Badge
                              variant="outline"
                              style={{
                                backgroundColor: announcement.category.color || undefined,
                                color: announcement.category.color ? "#fff" : undefined
                              }}
                            >
                              {announcement.category.name}
                            </Badge>
                          )}
                          <Badge className={priority?.color}>
                            <PriorityIcon className="h-3 w-3 mr-1" />
                            {priority?.label}
                          </Badge>
                          {announcement.requireAcknowledgment && (
                            announcement.isAcknowledged ? (
                              <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                Okundu
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                Onay Gerekli
                              </Badge>
                            )
                          )}
                          {announcement.survey && (
                            <Badge variant="secondary" className="gap-1">
                              Anket Var
                            </Badge>
                          )}
                        </div>

                        <h3 className={`text-lg font-semibold mb-1 ${
                          !announcement.isRead ? "text-primary" : ""
                        }`}>
                          {announcement.title}
                        </h3>

                        {announcement.summary && (
                          <p className="text-muted-foreground line-clamp-2 mb-3">
                            {announcement.summary}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatDate(announcement.publishedAt || announcement.createdAt)}
                          </span>
                          <span>|</span>
                          <span>{announcement.authorName}</span>
                        </div>
                      </div>

                      {/* Right side - Stats */}
                      <div className="flex flex-col items-end gap-2 text-sm text-muted-foreground shrink-0">
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {announcement.viewCount}
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="h-4 w-4" />
                          {announcement._count.reactions}
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          {announcement._count.comments}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Toplam {pagination.total} duyuru, Sayfa {pagination.page} / {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              <ChevronLeft className="h-4 w-4" />
              Onceki
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Sonraki
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
