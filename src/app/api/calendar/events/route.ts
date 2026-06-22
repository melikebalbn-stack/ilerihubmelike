import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getTodayEvents,
  getWeekEvents,
  getUpcomingEvents,
  isCalendarConfigured,
  FormattedCalendarEvent,
} from '@/lib/microsoft-calendar'

// GET /api/calendar/events?range=today|week|upcoming
export async function GET(request: NextRequest) {
  try {
    // Kimlik dogrulama kontrolu
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Azure AD yapilandirmasi kontrol
    if (!isCalendarConfigured()) {
      return NextResponse.json(
        {
          error: 'Calendar not configured',
          message: 'Takvim entegrasyonu yapilandirilmamis',
          events: [],
          count: 0,
        },
        { status: 200 }
      )
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'today'

    const userEmail = session.user.email

    let events: FormattedCalendarEvent[] = []

    try {
      switch (range) {
        case 'week':
          events = await getWeekEvents(userEmail)
          break
        case 'upcoming':
          events = await getUpcomingEvents(userEmail, 24) // 24 saat
          break
        case 'today':
        default:
          events = await getTodayEvents(userEmail)
          break
      }
    } catch (calendarError) {
      console.error('Takvim verileri alinamadi:', calendarError)
      // Hata durumunda bos liste don (kullanici deneyimini bozmamak icin)
      return NextResponse.json({
        events: [],
        count: 0,
        error: 'calendar_fetch_failed',
        message: 'Takvim verileri alinamadi',
      })
    }

    return NextResponse.json({
      events,
      count: events.length,
      range,
      userEmail,
    })
  } catch (error) {
    console.error('Calendar API hatasi:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
