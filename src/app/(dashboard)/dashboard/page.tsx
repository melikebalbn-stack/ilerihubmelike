"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bell, UtensilsCrossed, ClipboardList, AlertTriangle, Clock, CheckCircle2, Lightbulb, ThumbsUp, XCircle, ArrowRight, Megaphone, Pin, Calendar, Video, MapPin, Headphones, ChevronLeft, ChevronRight, FolderSync, GraduationCap, Settings2, RefreshCw, Eye, EyeOff, GripVertical, X, Check, LayoutDashboard, Users, FileText, Shield, Briefcase, Wrench, Activity, TrendingUp, Ticket } from "lucide-react"
import { useSession } from "next-auth/react"
import { useAuthenticatedData } from "@/hooks/use-authenticated-data"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import AnimatedNumber from "@/components/dashboard/AnimatedNumber"
import ModuleCarousel from "@/components/dashboard/ModuleCarousel"
import { AcmeCertCard } from "@/components/dashboard/AcmeCertCard"

// Yemek menüsü verileri
interface DailyMenu {
  date: string // YYYY-MM-DD
  dayName: string
  items: string[]
  isHoliday?: boolean
  holidayName?: string
}

// Gün adları
const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

// Haftalık boş menü oluştur (API'den veri gelmezse)
const createEmptyWeekMenu = (weekStart: Date): DailyMenu[] => {
  const result: DailyMenu[] = []

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    result.push({
      date: dateStr,
      dayName: dayNames[dayOfWeek],
      items: [],
      isHoliday: isWeekend,
      holidayName: isWeekend ? dayNames[dayOfWeek] : undefined
    })
  }

  return result
}

interface Task {
  id: string
  title: string
  dueDate: string
  status: string
  priority: string
  category?: {
    name: string
    color: string
  }
}

interface PendingSuggestion {
  id: string
  suggestionNumber: string
  title: string
  submittedByName: string
  submittedAt: string
}

interface SuggestionUpdate {
  id: string
  suggestionNumber: string
  title: string
  status: string
  statusLabel: string
  statusType: 'success' | 'error' | 'warning' | 'info'
  decisionDate: string
  decisionComment?: string | null
}

interface SystemNotice {
  enabled: boolean
  title: string
  message: string
}

interface LatestAnnouncement {
  id: string
  title: string
  summary: string | null
  priority: string
  isPinned: boolean
  publishedAt: string | null
  createdAt: string
  isRead: boolean
  category: {
    name: string
    color: string | null
  } | null
}

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

interface TicketStats {
  summary: {
    totalOpen: number
    totalNew: number
    myOpenTickets: number
    assignedToMe: number
  }
  recentTickets: Array<{
    id: string
    ticketNumber: string
    subject: string
    status: string
    priority: string
    createdAt: string
    requesterName: string
  }>
}

// Dashboard istatistikleri
interface DashboardStats {
  stats: {
    employees: { total: number; label: string }
    devices: { total: number; upcoming: number; label: string }
    suggestions: { pending: number; label: string }
    tickets: { open: number; label: string }
  }
  myTasks: {
    suggestions: number
    tickets: number
  }
  upcomingCalibrations: Array<{
    id: string
    deviceCode: string
    deviceName: string
    location: string
    nextCalibrationDate: string
    daysLeft: number
  }>
  recentActivities: Array<{
    type: 'suggestion' | 'calibration'
    id: string
    title: string
    status: string
    date: string
    user: string | null
  }>
  isAdmin: boolean
}

// Widget tanımları
type WidgetId = 'tasks' | 'calendar' | 'menu' | 'tickets' | 'announcements' | 'quickAccess' | 'systemInfo' | 'upcomingCalibrations' | 'recentActivities'

interface WidgetConfig {
  id: WidgetId
  name: string
  icon: React.ReactNode
  description: string
}

