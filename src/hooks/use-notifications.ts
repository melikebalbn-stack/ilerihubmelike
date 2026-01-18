'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface Notification {
  id: string
  title: string
  message: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  isRead: boolean
  link?: string
  createdAt: string
}

interface SSEMessage {
  type: 'init' | 'new'
  notifications: Notification[]
  unreadCount: number
}

export function useNotifications() {
  const { data: session, status } = useSession()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  // SSE bağlantısını kur
  useEffect(() => {
    if (status !== 'authenticated') {
      setIsLoading(false)
      return
    }

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      const eventSource = new EventSource('/api/sse/notifications')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setIsConnected(true)
        setIsLoading(false)
      }

      eventSource.onmessage = (event) => {
        try {
          const data: SSEMessage = JSON.parse(event.data)

          if (data.type === 'init') {
            setNotifications(data.notifications)
            setUnreadCount(data.unreadCount)
          } else if (data.type === 'new') {
            setNotifications(prev => [...data.notifications, ...prev])
            setUnreadCount(data.unreadCount)

            // Browser notification göster
            if (Notification.permission === 'granted') {
              data.notifications.forEach(n => {
                new Notification(n.title, {
                  body: n.message,
                  icon: '/icons/icon-192x192.svg',
                  tag: n.id,
                })
              })
            }
          }
        } catch (error) {
          console.error('SSE message parse error:', error)
        }
      }

      eventSource.onerror = () => {
        setIsConnected(false)
        eventSource.close()
        // 5 saniye sonra yeniden bağlan
        setTimeout(connectSSE, 5000)
      }
    }

    connectSSE()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [status])

  // Bildirimi okundu olarak işaretle
  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
      })

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, isRead: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Mark as read error:', error)
    }
  }, [])

  // Tümünü okundu olarak işaretle
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      })

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, isRead: true }))
        )
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Mark all as read error:', error)
    }
  }, [])

  // Daha fazla bildirim yükle
  const loadMore = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/notifications?offset=${notifications.length}&limit=20`
      )

      if (response.ok) {
        const data = await response.json()
        setNotifications(prev => [...prev, ...data.notifications])
      }
    } catch (error) {
      console.error('Load more error:', error)
    }
  }, [notifications.length])

  return {
    notifications,
    unreadCount,
    isLoading,
    isConnected,
    markAsRead,
    markAllAsRead,
    loadMore,
  }
}
