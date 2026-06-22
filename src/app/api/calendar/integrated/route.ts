import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api-response'
import { CalendarEventType } from '@/generated/prisma'

// Renk haritası
const EVENT_COLORS: Record<CalendarEventType, string> = {
  MEETING: '#3b82f6',       // mavi
  TRAINING: '#8b5cf6',      // mor
  CALIBRATION: '#f97316',   // turuncu
  FIRE_INSPECTION: '#ef4444', // kırmızı
  LEAVE: '#22c55e',         // yeşil
  HOLIDAY: '#6b7280',       // gri
  REMINDER: '#06b6d4',      // camgöbeği
  OTHER: '#64748b',         // arduvaz
}

// Admin rolleri
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER']

// Birleşik takvim etkinliği tipi
interface IntegratedEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  type: CalendarEventType
  color: string
  extendedProps: {
    sourceType: 'calendar_event' | 'calibration' | 'fire_inspection'
    sourceId: string
    description?: string
    location?: string
    departmentId?: string
    departmentName?: string
    createdByName?: string
    // Kalibrasyon için ek bilgiler
    deviceId?: string
    status?: string
    responsiblePerson?: string
  }
}

// GET /api/calendar/integrated - Birleşik takvim verisi
// Parametreler: start, end (ISO date strings)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return apiUnauthorized()
    }

    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    // Tarih parametreleri zorunlu
    if (!start || !end) {
      return apiBadRequest('start ve end parametreleri zorunludur')
    }

    const startDate = new Date(start)
    const endDate = new Date(end)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return apiBadRequest('Geçersiz tarih formatı')
    }

    const isAdmin = ADMIN_ROLES.includes(session.user.role)
    const integratedEvents: IntegratedEvent[] = []

    // 1. CalendarEvent'lerden etkinlikler
    const calendarEvents = await prisma.calendarEvent.findMany({
      where: {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        OR: isAdmin
          ? undefined
          : [
              { isPublic: true },
              { createdBy: { email: session.user.email } },
            ],
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    for (const event of calendarEvents) {
      integratedEvents.push({
        id: `event_${event.id}`,
        title: event.title,
        start: event.startDate.toISOString(),
        end: event.endDate.toISOString(),
        allDay: event.allDay,
        type: event.type,
        color: event.color || EVENT_COLORS[event.type],
        extendedProps: {
          sourceType: 'calendar_event',
          sourceId: event.id,
          description: event.description || undefined,
          location: event.location || undefined,
          departmentId: event.departmentId || undefined,
          departmentName: event.department?.name || undefined,
          createdByName: event.createdBy.name || undefined,
        },
      })
    }

    // 2. Kalibrasyon cihazlarından yaklaşan kalibrasyonlar
    const calibrationDevices = await prisma.calibrationDevice.findMany({
      where: {
        isActive: true,
        nextCalibrationDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    })

    for (const device of calibrationDevices) {
      const calibrationDate = device.nextCalibrationDate
      if (!calibrationDate) continue

      integratedEvents.push({
        id: `calibration_${device.id}`,
        title: `Kalibrasyon: ${device.name}`,
        start: calibrationDate.toISOString(),
        end: calibrationDate.toISOString(),
        allDay: true,
        type: CalendarEventType.CALIBRATION,
        color: EVENT_COLORS.CALIBRATION,
        extendedProps: {
          sourceType: 'calibration',
          sourceId: device.id,
          description: `Cihaz: ${device.name} (${device.deviceId})\nSon kalibrasyon: ${device.lastCalibrationDate?.toLocaleDateString('tr-TR') || '-'}`,
          location: device.location || undefined,
          deviceId: device.deviceId,
          status: device.status,
          responsiblePerson: device.responsiblePerson || undefined,
        },
      })
    }

    // 3. Yangın kontrolleri (CalendarEvent'lerden sourceType='fire_inspection' olanlar)
    // Not: Ayrı bir yangın kontrolü tablosu yoksa, CalendarEvent'lerdeki FIRE_INSPECTION tipli kayıtlar kullanılır
    // Bu kayıtlar zaten yukarıda CalendarEvent sorgusu ile çekildi
    // Eğer ayrı bir FireInspection modeli varsa burada sorgulanabilir

    // Etkinlikleri başlangıç tarihine göre sırala
    integratedEvents.sort((a, b) => {
      return new Date(a.start).getTime() - new Date(b.start).getTime()
    })

    return apiSuccess({
      events: integratedEvents,
      count: integratedEvents.length,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    })

  } catch (error) {
    console.error('IntegratedCalendar GET error:', error)
    return apiError('Takvim verileri alınamadı', 500, {
      endpoint: '/api/calendar/integrated',
      error,
    })
  }
}