const WIDGET_CONFIGS: WidgetConfig[] = [
  { id: 'tasks', name: 'Bana Atanan Görevler', icon: <ClipboardList className="h-4 w-4" />, description: 'Görev listesi ve durumları' },
  { id: 'calendar', name: 'Bugünkü Toplantılarım', icon: <Calendar className="h-4 w-4" />, description: 'Outlook takvim etkinlikleri' },
  { id: 'menu', name: 'Yemek Menüsü', icon: <UtensilsCrossed className="h-4 w-4" />, description: 'Günlük yemek menüsü' },
  { id: 'tickets', name: 'IT Destek', icon: <Headphones className="h-4 w-4" />, description: 'Teknik destek talepleri' },
  { id: 'announcements', name: 'Son Duyurular', icon: <Megaphone className="h-4 w-4" />, description: 'Şirket duyuruları' },
  { id: 'upcomingCalibrations', name: 'Yaklaşan Kalibrasyonlar', icon: <Wrench className="h-4 w-4" />, description: '30 gün içindeki kalibrasyonlar' },
  { id: 'recentActivities', name: 'Son Aktiviteler', icon: <Activity className="h-4 w-4" />, description: 'Sistemdeki son hareketler' },
  { id: 'quickAccess', name: 'Hızlı Erişim', icon: <LayoutDashboard className="h-4 w-4" />, description: 'Sık kullanılan modüller' },
  { id: 'systemInfo', name: 'Sistem Bilgileri', icon: <Settings2 className="h-4 w-4" />, description: 'Teknik detaylar' },
]

// Hızlı erişim modül tanımları
interface QuickAccessModule {
  id: string
  name: string
  href: string
  icon: React.ReactNode
  color: string
}

const ALL_QUICK_ACCESS_MODULES: QuickAccessModule[] = [
  { id: 'it-support', name: 'IT Destek Merkezi', href: '/it-support', icon: <Headphones className="h-4 w-4" />, color: 'text-green-500' },
  { id: 'tasks', name: 'Planlı Görevler', href: '/tasks', icon: <ClipboardList className="h-4 w-4" />, color: 'text-blue-500' },
  { id: 'suggestions', name: 'Öneri Sistemi', href: '/suggestions', icon: <Lightbulb className="h-4 w-4" />, color: 'text-amber-500' },
  { id: 'meetings', name: 'Toplantılar', href: '/meetings', icon: <Users className="h-4 w-4" />, color: 'text-indigo-500' },
  { id: 'iso27001', name: 'ISO 27001 BGYS', href: '/iso27001', icon: <Shield className="h-4 w-4" />, color: 'text-emerald-500' },
  { id: 'forms', name: 'Formlar', href: '/forms', icon: <FileText className="h-4 w-4" />, color: 'text-purple-500' },
  { id: 'calibration', name: 'Kalibrasyon Takibi', href: '/calibration', icon: <Settings2 className="h-4 w-4" />, color: 'text-orange-500' },
  { id: 'strategic-hr', name: 'Stratejik İK', href: '/strategic-hr/recruitment', icon: <Briefcase className="h-4 w-4" />, color: 'text-pink-500' },
  { id: 'announcements', name: 'Duyurular', href: '/announcements', icon: <Megaphone className="h-4 w-4" />, color: 'text-violet-500' },
  { id: 'settings', name: 'Ayarlar', href: '/settings', icon: <Settings2 className="h-4 w-4" />, color: 'text-gray-500' },
]

// Dashboard ayarları tipi
interface DashboardSettings {
  visibleWidgets: WidgetId[]
  quickAccessModules: string[]
}

const DEFAULT_SETTINGS: DashboardSettings = {
  visibleWidgets: ['tasks', 'calendar', 'menu', 'tickets', 'announcements', 'upcomingCalibrations', 'recentActivities', 'quickAccess'],
  quickAccessModules: ['it-support', 'tasks', 'suggestions', 'meetings', 'calibration', 'settings']
}

