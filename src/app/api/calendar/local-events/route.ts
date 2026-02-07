import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiCreated } from '@/lib/api-response'
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

// GET /api/calendar/local-events - Takvim etkinliklerini listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return apiUnauthorized()
    }

    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const type = searchParams.get('type')
    const departmentId = searchParams.get('departmentId')
    const isPublic = searchParams.get('isPublic')

    // Filtreleme koşulları
    const where: any = {}

    // Tarih aralığı filtresi
    if (start) {
      where.startDate = { gte: new Date(start) }
    }
    if (end) {
      where.endDate = { ...(where.endDate || {}), lte: new Date(end) }
    }

    // Tip filtresi
    if (type && type !== 'all') {
      where.type = type as CalendarEventType
    }

    // Departman filtresi
    if (departmentId) {
      where.departmentId = departmentId
    }

    // Görünürlük filtresi
    // Kullanıcı admin değilse, sadece public etkinlikleri veya kendi oluşturduklarını görebilir
    const isAdmin = ADMIN_ROLES.includes(session.user.role)

    if (isPublic === 'true') {
      where.isPublic = true
    } else if (isPublic === 'false' && isAdmin) {
      where.isPublic = false
    } else if (!isAdmin) {
      // Admin olmayan kullanıcı için: public olanlar VEYA kendi oluşturduğu
      where.OR = [
        { isPublic: true },
        { createdById: session.user.id },
      ]
    }

    const events = await prisma.calendarEvent.findMany({
      where,
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
      orderBy: {
        startDate: 'asc',
      },
    })

    // Renk bilgisini ekle (eğer yoksa)
    const eventsWithColor = events.map(event => ({
      ...event,
      color: event.color || EVENT_COLORS[event.type],
    }))

    return apiSuccess(eventsWithColor)

  } catch (error) {
    console.error('CalendarEvent GET error:', error)
    return apiError('Etkinlikler alınamadı', 500, {
      endpoint: '/api/calendar/local-events',
      error,
    })
  }
}

// POST /api/calendar/local-events - Yeni etkinlik oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return apiUnauthorized()
    }

    const body = await request.json()
    const {
      title,
      description,
      startDate,
      endDate,
      allDay,
      type,
      color,
      location,
      departmentId,
      isRecurring,
      recurrenceRule,
      remindBefore,
      isPublic,
      sourceType,
      sourceId,
    } = body

    // Validasyon
    if (!title || !title.trim()) {
      return apiBadRequest('Başlık zorunludur')
    }

    if (!startDate) {
      return apiBadRequest('Başlangıç tarihi zorunludur')
    }

    if (!endDate) {
      return apiBadRequest('Bitiş tarihi zorunludur')
    }

    const parsedStartDate = new Date(startDate)
    const parsedEndDate = new Date(endDate)

    if (parsedStartDate > parsedEndDate) {
      return apiBadRequest('Başlangıç tarihi bitiş tarihinden sonra olamaz')
    }

    // Etkinlik tipi kontrolü
    const eventType = type && Object.values(CalendarEventType).includes(type as CalendarEventType)
      ? (type as CalendarEventType)
      : CalendarEventType.OTHER

    // Departman kontrolü (varsa)
    if (departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
      })
      if (!department) {
        return apiBadRequest('Geçersiz departman')
      }
    }

    // Kullanıcı ID'sini bul (session'dan gelen email ile)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return apiBadRequest('Kullanıcı bulunamadı')
    }

    // Etkinlik oluştur
    const event = await prisma.calendarEvent.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        allDay: allDay || false,
        type: eventType,
        color: color || EVENT_COLORS[eventType],
        location: location?.trim() || null,
        departmentId: departmentId || null,
        isRecurring: isRecurring || false,
        recurrenceRule: recurrenceRule?.trim() || null,
        remindBefore: remindBefore ? parseInt(remindBefore) : null,
        isPublic: isPublic !== false, // Default true
        sourceType: sourceType?.trim() || null,
        sourceId: sourceId?.trim() || null,
        createdById: user.id,
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

    return apiCreated(event)

  } catch (error) {
    console.error('CalendarEvent POST error:', error)
    return apiError('Etkinlik oluşturulamadı', 500, {
      endpoint: '/api/calendar/local-events',
      error,
    })
  }
}
