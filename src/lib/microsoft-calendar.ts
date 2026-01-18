// Microsoft Graph Calendar API Integration
// Outlook takviminden toplantı bilgilerini çekmek için

interface CalendarEvent {
  id: string
  subject: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  location?: {
    displayName: string
  }
  isOnlineMeeting: boolean
  onlineMeeting?: {
    joinUrl: string
  }
  organizer?: {
    emailAddress: {
      name: string
      address: string
    }
  }
  attendees?: Array<{
    emailAddress: {
      name: string
      address: string
    }
    status: {
      response: string
    }
  }>
  showAs?: string
  importance?: string
  isAllDay?: boolean
}

interface GraphCalendarResponse {
  value: CalendarEvent[]
  '@odata.nextLink'?: string
}

export interface FormattedCalendarEvent {
  id: string
  subject: string
  startTime: string
  endTime: string
  startDate: string
  location: string | null
  isOnline: boolean
  onlineMeetingUrl: string | null
  organizer: string | null
  isAllDay: boolean
}

// Access token almak için (Client Credentials Flow)
async function getCalendarAccessToken(): Promise<string> {
  const tenantId = process.env.AZURE_AD_TENANT_ID
  const clientId = process.env.AZURE_AD_CLIENT_ID
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Azure AD credentials not configured')
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Calendar token alma hatasi:', error)
    throw new Error('Failed to get calendar access token')
  }

  const data = await response.json()
  return data.access_token
}

// Tarih formatla (HH:mm)
function formatTime(dateTimeString: string): string {
  const date = new Date(dateTimeString)
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

// Tarih formatla (dd.MM.yyyy)
function formatDate(dateTimeString: string): string {
  const date = new Date(dateTimeString)
  return date.toLocaleDateString('tr-TR')
}

// Kullanicinin takvim etkinliklerini getir
export async function getUserCalendarEvents(
  userEmail: string,
  startDate: Date,
  endDate: Date
): Promise<FormattedCalendarEvent[]> {
  try {
    const accessToken = await getCalendarAccessToken()
    const graphEndpoint = process.env.GRAPH_API_ENDPOINT || 'https://graph.microsoft.com/v1.0'

    // ISO format ile tarih
    const startDateTime = startDate.toISOString()
    const endDateTime = endDate.toISOString()

    // Graph API Calendar Events endpoint
    const url = `${graphEndpoint}/users/${encodeURIComponent(userEmail)}/calendar/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$orderby=start/dateTime&$top=50&$select=id,subject,start,end,location,isOnlineMeeting,onlineMeeting,organizer,showAs,importance,isAllDay`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'outlook.timezone="Europe/Istanbul"',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Calendar API hatasi:', error)

      if (response.status === 404) {
        // Kullanici bulunamadi veya takvim yok
        return []
      }

      throw new Error(`Failed to fetch calendar events: ${response.status}`)
    }

    const data: GraphCalendarResponse = await response.json()

    // Etkinlikleri formatla
    return data.value.map((event) => ({
      id: event.id,
      subject: event.subject || 'Basliksiz Toplanti',
      startTime: formatTime(event.start.dateTime),
      endTime: formatTime(event.end.dateTime),
      startDate: formatDate(event.start.dateTime),
      location: event.location?.displayName || null,
      isOnline: event.isOnlineMeeting || false,
      onlineMeetingUrl: event.onlineMeeting?.joinUrl || null,
      organizer: event.organizer?.emailAddress?.name || null,
      isAllDay: event.isAllDay || false,
    }))
  } catch (error) {
    console.error('Takvim etkinlikleri alinirken hata:', error)
    throw error
  }
}

// Bugunun toplantilari
export async function getTodayEvents(userEmail: string): Promise<FormattedCalendarEvent[]> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  return getUserCalendarEvents(userEmail, startOfDay, endOfDay)
}

// Bu haftanin toplantilari
export async function getWeekEvents(userEmail: string): Promise<FormattedCalendarEvent[]> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)

  // 7 gun sonrasi
  const endOfWeek = new Date(startOfDay)
  endOfWeek.setDate(endOfWeek.getDate() + 7)
  endOfWeek.setHours(23, 59, 59)

  return getUserCalendarEvents(userEmail, startOfDay, endOfWeek)
}

// Yaklasan toplantilari getir (simdi + belirtilen saat)
export async function getUpcomingEvents(
  userEmail: string,
  hoursAhead: number = 24
): Promise<FormattedCalendarEvent[]> {
  const now = new Date()
  const endTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)

  return getUserCalendarEvents(userEmail, now, endTime)
}

// Azure AD yapilandirmasi kontrol
export function isCalendarConfigured(): boolean {
  return !!(
    process.env.AZURE_AD_TENANT_ID &&
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET
  )
}
