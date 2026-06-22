'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect as Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Bell,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  Inbox,
} from 'lucide-react'

interface Notification {
  id: string
  title: string
  message: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'REMINDER'
  isRead: boolean
  link: string | null
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

type FilterType = 'all' | 'unread' | 'read'
type NotificationType = 'all' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'REMINDER'

const typeConfig: Record<
  Notification['type'],
  { icon: typeof Info; color: string; label: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  INFO: {
    icon: Info,
    color: 'text-blue-500',
    label: 'Bilgi',
    badgeVariant: 'secondary',
  },
  SUCCESS: {
    icon: CheckCircle,
    color: 'text-green-500',
    label: 'Basari',
    badgeVariant: 'default',
  },
  WARNING: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    label: 'Uyari',
    badgeVariant: 'outline',
  },
  ERROR: {
    icon: XCircle,
    color: 'text-red-500',
    label: 'Hata',
    badgeVariant: 'destructive',
  },
  REMINDER: {
    icon: Bell,
    color: 'text-purple-500',
    label: 'Hatirlatma',
    badgeVariant: 'secondary',
  },
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [typeFilter, setTypeFilter] = useState<NotificationType>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (filter === 'unread') {
        params.set('unreadOnly', 'true')
      }

      const res = await fetch(`/api/notifications?${params}`)
      if (res.ok) {
        const data = await res.json()
        let filteredNotifications = data.notifications as Notification[]

        // Client-side filter for read status (API only supports unreadOnly)
        if (filter === 'read') {
          filteredNotifications = filteredNotifications.filter((n) => n.isRead)
        }

        // Client-side filter for type
        if (typeFilter !== 'all') {
          filteredNotifications = filteredNotifications.filter((n) => n.type === typeFilter)
        }

        setNotifications(filteredNotifications)
        setPagination(data.pagination)
      } else {
        toast.error('Bildirimler yuklenirken hata olustu')
      }
    } catch (error) {
      console.error('Bildirimler yuklenirken hata:', error)
      toast.error('Bildirimler yuklenirken hata olustu')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filter, typeFilter])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      })
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        )
      }
    } catch (error) {
      console.error('Okundu olarak isaretlenirken hata:', error)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id)
    }
    if (notification.link) {
      router.push(notification.link)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
      })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
        toast.success('Tum bildirimler okundu olarak isaretlendi')
      } else {
        toast.error('Islem basarisiz oldu')
      }
    } catch (error) {
      console.error('Tumunu okundu isaretle hatasi:', error)
      toast.error('Islem basarisiz oldu')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        toast.success('Bildirim silindi')
      } else {
        toast.error('Bildirim silinemedi')
      }
    } catch (error) {
      console.error('Bildirim silme hatasi:', error)
      toast.error('Bildirim silinemedi')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.warning('Lutfen silinecek bildirimleri secin')
      return
    }

    const deletePromises = Array.from(selectedIds).map((id) =>
      fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    )

    try {
      const results = await Promise.all(deletePromises)
      const successCount = results.filter((r) => r.ok).length
      const failCount = results.length - successCount

      if (successCount > 0) {
        setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)))
        setSelectedIds(new Set())
        toast.success(`${successCount} bildirim silindi`)
      }
      if (failCount > 0) {
        toast.error(`${failCount} bildirim silinemedi`)
      }
    } catch (error) {
      console.error('Toplu silme hatasi:', error)
      toast.error('Silme islemi sirasinda hata olustu')
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(notifications.map((n) => n.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Simdi'
    if (diffMins < 60) return `${diffMins} dakika once`
    if (diffHours < 24) return `${diffHours} saat once`
    if (diffDays < 7) return `${diffDays} gun once`

    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isAllSelected = notifications.length > 0 && selectedIds.size === notifications.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Bildirimler</h1>
            <p className="text-sm text-muted-foreground">
              Tum bildirimlerinizi buradan yonetin
            </p>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilter('all')
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
              >
                Tumu
              </Button>
              <Button
                variant={filter === 'unread' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilter('unread')
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
              >
                Okunmamis
              </Button>
              <Button
                variant={filter === 'read' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilter('read')
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
              >
                Okunmus
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              {/* Type Filter */}
              <Select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value as NotificationType)
                  setPagination((prev) => ({ ...prev, page: 1 }))
                }}
                className="w-full sm:w-48"
              >
                <option value="all">Tum Tipler</option>
                <option value="INFO">Bilgi</option>
                <option value="SUCCESS">Basari</option>
                <option value="WARNING">Uyari</option>
                <option value="ERROR">Hata</option>
                <option value="REMINDER">Hatirlatma</option>
              </Select>

              {/* Bulk Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="whitespace-nowrap"
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Tumunu Okundu Isaretle
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                  className="whitespace-nowrap text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Secilenleri Sil ({selectedIds.size})
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-4 rounded-lg border animate-pulse"
                >
                  <div className="h-5 w-5 rounded bg-muted" />
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-muted" />
                    <div className="h-3 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-1/4 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Bildirim Bulunamadi</h3>
            <p className="text-sm text-muted-foreground">
              {filter === 'unread'
                ? 'Okunmamis bildiriminiz yok.'
                : filter === 'read'
                ? 'Okunmus bildiriminiz yok.'
                : 'Henuz bildiriminiz yok.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Tumunu sec"
              />
              <span className="text-sm text-muted-foreground">
                {selectedIds.size > 0
                  ? `${selectedIds.size} bildirim secildi`
                  : 'Tumunu sec'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {notifications.map((notification) => {
                const config = typeConfig[notification.type]
                const TypeIcon = config.icon

                return (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                      !notification.isRead
                        ? 'bg-primary/5 border-primary/20 font-medium'
                        : 'bg-background hover:bg-muted/50'
                    } ${notification.link ? 'cursor-pointer' : ''}`}
                  >
                    <Checkbox
                      checked={selectedIds.has(notification.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOne(notification.id, checked as boolean)
                      }
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Sec: ${notification.title}`}
                    />

                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        notification.type === 'SUCCESS'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : notification.type === 'WARNING'
                          ? 'bg-amber-100 dark:bg-amber-900/30'
                          : notification.type === 'ERROR'
                          ? 'bg-red-100 dark:bg-red-900/30'
                          : notification.type === 'REMINDER'
                          ? 'bg-purple-100 dark:bg-purple-900/30'
                          : 'bg-blue-100 dark:bg-blue-900/30'
                      }`}
                    >
                      <TypeIcon className={`h-5 w-5 ${config.color}`} />
                    </div>

                    <div
                      className="flex-1 min-w-0"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4
                          className={`text-sm ${
                            !notification.isRead ? 'font-semibold' : 'font-medium'
                          }`}
                        >
                          {notification.title}
                        </h4>
                        <Badge variant={config.badgeVariant} className="text-xs">
                          {config.label}
                        </Badge>
                        {!notification.isRead && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(notification.id)
                      }}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Toplam {pagination.total} bildirim, Sayfa {pagination.page} /{' '}
            {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
              }
            >
              <ChevronLeft className="h-4 w-4" />
              Onceki
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
              }
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
