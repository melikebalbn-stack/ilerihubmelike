"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, MapPin, Box, Layers, Mail, Settings, Flame, Gauge, ChevronDown, ExternalLink, Search, Tag, Building2, Bell, RefreshCw, CalendarCheck, Palette, Lightbulb, Users, LayoutDashboard, AlertTriangle, Save, Megaphone, ClipboardList, Eye, BarChart3, Calendar, Headphones, UtensilsCrossed, Download, Upload, Smartphone } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { NotificationToggle } from "@/components/pwa/notification-permission"

type Location = {
  id: string
  name: string
  code: string | null
  isActive: boolean
  sortOrder: number
}

type DeviceType = {
  id: string
  name: string
  code: string | null
  isActive: boolean
  sortOrder: number
}

type DeviceModel = {
  id: string
  name: string
  manufacturer: string | null
  code: string | null
  isActive: boolean
  sortOrder: number
}

type DeviceName = {
  id: string
  name: string
  code: string | null
  isActive: boolean
  sortOrder: number
}

type CalibrationDepartment = {
  id: string
  name: string
  code: string | null
  isActive: boolean
  sortOrder: number
}

type NotificationEmail = {
  id: string
  email: string
  name: string | null
  isActive: boolean
}

type NotificationRule = {
  id: string
  type: 'EXPIRING' | 'EXPIRED'
  period: 'BEFORE' | 'AFTER'
  days: number
  repeatWeekly: boolean
  isActive: boolean
}

type TaskCategory = {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  isActive: boolean
  sortOrder: number
  _count?: { tasks: number }
}

type SuggestionBoardMember = {
  id: string
  email: string
  name: string
  department: string | null
  role: string | null
  isActive: boolean
}

type AnnouncementCategory = {
  id: string
  name: string
  color: string | null
  icon: string | null
  isActive: boolean
  sortOrder: number
  _count?: { announcements: number }
}

type TicketCategory = {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  defaultPriority: string
  slaResponseMinutes: number | null
  slaResolutionMinutes: number | null
  isActive: boolean
  sortOrder: number
  _count?: { tickets: number }
}

type Survey = {
  id: string
  surveyNumber: string
  title: string
  description: string | null
  surveyType: string
  status: string
  isAnonymous: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  _count: {
    questions: number
    responses: number
  }
}

type EditingType = 'location' | 'device-type' | 'device-model' | 'device-name' | 'department' | 'task-category' | 'announcement-category' | 'ticket-category' | null

