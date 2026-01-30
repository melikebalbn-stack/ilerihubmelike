'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import {
  CalendarDays,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  RefreshCw,
  Tag,
  User,
  Bell,
  ChevronDown,
  MoreVertical,
  Calendar,
  Check,
  Circle,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  Users,
  Building2,
  ListTodo
} from 'lucide-react'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { UserSearchCombobox, type ADUser } from '@/components/user-search-combobox'

type TaskCategory = {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  _count?: { tasks: number }
}

type ResponsiblePerson = {
  name: string
  email: string
}

type PlannedTask = {
  id: string
  title: string
  description: string | null
  categoryId: string | null
  category: TaskCategory | null
  dueDate: string
  startDate: string | null
  completedDate: string | null
  isRecurring: boolean
  recurrenceType: string | null
  recurrenceInterval: number | null
  reminderDays: number[]
  responsiblePerson: string | null
  responsiblePersonEmail: string | null
  responsibleDepartment: string | null
  responsiblePersons: string | null // JSON string
  responsibleDepartments: string[]
  notificationEmails: string[]
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE'
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  notes: string | null
  createdAt: string
  // Eskalasyon alanları
  escalationEnabled: boolean
  escalationCategory: string | null
  escalationPriority: string | null
}

type Department = {
  id: string
  name: string
  code: string
  adOuName: string | null
  adOuDn: string | null
  sortOrder: number
}

const statusLabels: Record<string, string> = {
  PENDING: 'Bekliyor',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal Edildi',
  OVERDUE: 'Gecikmiş',
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  OVERDUE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const priorityLabels: Record<string, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik',
}

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  NORMAL: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300',
  CRITICAL: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
}

const recurrenceLabels: Record<string, string> = {
  DAILY: 'Günlük',
  WEEKLY: 'Haftalık',
  MONTHLY: 'Aylık',
  QUARTERLY: '3 Aylık',
  SEMI_ANNUAL: '6 Aylık',
  YEARLY: 'Yıllık',
}

// Eskalasyon Kategorileri
const escalationCategories: { value: string; label: string; description: string }[] = [
  { value: 'CUSTOMER_LINE_STOP', label: 'Müşteri Hat Durması', description: 'OEM müşterinin üretim hattı durdu' },
  { value: 'PRODUCT_SAFETY', label: 'Ürün Güvenliği Sorunu', description: 'Güvenlik riski taşıyan ürün problemi' },
  { value: 'RECALL', label: 'Geri Çağırma (Recall)', description: 'Ürün geri çağırma durumu' },
  { value: 'CONTROLLED_SHIPPING', label: 'Kontrollü Sevkiyat (CS1/CS2)', description: 'OEM tarafından kontrollü sevkiyat talebi' },
  { value: 'SERIOUS_ACCIDENT', label: 'Ciddi İş Kazası', description: 'Ölümlü veya ağır yaralanmalı kaza' },
  { value: 'ENVIRONMENTAL_INCIDENT', label: 'Çevresel Olay', description: 'Tehlikeli madde sızıntısı veya çevre kirliliği' },
  { value: 'CRITICAL_SUPPLY_ISSUE', label: 'Kritik Tedarik Kesintisi', description: 'Üretimi durduracak tedarik problemi' },
]

// Eskalasyon Öncelik Seviyeleri
const escalationPriorities: { value: string; label: string; description: string; color: string }[] = [
  { value: 'LEVEL_4_CRITICAL', label: 'Seviye 4 - Kritik', description: 'Anında CEO/GM bildirimi', color: 'bg-red-500' },
  { value: 'LEVEL_3_HIGH', label: 'Seviye 3 - Yüksek', description: '<2 saat içinde Direktör bildirimi', color: 'bg-orange-500' },
  { value: 'LEVEL_2_MEDIUM', label: 'Seviye 2 - Orta', description: '<24 saat içinde Müdür bildirimi', color: 'bg-yellow-500' },
  { value: 'LEVEL_1_LOW', label: 'Seviye 1 - Düşük', description: '<48 saat içinde Şef/Lider bildirimi', color: 'bg-blue-500' },
]

// Timeline types
type TimelinePeriod = {
  id: string
  dueDate: string
  status: string
  completedDate: string | null
  notes: string | null
  isRoot: boolean
}

