'use client'

import { Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

interface NotificationItemProps {
  notification: {
    id: string
    title: string
    message: string
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
    isRead: boolean
    link?: string
    createdAt: string
  }
  onRead: (id: string) => void
  onClick?: () => void
}

const typeConfig = {
  INFO: {
    icon: Info,
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-500',
    borderColor: 'border-l-blue-500',
  },
  SUCCESS: {
    icon: CheckCircle,
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    iconColor: 'text-green-500',
    borderColor: 'border-l-green-500',
  },
  WARNING: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    iconColor: 'text-yellow-500',
    borderColor: 'border-l-yellow-500',
  },
  ERROR: {
    icon: XCircle,
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    iconColor: 'text-red-500',
    borderColor: 'border-l-red-500',
  },
}

export function NotificationItem({ notification, onRead, onClick }: NotificationItemProps) {
  const config = typeConfig[notification.type]
  const Icon = config.icon

  const handleClick = () => {
    if (!notification.isRead) {
      onRead(notification.id)
    }
    onClick?.()
    if (notification.link) {
      window.location.href = notification.link
    }
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex gap-3 p-3 border-l-4 cursor-pointer transition-colors',
        config.borderColor,
        notification.isRead
          ? 'bg-background hover:bg-muted/50'
          : cn(config.bgColor, 'hover:opacity-90')
      )}
    >
      <div className={cn('flex-shrink-0 mt-0.5', config.iconColor)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          !notification.isRead && 'text-foreground'
        )}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
            locale: tr,
          })}
        </p>
      </div>
      {!notification.isRead && (
        <div className="flex-shrink-0">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
        </div>
      )}
    </div>
  )
}
