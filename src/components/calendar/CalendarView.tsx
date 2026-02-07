'use client'

import { useRef, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, EventDropArg, EventInput, DateSelectArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { CalendarEventType } from '@/generated/prisma'

// Tip-renk eşlemesi
export const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  MEETING: '#3b82f6',        // mavi
  TRAINING: '#8b5cf6',       // mor
  CALIBRATION: '#f97316',    // turuncu
  FIRE_INSPECTION: '#ef4444', // kırmızı
  LEAVE: '#22c55e',          // yeşil
  HOLIDAY: '#6b7280',        // gri
  REMINDER: '#06b6d4',       // camgöbeği
  OTHER: '#64748b',          // arduvaz
}

// Tip-etiket eşlemesi
export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  MEETING: 'Toplantı',
  TRAINING: 'Eğitim',
  CALIBRATION: 'Kalibrasyon',
  FIRE_INSPECTION: 'Yangın Kontrolü',
  LEAVE: 'İzin',
  HOLIDAY: 'Tatil',
  REMINDER: 'Hatırlatma',
  OTHER: 'Diğer',
}

export interface CalendarEvent {
  id: string
  title: string
  description?: string | null
  startDate: string | Date
  endDate: string | Date
  allDay?: boolean
  type: CalendarEventType
  color?: string | null
  location?: string | null
  departmentId?: string | null
  department?: { id: string; name: string } | null
  createdBy?: { id: string; name: string; email: string } | null
  isPublic?: boolean
  isRecurring?: boolean
  remindBefore?: number | null
}

export interface CalendarFilters {
  types?: CalendarEventType[]
  departmentId?: string | null
}

interface CalendarViewProps {
  events: CalendarEvent[]
  onEventClick?: (event: CalendarEvent) => void
  onDateClick?: (date: Date, allDay: boolean) => void
  onEventDrop?: (eventId: string, start: Date, end: Date, allDay: boolean) => void
  filters?: CalendarFilters
}

export function CalendarView({
  events,
  onEventClick,
  onDateClick,
  onEventDrop,
  filters,
}: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null)

  // Etkinlikleri filtrele ve FullCalendar formatına dönüştür
  const calendarEvents: EventInput[] = useMemo(() => {
    let filteredEvents = events

    // Tip filtresi
    if (filters?.types && filters.types.length > 0) {
      filteredEvents = filteredEvents.filter(event =>
        filters.types!.includes(event.type)
      )
    }

    // Departman filtresi
    if (filters?.departmentId) {
      filteredEvents = filteredEvents.filter(
        event => event.departmentId === filters.departmentId
      )
    }

    return filteredEvents.map(event => ({
      id: event.id,
      title: event.title,
      start: typeof event.startDate === 'string' ? event.startDate : event.startDate.toISOString(),
      end: typeof event.endDate === 'string' ? event.endDate : event.endDate.toISOString(),
      allDay: event.allDay ?? false,
      backgroundColor: event.color || EVENT_TYPE_COLORS[event.type],
      borderColor: event.color || EVENT_TYPE_COLORS[event.type],
      extendedProps: {
        ...event,
      },
    }))
  }, [events, filters])

  // Etkinlik tıklama
  const handleEventClick = (arg: EventClickArg) => {
    if (onEventClick) {
      onEventClick(arg.event.extendedProps as CalendarEvent)
    }
  }

  // Tarih tıklama
  const handleDateClick = (arg: DateClickArg) => {
    if (onDateClick) {
      onDateClick(arg.date, arg.allDay)
    }
  }

  // Etkinlik sürükle-bırak
  const handleEventDrop = (arg: EventDropArg) => {
    if (onEventDrop && arg.event.start) {
      const end = arg.event.end || arg.event.start
      onEventDrop(arg.event.id, arg.event.start, end, arg.event.allDay)
    }
  }

  return (
    <div className="bg-background rounded-lg border p-4">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={calendarEvents}
        locale="tr"
        firstDay={1}
        editable={true}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        weekends={true}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth',
        }}
        buttonText={{
          today: 'Bugün',
          month: 'Ay',
          week: 'Hafta',
          day: 'Gün',
          list: 'Liste',
        }}
        allDayText="Tüm gün"
        noEventsText="Etkinlik bulunamadı"
        moreLinkText={(n) => `+${n} etkinlik daha`}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        eventDrop={handleEventDrop}
        height="auto"
        aspectRatio={1.8}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
        slotLabelFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
        dayHeaderFormat={{
          weekday: 'short',
          day: 'numeric',
        }}
        titleFormat={{
          year: 'numeric',
          month: 'long',
        }}
        eventContent={(arg) => {
          return (
            <div className="p-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs">
              {arg.timeText && (
                <span className="font-semibold mr-1">{arg.timeText}</span>
              )}
              <span>{arg.event.title}</span>
            </div>
          )
        }}
      />
    </div>
  )
}
