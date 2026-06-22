'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Building2,
  Edit,
  Trash2,
  Globe,
  Lock,
  RefreshCw,
  Bell,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, type CalendarEvent } from './CalendarView'

interface EventDetailProps {
  event: CalendarEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (event: CalendarEvent) => void
  onDelete?: (eventId: string) => void
  canEdit?: boolean
}

export function EventDetail({
  event,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  canEdit = false,
}: EventDetailProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!event) return null

  const formatDate = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return format(d, 'd MMMM yyyy', { locale: tr })
  }

  const formatTime = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return format(d, 'HH:mm', { locale: tr })
  }

  const formatDateTime = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return format(d, 'd MMMM yyyy, HH:mm', { locale: tr })
  }

  const handleEdit = () => {
    onOpenChange(false)
    onEdit?.(event)
  }

  const handleDeleteConfirm = () => {
    onDelete?.(event.id)
    setShowDeleteConfirm(false)
    onOpenChange(false)
  }

  const eventColor = event.color || EVENT_TYPE_COLORS[event.type]

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold break-words">
                  {event.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Etkinlik detayları
                </DialogDescription>
              </div>
              <Badge
                className="shrink-0 text-white"
                style={{ backgroundColor: eventColor }}
              >
                {EVENT_TYPE_LABELS[event.type]}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Tarih ve Saat */}
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1">
                {event.allDay ? (
                  <>
                    <p className="font-medium">{formatDate(event.startDate)}</p>
                    {formatDate(event.startDate) !== formatDate(event.endDate) && (
                      <p className="text-sm text-muted-foreground">
                        - {formatDate(event.endDate)}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">Tüm gün</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">
                      {formatDate(event.startDate)}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>
                        {formatTime(event.startDate)} - {formatTime(event.endDate)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Konum */}
            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="flex-1">{event.location}</p>
              </div>
            )}

            {/* Açıklama */}
            {event.description && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{event.description}</p>
              </div>
            )}

            {/* Departman */}
            {event.department && (
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <p>{event.department.name}</p>
              </div>
            )}

            {/* Oluşturan */}
            {event.createdBy && (
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground shrink-0" />
                <p>{event.createdBy.name || event.createdBy.email}</p>
              </div>
            )}

            {/* Meta bilgiler */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {/* Görünürlük */}
              <Badge variant="outline" className="gap-1">
                {event.isPublic ? (
                  <>
                    <Globe className="h-3 w-3" />
                    Herkese açık
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3" />
                    Özel
                  </>
                )}
              </Badge>

              {/* Tekrarlayan */}
              {event.isRecurring && (
                <Badge variant="outline" className="gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Tekrarlayan
                </Badge>
              )}

              {/* Hatırlatma */}
              {event.remindBefore && (
                <Badge variant="outline" className="gap-1">
                  <Bell className="h-3 w-3" />
                  {event.remindBefore >= 1440
                    ? `${Math.floor(event.remindBefore / 1440)} gün önce`
                    : event.remindBefore >= 60
                    ? `${Math.floor(event.remindBefore / 60)} saat önce`
                    : `${event.remindBefore} dk önce`}
                </Badge>
              )}
            </div>

            {/* Eylem butonları */}
            {canEdit && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Düzenle
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Sil
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Silme onayı */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Etkinliği Sil</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{event.title}&quot; etkinliğini silmek istediğinize emin misiniz?
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
