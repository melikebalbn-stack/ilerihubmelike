import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest, apiNoContent } from '@/lib/api-response'
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

// GET /api/calendar/local-events/[id] - Tek etkinlik detayı
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return apiUnauthorized()
    }

    const { id } = await params

    const event = await prisma.calendarEvent.findUnique({
      where: { id },
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

    if (!event) {
      return apiNotFound('Etkinlik bulunamadı')
    }

    // Görünürlük kontrolü
    // Private etkinlikler sadece oluşturan veya admin tarafından görülebilir
    const isAdmin = ADMIN_ROLES.includes(session.user.role)
    const isCreator = event.createdBy.email === session.user.email

    if (!event.isPublic && !isAdmin && !isCreator) {
      return apiNotFound('Etkinlik bulunamadı')
    }

    // Renk bilgisini ekle (eğer yoksa)
    const eventWithColor = {
      ...event,
      color: event.color || EVENT_COLORS[event.type],
    }

    return apiSuccess(eventWithColor)

  } catch (error) {
    console.error('CalendarEvent GET [id] error:', error)
    return apiError('Etkinlik alınamadı', 500, {
      endpoint: '/api/calendar/local-events/[id]',
      error,
    })
  }
}

// PATCH /api/calendar/local-events/[id] - Etkinlik güncelle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return apiUnauthorized()
    }

    const { id } = await params

    // Mevcut etkinliği bul
    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })

    if (!existingEvent) {
      return apiNotFound('Etkinlik bulunamadı')
    }

    // Yetki kontrolü: Sadece oluşturan veya admin güncelleyebilir
    const isAdmin = ADMIN_ROLES.includes(session.user.role)
    const isCreator = existingEvent.createdBy.email === session.user.email

    if (!isAdmin && !isCreator) {
      return apiForbidden()
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

    // Tarih validasyonu
    const parsedStartDate = startDate ? new Date(startDate) : existingEvent.startDate
    const parsedEndDate = endDate ? new Date(endDate) : existingEvent.endDate

    if (parsedStartDate > parsedEndDate) {
      return apiBadRequest('Başlangıç tarihi bitiş tarihinden sonra olamaz')
    }

    // Departman kontrolü (değişiyorsa)
    if (departmentId && departmentId !== existingEvent.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
      })
      if (!department) {
        return apiBadRequest('Geçersiz departman')
      }
    }

    // Etkinlik tipi
    let eventType = existingEvent.type
    if (type !== undefined) {
      eventType = Object.values(CalendarEventType).includes(type as CalendarEventType)
        ? (type as CalendarEventType)
        : CalendarEventType.OTHER
    }

    // Renk güncelleme (tip değişirse otomatik renk)
    let eventColor = color
    if (color === undefined && type !== undefined && type !== existingEvent.type) {
      eventColor = EVENT_COLORS[eventType]
    }

    // Güncelle
    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(startDate !== undefined && { startDate: parsedStartDate }),
        ...(endDate !== undefined && { endDate: parsedEndDate }),
        ...(allDay !== undefined && { allDay }),
        ...(type !== undefined && { type: eventType }),
        ...(eventColor !== undefined && { color: eventColor }),
        ...(location !== undefined && { location: location?.trim() || null }),
        ...(departmentId !== undefined && { departmentId: departmentId || null }),
        ...(isRecurring !== undefined && { isRecurring }),
        ...(recurrenceRule !== undefined && { recurrenceRule: recurrenceRule?.trim() || null }),
        ...(remindBefore !== undefined && { remindBefore: remindBefore ? parseInt(remindBefore) : null }),
        ...(isPublic !== undefined && { isPublic }),
        ...(sourceType !== undefined && { sourceType: sourceType?.trim() || null }),
        ...(sourceId !== undefined && { sourceId: sourceId?.trim() || null }),
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

    return apiSuccess(event)

  } catch (error) {
    console.error('CalendarEvent PATCH error:', error)
    return apiError('Etkinlik güncellenemedi', 500, {
      endpoint: '/api/calendar/local-events/[id]',
      error,
    })
  }
}

// DELETE /api/calendar/local-events/[id] - Etkinlik sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return apiUnauthorized()
    }

    const { id } = await params

    // Mevcut etkinliği bul
    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })

    if (!existingEvent) {
      return apiNotFound('Etkinlik bulunamadı')
    }

    // Yetki kontrolü: Sadece oluşturan veya admin silebilir
    const isAdmin = ADMIN_ROLES.includes(session.user.role)
    const isCreator = existingEvent.createdBy.email === session.user.email

    if (!isAdmin && !isCreator) {
      return apiForbidden()
    }

    // Hard delete
    await prisma.calendarEvent.delete({
      where: { id },
    })

    return apiNoContent()

  } catch (error) {
    console.error('CalendarEvent DELETE error:', error)
    return apiError('Etkinlik silinemedi', 500, {
      endpoint: '/api/calendar/local-events/[id]',
      error,
    })
  }
}