// localStorage key
const DASHBOARD_SETTINGS_KEY = 'ilerihub_dashboard_settings'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [pendingSuggestions, setPendingSuggestions] = useState<PendingSuggestion[]>([])
  const [mySuggestionUpdates, setMySuggestionUpdates] = useState<SuggestionUpdate[]>([])
  const [systemNotice, setSystemNotice] = useState<SystemNotice | null>(null)
  const [latestAnnouncements, setLatestAnnouncements] = useState<LatestAnnouncement[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null)
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)

  // Dashboard özelleştirme state'leri
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS)
  const [tempSettings, setTempSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [refreshingWidget, setRefreshingWidget] = useState<string | null>(null)

  // IT Ekibi kontrolü: IT_MANAGER/ADMIN rolü VEYA Sistem Geliştirme OU'sunda
  const userOu = (session?.user?.ou || "").toLowerCase()
  const userDept = (session?.user?.department || "").toLowerCase()
  const isITStaff = session?.user?.role === "IT_MANAGER" ||
    session?.user?.role === "ADMIN" ||
    session?.user?.role === "SUPER_ADMIN" ||
    userOu.includes("sistem") ||
    userOu.includes("bilgi teknoloji") ||
    userOu.includes("information") ||
    userOu.includes("it") ||
    (!userOu && (userDept.includes("sistem") || userDept.includes("bilgi teknoloji") || userDept.includes("information")))

  // Yemek menüsü state'leri
  const [selectedMenuDate, setSelectedMenuDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Pazartesi'ye git
    return new Date(today.setDate(diff))
  })
  const [weeklyMenu, setWeeklyMenu] = useState<DailyMenu[]>([])

  // localStorage'dan ayarları yükle
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DASHBOARD_SETTINGS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setSettings(parsed)
        setTempSettings(parsed)
      }
    } catch (e) {
      console.error('Dashboard ayarları yüklenemedi:', e)
    }
  }, [])

  // Ayarları kaydet
  const saveSettings = () => {
    setSettings(tempSettings)
    localStorage.setItem(DASHBOARD_SETTINGS_KEY, JSON.stringify(tempSettings))
    setSettingsOpen(false)
  }

  // Widget görünürlüğünü toggle et
  const toggleWidget = (widgetId: WidgetId) => {
    setTempSettings(prev => {
      const isVisible = prev.visibleWidgets.includes(widgetId)
      return {
        ...prev,
        visibleWidgets: isVisible
          ? prev.visibleWidgets.filter(id => id !== widgetId)
          : [...prev.visibleWidgets, widgetId]
      }
    })
  }

  // Hızlı erişim modülünü toggle et
  const toggleQuickAccess = (moduleId: string) => {
    setTempSettings(prev => {
      const isSelected = prev.quickAccessModules.includes(moduleId)
      if (isSelected) {
        return {
          ...prev,
          quickAccessModules: prev.quickAccessModules.filter(id => id !== moduleId)
        }
      } else if (prev.quickAccessModules.length < 6) {
        return {
          ...prev,
          quickAccessModules: [...prev.quickAccessModules, moduleId]
        }
      }
      return prev
    })
  }

  // Haftalık menüyü API'den yükle
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const weekStartStr = weekStart.toISOString().split('T')[0]
        const res = await fetch(`/api/menu?weekStart=${weekStartStr}`)

        if (res.ok) {
          const apiMenus = await res.json()

          // API'den gelen verileri haftanın günleriyle birleştir
          const emptyWeek = createEmptyWeekMenu(weekStart)

          // API'den gelen verileri map'e çevir
          const menuMap = new Map<string, { items: string[], isHoliday?: boolean, holidayName?: string }>()
          for (const menu of apiMenus) {
            menuMap.set(menu.date, {
              items: menu.items || [],
              isHoliday: menu.isHoliday,
              holidayName: menu.holidayName
            })
          }

          // Boş haftayı API verileriyle güncelle
          const mergedMenu = emptyWeek.map(day => {
            const apiData = menuMap.get(day.date)
            if (apiData) {
              return {
                ...day,
                items: apiData.items,
                isHoliday: apiData.isHoliday ?? day.isHoliday,
                holidayName: apiData.holidayName ?? day.holidayName
              }
            }
            return day
          })

          setWeeklyMenu(mergedMenu)
        } else {
          // API hatası durumunda boş menü göster
          setWeeklyMenu(createEmptyWeekMenu(weekStart))
        }
      } catch {
        // Hata durumunda boş menü göster
        setWeeklyMenu(createEmptyWeekMenu(weekStart))
      }
    }

    fetchMenu()
  }, [weekStart])

  // Seçili günün menüsü
  const selectedDayMenu = weeklyMenu.find(m => m.date === selectedMenuDate)

  // Önceki/sonraki hafta
  const goToPreviousWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(weekStart.getDate() - 7)
    setWeekStart(newStart)
  }

  const goToNextWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(weekStart.getDate() + 7)
    setWeekStart(newStart)
  }

  // Bugüne git
  const goToToday = () => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    setWeekStart(new Date(today.setDate(diff)))
    setSelectedMenuDate(new Date().toISOString().split('T')[0])
  }

  // Veri yükleme fonksiyonları
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?viewMode=my&limit=5')
      if (res.ok) {
        const data = await res.json()
        setMyTasks(data)
      }
    } catch (error) {
      console.error('Görevler yüklenirken hata:', error)
    }
  }, [])

  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/events?range=today')
      if (res.ok) {
        const data = await res.json()
        if (data.error) {
          setCalendarError(data.message || 'Takvim yuklenemedi')
        } else {
          setCalendarEvents(data.events || [])
          setCalendarError(null)
        }
      }
    } catch (error) {
      console.error('Takvim yüklenirken hata:', error)
    }
  }, [])

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch('/api/tickets/stats')
      if (res.ok) {
        const data = await res.json()
        setTicketStats(data)
      }
    } catch (error) {
      console.error('Ticket istatistikleri yüklenirken hata:', error)
    }
  }, [])

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch('/api/announcements?limit=5')
      if (res.ok) {
        const data = await res.json()
        setLatestAnnouncements(data.announcements || [])
      }
    } catch (error) {
      console.error('Duyurular yüklenirken hata:', error)
    }
  }, [])

  const fetchDashboardStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setDashboardStats(data.data)
        }
      }
    } catch (error) {
      console.error('Dashboard istatistikleri yüklenirken hata:', error)
    }
  }, [])

  // Widget yenileme fonksiyonu
  const refreshWidget = async (widgetId: string) => {
    setRefreshingWidget(widgetId)
    try {
      switch (widgetId) {
        case 'tasks':
          await fetchTasks()
          break
        case 'calendar':
          await fetchCalendar()
          break
        case 'tickets':
          await fetchTickets()
          break
        case 'announcements':
          await fetchAnnouncements()
          break
      }
    } finally {
      setTimeout(() => setRefreshingWidget(null), 500)
    }
  }

  // Dashboard verilerini yükle (loading/auth-gate/timeout artık useAuthenticatedData'da —
  // önceden status beklemesi ve timeout sigortası yoktu, hook kazandırır).
  const fetchData = async () => {
    try {
      // Görevleri, bekleyen önerileri, kendi önerilerimin güncellemelerini, sistem notunu, duyuruları, takvimi, ticket ve dashboard istatistiklerini paralel olarak yükle
      const [tasksRes, suggestionsRes, myUpdatesRes, systemRes, announcementsRes, calendarRes, ticketsRes, dashboardStatsRes] = await Promise.all([
        fetch('/api/tasks?viewMode=my&limit=5'),
        fetch('/api/suggestions?viewMode=awaiting_my_approval&limit=5'),
        fetch('/api/suggestions/my-updates?limit=5'),
        fetch('/api/system/settings?category=dashboard'),
        fetch('/api/announcements?limit=5'),
        fetch('/api/calendar/events?range=today'),
        fetch('/api/tickets/stats'),
        fetch('/api/dashboard/stats')
      ])

      if (tasksRes.ok) {
        const data = await tasksRes.json()
        setMyTasks(data)
      }

      if (suggestionsRes.ok) {
        const data = await suggestionsRes.json()
        setPendingSuggestions(data)
      }

      if (myUpdatesRes.ok) {
        const data = await myUpdatesRes.json()
        setMySuggestionUpdates(data)
      }

      if (systemRes.ok) {
        const settings = await systemRes.json()
        if (settings['system_notice_enabled'] === 'true') {
          setSystemNotice({
            enabled: true,
            title: settings['system_notice_title'] || '',
            message: settings['system_notice_message'] || ''
          })
        }
      }

      if (announcementsRes.ok) {
        const data = await announcementsRes.json()
        setLatestAnnouncements(data.announcements || [])
      }

      if (calendarRes.ok) {
        const data = await calendarRes.json()
        if (data.error) {
          setCalendarError(data.message || 'Takvim yuklenemedi')
        } else {
          setCalendarEvents(data.events || [])
        }
      }

      if (ticketsRes.ok) {
        const data = await ticketsRes.json()
        setTicketStats(data)
      }

      if (dashboardStatsRes.ok) {
        const data = await dashboardStatsRes.json()
        if (data.success) {
          setDashboardStats(data.data)
        }
      }
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error)
    }
  }

  const { loading } = useAuthenticatedData(fetchData)

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <Badge variant="destructive" className="text-xs">Kritik</Badge>
      case 'HIGH':
        return <Badge className="bg-orange-500 text-xs">Yüksek</Badge>
      case 'NORMAL':
        return <Badge variant="secondary" className="text-xs">Normal</Badge>
      case 'LOW':
        return <Badge variant="outline" className="text-xs">Düşük</Badge>
      default:
        return null
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OVERDUE':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'IN_PROGRESS':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  }

  const overdueTasks = myTasks.filter(t => t.status === 'OVERDUE').length
  const pendingTasks = myTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length

  // Widget görünürlük kontrolü
  const isWidgetVisible = (widgetId: WidgetId) => settings.visibleWidgets.includes(widgetId)

  // Seçili hızlı erişim modülleri
  const selectedQuickAccessModules = ALL_QUICK_ACCESS_MODULES.filter(m =>
    settings.quickAccessModules.includes(m.id)
  )

  return (
    <div className="space-y-6">
      {/* Welcome Section with Quick Links */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Hoş geldiniz, {session?.user?.name || 'Kullanıcı'}
          </p>
        </div>

        {/* Hızlı Erişim Butonları ve Ayarlar */}
        <div className="flex gap-2 flex-wrap">
          <a
            href="http://transfer.ilerigroup.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-blue-700 dark:text-blue-300"
          >
            <FolderSync className="h-4 w-4" />
            <span className="text-sm font-medium hidden sm:inline">Dosya Transferi</span>
          </a>
          <a
            href="/api/sso/akademi"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-indigo-700 dark:text-indigo-300"
          >
            <GraduationCap className="h-4 w-4" />
            <span className="text-sm font-medium hidden sm:inline">ILERI Akademi</span>
          </a>

          {/* Dashboard Özelleştirme Butonu */}
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Özelleştir</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  Dashboard Özelleştir
                </DialogTitle>
                <DialogDescription>
                  Görüntülemek istediğiniz widget'ları ve hızlı erişim modüllerini seçin.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Widget Ayarları */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Görünür Widget'lar
                  </h4>
                  <div className="space-y-3">
                    {WIDGET_CONFIGS.map(widget => (
                      <div key={widget.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            {widget.icon}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{widget.name}</p>
                            <p className="text-xs text-muted-foreground">{widget.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={tempSettings.visibleWidgets.includes(widget.id)}
                          onCheckedChange={() => toggleWidget(widget.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Hızlı Erişim Modülleri */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    Hızlı Erişim Modülleri
                    <Badge variant="secondary" className="ml-2">
                      {tempSettings.quickAccessModules.length}/6
                    </Badge>
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    En fazla 6 modül seçebilirsiniz
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ALL_QUICK_ACCESS_MODULES.map(module => {
                      const isSelected = tempSettings.quickAccessModules.includes(module.id)
                      const isDisabled = !isSelected && tempSettings.quickAccessModules.length >= 6
                      return (
                        <button
                          key={module.id}
                          onClick={() => toggleQuickAccess(module.id)}
                          disabled={isDisabled}
                          className={`
                            flex items-center gap-2 p-2 rounded-lg border transition-all text-left
                            ${isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : isDisabled
                                ? 'border-muted bg-muted/50 opacity-50 cursor-not-allowed'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            }
                          `}
                        >
                          <div className={`${module.color}`}>
                            {module.icon}
                          </div>
                          <span className="text-xs font-medium truncate">{module.name}</span>
                          {isSelected && <Check className="h-3 w-3 text-primary ml-auto" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => {
                  setTempSettings(settings)
                  setSettingsOpen(false)
                }}>
                  İptal
                </Button>
                <Button onClick={saveSettings}>
                  <Check className="h-4 w-4 mr-2" />
                  Kaydet
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sistem Notu / Duyuru */}
      {systemNotice && systemNotice.enabled && (systemNotice.title || systemNotice.message) && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            {systemNotice.title && (
              <p className="font-semibold text-amber-800 dark:text-amber-200">{systemNotice.title}</p>
            )}
            {systemNotice.message && (
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{systemNotice.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Genel Bakış İstatistikleri */}
      {dashboardStats && (
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Çalışan Sayısı */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-default">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{dashboardStats.stats.employees.label}</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400"><AnimatedNumber value={dashboardStats.stats.employees.total} /></p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Aktif Cihaz */}
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/50 dark:to-orange-900/30 border-orange-200 dark:border-orange-800 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-default">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{dashboardStats.stats.devices.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400"><AnimatedNumber value={dashboardStats.stats.devices.total} /></p>
                    {dashboardStats.stats.devices.upcoming > 0 && (
                      <span className="text-xs text-orange-500">({dashboardStats.stats.devices.upcoming} yaklaşan)</span>
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-full bg-orange-500/10">
                  <Wrench className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bekleyen Öneriler */}
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-default">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{dashboardStats.stats.suggestions.label}</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400"><AnimatedNumber value={dashboardStats.stats.suggestions.pending} /></p>
                </div>
                <div className="p-3 rounded-full bg-amber-500/10">
                  <Lightbulb className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Açık Ticketlar */}
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-default">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{dashboardStats.stats.tickets.label}</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400"><AnimatedNumber value={dashboardStats.stats.tickets.open} /></p>
                </div>
                <div className="p-3 rounded-full bg-green-500/10">
                  <Ticket className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hızlı Erişim Carousel */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-400">
            Hizli Erisim
          </span>
        </div>
        <ModuleCarousel />
      </div>

      {/* Onay Bekleyen Öneriler - Alert Banner */}
      {pendingSuggestions.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <Lightbulb className="h-5 w-5" />
                Onayınızı Bekleyen Öneriler
                <Badge className="bg-amber-600 text-white ml-2">{pendingSuggestions.length}</Badge>
              </CardTitle>
              <Link
                href="/suggestions?viewMode=awaiting_my_approval"
                className="text-sm text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 hover:underline"
              >
                Tümünü Gör →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {pendingSuggestions.slice(0, 3).map((suggestion) => (
                <Link
                  key={suggestion.id}
                  href={`/suggestions/${suggestion.id}`}
                  className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-900/20 p-3 hover:bg-amber-100/50 dark:hover:bg-amber-900/40 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <ThumbsUp className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{suggestion.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {suggestion.suggestionNumber} • {suggestion.submittedByName} • {formatDate(suggestion.submittedAt)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-2 border-amber-400 text-amber-700 dark:text-amber-300">
                    Onay Bekliyor
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Önerilerimde Son Gelişmeler */}
      {mySuggestionUpdates.length > 0 && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <Bell className="h-5 w-5" />
                Önerilerimde Son Gelişmeler
              </CardTitle>
              <Link
                href="/suggestions?viewMode=my"
                className="text-sm text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100 hover:underline"
              >
                Tüm Önerilerim →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {mySuggestionUpdates.slice(0, 3).map((update) => (
                <Link
                  key={update.id}
                  href={`/suggestions/${update.id}`}
                  className="flex items-center justify-between rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-blue-900/20 p-3 hover:bg-blue-100/50 dark:hover:bg-blue-900/40 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {update.statusType === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />}
                    {update.statusType === 'error' && <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />}
                    {update.statusType === 'warning' && <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />}
                    {update.statusType === 'info' && <ArrowRight className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{update.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {update.suggestionNumber} • {formatDate(update.decisionDate)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      update.statusType === 'success' ? 'border-green-400 text-green-700 dark:text-green-300' :
                      update.statusType === 'error' ? 'border-red-400 text-red-700 dark:text-red-300' :
                      update.statusType === 'warning' ? 'border-amber-400 text-amber-700 dark:text-amber-300' :
                      'border-blue-400 text-blue-700 dark:text-blue-300'
                    }
                  >
                    {update.statusLabel}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Bana Atanan Görevler - Büyük Kart */}
        {isWidgetVisible('tasks') && (
          <Card className="md:col-span-2 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-500" />
                  Bana Atanan Görevler
                </CardTitle>
                <CardDescription>
                  {overdueTasks > 0 && (
                    <span className="text-red-500 font-medium">{overdueTasks} gecikmiş, </span>
                  )}
                  {pendingTasks} bekleyen görev
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => refreshWidget('tasks')}
                  disabled={refreshingWidget === 'tasks'}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshingWidget === 'tasks' ? 'animate-spin' : ''}`} />
                </Button>
                <Link
                  href="/tasks?viewMode=my"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Tümünü Gör →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="classic-spinner" />
                </div>
              ) : myTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Size atanmış görev bulunmuyor</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myTasks.slice(0, 3).map((task) => (
                    <Link
                      key={task.id}
                      href={`/tasks?highlight=${task.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getStatusIcon(task.status)}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {task.category && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: task.category.color + '20',
                                  color: task.category.color
                                }}
                              >
                                {task.category.name}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(task.dueDate)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-2">
                        {getPriorityBadge(task.priority)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bugunku Toplantilarim */}
        {isWidgetVisible('calendar') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-500" />
                  Bugunku Toplantilarim
                </CardTitle>
                <CardDescription>
                  Outlook takviminizdeki toplantilar
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => refreshWidget('calendar')}
                  disabled={refreshingWidget === 'calendar'}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshingWidget === 'calendar' ? 'animate-spin' : ''}`} />
                </Button>
                <Link
                  href="/calendar"
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Detay →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {calendarError ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{calendarError}</p>
                </div>
              ) : calendarEvents.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Bugun toplantiniz yok</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {calendarEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex flex-col items-center min-w-[50px] text-center">
                        <span className="text-sm font-bold text-indigo-600">{event.startTime}</span>
                        <span className="text-xs text-muted-foreground">{event.endTime}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{event.subject}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {event.isOnline ? (
                            <span className="flex items-center gap-1">
                              <Video className="h-3 w-3" />
                              {event.onlineMeetingUrl ? (
                                <a
                                  href={event.onlineMeetingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Teams
                                </a>
                              ) : (
                                'Online'
                              )}
                            </span>
                          ) : event.location ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  {calendarEvents.length > 5 && (
                    <p className="text-xs text-center text-muted-foreground pt-2">
                      +{calendarEvents.length - 5} toplanti daha
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Günün Yemeği - Takvimli */}
        {isWidgetVisible('menu') && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-orange-500" />
                  Yemek Menüsü
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs h-7 px-2">
                  Bugün
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Hafta Navigasyonu */}
              <div className="flex items-center justify-between mb-3">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium text-muted-foreground">
                  {weekStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} - {
                    new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
                  }
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Mini Takvim - Haftanın Günleri */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-3">
                {weeklyMenu.map((day) => {
                  const isToday = day.date === new Date().toISOString().split('T')[0]
                  const isSelected = day.date === selectedMenuDate
                  const isWeekend = day.dayName === 'Cumartesi' || day.dayName === 'Pazar'
                  const dayNum = new Date(day.date).getDate()

                  return (
                    <button
                      key={day.date}
                      onClick={() => setSelectedMenuDate(day.date)}
                      className={`
                        flex flex-col items-center p-1 sm:p-1.5 rounded-lg transition-all text-center min-h-[44px] sm:min-h-0
                        ${isSelected
                          ? 'bg-orange-500 text-white shadow-md'
                          : isToday
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 ring-1 ring-orange-300'
                            : isWeekend
                              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                              : 'hover:bg-orange-50 dark:hover:bg-orange-900/20'
                        }
                      `}
                    >
                      <span className="text-[9px] sm:text-[10px] font-medium">{day.dayName.slice(0, 2)}</span>
                      <span className={`text-xs sm:text-sm font-bold ${isSelected ? '' : isToday ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                        {dayNum}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Seçili Günün Menüsü */}
              {selectedDayMenu && (
                <div className={`rounded-lg p-3 border ${
                  selectedDayMenu.isHoliday
                    ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                    : 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900'
                }`}>
                  <p className={`text-xs font-medium mb-2 ${
                    selectedDayMenu.isHoliday
                      ? 'text-gray-500'
                      : 'text-orange-600 dark:text-orange-400'
                  }`}>
                    {new Date(selectedDayMenu.date).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      weekday: 'long'
                    })}
                  </p>

                  {selectedDayMenu.isHoliday ? (
                    <div className="text-center py-3">
                      <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-500">{selectedDayMenu.holidayName || 'Tatil'}</p>
                      <p className="text-xs text-gray-400 mt-1">Yemek servisi yok</p>
                    </div>
                  ) : selectedDayMenu.items.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedDayMenu.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                          <p className="text-sm font-medium">{item}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-3">
                      <p className="text-sm text-muted-foreground">Menü henüz belirlenmedi</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* IT Destek Taleplerim */}
        {isWidgetVisible('tickets') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-green-500" />
                  IT Destek
                </CardTitle>
                <CardDescription>
                  Teknik destek talepleriniz
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => refreshWidget('tickets')}
                  disabled={refreshingWidget === 'tickets'}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshingWidget === 'tickets' ? 'animate-spin' : ''}`} />
                </Button>
                <Link
                  href="/it-support"
                  className="text-sm text-green-600 hover:underline"
                >
                  Taleplerim →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {ticketStats ? (
                <div className="space-y-3">
                  <div className={`grid gap-2 ${isITStaff ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{ticketStats.summary.myOpenTickets}</p>
                      <p className="text-xs text-muted-foreground">Acik Taleplerim</p>
                    </div>
                    {isITStaff && (
                      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
                        <p className="text-2xl font-bold text-blue-600">{ticketStats.summary.totalOpen}</p>
                        <p className="text-xs text-muted-foreground">Toplam Acik</p>
                      </div>
                    )}
                  </div>
                  {ticketStats.recentTickets.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground">Son Talepler</p>
                      {ticketStats.recentTickets.slice(0, 3).map((ticket) => (
                        <Link
                          key={ticket.id}
                          href="/it-support"
                          className="flex items-center justify-between rounded-lg border p-2 hover:bg-muted/50 transition-colors text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
                            <span className="truncate">{ticket.subject}</span>
                          </div>
                          <Badge variant={ticket.status === 'NEW' ? 'default' : 'secondary'} className="ml-2 text-xs">
                            {ticket.status === 'NEW' ? 'Yeni' : ticket.status === 'IN_PROGRESS' ? 'Islemde' : ticket.status === 'RESOLVED' ? 'Cozuldu' : ticket.status}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                  <Link
                    href="/it-support"
                    className="block w-full text-center text-sm text-green-600 hover:underline pt-2"
                  >
                    + Yeni Talep Olustur
                  </Link>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Headphones className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">Yukluyor...</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Son Duyurular */}
        {isWidgetVisible('announcements') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-purple-500" />
                  Son Duyurular
                </CardTitle>
                <CardDescription>
                  Sirket haberlerinden haberdar olun
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => refreshWidget('announcements')}
                  disabled={refreshingWidget === 'announcements'}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshingWidget === 'announcements' ? 'animate-spin' : ''}`} />
                </Button>
                <Link
                  href="/announcements"
                  className="text-sm text-purple-600 hover:underline"
                >
                  Tumunu Gor →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {latestAnnouncements.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Henuz duyuru yok</p>
                </div>
              ) : (
                latestAnnouncements.slice(0, 4).map((announcement) => (
                  <Link
                    key={announcement.id}
                    href={`/announcements/${announcement.id}`}
                    className={`flex items-start gap-2 rounded-lg border p-3 hover:bg-muted/50 transition-colors ${
                      !announcement.isRead ? 'border-l-4 border-l-purple-500' : ''
                    } ${announcement.priority === 'URGENT' ? 'bg-red-50 dark:bg-red-950/20 border-red-200' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {announcement.isPinned && (
                          <Pin className="h-3 w-3 text-purple-500 flex-shrink-0" />
                        )}
                        <p className={`text-sm font-medium truncate ${!announcement.isRead ? 'text-purple-600' : ''}`}>
                          {announcement.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {announcement.category && (
                          <Badge
                            variant="outline"
                            className="text-xs px-1 py-0"
                            style={{
                              backgroundColor: announcement.category.color ? `${announcement.category.color}20` : undefined,
                              color: announcement.category.color || undefined,
                              borderColor: announcement.category.color || undefined
                            }}
                          >
                            {announcement.category.name}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(announcement.publishedAt || announcement.createdAt)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Yaklaşan Kalibrasyonlar */}
        {isWidgetVisible('upcomingCalibrations') && dashboardStats && dashboardStats.upcomingCalibrations.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-orange-500" />
                  Yaklaşan Kalibrasyonlar
                </CardTitle>
                <CardDescription>
                  30 gün içinde kalibrasyon gereken cihazlar
                </CardDescription>
              </div>
              <Link
                href="/calibration"
                className="text-sm text-orange-600 hover:underline"
              >
                Tümünü Gör →
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dashboardStats.upcomingCalibrations.map((cal) => (
                  <Link
                    key={cal.id}
                    href={`/calibration/devices/${cal.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full ${
                        cal.daysLeft <= 7 ? 'bg-red-500' : cal.daysLeft <= 14 ? 'bg-amber-500' : 'bg-green-500'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{cal.deviceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {cal.deviceCode} {cal.location && `• ${cal.location}`}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={cal.daysLeft <= 7 ? 'destructive' : cal.daysLeft <= 14 ? 'default' : 'secondary'}
                      className="ml-2"
                    >
                      {cal.daysLeft} gün
                    </Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Son Aktiviteler */}
        {isWidgetVisible('recentActivities') && dashboardStats && dashboardStats.recentActivities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-500" />
                Son Aktiviteler
              </CardTitle>
              <CardDescription>
                Sistemdeki son hareketler
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dashboardStats.recentActivities.slice(0, 5).map((activity) => (
                  <Link
                    key={`${activity.type}-${activity.id}`}
                    href={activity.type === 'suggestion' ? `/suggestions/${activity.id}` : `/calibration/devices`}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`p-2 rounded-full ${
                      activity.type === 'suggestion' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {activity.type === 'suggestion' ? (
                        <Lightbulb className="h-4 w-4" />
                      ) : (
                        <Wrench className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.user || 'Sistem'} • {formatDate(activity.date)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {activity.type === 'suggestion'
                        ? activity.status === 'PENDING' ? 'Bekliyor' : activity.status === 'APPROVED' ? 'Onaylı' : activity.status
                        : activity.status === 'PASS' ? 'Geçti' : 'Kaldı'}
                    </Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Hızlı Erişim kaldırıldı - Carousel olarak üst kısımda gösteriliyor */}

        {/* Sistem Bilgileri */}
        {isWidgetVisible('systemInfo') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Sistem Bilgileri
              </CardTitle>
              <CardDescription>
                Teknik detaylar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Framework:</span>
                  <span className="font-medium">Next.js 15.5.9</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Database:</span>
                  <span className="font-medium">PostgreSQL 14</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auth:</span>
                  <span className="font-medium">Active Directory</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Server:</span>
                  <span className="font-medium">172.16.16.33:3000</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TLS Sertifika Monitor — sadece admin.system.manage permission'a sahip kullanıcılara görünür */}
        <AcmeCertCard />
      </div>
    </div>
  )
}