export default function SettingsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([])
  const [deviceModels, setDeviceModels] = useState<DeviceModel[]>([])
  const [deviceNames, setDeviceNames] = useState<DeviceName[]>([])
  const [departments, setDepartments] = useState<CalibrationDepartment[]>([])
  const [notificationEmails, setNotificationEmails] = useState<NotificationEmail[]>([])
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([])
  const [taskCategories, setTaskCategories] = useState<TaskCategory[]>([])
  const [taskNotificationEmails, setTaskNotificationEmails] = useState<NotificationEmail[]>([])
  const [suggestionBoardMembers, setSuggestionBoardMembers] = useState<SuggestionBoardMember[]>([])
  const [announcementCategories, setAnnouncementCategories] = useState<AnnouncementCategory[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([])

  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [calibrationOpen, setCalibrationOpen] = useState(false)
  const [suggestionSystemOpen, setSuggestionSystemOpen] = useState(false)
  const [tasksOpen, setTasksOpen] = useState(false)
  const [fireSafetyOpen, setFireSafetyOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [announcementSystemOpen, setAnnouncementSystemOpen] = useState(false)
  const [itTicketOpen, setItTicketOpen] = useState(false)

  // Dashboard sistem ayarları
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({})
  const [savingSettings, setSavingSettings] = useState(false)
  const [systemNotice, setSystemNotice] = useState({ enabled: false, title: '', message: '' })
  const [noticeEdited, setNoticeEdited] = useState(false)

  // Alt bölümler için açılır-kapanır durumlar
  const [locationsOpen, setLocationsOpen] = useState(false)
  const [deviceTypesOpen, setDeviceTypesOpen] = useState(false)
  const [deviceModelsOpen, setDeviceModelsOpen] = useState(false)
  const [deviceNamesOpen, setDeviceNamesOpen] = useState(false)
  const [departmentsOpen, setDepartmentsOpen] = useState(false)
  const [notificationEmailsOpen, setNotificationEmailsOpen] = useState(false)
  const [notificationRulesOpen, setNotificationRulesOpen] = useState(false)
  const [taskCategoriesOpen, setTaskCategoriesOpen] = useState(false)
  const [taskNotificationEmailsOpen, setTaskNotificationEmailsOpen] = useState(false)
  const [boardMembersOpen, setBoardMembersOpen] = useState(false)
  const [announcementCategoriesOpen, setAnnouncementCategoriesOpen] = useState(false)
  const [surveysOpen, setSurveysOpen] = useState(false)
  const [ticketCategoriesOpen, setTicketCategoriesOpen] = useState(false)
  const [ticketTypesOpen, setTicketTypesOpen] = useState(false)

  // Öneri Kurulu üyesi ekleme
  const [newBoardMember, setNewBoardMember] = useState({
    email: '',
    name: '',
    department: '',
    role: '',
  })
  const [addingBoardMember, setAddingBoardMember] = useState(false)
  const [boardMemberSearch, setBoardMemberSearch] = useState('')

  // Yeni e-posta ekleme
  const [newEmail, setNewEmail] = useState('')
  const [addingEmail, setAddingEmail] = useState(false)

  // Yeni kural ekleme
  const [newRule, setNewRule] = useState({
    type: 'EXPIRING' as 'EXPIRING' | 'EXPIRED',
    period: 'BEFORE' as 'BEFORE' | 'AFTER',
    days: 7,
    repeatWeekly: false,
  })
  const [addingRule, setAddingRule] = useState(false)

  // Yeni kategori ekleme
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
  })
  const [addingCategory, setAddingCategory] = useState(false)

  // Yeni görev bildirim e-postası ekleme
  const [newTaskEmail, setNewTaskEmail] = useState('')
  const [addingTaskEmail, setAddingTaskEmail] = useState(false)

  // Yeni duyuru kategorisi ekleme
  const [newAnnouncementCategory, setNewAnnouncementCategory] = useState({
    name: '',
    color: '#3b82f6',
  })
  const [addingAnnouncementCategory, setAddingAnnouncementCategory] = useState(false)

  // Yeni ticket kategorisi ekleme
  const [newTicketCategory, setNewTicketCategory] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    defaultPriority: 'NORMAL',
  })
  const [addingTicketCategory, setAddingTicketCategory] = useState(false)

  // Arama filtreleri
  const [locationSearch, setLocationSearch] = useState('')
  const [deviceTypeSearch, setDeviceTypeSearch] = useState('')
  const [deviceModelSearch, setDeviceModelSearch] = useState('')
  const [deviceNameSearch, setDeviceNameSearch] = useState('')
  const [departmentSearch, setDepartmentSearch] = useState('')
  const [taskCategorySearch, setTaskCategorySearch] = useState('')
  const [announcementCategorySearch, setAnnouncementCategorySearch] = useState('')
  const [surveySearch, setSurveySearch] = useState('')
  const [ticketCategorySearch, setTicketCategorySearch] = useState('')

  // Filtrelenmiş listeler
  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(locationSearch.toLowerCase()) ||
    (loc.code && loc.code.toLowerCase().includes(locationSearch.toLowerCase()))
  )

  const filteredDeviceTypes = deviceTypes.filter(type =>
    type.name.toLowerCase().includes(deviceTypeSearch.toLowerCase()) ||
    (type.code && type.code.toLowerCase().includes(deviceTypeSearch.toLowerCase()))
  )

  const filteredDeviceModels = deviceModels.filter(model =>
    model.name.toLowerCase().includes(deviceModelSearch.toLowerCase()) ||
    (model.code && model.code.toLowerCase().includes(deviceModelSearch.toLowerCase())) ||
    (model.manufacturer && model.manufacturer.toLowerCase().includes(deviceModelSearch.toLowerCase()))
  )

  const filteredDeviceNames = deviceNames.filter(item =>
    item.name.toLowerCase().includes(deviceNameSearch.toLowerCase()) ||
    (item.code && item.code.toLowerCase().includes(deviceNameSearch.toLowerCase()))
  )

  const filteredDepartments = departments.filter(item =>
    item.name.toLowerCase().includes(departmentSearch.toLowerCase()) ||
    (item.code && item.code.toLowerCase().includes(departmentSearch.toLowerCase()))
  )

  const filteredTaskCategories = taskCategories.filter(item =>
    item.name.toLowerCase().includes(taskCategorySearch.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(taskCategorySearch.toLowerCase()))
  )

  const filteredAnnouncementCategories = announcementCategories.filter(item =>
    item.name.toLowerCase().includes(announcementCategorySearch.toLowerCase())
  )

  const filteredSurveys = surveys.filter(item =>
    item.title.toLowerCase().includes(surveySearch.toLowerCase()) ||
    item.surveyNumber.toLowerCase().includes(surveySearch.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(surveySearch.toLowerCase()))
  )

  const filteredTicketCategories = ticketCategories.filter(item =>
    item.name.toLowerCase().includes(ticketCategorySearch.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(ticketCategorySearch.toLowerCase()))
  )

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<EditingType>(null)
  const [editingItem, setEditingItem] = useState<any>(null)

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    manufacturer: '',
    description: '',
    color: '#3b82f6',
  })

  const [emailTest, setEmailTest] = useState({
    email: '',
    name: '',
    sending: false,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [locsRes, typesRes, modelsRes, namesRes, deptsRes, emailsRes, rulesRes, categoriesRes, taskEmailsRes, boardMembersRes, systemRes, annCategoriesRes, surveysRes, ticketCategoriesRes] = await Promise.all([
        fetch('/api/settings/locations'),
        fetch('/api/settings/device-types'),
        fetch('/api/settings/device-models'),
        fetch('/api/settings/device-names'),
        fetch('/api/settings/departments'),
        fetch('/api/settings/notification-emails'),
        fetch('/api/settings/notification-rules'),
        fetch('/api/tasks/categories'),
        fetch('/api/tasks/notification-emails'),
        fetch('/api/suggestions/board-members'),
        fetch('/api/system/settings?category=dashboard'),
        fetch('/api/announcements/categories'),
        fetch('/api/surveys?limit=100'),
        fetch('/api/tickets/categories'),
      ])

      if (locsRes.ok) setLocations(await locsRes.json())
      if (typesRes.ok) setDeviceTypes(await typesRes.json())
      if (modelsRes.ok) setDeviceModels(await modelsRes.json())
      if (namesRes.ok) setDeviceNames(await namesRes.json())
      if (deptsRes.ok) setDepartments(await deptsRes.json())
      if (emailsRes.ok) setNotificationEmails(await emailsRes.json())
      if (rulesRes.ok) setNotificationRules(await rulesRes.json())
      if (categoriesRes.ok) setTaskCategories(await categoriesRes.json())
      if (taskEmailsRes.ok) setTaskNotificationEmails(await taskEmailsRes.json())
      if (boardMembersRes.ok) setSuggestionBoardMembers(await boardMembersRes.json())
      if (annCategoriesRes.ok) setAnnouncementCategories(await annCategoriesRes.json())
      if (ticketCategoriesRes.ok) setTicketCategories(await ticketCategoriesRes.json())
      if (surveysRes.ok) {
        const data = await surveysRes.json()
        setSurveys(data.surveys || [])
      }
      if (systemRes.ok) {
        const settings = await systemRes.json()
        setSystemSettings(settings)
        // Sistem notunu ayarla
        setSystemNotice({
          enabled: settings['system_notice_enabled'] === 'true',
          title: settings['system_notice_title'] || '',
          message: settings['system_notice_message'] || ''
        })
      }
    } catch (error) {
      console.error('Ayarlar yüklenirken hata:', error)
    }
  }

  const handleSystemSettingChange = async (key: string, value: boolean) => {
    setSavingSettings(true)
    try {
      const res = await fetch('/api/system/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: value ? 'true' : 'false', category: 'dashboard' }),
      })

      if (res.ok) {
        setSystemSettings(prev => ({ ...prev, [key]: value ? 'true' : 'false' }))
        toast.success('Ayar kaydedildi')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Ayar kaydedilirken hata oluştu')
      }
    } catch (error) {
      toast.error('Ayar kaydedilirken hata oluştu')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveSystemNotice = async () => {
    setSavingSettings(true)
    try {
      // Tüm ayarları aynı anda kaydet
      const requests = [
        fetch('/api/system/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'system_notice_enabled', value: systemNotice.enabled ? 'true' : 'false', category: 'dashboard' }),
        }),
        fetch('/api/system/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'system_notice_title', value: systemNotice.title, category: 'dashboard' }),
        }),
        fetch('/api/system/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'system_notice_message', value: systemNotice.message, category: 'dashboard' }),
        }),
      ]

      const responses = await Promise.all(requests)
      const allOk = responses.every(res => res.ok)

      if (allOk) {
        setSystemSettings(prev => ({
          ...prev,
          system_notice_enabled: systemNotice.enabled ? 'true' : 'false',
          system_notice_title: systemNotice.title,
          system_notice_message: systemNotice.message,
        }))
        setNoticeEdited(false)
        toast.success('Sistem notu kaydedildi')
      } else {
        toast.error('Sistem notu kaydedilirken hata oluştu')
      }
    } catch (error) {
      toast.error('Sistem notu kaydedilirken hata oluştu')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleAddNotificationEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Geçerli bir e-posta adresi giriniz')
      return
    }

    setAddingEmail(true)
    try {
      const res = await fetch('/api/settings/notification-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      })

      if (res.ok) {
        toast.success('E-posta adresi eklendi')
        setNewEmail('')
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'E-posta eklenirken hata oluştu')
      }
    } catch (error) {
      toast.error('E-posta eklenirken hata oluştu')
    } finally {
      setAddingEmail(false)
    }
  }

  const handleDeleteNotificationEmail = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/notification-emails/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('E-posta adresi silindi')
        loadData()
      } else {
        toast.error('E-posta silinirken hata oluştu')
      }
    } catch (error) {
      toast.error('E-posta silinirken hata oluştu')
    }
  }

  const handleAddNotificationRule = async () => {
    setAddingRule(true)
    try {
      const res = await fetch('/api/settings/notification-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      })

      if (res.ok) {
        toast.success('Bildirim kuralı eklendi')
        setNewRule({
          type: 'EXPIRING',
          period: 'BEFORE',
          days: 7,
          repeatWeekly: false,
        })
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kural eklenirken hata oluştu')
      }
    } catch (error) {
      toast.error('Kural eklenirken hata oluştu')
    } finally {
      setAddingRule(false)
    }
  }

  const handleDeleteNotificationRule = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/notification-rules/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Bildirim kuralı silindi')
        loadData()
      } else {
        toast.error('Kural silinirken hata oluştu')
      }
    } catch (error) {
      toast.error('Kural silinirken hata oluştu')
    }
  }

  const getRuleDescription = (rule: NotificationRule) => {
    const typeText = rule.type === 'EXPIRING' ? 'Süresi Yaklaşan' : 'Süresi Dolan'
    const periodText = rule.period === 'BEFORE' ? 'kala' : 'sonra'
    const repeatText = rule.repeatWeekly ? ' (Haftalık tekrar)' : ''
    return `${typeText} - ${rule.days} gün ${periodText}${repeatText}`
  }

  const handleAddTaskCategory = async () => {
    if (!newCategory.name) {
      toast.error('Kategori adı zorunludur')
      return
    }

    setAddingCategory(true)
    try {
      const res = await fetch('/api/tasks/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategory),
      })

      if (res.ok) {
        toast.success('Kategori eklendi')
        setNewCategory({ name: '', description: '', color: '#3b82f6' })
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kategori eklenirken hata oluştu')
      }
    } catch (error) {
      toast.error('Kategori eklenirken hata oluştu')
    } finally {
      setAddingCategory(false)
    }
  }

  const handleDeleteTaskCategory = async (id: string) => {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return

    try {
      const res = await fetch(`/api/tasks/categories?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Kategori silindi')
        loadData()
      } else {
        toast.error('Kategori silinirken hata oluştu')
      }
    } catch (error) {
      toast.error('Kategori silinirken hata oluştu')
    }
  }

  const handleAddTaskNotificationEmail = async () => {
    if (!newTaskEmail || !newTaskEmail.includes('@')) {
      toast.error('Geçerli bir e-posta adresi giriniz')
      return
    }

    setAddingTaskEmail(true)
    try {
      const res = await fetch('/api/tasks/notification-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newTaskEmail }),
      })

      if (res.ok) {
        toast.success('E-posta adresi eklendi')
        setNewTaskEmail('')
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'E-posta eklenirken hata oluştu')
      }
    } catch (error) {
      toast.error('E-posta eklenirken hata oluştu')
    } finally {
      setAddingTaskEmail(false)
    }
  }

  const handleDeleteTaskNotificationEmail = async (id: string) => {
    if (!confirm('Bu e-posta adresini silmek istediğinizden emin misiniz?')) return

    try {
      const res = await fetch(`/api/tasks/notification-emails?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('E-posta adresi silindi')
        loadData()
      } else {
        toast.error('E-posta silinirken hata oluştu')
      }
    } catch (error) {
      toast.error('E-posta silinirken hata oluştu')
    }
  }

  const handleAddBoardMember = async () => {
    if (!newBoardMember.email || !newBoardMember.name) {
      toast.error('E-posta ve isim alanları zorunludur')
      return
    }

    if (!newBoardMember.email.includes('@')) {
      toast.error('Geçerli bir e-posta adresi giriniz')
      return
    }

    setAddingBoardMember(true)
    try {
      const res = await fetch('/api/suggestions/board-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBoardMember),
      })

      if (res.ok) {
        toast.success('Öneri Kurulu üyesi eklendi')
        setNewBoardMember({ email: '', name: '', department: '', role: '' })
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Üye eklenirken hata oluştu')
      }
    } catch (error) {
      toast.error('Üye eklenirken hata oluştu')
    } finally {
      setAddingBoardMember(false)
    }
  }

  const handleDeleteBoardMember = async (id: string) => {
    if (!confirm('Bu üyeyi Öneri Kurulundan çıkarmak istediğinizden emin misiniz?')) return

    try {
      const res = await fetch(`/api/suggestions/board-members?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Üye kuruldan çıkarıldı')
        loadData()
      } else {
        toast.error('Üye silinirken hata oluştu')
      }
    } catch (error) {
      toast.error('Üye silinirken hata oluştu')
    }
  }

  const filteredBoardMembers = suggestionBoardMembers.filter(member =>
    member.name.toLowerCase().includes(boardMemberSearch.toLowerCase()) ||
    member.email.toLowerCase().includes(boardMemberSearch.toLowerCase()) ||
    (member.department && member.department.toLowerCase().includes(boardMemberSearch.toLowerCase()))
  )

  const handleAddAnnouncementCategory = async () => {
    if (!newAnnouncementCategory.name) {
      toast.error('Kategori adı zorunludur')
      return
    }

    setAddingAnnouncementCategory(true)
    try {
      const res = await fetch('/api/announcements/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnnouncementCategory),
      })

      if (res.ok) {
        toast.success('Duyuru kategorisi eklendi')
        setNewAnnouncementCategory({ name: '', color: '#3b82f6' })
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kategori eklenirken hata oluştu')
      }
    } catch (error) {
      toast.error('Kategori eklenirken hata oluştu')
    } finally {
      setAddingAnnouncementCategory(false)
    }
  }

  const handleDeleteAnnouncementCategory = async (id: string) => {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return

    try {
      const res = await fetch(`/api/announcements/categories?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Kategori silindi')
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kategori silinirken hata oluştu')
      }
    } catch (error) {
      toast.error('Kategori silinirken hata oluştu')
    }
  }

  // IT Ticket kategori ekleme
  const handleAddTicketCategory = async () => {
    if (!newTicketCategory.name) {
      toast.error('Kategori adı zorunludur')
      return
    }

    setAddingTicketCategory(true)
    try {
      const res = await fetch('/api/tickets/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicketCategory),
      })

      if (res.ok) {
        toast.success('Kategori eklendi')
        setNewTicketCategory({ name: '', description: '', color: '#3b82f6', defaultPriority: 'NORMAL' })
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kategori eklenirken hata oluştu')
      }
    } catch (error) {
      toast.error('Kategori eklenirken hata oluştu')
    } finally {
      setAddingTicketCategory(false)
    }
  }

  const handleDeleteTicketCategory = async (id: string) => {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return

    try {
      const res = await fetch(`/api/tickets/categories?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Kategori silindi')
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kategori silinirken hata oluştu')
      }
    } catch (error) {
      toast.error('Kategori silinirken hata oluştu')
    }
  }

  const handleDeleteSurvey = async (id: string) => {
    if (!confirm('Bu anketi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) return

    try {
      const res = await fetch(`/api/surveys/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Anket silindi')
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Anket silinirken hata oluştu')
      }
    } catch (error) {
      toast.error('Anket silinirken hata oluştu')
    }
  }

  const getSurveyStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return { label: 'Taslak', color: 'bg-gray-100 text-gray-800' }
      case 'ACTIVE':
        return { label: 'Aktif', color: 'bg-green-100 text-green-800' }
      case 'CLOSED':
        return { label: 'Kapalı', color: 'bg-red-100 text-red-800' }
      case 'ARCHIVED':
        return { label: 'Arşivlendi', color: 'bg-purple-100 text-purple-800' }
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800' }
    }
  }

  const getSurveyTypeBadge = (type: string) => {
    switch (type) {
      case 'POLL':
        return { label: 'Oylama', color: 'bg-blue-100 text-blue-800' }
      case 'FEEDBACK':
        return { label: 'Geri Bildirim', color: 'bg-amber-100 text-amber-800' }
      case 'QUESTIONNAIRE':
        return { label: 'Anket', color: 'bg-indigo-100 text-indigo-800' }
      default:
        return { label: type, color: 'bg-gray-100 text-gray-800' }
    }
  }

  const handleAdd = async () => {
    try {
      let endpoint = ''
      let body: any = { name: formData.name, code: formData.code }

      if (editingType === 'location') endpoint = '/api/settings/locations'
      else if (editingType === 'device-type') endpoint = '/api/settings/device-types'
      else if (editingType === 'device-model') {
        endpoint = '/api/settings/device-models'
        body.manufacturer = formData.manufacturer
      }
      else if (editingType === 'device-name') endpoint = '/api/settings/device-names'
      else if (editingType === 'department') endpoint = '/api/settings/departments'

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success('Başarıyla eklendi')
        setIsAddDialogOpen(false)
        resetForm()
        loadData()
      } else {
        toast.error('Eklenirken bir hata oluştu')
      }
    } catch (error) {
      console.error('Ekleme hatası:', error)
      toast.error('Eklenirken bir hata oluştu')
    }
  }

  const handleEdit = async () => {
    try {
      let endpoint = ''
      let body: any = {
        name: formData.name,
        code: formData.code,
        isActive: editingItem.isActive,
        sortOrder: editingItem.sortOrder,
      }

      if (editingType === 'location') endpoint = `/api/settings/locations/${editingItem.id}`
      else if (editingType === 'device-type') endpoint = `/api/settings/device-types/${editingItem.id}`
      else if (editingType === 'device-model') {
        endpoint = `/api/settings/device-models/${editingItem.id}`
        body.manufacturer = formData.manufacturer
      }
      else if (editingType === 'device-name') endpoint = `/api/settings/device-names/${editingItem.id}`
      else if (editingType === 'department') endpoint = `/api/settings/departments/${editingItem.id}`

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success('Başarıyla güncellendi')
        setIsEditDialogOpen(false)
        setEditingItem(null)
        resetForm()
        loadData()
      } else {
        toast.error('Güncellenirken bir hata oluştu')
      }
    } catch (error) {
      console.error('Güncelleme hatası:', error)
      toast.error('Güncellenirken bir hata oluştu')
    }
  }

  const handleDelete = async (id: string, type: EditingType) => {
    if (!confirm('Silmek istediğinizden emin misiniz?')) return

    try {
      let endpoint = ''
      if (type === 'location') endpoint = `/api/settings/locations/${id}`
      else if (type === 'device-type') endpoint = `/api/settings/device-types/${id}`
      else if (type === 'device-model') endpoint = `/api/settings/device-models/${id}`
      else if (type === 'device-name') endpoint = `/api/settings/device-names/${id}`
      else if (type === 'department') endpoint = `/api/settings/departments/${id}`

      const res = await fetch(endpoint, { method: 'DELETE' })

      if (res.ok) {
        toast.success('Başarıyla silindi')
        loadData()
      } else {
        toast.error('Silinirken bir hata oluştu')
      }
    } catch (error) {
      console.error('Silme hatası:', error)
      toast.error('Silinirken bir hata oluştu')
    }
  }

  const openAddDialog = (type: EditingType) => {
    setEditingType(type)
    resetForm()
    setIsAddDialogOpen(true)
  }

  const openEditDialog = (item: any, type: EditingType) => {
    setEditingType(type)
    setEditingItem(item)
    setFormData({
      name: item.name,
      code: item.code || '',
      manufacturer: item.manufacturer || '',
      description: item.description || '',
      color: item.color || '#3b82f6',
    })
    setIsEditDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({ name: '', code: '', manufacturer: '', description: '', color: '#3b82f6' })
  }

  const handleSendTestEmail = async () => {
    if (!emailTest.email) {
      toast.error('E-posta adresi gerekli')
      return
    }

    setEmailTest({ ...emailTest, sending: true })

    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailTest.email,
          name: emailTest.name || 'Test Kullanıcı',
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        toast.success('Test e-postası başarıyla gönderildi!')
        setEmailTest({ email: '', name: '', sending: false })
      } else {
        toast.error(data.error || 'E-posta gönderilemedi')
        setEmailTest({ ...emailTest, sending: false })
      }
    } catch (error) {
      console.error('E-posta test hatası:', error)
      toast.error('E-posta gönderilirken bir hata oluştu')
      setEmailTest({ ...emailTest, sending: false })
    }
  }

  const getDialogTitle = () => {
    if (editingType === 'location') return 'Lokasyon'
    if (editingType === 'device-type') return 'Cihaz Tipi'
    if (editingType === 'device-model') return 'Cihaz Modeli'
    if (editingType === 'device-name') return 'Cihaz Adı'
    if (editingType === 'department') return 'Departman'
    if (editingType === 'task-category') return 'Görev Kategorisi'
    if (editingType === 'announcement-category') return 'Duyuru Kategorisi'
    return ''
  }

  const ItemList = ({ items, type, emptyText }: { items: any[], type: EditingType, emptyText: string }) => (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{emptyText}</p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
          >
            <div className="flex-1">
              <p className="font-medium text-sm">{item.name}</p>
              <div className="flex gap-3 text-xs text-muted-foreground">
                {item.code && <span>Kod: {item.code}</span>}
                {item.manufacturer && <span>Üretici: {item.manufacturer}</span>}
                <span className={item.isActive ? 'text-green-600' : 'text-red-600'}>
                  {item.isActive ? 'Aktif' : 'Pasif'}
                </span>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item, type)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id, type)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ayarlar</h1>
          <p className="text-muted-foreground">
            Sistem ve modül ayarlarını yönetin
          </p>
        </div>
      </div>

      {/* Push Bildirimleri */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle>Push Bildirimleri</CardTitle>
              <CardDescription>Mobil bildirim ayarlarını yönetin</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <NotificationToggle />
        </CardContent>
      </Card>

      {/* Dashboard Ayarları */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setDashboardOpen(!dashboardOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                <LayoutDashboard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Dashboard Ayarları</CardTitle>
                  <a
                    href="/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <CardDescription>Sistem durumu ve genel ayarlar</CardDescription>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${dashboardOpen ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        {dashboardOpen && (
          <CardContent>
            <div className="space-y-4">
              {/* Sistem Notu / Duyuru */}
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${systemNotice.enabled ? 'bg-amber-100 dark:bg-amber-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <AlertTriangle className={`h-5 w-5 ${systemNotice.enabled ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Sistem Notu / Duyuru</h3>
                      <p className="text-sm text-muted-foreground">
                        Dashboard'da kullanıcılara gösterilecek bilgilendirme mesajı
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${systemNotice.enabled ? 'text-amber-600' : 'text-gray-500'}`}>
                      {systemNotice.enabled ? 'Aktif' : 'Kapalı'}
                    </span>
                    <Switch
                      checked={systemNotice.enabled}
                      onCheckedChange={(checked) => {
                        setSystemNotice(prev => ({ ...prev, enabled: checked }))
                        setNoticeEdited(true)
                      }}
                      disabled={savingSettings}
                    />
                  </div>
                </div>

                {/* Not içeriği */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="notice-title" className="text-sm font-medium">Başlık</Label>
                    <Input
                      id="notice-title"
                      placeholder="Örn: Sistem Bakımda"
                      value={systemNotice.title}
                      onChange={(e) => {
                        setSystemNotice(prev => ({ ...prev, title: e.target.value }))
                        setNoticeEdited(true)
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notice-message" className="text-sm font-medium">Mesaj</Label>
                    <Textarea
                      id="notice-message"
                      placeholder="Örn: Yangın Güvenliği Modülü bakımda. Lütfen daha sonra tekrar deneyiniz."
                      value={systemNotice.message}
                      onChange={(e) => {
                        setSystemNotice(prev => ({ ...prev, message: e.target.value }))
                        setNoticeEdited(true)
                      }}
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Önizleme */}
                {systemNotice.enabled && (systemNotice.title || systemNotice.message) && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground mb-2">Önizleme:</p>
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                      {systemNotice.title && (
                        <p className="font-semibold text-amber-800 dark:text-amber-200">{systemNotice.title}</p>
                      )}
                      {systemNotice.message && (
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{systemNotice.message}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Kaydet butonu */}
                {noticeEdited && (
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSaveSystemNotice}
                      disabled={savingSettings}
                      size="sm"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {savingSettings ? 'Kaydediliyor...' : 'Kaydet'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Yemek Menüsü Yönetimi */}
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                      <UtensilsCrossed className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Yemek Menüsü Yönetimi</h3>
                      <p className="text-sm text-muted-foreground">
                        Haftalık yemek menüsünü Excel ile yükleyin veya şablon indirin
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Şablon İndir */}
                  <div className="p-3 border rounded-lg bg-background">
                    <h4 className="font-medium mb-2">Excel Şablonu İndir</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Yemek menüsü girmek için Excel şablonunu indirin
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open('/api/menu/template', '_blank')
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Şablon İndir
                    </Button>
                  </div>

                  {/* Excel Yükle */}
                  <div className="p-3 border rounded-lg bg-background">
                    <h4 className="font-medium mb-2">Excel Dosyası Yükle</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Doldurulmuş Excel dosyasını yükleyerek menüleri import edin
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept=".xlsx,.xls"
                        id="menu-upload"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return

                          const formData = new FormData()
                          formData.append('file', file)

                          try {
                            const res = await fetch('/api/menu/import', {
                              method: 'POST',
                              body: formData
                            })
                            const data = await res.json()
                            if (res.ok) {
                              toast.success(data.message || 'Menüler başarıyla yüklendi')
                            } else {
                              toast.error(data.error || 'Yükleme başarısız')
                            }
                          } catch {
                            toast.error('Dosya yüklenirken hata oluştu')
                          }

                          // Input'u sıfırla
                          e.target.value = ''
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          document.getElementById('menu-upload')?.click()
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Excel Yükle
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Yardım */}
                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <p className="font-medium mb-1">Excel Şablonu Kullanımı:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Tarih sütununu DD.MM.YYYY formatında doldurun</li>
                    <li>Çorba, Ana Yemek, Yan Yemek, İçecek sütunlarını doldurun</li>
                    <li>Tatil günleri için &quot;Tatil&quot; sütununa &quot;Evet&quot; yazın</li>
                    <li>Hafta sonu günleri otomatik olarak tatil işaretlenir</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Duyuru Sistemi Ayarları */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setAnnouncementSystemOpen(!announcementSystemOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                <Megaphone className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Duyuru Sistemi Ayarları</CardTitle>
                  <a
                    href="/announcements"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <CardDescription>Duyuru kategorileri ve anket yönetimi</CardDescription>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${announcementSystemOpen ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        {announcementSystemOpen && (
          <CardContent>
            <div className="space-y-3">
              {/* Duyuru Kategorileri */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setAnnouncementCategoriesOpen(!announcementCategoriesOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Duyuru Kategorileri</h3>
                    <span className="text-xs text-muted-foreground">({announcementCategories.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${announcementCategoriesOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {announcementCategoriesOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <p className="text-sm text-muted-foreground mb-3">
                        Duyuruları kategorize etmek için etiketler oluşturun (örn: Genel, İK, IT, Kalite).
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Kategori adı *"
                          value={newAnnouncementCategory.name}
                          onChange={(e) => setNewAnnouncementCategory({ ...newAnnouncementCategory, name: e.target.value })}
                          className="flex-1"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newAnnouncementCategory.color}
                            onChange={(e) => setNewAnnouncementCategory({ ...newAnnouncementCategory, color: e.target.value })}
                            className="w-9 h-9 rounded cursor-pointer border"
                          />
                        </div>
                        <Button
                          onClick={handleAddAnnouncementCategory}
                          disabled={addingAnnouncementCategory || !newAnnouncementCategory.name}
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ekle
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 border-b bg-background">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Kategori ara..."
                          value={announcementCategorySearch}
                          onChange={(e) => setAnnouncementCategorySearch(e.target.value)}
                          className="pl-8 h-9"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto">
                      {filteredAnnouncementCategories.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          {announcementCategorySearch ? "Sonuç bulunamadı" : "Henüz kategori eklenmemiş"}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {filteredAnnouncementCategories.map((cat) => (
                            <div
                              key={cat.id}
                              className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: cat.color || '#3b82f6' }}
                                />
                                <div>
                                  <span className="text-sm font-medium">{cat.name}</span>
                                </div>
                                {cat._count && cat._count.announcements > 0 && (
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                    {cat._count.announcements} duyuru
                                  </span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteAnnouncementCategory(cat.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Anketler */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSurveysOpen(!surveysOpen)}
                >
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Anketler</h3>
                    <span className="text-xs text-muted-foreground">({surveys.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${surveysOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {surveysOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <p className="text-sm text-muted-foreground mb-3">
                        Sistemdeki tüm anketleri görüntüleyin ve yönetin. <Link href="/announcements/manage" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>Yeni anket oluşturmak için tıklayın</Link>
                      </p>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Anket ara..."
                          value={surveySearch}
                          onChange={(e) => setSurveySearch(e.target.value)}
                          className="pl-8 h-9"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="p-3 max-h-96 overflow-y-auto">
                      {filteredSurveys.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          {surveySearch ? "Sonuç bulunamadı" : "Henüz anket oluşturulmamış"}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {filteredSurveys.map((survey) => {
                            const statusBadge = getSurveyStatusBadge(survey.status)
                            const typeBadge = getSurveyTypeBadge(survey.surveyType)
                            return (
                              <div
                                key={survey.id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-mono text-muted-foreground">{survey.surveyNumber}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge.color}`}>
                                      {statusBadge.label}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${typeBadge.color}`}>
                                      {typeBadge.label}
                                    </span>
                                    {survey.isAnonymous && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                                        Anonim
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm font-medium truncate">{survey.title}</p>
                                  {survey.description && (
                                    <p className="text-xs text-muted-foreground truncate">{survey.description}</p>
                                  )}
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <ClipboardList className="h-3 w-3" />
                                      {survey._count.questions} soru
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <BarChart3 className="h-3 w-3" />
                                      {survey._count.responses} yanıt
                                    </span>
                                    {survey.endsAt && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Bitiş: {new Date(survey.endsAt).toLocaleDateString('tr-TR')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                  <a
                                    href={`/announcements/manage?surveyId=${survey.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </a>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteSurvey(survey.id)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* IT Ticket Ayarları */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setItTicketOpen(!itTicketOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Headphones className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>IT Ticket Ayarları</CardTitle>
                  <a
                    href="/it-support"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <CardDescription>IT destek talep kategorileri ve ayarları</CardDescription>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${itTicketOpen ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        {itTicketOpen && (
          <CardContent>
            <div className="space-y-3">
              {/* Ticket Kategorileri */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setTicketCategoriesOpen(!ticketCategoriesOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Ticket Kategorileri</h3>
                    <span className="text-xs text-muted-foreground">({ticketCategories.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${ticketCategoriesOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {ticketCategoriesOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <p className="text-sm text-muted-foreground mb-3">
                        IT destek taleplerini kategorize etmek için etiketler oluşturun (örn: Donanım, Yazılım, Ağ, Erişim İzni).
                      </p>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Kategori adı *"
                            value={newTicketCategory.name}
                            onChange={(e) => setNewTicketCategory({ ...newTicketCategory, name: e.target.value })}
                            className="flex-1"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={newTicketCategory.color}
                              onChange={(e) => setNewTicketCategory({ ...newTicketCategory, color: e.target.value })}
                              className="w-9 h-9 rounded cursor-pointer border"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Açıklama (isteğe bağlı)"
                            value={newTicketCategory.description}
                            onChange={(e) => setNewTicketCategory({ ...newTicketCategory, description: e.target.value })}
                            className="flex-1"
                          />
                          <select
                            value={newTicketCategory.defaultPriority}
                            onChange={(e) => setNewTicketCategory({ ...newTicketCategory, defaultPriority: e.target.value })}
                            className="h-9 px-3 rounded-md border bg-background text-sm"
                          >
                            <option value="TICKET_LOW">Düşük</option>
                            <option value="NORMAL">Normal</option>
                            <option value="TICKET_HIGH">Yüksek</option>
                            <option value="TICKET_CRITICAL">Kritik</option>
                          </select>
                          <Button
                            onClick={handleAddTicketCategory}
                            disabled={addingTicketCategory || !newTicketCategory.name}
                            size="sm"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Ekle
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 border-b bg-background">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Kategori ara..."
                          value={ticketCategorySearch}
                          onChange={(e) => setTicketCategorySearch(e.target.value)}
                          className="pl-8 h-9"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto">
                      {filteredTicketCategories.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          {ticketCategorySearch ? "Sonuç bulunamadı" : "Henüz kategori eklenmemiş"}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {filteredTicketCategories.map((cat) => (
                            <div
                              key={cat.id}
                              className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: cat.color || '#3b82f6' }}
                                />
                                <div>
                                  <span className="text-sm font-medium">{cat.name}</span>
                                  {cat.description && (
                                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                                  )}
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  cat.defaultPriority === 'TICKET_CRITICAL' ? 'bg-red-100 text-red-800' :
                                  cat.defaultPriority === 'TICKET_HIGH' ? 'bg-orange-100 text-orange-800' :
                                  cat.defaultPriority === 'NORMAL' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {cat.defaultPriority === 'TICKET_CRITICAL' ? 'Kritik' :
                                   cat.defaultPriority === 'TICKET_HIGH' ? 'Yüksek' :
                                   cat.defaultPriority === 'NORMAL' ? 'Normal' : 'Düşük'}
                                </span>
                                {cat._count && cat._count.tickets > 0 && (
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                    {cat._count.tickets} ticket
                                  </span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTicketCategory(cat.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Talep Tipleri */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setTicketTypesOpen(!ticketTypesOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Talep Tipleri</h3>
                    <span className="text-xs text-muted-foreground">(4)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${ticketTypesOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {ticketTypesOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <p className="text-sm text-muted-foreground">
                        ITIL standartlarına uygun talep tipleri. Bu tipler sistem tarafından tanımlıdır.
                      </p>
                    </div>
                    <div className="p-3">
                      <div className="space-y-2">
                        {/* INCIDENT */}
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <div>
                              <span className="text-sm font-medium">Olay (Incident)</span>
                              <p className="text-xs text-muted-foreground">Hizmet kesintisi veya kalite düşüşü</p>
                            </div>
                          </div>
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">INCIDENT</span>
                        </div>

                        {/* SERVICE_REQUEST */}
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <div>
                              <span className="text-sm font-medium">Hizmet Talebi (Service Request)</span>
                              <p className="text-xs text-muted-foreground">Standart hizmet talepleri (yazılım kurulumu, erişim izni vb.)</p>
                            </div>
                          </div>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">SERVICE_REQUEST</span>
                        </div>

                        {/* PROBLEM */}
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            <div>
                              <span className="text-sm font-medium">Problem</span>
                              <p className="text-xs text-muted-foreground">Tekrarlayan olayların kök neden analizi</p>
                            </div>
                          </div>
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">PROBLEM</span>
                        </div>

                        {/* CHANGE_REQUEST */}
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-purple-500" />
                            <div>
                              <span className="text-sm font-medium">Değişiklik Talebi (Change Request)</span>
                              <p className="text-xs text-muted-foreground">Sistem veya altyapı değişiklik talepleri</p>
                            </div>
                          </div>
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">CHANGE_REQUEST</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Kalibrasyon Ayarları */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setCalibrationOpen(!calibrationOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Gauge className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Kalibrasyon Ayarları</CardTitle>
                  <a
                    href="/calibration"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <CardDescription>Kalibrasyon modülü için gerekli tanımlamalar</CardDescription>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${calibrationOpen ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        {calibrationOpen && (
          <CardContent>
            <div className="space-y-3">
              {/* Lokasyonlar */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setLocationsOpen(!locationsOpen)}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Lokasyonlar</h3>
                    <span className="text-xs text-muted-foreground">({locations.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openAddDialog('location')
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Ekle
                    </Button>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${locationsOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {locationsOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Lokasyon ara..."
                          value={locationSearch}
                          onChange={(e) => setLocationSearch(e.target.value)}
                          className="pl-8 h-9"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto">
                      <ItemList items={filteredLocations} type="location" emptyText={locationSearch ? "Sonuç bulunamadı" : "Henüz lokasyon eklenmemiş"} />
                    </div>
                  </div>
                )}
              </div>

              {/* Cihaz Tipleri */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setDeviceTypesOpen(!deviceTypesOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Cihaz Tipleri</h3>
                    <span className="text-xs text-muted-foreground">({deviceTypes.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openAddDialog('device-type')
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Ekle
                    </Button>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${deviceTypesOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {deviceTypesOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Cihaz tipi ara..."
                          value={deviceTypeSearch}
                          onChange={(e) => setDeviceTypeSearch(e.target.value)}
                          className="pl-8 h-9"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto">
                      <ItemList items={filteredDeviceTypes} type="device-type" emptyText={deviceTypeSearch ? "Sonuç bulunamadı" : "Henüz cihaz tipi eklenmemiş"} />
                    </div>
                  </div>
                )}
              </div>

              {/* Cihaz Modelleri */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setDeviceModelsOpen(!deviceModelsOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Cihaz Modelleri</h3>
                    <span className="text-xs text-muted-foreground">({deviceModels.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openAddDialog('device-model')
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Ekle
                    </Button>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${deviceModelsOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {deviceModelsOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Cihaz modeli ara..."
                          value={deviceModelSearch}
                          onChange={(e) => setDeviceModelSearch(e.target.value)}
                          className="pl-8 h-9"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto">
                      <ItemList items={filteredDeviceModels} type="device-model" emptyText={deviceModelSearch ? "Sonuç bulunamadı" : "Henüz cihaz modeli eklenmemiş"} />
                    </div>
                  </div>
                )}
              </div>

              {/* Cihaz Adları */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setDeviceNamesOpen(!deviceNamesOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Cihaz Adları</h3>
                    <span className="text-xs text-muted-foreground">({deviceNames.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openAddDialog('device-name')
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Ekle
                    </Button>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${deviceNamesOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {deviceNamesOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Cihaz adı ara..."
                          value={deviceNameSearch}
                          onChange={(e) => setDeviceNameSearch(e.target.value)}
                          className="pl-8 h-9"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto">
                      <ItemList items={filteredDeviceNames} type="device-name" emptyText={deviceNameSearch ? "Sonuç bulunamadı" : "Henüz cihaz adı eklenmemiş"} />
                    </div>
                  </div>
                )}
              </div>

              {/* Departmanlar */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setDepartmentsOpen(!departmentsOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Departmanlar</h3>
                    <span className="text-xs text-muted-foreground">({departments.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openAddDialog('department')
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Ekle
                    </Button>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${departmentsOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {departmentsOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Departman ara..."
                          value={departmentSearch}
                          onChange={(e) => setDepartmentSearch(e.target.value)}
                          className="pl-8 h-9"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto">
                      <ItemList items={filteredDepartments} type="department" emptyText={departmentSearch ? "Sonuç bulunamadı" : "Henüz departman eklenmemiş"} />
                    </div>
                  </div>
                )}
              </div>

              {/* Bildirim E-postaları */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setNotificationEmailsOpen(!notificationEmailsOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Bildirim E-postaları</h3>
                    <span className="text-xs text-muted-foreground">({notificationEmails.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${notificationEmailsOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {notificationEmailsOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <p className="text-sm text-muted-foreground mb-3">
                        Kalibrasyon bildirimleri bu e-posta adreslerine gönderilecektir.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="ornek@ilerigroup.com"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddNotificationEmail()
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleAddNotificationEmail}
                          disabled={addingEmail || !newEmail}
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ekle
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto">
                      {notificationEmails.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Henüz bildirim e-postası eklenmemiş
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {notificationEmails.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{item.email}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteNotificationEmail(item.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bildirim Kuralları */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setNotificationRulesOpen(!notificationRulesOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Bildirim Kuralları</h3>
                    <span className="text-xs text-muted-foreground">({notificationRules.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${notificationRulesOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {notificationRulesOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <p className="text-sm text-muted-foreground mb-3">
                        Hangi durumlarda bildirim e-postası gönderileceğini belirleyin.
                      </p>
                      <div className="flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[140px]">
                          <Label className="text-xs text-muted-foreground">Durum</Label>
                          <select
                            value={newRule.type}
                            onChange={(e) => {
                              const type = e.target.value as 'EXPIRING' | 'EXPIRED'
                              setNewRule({
                                ...newRule,
                                type,
                                period: type === 'EXPIRING' ? 'BEFORE' : 'AFTER',
                              })
                            }}
                            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                          >
                            <option value="EXPIRING">Süresi Yaklaşan</option>
                            <option value="EXPIRED">Süresi Dolan</option>
                          </select>
                        </div>
                        <div className="w-[80px]">
                          <Label className="text-xs text-muted-foreground">Süre</Label>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={newRule.days}
                            onChange={(e) => setNewRule({ ...newRule, days: parseInt(e.target.value) || 1 })}
                            className="h-9"
                          />
                        </div>
                        <div className="w-[80px]">
                          <Label className="text-xs text-muted-foreground">Periyod</Label>
                          <select
                            value={newRule.period}
                            disabled
                            className="w-full h-9 px-3 rounded-md border border-input bg-muted text-sm"
                          >
                            <option value="BEFORE">Kala</option>
                            <option value="AFTER">Sonra</option>
                          </select>
                        </div>
                        {newRule.type === 'EXPIRED' && (
                          <div className="flex items-center gap-2 h-9">
                            <input
                              type="checkbox"
                              id="repeatWeekly"
                              checked={newRule.repeatWeekly}
                              onChange={(e) => setNewRule({ ...newRule, repeatWeekly: e.target.checked })}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                            <Label htmlFor="repeatWeekly" className="text-xs whitespace-nowrap">
                              Haftalık tekrar
                            </Label>
                          </div>
                        )}
                        <Button
                          onClick={handleAddNotificationRule}
                          disabled={addingRule}
                          size="sm"
                          className="h-9"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ekle
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto">
                      {notificationRules.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Henüz bildirim kuralı eklenmemiş
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {notificationRules.map((rule) => (
                            <div
                              key={rule.id}
                              className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Bell className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{getRuleDescription(rule)}</span>
                                {rule.repeatWeekly && (
                                  <RefreshCw className="h-3 w-3 text-blue-500" />
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteNotificationRule(rule.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Öneri Sistemi Ayarları */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setSuggestionSystemOpen(!suggestionSystemOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg">
                <Lightbulb className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Öneri Sistemi Ayarları</CardTitle>
                  <a
                    href="/suggestions"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <CardDescription>Sürekli iyileştirme merkezi ve onay akışı ayarları</CardDescription>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${suggestionSystemOpen ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        {suggestionSystemOpen && (
          <CardContent>
            <div className="space-y-3">
              {/* Öneri Kurulu Üyeleri */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setBoardMembersOpen(!boardMembersOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Öneri Kurulu Üyeleri</h3>
                    <span className="text-xs text-muted-foreground">({suggestionBoardMembers.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${boardMembersOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {boardMembersOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <p className="text-sm text-muted-foreground mb-3">
                        Öneri Kurulu, departman yöneticilerinin onayladığı önerileri değerlendirir ve son kararı verir.
                      </p>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="E-posta adresi *"
                            value={newBoardMember.email}
                            onChange={(e) => setNewBoardMember({ ...newBoardMember, email: e.target.value })}
                            className="flex-1"
                          />
                          <Input
                            placeholder="Ad Soyad *"
                            value={newBoardMember.name}
                            onChange={(e) => setNewBoardMember({ ...newBoardMember, name: e.target.value })}
                            className="flex-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Departman"
                            value={newBoardMember.department}
                            onChange={(e) => setNewBoardMember({ ...newBoardMember, department: e.target.value })}
                            className="flex-1"
                          />
                          <Input
                            placeholder="Rol (Başkan, Üye, vb.)"
                            value={newBoardMember.role}
                            onChange={(e) => setNewBoardMember({ ...newBoardMember, role: e.target.value })}
                            className="flex-1"
                          />
                          <Button
                            onClick={handleAddBoardMember}
                            disabled={addingBoardMember || !newBoardMember.email || !newBoardMember.name}
                            size="sm"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Ekle
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 border-b bg-background">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Üye ara..."
                          value={boardMemberSearch}
                          onChange={(e) => setBoardMemberSearch(e.target.value)}
                          className="pl-8 h-9"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto">
                      {filteredBoardMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          {boardMemberSearch ? "Sonuç bulunamadı" : "Henüz Öneri Kurulu üyesi eklenmemiş"}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {filteredBoardMembers.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{member.name}</span>
                                    {member.role && (
                                      <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                                        {member.role}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{member.email}</p>
                                  {member.department && (
                                    <p className="text-xs text-muted-foreground">{member.department}</p>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteBoardMember(member.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Planlı Görevler Ayarları */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setTasksOpen(!tasksOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <CalendarCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Planlı Görevler Ayarları</CardTitle>
                  <a
                    href="/tasks"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <CardDescription>Planlı görevler modülü için kategori tanımlamaları</CardDescription>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${tasksOpen ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        {tasksOpen && (
          <CardContent>
            <div className="space-y-3">
              {/* Görev Kategorileri */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setTaskCategoriesOpen(!taskCategoriesOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Görev Kategorileri</h3>
                    <span className="text-xs text-muted-foreground">({taskCategories.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${taskCategoriesOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {taskCategoriesOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <p className="text-sm text-muted-foreground mb-3">
                        Görevleri gruplamak için kategoriler oluşturun (örn: Sertifikasyonlar, Yasal Denetimler, Bakım).
                      </p>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Kategori adı *"
                            value={newCategory.name}
                            onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                            className="flex-1"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={newCategory.color}
                              onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                              className="w-9 h-9 rounded cursor-pointer border"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Açıklama (opsiyonel)"
                            value={newCategory.description}
                            onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                            className="flex-1"
                          />
                          <Button
                            onClick={handleAddTaskCategory}
                            disabled={addingCategory || !newCategory.name}
                            size="sm"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Ekle
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 border-b bg-background">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Kategori ara..."
                          value={taskCategorySearch}
                          onChange={(e) => setTaskCategorySearch(e.target.value)}
                          className="pl-8 h-9"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto">
                      {filteredTaskCategories.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          {taskCategorySearch ? "Sonuç bulunamadı" : "Henüz kategori eklenmemiş"}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {filteredTaskCategories.map((cat) => (
                            <div
                              key={cat.id}
                              className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: cat.color || '#3b82f6' }}
                                />
                                <div>
                                  <span className="text-sm font-medium">{cat.name}</span>
                                  {cat.description && (
                                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                                  )}
                                </div>
                                {cat._count && cat._count.tasks > 0 && (
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                    {cat._count.tasks} görev
                                  </span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTaskCategory(cat.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bildirim E-postaları */}
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setTaskNotificationEmailsOpen(!taskNotificationEmailsOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Bildirim E-postaları</h3>
                    <span className="text-xs text-muted-foreground">({taskNotificationEmails.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${taskNotificationEmailsOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {taskNotificationEmailsOpen && (
                  <div className="border-t">
                    <div className="p-3 border-b bg-background">
                      <p className="text-sm text-muted-foreground mb-3">
                        Tüm görev bildirimlerinin gönderileceği e-posta adresleri. Bu adresler her görev oluşturulduğunda otomatik olarak bilgilendirilir.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="E-posta adresi"
                          value={newTaskEmail}
                          onChange={(e) => setNewTaskEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddTaskNotificationEmail()
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleAddTaskNotificationEmail}
                          disabled={addingTaskEmail || !newTaskEmail}
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ekle
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 max-h-64 overflow-y-auto">
                      {taskNotificationEmails.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Henüz bildirim e-postası eklenmemiş
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {taskNotificationEmails.map((email) => (
                            <div
                              key={email.id}
                              className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{email.email}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTaskNotificationEmail(email.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Yangın Güvenliği Ayarları */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setFireSafetyOpen(!fireSafetyOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Yangın Güvenliği Ayarları</CardTitle>
                  <a
                    href="/fire-safety"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <CardDescription>Yangın güvenliği modülü için gerekli tanımlamalar</CardDescription>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${fireSafetyOpen ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        {fireSafetyOpen && (
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Flame className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Yangın Güvenliği modülü yakında eklenecek</p>
              <p className="text-sm">Bu bölümde ekipman tipleri, kontrol periyotları vb. ayarlar yer alacak</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* E-Posta Ayarları */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setEmailOpen(!emailOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle>E-Posta Ayarları</CardTitle>
                <CardDescription>SMTP yapılandırması ve bildirim ayarları</CardDescription>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${emailOpen ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        {emailOpen && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SMTP Yapılandırması */}
              <div className="space-y-3">
                <h3 className="font-semibold">SMTP Yapılandırması</h3>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <pre className="text-xs overflow-x-auto">
{`SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="ilerihub@ilerigroup.com"
SMTP_PASSWORD="********"
SMTP_FROM="ILERIHub <ilerihub@ilerigroup.com>"`}
                  </pre>
                  <p className="text-xs text-muted-foreground mt-3">
                    💡 Yapılandırma .env dosyasından okunur
                  </p>
                </div>
              </div>

              {/* Test E-postası */}
              <div className="space-y-3">
                <h3 className="font-semibold">Test E-postası Gönder</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="test-email" className="text-sm">E-posta Adresi *</Label>
                    <Input
                      id="test-email"
                      type="email"
                      placeholder="test@example.com"
                      value={emailTest.email}
                      onChange={(e) => setEmailTest({ ...emailTest, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="test-name" className="text-sm">İsim (Opsiyonel)</Label>
                    <Input
                      id="test-name"
                      placeholder="Test Kullanıcı"
                      value={emailTest.name}
                      onChange={(e) => setEmailTest({ ...emailTest, name: e.target.value })}
                    />
                  </div>
                  <Button
                    onClick={handleSendTestEmail}
                    disabled={emailTest.sending}
                    className="w-full"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {emailTest.sending ? 'Gönderiliyor...' : 'Test E-postası Gönder'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni {getDialogTitle()}</DialogTitle>
            <DialogDescription>Yeni bir öğe ekleyin</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Ad *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={editingType === 'location' ? 'Örn: Ana Bina 1. Kat' : 'Örn: Kumpas'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Kod</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Örn: LOC_001"
              />
            </div>
            {editingType === 'device-model' && (
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Üretici</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="Örn: Mitutoyo"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>İptal</Button>
            <Button onClick={handleAdd}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getDialogTitle()} Düzenle</DialogTitle>
            <DialogDescription>Öğeyi güncelleyin</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Ad *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-code">Kod</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            {editingType === 'device-model' && (
              <div className="space-y-2">
                <Label htmlFor="edit-manufacturer">Üretici</Label>
                <Input
                  id="edit-manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>İptal</Button>
            <Button onClick={handleEdit}>Güncelle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
