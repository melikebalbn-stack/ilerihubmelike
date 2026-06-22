'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Calendar, Plus, Filter, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  CalendarView,
  EventForm,
  EventDetail,
  CalendarFiltersComponent,
} from '@/components/calendar'
import type { CalendarEvent, CalendarFilters } from '@/components/calendar'

// Admin rolleri
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER']

export default function CalendarPage() {
  const { data: session } = useSession()

  // State
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [showEventForm, setShowEventForm] = useState(false)
  const [showEventDetail, setShowEventDetail] = useState(false)
  const [filters, setFilters] = useState<CalendarFilters>({
    types: undefined,
    departmentId: null,
  })
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    // Varsayilan olarak bu ayin baslasindan gelecek ay sonuna kadar
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 2, 0)
    return { start, end }
  })
  const [initialDate, setInitialDate] = useState<Date | null>(null)
  const [initialAllDay, setInitialAllDay] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Kullanici bilgileri
  const currentUser = session?.user
  const isAdmin = currentUser?.role && ADMIN_ROLES.includes(currentUser.role)

  // Etkinlikleri yukle
  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      })

      const res = await fetch(`/api/calendar/integrated?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        // API'den gelen integrated events'i CalendarEvent formatina donustur
        const mappedEvents: CalendarEvent[] = (data.data?.events || []).map((event: any) => ({
          id: event.extendedProps?.sourceId || event.id,
          title: event.title,
          description: event.extendedProps?.description || null,
          startDate: event.start,
          endDate: event.end,
          allDay: event.allDay,
          type: event.type,
          color: event.color,
          location: event.extendedProps?.location || null,
          departmentId: event.extendedProps?.departmentId || null,
          department: event.extendedProps?.departmentId
            ? { id: event.extendedProps.departmentId, name: event.extendedProps.departmentName || '' }
            : null,
          createdBy: event.extendedProps?.createdByName
            ? { id: '', name: event.extendedProps.createdByName, email: '' }
            : null,
          isPublic: true,
          isRecurring: false,
          remindBefore: null,
          // sourceType'i sakla (edit/delete icin onemli)
          _sourceType: event.extendedProps?.sourceType,
        }))
        setEvents(mappedEvents)
      } else {
        toast.error('Etkinlikler yuklenemedi')
      }
    } catch (error) {
      console.error('Etkinlikler yuklenirken hata:', error)
      toast.error('Etkinlikler yuklenemedi')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    if (session?.user) {
      fetchEvents()
    }
  }, [session?.user, fetchEvents])

  // Tarih tiklama - yeni etkinlik olustur
  const handleDateClick = (date: Date, allDay: boolean) => {
    setInitialDate(date)
    setInitialAllDay(allDay)
    setEditingEvent(null)
    setShowEventForm(true)
  }

  // Etkinlik tiklama - detay goster
  const handleEventClick = (event: CalendarEvent) => {
    // Sadece calendar_event tipindeki etkinlikler duzenlenebilir
    const eventWithMeta = event as CalendarEvent & { _sourceType?: string }
    if (eventWithMeta._sourceType === 'calibration') {
      // Kalibrasyon etkinlikleri icin sadece bilgi goster
      toast.info('Kalibrasyon etkinlikleri kalibrasyon modulunden yonetilir')
      return
    }
    setSelectedEvent(event)
    setShowEventDetail(true)
  }

  // Etkinlik surukle-birak
  const handleEventDrop = async (eventId: string, start: Date, end: Date, allDay: boolean) => {
    try {
      const res = await fetch(`/api/calendar/local-events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          allDay,
        }),
      })

      if (res.ok) {
        toast.success('Etkinlik tarihi guncellendi')
        fetchEvents()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Etkinlik guncellenemedi')
        // Degisikligi geri al
        fetchEvents()
      }
    } catch (error) {
      console.error('Etkinlik guncellenirken hata:', error)
      toast.error('Etkinlik guncellenemedi')
      fetchEvents()
    }
  }

  // Etkinlik duzenleme
  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event)
    setInitialDate(null)
    setShowEventDetail(false)
    setShowEventForm(true)
  }

  // Etkinlik silme
  const handleDelete = async (eventId: string) => {
    try {
      const res = await fetch(`/api/calendar/local-events/${eventId}`, {
        method: 'DELETE',
      })

      if (res.ok || res.status === 204) {
        toast.success('Etkinlik silindi')
        setShowEventDetail(false)
        setSelectedEvent(null)
        fetchEvents()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Etkinlik silinemedi')
      }
    } catch (error) {
      console.error('Etkinlik silinirken hata:', error)
      toast.error('Etkinlik silinemedi')
    }
  }

  // Duzenleme yetkisi kontrolu
  const canEditEvent = (event: CalendarEvent): boolean => {
    if (!currentUser) return false
    if (isAdmin) return true
    // Oluşturan kullanici kontrol et
    if (event.createdBy?.email === currentUser.email) return true
    return false
  }

  // Form kapatildiginda
  const handleFormClose = (open: boolean) => {
    setShowEventForm(open)
    if (!open) {
      setEditingEvent(null)
      setInitialDate(null)
    }
  }

  // Form basarili oldugunda
  const handleFormSuccess = () => {
    fetchEvents()
  }

  // Filtrelenmis etkinlikler
  const filteredEvents = events.filter((event) => {
    // Tip filtresi
    if (filters.types && filters.types.length > 0) {
      if (!filters.types.includes(event.type)) return false
    }
    // Departman filtresi
    if (filters.departmentId) {
      if (event.departmentId !== filters.departmentId) return false
    }
    return true
  })

  // Aktif filtre sayisi
  const activeFilterCount =
    (filters.types?.length !== undefined && filters.types.length < 8 ? 1 : 0) +
    (filters.departmentId ? 1 : 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Calendar className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-500" />
            Takvim
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Etkinliklerinizi planlayın ve yonetin
          </p>
        </div>
        <Button onClick={() => {
          setEditingEvent(null)
          setInitialDate(null)
          setShowEventForm(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Etkinlik
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Mobile Filters Toggle */}
        <div className="lg:hidden">
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtreler
                  {activeFilterCount > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
                      {activeFilterCount}
                    </span>
                  )}
                </span>
                {filtersOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <CalendarFiltersComponent
                filters={filters}
                onChange={setFilters}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Desktop Filters Sidebar */}
        <div className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-6">
            <CalendarFiltersComponent
              filters={filters}
              onChange={setFilters}
            />
          </div>
        </div>

        {/* Calendar View */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <Card>
              <CardContent className="py-12 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Etkinlikler yukleniyor...</p>
              </CardContent>
            </Card>
          ) : (
            <CalendarView
              events={filteredEvents}
              onEventClick={handleEventClick}
              onDateClick={handleDateClick}
              onEventDrop={handleEventDrop}
              filters={filters}
            />
          )}
        </div>
      </div>

      {/* Event Form Dialog */}
      <EventForm
        open={showEventForm}
        onOpenChange={handleFormClose}
        event={editingEvent}
        onSuccess={handleFormSuccess}
        initialDate={initialDate}
        initialAllDay={initialAllDay}
      />

      {/* Event Detail Dialog */}
      <EventDetail
        event={selectedEvent}
        open={showEventDetail}
        onOpenChange={setShowEventDetail}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canEdit={selectedEvent ? canEditEvent(selectedEvent) : false}
      />
    </div>
  )
}