type FuturePeriod = {
  dueDate: string
  status: 'FUTURE'
  isProjected: true
}

type TimelineData = {
  rootTask: {
    id: string
    title: string
    description: string | null
    category: TaskCategory | null
    isRecurring: boolean
    recurrenceType: string | null
    recurrenceInterval: number | null
    responsiblePerson: string | null
    responsibleDepartment: string | null
    priority: string
  }
  periods: TimelinePeriod[]
  futurePeriods: FuturePeriod[]
}

// Radar chart config
const departmentChartConfig: ChartConfig = {
  tasks: {
    label: "Görev Sayısı",
    color: "hsl(var(--chart-1))",
  },
}

// View mode types
type ViewMode = 'my' | 'department' | 'subordinates' | 'all'

const viewModeLabels: Record<ViewMode, string> = {
  my: 'Benim Görevlerim',
  department: 'Departman Görevleri',
  subordinates: 'Ekibimin Görevleri',
  all: 'Tüm Görevler',
}

export default function TasksPage() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState<PlannedTask[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('my')

  // Kullanıcı rolüne göre gösterilecek tab'lar
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  // Modal states
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showTimelineModal, setShowTimelineModal] = useState(false)
  const [editingTask, setEditingTask] = useState<PlannedTask | null>(null)
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: '',
    dueDate: '',
    startDate: '',
    isRecurring: false,
    recurrenceType: '',
    recurrenceInterval: 1,
    reminderDays: [] as number[],
    responsiblePerson: '',
    responsiblePersonEmail: '',
    responsibleDepartment: '',
    responsiblePersons: [] as ResponsiblePerson[], // Çoklu kişiler
    responsibleDepartments: [] as string[], // Çoklu departmanlar
    notificationEmails: [] as string[],
    priority: 'NORMAL',
    notes: '',
    // Eskalasyon alanları
    escalationEnabled: false,
    escalationCategory: '',
    escalationPriority: '',
  })

  const [newEmail, setNewEmail] = useState('')

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
  })

  // Kategoriler ve departmanlar sadece sayfa yüklendiğinde çekilsin
  useEffect(() => {
    fetchCategories()
    fetchDepartments()
  }, [])

  // Görevler filtre değiştiğinde yeniden çekilsin
  useEffect(() => {
    fetchTasks()
  }, [searchTerm, statusFilter, priorityFilter, categoryFilter, viewMode])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('viewMode', viewMode)
      if (searchTerm) params.append('search', searchTerm)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (priorityFilter !== 'all') params.append('priority', priorityFilter)
      if (categoryFilter !== 'all') params.append('categoryId', categoryFilter)

      console.log('📋 Fetching tasks with params:', params.toString())
      const response = await fetch(`/api/tasks?${params.toString()}`)
      console.log('📋 Tasks API response status:', response.status, response.statusText)

      if (response.ok) {
        const data = await response.json()
        console.log('📋 Tasks data received:', data.length, 'tasks')
        setTasks(data)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('📋 Tasks API error:', response.status, errorData)
      }
    } catch (error) {
      console.error('Görevler alınamadı:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      console.log('📂 Fetching categories...')
      const response = await fetch('/api/tasks/categories')
      console.log('📂 Categories API response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('📂 Categories received:', data.length)
        setCategories(data)
      } else {
        console.error('📂 Categories API error:', response.status)
      }
    } catch (error) {
      console.error('Kategoriler alınamadı:', error)
    }
  }

  const fetchDepartments = async () => {
    try {
      console.log('🏢 Fetching departments...')
      const response = await fetch('/api/departments')
      console.log('🏢 Departments API response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('🏢 Departments received:', data.length)
        setDepartments(data)
      } else {
        console.error('🏢 Departments API error:', response.status)
      }
    } catch (error) {
      console.error('Departmanlar alınamadı:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks'
      const method = editingTask ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          reminderDays: formData.reminderDays.length > 0 ? formData.reminderDays : [30, 7, 1],
        }),
      })

      if (response.ok) {
        setShowTaskModal(false)
        resetForm()
        fetchTasks()
      } else {
        const error = await response.json()
        alert(error.error || 'Bir hata oluştu')
      }
    } catch (error) {
      console.error('Görev kaydedilemedi:', error)
      alert('Görev kaydedilemedi')
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        fetchTasks()
      }
    } catch (error) {
      console.error('Durum güncellenemedi:', error)
    }
  }

  const handleDelete = async (taskId: string) => {
    if (!confirm('Bu görevi silmek istediğinize emin misiniz?')) return

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchTasks()
      }
    } catch (error) {
      console.error('Görev silinemedi:', error)
    }
  }

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch('/api/tasks/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryFormData),
      })

      if (response.ok) {
        setShowCategoryModal(false)
        setCategoryFormData({ name: '', description: '', color: '#3b82f6' })
        fetchCategories()
      } else {
        const error = await response.json()
        alert(error.error || 'Bir hata oluştu')
      }
    } catch (error) {
      console.error('Kategori kaydedilemedi:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      categoryId: '',
      dueDate: '',
      startDate: '',
      isRecurring: false,
      recurrenceType: '',
      recurrenceInterval: 1,
      reminderDays: [],
      responsiblePerson: '',
      responsiblePersonEmail: '',
      responsibleDepartment: '',
      responsiblePersons: [],
      responsibleDepartments: [],
      notificationEmails: [],
      priority: 'NORMAL',
      notes: '',
      escalationEnabled: false,
      escalationCategory: '',
      escalationPriority: '',
    })
    setNewEmail('')
    setEditingTask(null)
  }

  const openEditModal = (task: PlannedTask) => {
    setEditingTask(task)

    // Çoklu kişileri parse et
    let parsedPersons: ResponsiblePerson[] = []
    if (task.responsiblePersons) {
      try {
        parsedPersons = JSON.parse(task.responsiblePersons)
      } catch {
        // Eski format veya hatalı JSON
        if (task.responsiblePerson && task.responsiblePersonEmail) {
          parsedPersons = [{ name: task.responsiblePerson, email: task.responsiblePersonEmail }]
        }
      }
    } else if (task.responsiblePerson && task.responsiblePersonEmail) {
      // Geriye uyumluluk: eski format
      parsedPersons = [{ name: task.responsiblePerson, email: task.responsiblePersonEmail }]
    }

    // Çoklu departmanları al
    let parsedDepartments: string[] = task.responsibleDepartments || []
    if (parsedDepartments.length === 0 && task.responsibleDepartment) {
      parsedDepartments = [task.responsibleDepartment]
    }

    setFormData({
      title: task.title,
      description: task.description || '',
      categoryId: task.categoryId || '',
      dueDate: task.dueDate.split('T')[0],
      startDate: task.startDate?.split('T')[0] || '',
      isRecurring: task.isRecurring,
      recurrenceType: task.recurrenceType || '',
      recurrenceInterval: task.recurrenceInterval || 1,
      reminderDays: task.reminderDays || [],
      responsiblePerson: task.responsiblePerson || '',
      responsiblePersonEmail: task.responsiblePersonEmail || '',
      responsibleDepartment: task.responsibleDepartment || '',
      responsiblePersons: parsedPersons,
      responsibleDepartments: parsedDepartments,
      notificationEmails: task.notificationEmails || [],
      priority: task.priority,
      notes: task.notes || '',
      escalationEnabled: task.escalationEnabled || false,
      escalationCategory: task.escalationCategory || '',
      escalationPriority: task.escalationPriority || '',
    })
    setNewEmail('')
    setShowTaskModal(true)
  }

  const getDaysRemaining = (dueDate: string) => {
    const now = new Date()
    const due = new Date(dueDate)
    const diffTime = due.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Timeline Modal fonksiyonları
  const openTimelineModal = async (task: PlannedTask) => {
    setTimelineLoading(true)
    setShowTimelineModal(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}/timeline`)
      if (response.ok) {
        const data = await response.json()
        setTimelineData(data)
      }
    } catch (error) {
      console.error('Timeline alınamadı:', error)
    } finally {
      setTimelineLoading(false)
    }
  }

  const handlePeriodStatusChange = async (periodId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${periodId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok && timelineData) {
        // Timeline'ı yeniden yükle
        const timelineResponse = await fetch(`/api/tasks/${timelineData.rootTask.id}/timeline`)
        if (timelineResponse.ok) {
          const data = await timelineResponse.json()
          setTimelineData(data)
        }
        fetchTasks()
      }
    } catch (error) {
      console.error('Durum güncellenemedi:', error)
    }
  }

  const handleCreateNextPeriod = async (dueDate: string) => {
    if (!timelineData) return

    try {
      const response = await fetch(`/api/tasks/${timelineData.rootTask.id}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate }),
      })

      if (response.ok) {
        // Timeline'ı yeniden yükle
        const timelineResponse = await fetch(`/api/tasks/${timelineData.rootTask.id}/timeline`)
        if (timelineResponse.ok) {
          const data = await timelineResponse.json()
          setTimelineData(data)
        }
        fetchTasks()
      }
    } catch (error) {
      console.error('Yeni periyot oluşturulamadı:', error)
    }
  }

  const handleDeletePeriod = async (periodId: string) => {
    if (!confirm('Bu periyodu silmek istediğinize emin misiniz?')) return

    try {
      const response = await fetch(`/api/tasks/${periodId}`, {
        method: 'DELETE',
      })

      if (response.ok && timelineData) {
        // Timeline'ı yeniden yükle
        const timelineResponse = await fetch(`/api/tasks/${timelineData.rootTask.id}/timeline`)
        if (timelineResponse.ok) {
          const data = await timelineResponse.json()
          setTimelineData(data)
        }
        fetchTasks()
      }
    } catch (error) {
      console.error('Periyot silinemedi:', error)
    }
  }

  // İstatistikler
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'PENDING').length,
    inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    completed: tasks.filter(t => t.status === 'COMPLETED').length,
    overdue: tasks.filter(t => t.status === 'OVERDUE').length,
  }

  // Departmanlara göre görev dağılımı (Radar Chart için)
  const departmentChartData = useMemo(() => {
    // Varsayılan departmanlar - her zaman gösterilecek
    const defaultDepartments = [
      'Planlama',
      'Üretim',
      'Satış Pazarlama',
      'Mühendislik',
      'Sistem Geliştirme',
      'İnsan Varlıkları',
    ]

    const departmentCounts: Record<string, number> = {}

    // Varsayılan departmanları 0 ile başlat
    defaultDepartments.forEach(dept => {
      departmentCounts[dept] = 0
    })

    // Görevlerden departman sayılarını hesapla
    tasks.forEach(task => {
      if (task.responsibleDepartment) {
        departmentCounts[task.responsibleDepartment] = (departmentCounts[task.responsibleDepartment] || 0) + 1
      }
    })

    // Tüm departmanları döndür
    return Object.entries(departmentCounts)
      .map(([department, count]) => ({
        department: department.length > 40 ? department.substring(0, 37) + '...' : department,
        fullName: department,
        tasks: count,
      }))
      .sort((a, b) => b.tasks - a.tasks)
      .slice(0, 8) // En fazla 8 departman göster
  }, [tasks])

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ListTodo className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
            Planlı Görevler
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">Kurumsal görev ve hatırlatma yönetimi</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <Tag className="w-4 h-4" />
            <span className="hidden sm:inline">Kategori Ekle</span>
            <span className="sm:hidden">Kategori</span>
          </button>
          <button
            onClick={() => {
              resetForm()
              setShowTaskModal(true)
            }}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Yeni Görev</span>
            <span className="sm:hidden">Ekle</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Toplam</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bekliyor</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.inProgress}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Devam</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bitti</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Gecikmiş</p>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-1 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 min-w-max">
          <button
            onClick={() => setViewMode('my')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              viewMode === 'my'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Benim Görevlerim</span>
            <span className="sm:hidden">Benim</span>
          </button>
          <button
            onClick={() => setViewMode('department')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              viewMode === 'department'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Departman</span>
            <span className="sm:hidden">Dept.</span>
          </button>
          <button
            onClick={() => setViewMode('subordinates')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              viewMode === 'subordinates'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Ekibim</span>
            <span className="sm:hidden">Ekip</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setViewMode('all')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                viewMode === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <ListTodo className="w-4 h-4" />
              <span className="hidden sm:inline">Tümü</span>
              <span className="sm:hidden">Tüm</span>
            </button>
          )}
        </div>
      </div>


      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Görev ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Durum</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Öncelik</option>
              {Object.entries(priorityLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Yükleniyor...</div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p>Henüz görev bulunmuyor</p>
            <button
              onClick={() => {
                resetForm()
                setShowTaskModal(true)
              }}
              className="mt-3 text-blue-600 dark:text-blue-400 hover:underline"
            >
              İlk görevi ekleyin
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {tasks.map((task) => {
              const daysRemaining = getDaysRemaining(task.dueDate)
              return (
                <div
                  key={task.id}
                  className={`p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    task.status === 'COMPLETED' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-2 sm:gap-4">
                    {/* Status checkbox */}
                    <button
                      onClick={() => handleStatusChange(
                        task.id,
                        task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
                      )}
                      className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        task.status === 'COMPLETED'
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-500'
                      }`}
                    >
                      {task.status === 'COMPLETED' && (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={`flex-1 min-w-0 ${task.isRecurring ? 'cursor-pointer' : ''}`}
                          onClick={() => task.isRecurring && openTimelineModal(task)}
                        >
                          <h3 className={`text-sm sm:text-base font-medium text-gray-900 dark:text-white ${
                            task.status === 'COMPLETED' ? 'line-through' : ''
                          } ${task.isRecurring ? 'hover:text-blue-600 dark:hover:text-blue-400' : ''}`}>
                            {task.title}
                            {task.isRecurring && (
                              <ChevronRight className="w-4 h-4 inline ml-1 text-gray-400 dark:text-gray-500" />
                            )}
                          </h3>
                          {task.description && (
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => openEditModal(task)}
                            className="p-1 sm:p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="p-1 sm:p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                        {/* Category */}
                        {task.category && (
                          <span
                            className="px-2 py-0.5 text-xs font-medium rounded-full border dark:border-opacity-50"
                            style={{
                              backgroundColor: `${task.category.color}20`,
                              color: task.category.color || '#3b82f6',
                              borderColor: `${task.category.color}40`,
                            }}
                          >
                            {task.category.name}
                          </span>
                        )}

                        {/* Status */}
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[task.status]}`}>
                          {statusLabels[task.status]}
                        </span>

                        {/* Priority */}
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityColors[task.priority]}`}>
                          {priorityLabels[task.priority]}
                        </span>

                        {/* Recurring badge */}
                        {task.isRecurring && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300">
                            <RefreshCw className="w-3 h-3 inline mr-1" />
                            {recurrenceLabels[task.recurrenceType || '']}
                          </span>
                        )}

                        {/* Due date */}
                        <span className={`flex items-center gap-1 text-xs ${
                          daysRemaining < 0 ? 'text-red-600 dark:text-red-400' :
                          daysRemaining <= 7 ? 'text-orange-600 dark:text-orange-400' :
                          'text-gray-500 dark:text-gray-400'
                        }`}>
                          <CalendarDays className="w-3 h-3 flex-shrink-0" />
                          <span className="hidden sm:inline">{new Date(task.dueDate).toLocaleDateString('tr-TR')}</span>
                          <span className="sm:hidden">{new Date(task.dueDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}</span>
                          {task.status !== 'COMPLETED' && (
                            <span className="hidden sm:inline ml-1">
                              ({daysRemaining > 0 ? `${daysRemaining} gün` :
                                daysRemaining === 0 ? 'Bugün' :
                                `${Math.abs(daysRemaining)} gün geçti`})
                            </span>
                          )}
                        </span>

                        {/* Responsible persons - hidden on mobile */}
                        {(task.responsiblePersons || task.responsiblePerson) && (
                          <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <User className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate max-w-[150px]">
                              {task.responsiblePersons ? (
                                (() => {
                                  try {
                                    const persons = JSON.parse(task.responsiblePersons) as { name: string; email: string }[]
                                    return persons.map(p => p.name).join(', ')
                                  } catch {
                                    return task.responsiblePerson
                                  }
                                })()
                              ) : task.responsiblePerson}
                            </span>
                          </span>
                        )}

                        {/* Responsible departments - hidden on mobile */}
                        {(task.responsibleDepartments && task.responsibleDepartments.length > 0) && (
                          <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Building2 className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate max-w-[150px]">{task.responsibleDepartments.join(', ')}</span>
                          </span>
                        )}

                        {/* Tamamla butonu - sadece tamamlanmamış görevler için */}
                        {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleStatusChange(task.id, 'COMPLETED')}
                            className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/50"
                          >
                            <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span className="hidden sm:inline">Tamamla</span>
                            <span className="sm:hidden">Bitti</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-none sm:rounded-xl w-full sm:max-w-2xl min-h-screen sm:min-h-0 sm:max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between z-10">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {editingTask ? 'Görevi Düzenle' : 'Yeni Görev'}
              </h2>
              <button
                onClick={() => {
                  setShowTaskModal(false)
                  resetForm()
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Görev Adı *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Örn: ISO 9001 Belge Yenileme"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Görev detayları..."
                />
              </div>

              {/* Category and Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Kategori
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Kategori seçin</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Öncelik
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {Object.entries(priorityLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Başlangıç Tarihi
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bitiş Tarihi *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Sorumlu Kişiler (Çoklu Seçim) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sorumlu Kişiler
                </label>
                <UserSearchCombobox
                  value=""
                  onSelect={(user) => {
                    if (user) {
                      // Aynı kişi zaten eklenmişse ekleme
                      const alreadyExists = formData.responsiblePersons.some(p => p.email === user.email)
                      if (!alreadyExists) {
                        setFormData({
                          ...formData,
                          responsiblePersons: [...formData.responsiblePersons, { name: user.name, email: user.email }],
                          // Geriye uyumluluk için ilk kişiyi eski alanlara da yaz
                          responsiblePerson: formData.responsiblePersons.length === 0 ? user.name : formData.responsiblePerson,
                          responsiblePersonEmail: formData.responsiblePersons.length === 0 ? user.email : formData.responsiblePersonEmail,
                        })
                      }
                    }
                  }}
                  placeholder="Kişi ara ve ekle..."
                />
                {/* Seçilen kişiler */}
                {formData.responsiblePersons.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.responsiblePersons.map((person, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                      >
                        <User className="h-3 w-3" />
                        {person.name}
                        <button
                          type="button"
                          onClick={() => {
                            const newPersons = formData.responsiblePersons.filter((_, i) => i !== idx)
                            setFormData({
                              ...formData,
                              responsiblePersons: newPersons,
                              responsiblePerson: newPersons[0]?.name || '',
                              responsiblePersonEmail: newPersons[0]?.email || '',
                            })
                          }}
                          className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Sorumlu Departmanlar (Çoklu Seçim) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sorumlu Departmanlar
                </label>
                <select
                  value=""
                  onChange={(e) => {
                    const deptName = e.target.value
                    if (deptName && !formData.responsibleDepartments.includes(deptName)) {
                      setFormData({
                        ...formData,
                        responsibleDepartments: [...formData.responsibleDepartments, deptName],
                        responsibleDepartment: formData.responsibleDepartments.length === 0 ? deptName : formData.responsibleDepartment,
                      })
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Departman seç ve ekle...</option>
                  {departments.filter(dept => !formData.responsibleDepartments.includes(dept.name)).map((dept) => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
                {/* Seçilen departmanlar */}
                {formData.responsibleDepartments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.responsibleDepartments.map((dept, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm"
                      >
                        <Building2 className="h-3 w-3" />
                        {dept}
                        <button
                          type="button"
                          onClick={() => {
                            const newDepts = formData.responsibleDepartments.filter((_, i) => i !== idx)
                            setFormData({
                              ...formData,
                              responsibleDepartments: newDepts,
                              responsibleDepartment: newDepts[0] || '',
                            })
                          }}
                          className="ml-1 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Notification Emails */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bildirim E-postaları
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (newEmail && newEmail.includes('@') && !formData.notificationEmails.includes(newEmail)) {
                            setFormData({
                              ...formData,
                              notificationEmails: [...formData.notificationEmails, newEmail]
                            })
                            setNewEmail('')
                          }
                        }
                      }}
                      placeholder="E-posta adresi ekleyin"
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newEmail && newEmail.includes('@') && !formData.notificationEmails.includes(newEmail)) {
                          setFormData({
                            ...formData,
                            notificationEmails: [...formData.notificationEmails, newEmail]
                          })
                          setNewEmail('')
                        }
                      }}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Ekle
                    </button>
                  </div>
                  {formData.notificationEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.notificationEmails.map((email, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                        >
                          {email}
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                notificationEmails: formData.notificationEmails.filter((_, i) => i !== index)
                              })
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Görev hatırlatmaları bu e-posta adreslerine gönderilecektir.
                  </p>
                </div>
              </div>

              {/* Recurring */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isRecurring}
                    onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Tekrarlayan Görev</span>
                </label>

                {formData.isRecurring && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tekrar Tipi
                      </label>
                      <select
                        value={formData.recurrenceType}
                        onChange={(e) => setFormData({ ...formData, recurrenceType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Seçin</option>
                        {Object.entries(recurrenceLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tekrar Aralığı
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.recurrenceInterval}
                        onChange={(e) => setFormData({ ...formData, recurrenceInterval: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Reminder Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hatırlatma Günleri
                </label>
                <div className="flex flex-wrap gap-2">
                  {[30, 14, 7, 3, 1].map((day) => (
                    <label
                      key={day}
                      className={`px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                        formData.reminderDays.includes(day)
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={formData.reminderDays.includes(day)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              reminderDays: [...formData.reminderDays, day].sort((a, b) => b - a),
                            })
                          } else {
                            setFormData({
                              ...formData,
                              reminderDays: formData.reminderDays.filter(d => d !== day),
                            })
                          }
                        }}
                      />
                      {day} gün önce
                    </label>
                  ))}
                </div>
              </div>

              {/* Eskalasyon Alanı */}
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.escalationEnabled}
                    onChange={(e) => setFormData({
                      ...formData,
                      escalationEnabled: e.target.checked,
                      escalationCategory: e.target.checked ? formData.escalationCategory : '',
                      escalationPriority: e.target.checked ? formData.escalationPriority : ''
                    })}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    🚨 Eskalasyon Gerektiren Kritik Görev
                  </span>
                </label>

                {formData.escalationEnabled && (
                  <div className="space-y-4 pt-2">
                    {/* Eskalasyon Kategorisi */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Eskalasyon Kategorisi *
                      </label>
                      <div className="space-y-2">
                        {escalationCategories.map((cat) => (
                          <label
                            key={cat.value}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              formData.escalationCategory === cat.value
                                ? 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700'
                                : 'bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-700 dark:border-gray-600'
                            }`}
                          >
                            <input
                              type="radio"
                              name="escalationCategory"
                              value={cat.value}
                              checked={formData.escalationCategory === cat.value}
                              onChange={(e) => setFormData({ ...formData, escalationCategory: e.target.value })}
                              className="mt-0.5 w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{cat.label}</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{cat.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Eskalasyon Seviyesi */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Eskalasyon Seviyesi *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {escalationPriorities.map((prio) => (
                          <label
                            key={prio.value}
                            className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                              formData.escalationPriority === prio.value
                                ? 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700'
                                : 'bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-700 dark:border-gray-600'
                            }`}
                          >
                            <input
                              type="radio"
                              name="escalationPriority"
                              value={prio.value}
                              checked={formData.escalationPriority === prio.value}
                              onChange={(e) => setFormData({ ...formData, escalationPriority: e.target.value })}
                              className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${prio.color}`}></span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{prio.label}</span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 ml-4">{prio.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notlar
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ek notlar..."
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 pb-4 sm:pb-0 safe-bottom">
                <button
                  type="button"
                  onClick={() => {
                    setShowTaskModal(false)
                    resetForm()
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingTask ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-xl sm:rounded-xl w-full sm:max-w-md">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Yeni Kategori</h2>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Kategori Adı *
                </label>
                <input
                  type="text"
                  required
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Örn: Sertifikasyonlar"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Açıklama
                </label>
                <input
                  type="text"
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Kategori açıklaması"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Renk
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={categoryFormData.color}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, color: e.target.value })}
                    className="w-10 h-10 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={categoryFormData.color}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 pb-4 sm:pb-0 safe-bottom">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timeline Modal */}
      {showTimelineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-none sm:rounded-xl w-full sm:max-w-2xl min-h-screen sm:min-h-0 sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {timelineData?.rootTask.title || 'Görev Zaman Çizelgesi'}
                </h2>
                {timelineData?.rootTask.isRecurring && timelineData?.rootTask.recurrenceType && (
                  <div className="flex items-center gap-2 mt-1">
                    <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {recurrenceLabels[timelineData.rootTask.recurrenceType] || timelineData.rootTask.recurrenceType}
                      {timelineData.rootTask.recurrenceInterval && timelineData.rootTask.recurrenceInterval > 1 &&
                        ` (${timelineData.rootTask.recurrenceInterval}x)`}
                    </span>
                    {timelineData.rootTask.category && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full border dark:border-opacity-50"
                          style={{
                            backgroundColor: `${timelineData.rootTask.category.color}20`,
                            color: timelineData.rootTask.category.color || '#3b82f6',
                            borderColor: `${timelineData.rootTask.category.color}40`
                          }}
                        >
                          {timelineData.rootTask.category.name}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setShowTimelineModal(false)
                  setTimelineData(null)
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {timelineLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : timelineData ? (
                <div className="space-y-4">
                  {/* Task Info */}
                  {timelineData.rootTask.description && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
                      <p className="text-sm text-gray-600 dark:text-gray-300">{timelineData.rootTask.description}</p>
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                        {timelineData.rootTask.responsiblePerson && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {timelineData.rootTask.responsiblePerson}
                          </span>
                        )}
                        {timelineData.rootTask.responsibleDepartment && (
                          <span className="flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5" />
                            {timelineData.rootTask.responsibleDepartment}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="relative">
                    {/* Vertical Line */}
                    <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-gray-200 dark:bg-gray-600" />

                    {/* Existing Periods */}
                    {timelineData.periods.map((period, index) => {
                      const daysRemaining = getDaysRemaining(period.dueDate)
                      const isCompleted = period.status === 'COMPLETED'
                      const isOverdue = period.status === 'OVERDUE' || (!isCompleted && daysRemaining < 0)
                      const isPending = period.status === 'PENDING' || period.status === 'IN_PROGRESS'

                      return (
                        <div key={period.id} className="relative flex items-start gap-4 pb-6">
                          {/* Status Icon */}
                          <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                            isCompleted
                              ? 'bg-green-100 dark:bg-green-900'
                              : isOverdue
                                ? 'bg-red-100 dark:bg-red-900'
                                : 'bg-blue-100 dark:bg-blue-900'
                          }`}>
                            {isCompleted ? (
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : isOverdue ? (
                              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                            ) : (
                              <Circle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 shadow-sm">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {new Date(period.dueDate).toLocaleDateString('tr-TR', {
                                      day: '2-digit',
                                      month: 'long',
                                      year: 'numeric'
                                    })}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[period.status]}`}>
                                    {statusLabels[period.status]}
                                  </span>
                                </div>
                                {!isCompleted && (
                                  <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {isOverdue
                                      ? `${Math.abs(daysRemaining)} gün gecikti`
                                      : `${daysRemaining} gün kaldı`}
                                  </p>
                                )}
                                {period.completedDate && (
                                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                    Tamamlanma: {new Date(period.completedDate).toLocaleDateString('tr-TR')}
                                  </p>
                                )}
                                {period.notes && (
                                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 flex items-start gap-1">
                                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-gray-400" />
                                    {period.notes}
                                  </p>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1">
                                {isPending && (
                                  <button
                                    onClick={() => handlePeriodStatusChange(period.id, 'COMPLETED')}
                                    className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/50 rounded-lg"
                                    title="Tamamla"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                )}
                                {!period.isRoot && (
                                  <button
                                    onClick={() => handleDeletePeriod(period.id)}
                                    className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg"
                                    title="Sil"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Future Periods (Projected) */}
                    {timelineData.futurePeriods.map((period, index) => (
                      <div key={`future-${index}`} className="relative flex items-start gap-4 pb-6">
                        {/* Status Icon */}
                        <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-500">
                          <Calendar className="w-4 h-4 text-gray-400" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 border border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-500 dark:text-gray-400">
                                  {new Date(period.dueDate).toLocaleDateString('tr-TR', {
                                    day: '2-digit',
                                    month: 'long',
                                    year: 'numeric'
                                  })}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300">
                                  Planlandı
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                {getDaysRemaining(period.dueDate)} gün sonra
                              </p>
                            </div>

                            {/* Actions */}
                            <button
                              onClick={() => handleCreateNextPeriod(period.dueDate)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-lg"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Oluştur
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  Zaman çizelgesi yüklenemedi
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end safe-bottom">
              <button
                onClick={() => {
                  setShowTimelineModal(false)
                  setTimelineData(null)
                }}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
