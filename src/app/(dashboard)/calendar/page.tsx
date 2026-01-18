"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Video,
  MapPin,
  Clock,
  Users,
  ExternalLink,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { useSession } from "next-auth/react"

interface CalendarEvent {
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

interface DayEvents {
  date: string
  dayName: string
  dayNumber: number
  events: CalendarEvent[]
  isToday: boolean
}

export default function CalendarPage() {
  const { data: session } = useSession()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"today" | "week">("week")
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0)

  const fetchEvents = async (range: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/calendar/events?range=${range}`)
      if (response.ok) {
        const data = await response.json()
        if (data.error) {
          setError(data.message || "Takvim yuklenemedi")
          setEvents([])
        } else {
          setEvents(data.events || [])
        }
      } else {
        setError("Takvim verileri alinamadi")
      }
    } catch (err) {
      setError("Baglanti hatasi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.email) {
      fetchEvents(activeTab)
    } else {
      setLoading(false)
    }
  }, [session?.user?.email, activeTab])

  // Haftanin gunlerini olustur
  const getWeekDays = (): DayEvents[] => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + currentWeekOffset * 7) // Pazartesi

    const days: DayEvents[] = []
    const dayNames = ["Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi", "Pazar"]

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      const dateStr = date.toLocaleDateString("tr-TR")
      const isToday = date.toDateString() === today.toDateString()

      const dayEvents = events.filter(e => e.startDate === dateStr)

      days.push({
        date: dateStr,
        dayName: dayNames[i],
        dayNumber: date.getDate(),
        events: dayEvents,
        isToday,
      })
    }

    return days
  }

  const weekDays = getWeekDays()

  // Hafta basligi
  const getWeekTitle = () => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + currentWeekOffset * 7)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)

    const startMonth = startOfWeek.toLocaleDateString("tr-TR", { month: "short" })
    const endMonth = endOfWeek.toLocaleDateString("tr-TR", { month: "short" })
    const year = endOfWeek.getFullYear()

    if (startMonth === endMonth) {
      return `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${startMonth} ${year}`
    }
    return `${startOfWeek.getDate()} ${startMonth} - ${endOfWeek.getDate()} ${endMonth} ${year}`
  }

  // Bugunun toplantilari
  const todayEvents = events.filter(e => {
    const today = new Date().toLocaleDateString("tr-TR")
    return e.startDate === today
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <CalendarIcon className="h-8 w-8 text-indigo-500" />
            Takvim
          </h1>
          <p className="text-muted-foreground">
            Outlook takviminizdeki toplantilariniz
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchEvents(activeTab)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Yenile
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "today" | "week")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="today">Bugun</TabsTrigger>
            <TabsTrigger value="week">Hafta</TabsTrigger>
          </TabsList>

          {activeTab === "week" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentWeekOffset(prev => prev - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[180px] text-center">
                {getWeekTitle()}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentWeekOffset(prev => prev + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {currentWeekOffset !== 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentWeekOffset(0)}
                >
                  Bugune Don
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Bugun Tab */}
        <TabsContent value="today" className="mt-6">
          {error ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">{error}</p>
              </CardContent>
            </Card>
          ) : loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Yukluyor...</p>
              </CardContent>
            </Card>
          ) : todayEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Bugun toplantiniz yok</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {todayEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Hafta Tab */}
        <TabsContent value="week" className="mt-6">
          {error ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">{error}</p>
              </CardContent>
            </Card>
          ) : loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Yukluyor...</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-7 gap-4">
              {weekDays.map((day) => (
                <div
                  key={day.date}
                  className={`min-h-[400px] rounded-lg border p-3 ${
                    day.isToday
                      ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
                      : "bg-card"
                  }`}
                >
                  {/* Gun Basligi */}
                  <div className="text-center mb-3 pb-2 border-b">
                    <p className="text-xs text-muted-foreground">{day.dayName}</p>
                    <p
                      className={`text-xl font-bold ${
                        day.isToday ? "text-indigo-600" : ""
                      }`}
                    >
                      {day.dayNumber}
                    </p>
                  </div>

                  {/* Etkinlikler */}
                  <div className="space-y-2">
                    {day.events.length === 0 ? (
                      <p className="text-xs text-center text-muted-foreground py-4">
                        Toplanti yok
                      </p>
                    ) : (
                      day.events.map((event) => (
                        <div
                          key={event.id}
                          className={`p-2 rounded text-xs ${
                            event.isOnline
                              ? "bg-blue-100 dark:bg-blue-950/40 border-l-2 border-blue-500"
                              : "bg-gray-100 dark:bg-gray-800 border-l-2 border-gray-400"
                          }`}
                        >
                          <p className="font-medium truncate">{event.subject}</p>
                          <p className="text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {event.startTime} - {event.endTime}
                          </p>
                          {event.isOnline && event.onlineMeetingUrl && (
                            <a
                              href={event.onlineMeetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1 mt-1"
                            >
                              <Video className="h-3 w-3" />
                              Katil
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Event Card Component
function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Saat */}
          <div className="text-center min-w-[70px]">
            <p className="text-lg font-bold text-indigo-600">{event.startTime}</p>
            <p className="text-sm text-muted-foreground">{event.endTime}</p>
          </div>

          {/* Detaylar */}
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{event.subject}</h3>

            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
              {event.isOnline ? (
                <span className="flex items-center gap-1">
                  <Video className="h-4 w-4 text-blue-500" />
                  Online Toplanti
                </span>
              ) : event.location ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {event.location}
                </span>
              ) : null}

              {event.organizer && (
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {event.organizer}
                </span>
              )}
            </div>

            {/* Teams Linki */}
            {event.isOnline && event.onlineMeetingUrl && (
              <a
                href={event.onlineMeetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Video className="h-4 w-4" />
                Teams Toplantisina Katil
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Badge */}
          {event.isAllDay && (
            <Badge variant="secondary">Tum Gun</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
