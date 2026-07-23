"use client"

import { useState, useEffect } from "react"
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
import { Settings, Gauge, Lightbulb, CalendarCheck, Flame, Mail, Megaphone, Headphones, Smartphone, LayoutDashboard, UserCheck, Clock, Plus, Trash2, Search, Loader2, RefreshCw, Users, CheckCircle2, AlertTriangle, Briefcase } from "lucide-react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { NotificationToggle } from "@/components/pwa/notification-permission"
import { CollapsibleSection } from "@/components/settings/CollapsibleSection"
import {
  DashboardSettingsPanel,
  AnnouncementSettingsPanel,
  CalibrationSettingsPanel,
  ITTicketSettingsPanel,
  SuggestionSettingsPanel,
  TaskSettingsPanel,
  EmailSettingsPanel
} from "@/components/settings/panels"
import type {
  Location,
  DeviceType,
  DeviceModel,
  DeviceName,
  CalibrationDepartment,
  ProductionSection,
  NotificationEmail,
  NotificationRule,
  TaskCategory,
  SuggestionBoardMember,
  AnnouncementCategory,
  TicketCategory,
  Survey,
  SystemNotice,
  EditingType,
  SettingsFormData,
  EmailTestData
} from "@/types/settings"

export default function SettingsPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role || 'EMPLOYEE'
  const userDepartment = ((session?.user as any)?.department || '').toLowerCase()
  const userOu = ((session?.user as any)?.ou || '').toLowerCase()
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole)
  const isKaliteUser = !isAdmin && (
    userRole === 'QUALITY_MANAGER' ||
    userDepartment.includes('kalite') || userDepartment.includes('laboratuvar') ||
    userOu.includes('kalite') || userOu.includes('laboratuvar')
  )

  // Data states
  const [locations, setLocations] = useState<Location[]>([])
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([])
  const [deviceModels, setDeviceModels] = useState<DeviceModel[]>([])
  const [deviceNames, setDeviceNames] = useState<DeviceName[]>([])
  const [departments, setDepartments] = useState<CalibrationDepartment[]>([])
  const [productionSections, setProductionSections] = useState<ProductionSection[]>([])
  const [realDepartments, setRealDepartments] = useState<{ id: string; name: string }[]>([])
  const [expiringEmails, setExpiringEmails] = useState<NotificationEmail[]>([])
  const [expiredEmails, setExpiredEmails] = useState<NotificationEmail[]>([])
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([])
  const [taskCategories, setTaskCategories] = useState<TaskCategory[]>([])
  const [taskNotificationEmails, setTaskNotificationEmails] = useState<NotificationEmail[]>([])
  const [suggestionBoardMembers, setSuggestionBoardMembers] = useState<SuggestionBoardMember[]>([])
  const [announcementCategories, setAnnouncementCategories] = useState<AnnouncementCategory[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([])

  // Dashboard settings
  const [savingSettings, setSavingSettings] = useState(false)
  const [systemNotice, setSystemNotice] = useState<SystemNotice>({ enabled: false, title: '', message: '' })
  const [noticeEdited, setNoticeEdited] = useState(false)

  // Search states
  const [locationSearch, setLocationSearch] = useState('')
  const [deviceTypeSearch, setDeviceTypeSearch] = useState('')
  const [deviceModelSearch, setDeviceModelSearch] = useState('')
  const [deviceNameSearch, setDeviceNameSearch] = useState('')
  const [departmentSearch, setDepartmentSearch] = useState('')
  const [productionSectionSearch, setProductionSectionSearch] = useState('')
  const [taskCategorySearch, setTaskCategorySearch] = useState('')
  const [announcementCategorySearch, setAnnouncementCategorySearch] = useState('')
  const [surveySearch, setSurveySearch] = useState('')
  const [ticketCategorySearch, setTicketCategorySearch] = useState('')
  const [boardMemberSearch, setBoardMemberSearch] = useState('')

  // New item states
  const [newExpiringEmail, setNewExpiringEmail] = useState('')
  const [addingExpiringEmail, setAddingExpiringEmail] = useState(false)
  const [newExpiredEmail, setNewExpiredEmail] = useState('')
  const [addingExpiredEmail, setAddingExpiredEmail] = useState(false)
  const [newRule, setNewRule] = useState({
    type: 'EXPIRING' as 'EXPIRING' | 'EXPIRED',
    period: 'BEFORE' as 'BEFORE' | 'AFTER',
    days: 7,
    repeatWeekly: false,
  })
  const [addingRule, setAddingRule] = useState(false)
  const [newCategory, setNewCategory] = useState({ name: '', description: '', color: '#3b82f6' })
  const [addingCategory, setAddingCategory] = useState(false)
  const [newTaskEmail, setNewTaskEmail] = useState('')
  const [addingTaskEmail, setAddingTaskEmail] = useState(false)
  const [newAnnouncementCategory, setNewAnnouncementCategory] = useState({ name: '', color: '#3b82f6' })
  const [addingAnnouncementCategory, setAddingAnnouncementCategory] = useState(false)
  const [newTicketCategory, setNewTicketCategory] = useState({ name: '', description: '', color: '#3b82f6', defaultPriority: 'NORMAL' })
  const [addingTicketCategory, setAddingTicketCategory] = useState(false)
  const [newBoardMember, setNewBoardMember] = useState({ email: '', name: '', department: '', role: '' })
  const [addingBoardMember, setAddingBoardMember] = useState(false)

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<EditingType>(null)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState<SettingsFormData>({ name: '', code: '', manufacturer: '', description: '', color: '#3b82f6', departmentId: '', isHurdaTarget: false })

  // Email test
  const [emailTest, setEmailTest] = useState<EmailTestData>({ email: '', name: '', sending: false })

  // Mesai formu yetkili kullanıcılar
  const [overtimeAuthUsers, setOvertimeAuthUsers] = useState<{ id: string; userId: string; user: { id: string; name: string; email: string; department: string | null; jobTitle: string | null } }[]>([])
  const [overtimeAllUsers, setOvertimeAllUsers] = useState<{ id: string; name: string; email: string; department: string | null; jobTitle: string | null }[]>([])
  const [overtimeUserSearch, setOvertimeUserSearch] = useState('')
  const [overtimeUsersLoaded, setOvertimeUsersLoaded] = useState(false)
  const [overtimeAdding, setOvertimeAdding] = useState<string | null>(null)
  const [overtimeRemoving, setOvertimeRemoving] = useState<string | null>(null)

  // LDAP Sync states
  const [ldapSyncing, setLdapSyncing] = useState(false)
  const [ldapSyncResult, setLdapSyncResult] = useState<{
    status: string
    created: number
    updated: number
    deactivated: number
    errors: number
    totalLdap: number
    totalDb: number
    duration?: number
    lastSyncAt?: string | null
    errorDetails?: string[]
  } | null>(null)

  // Load data on mount
  useEffect(() => {
    loadData()
    if (!isKaliteUser) {
      loadOvertimeAuthUsers()
      loadOvertimeAllUsers()
      loadLdapSyncStatus()
    }
  }, [isKaliteUser])

  const loadData = async () => {
    try {
      // Kalite kullanıcıları için sadece kalibrasyon verilerini yükle
      const calibrationFetches = [
        fetch('/api/settings/locations'),
        fetch('/api/settings/device-types'),
        fetch('/api/settings/device-models'),
        fetch('/api/settings/device-names'),
        fetch('/api/settings/departments'),
        fetch('/api/settings/production-sections'),
        fetch('/api/settings/notification-emails?category=EXPIRING'),
        fetch('/api/settings/notification-emails?category=EXPIRED'),
        fetch('/api/settings/notification-rules'),
        fetch('/api/departments'),
      ]

      if (isKaliteUser) {
        const [locsRes, typesRes, modelsRes, namesRes, deptsRes, prodSectionsRes, expiringEmailsRes, expiredEmailsRes, rulesRes, realDeptsRes] = await Promise.all(calibrationFetches)

        if (locsRes.ok) setLocations(await locsRes.json())
        if (typesRes.ok) setDeviceTypes(await typesRes.json())
        if (modelsRes.ok) setDeviceModels(await modelsRes.json())
        if (namesRes.ok) setDeviceNames(await namesRes.json())
        if (deptsRes.ok) setDepartments(await deptsRes.json())
        if (prodSectionsRes.ok) setProductionSections(await prodSectionsRes.json())
        if (expiringEmailsRes.ok) setExpiringEmails(await expiringEmailsRes.json())
        if (expiredEmailsRes.ok) setExpiredEmails(await expiredEmailsRes.json())
        if (rulesRes.ok) setNotificationRules(await rulesRes.json())
        if (realDeptsRes.ok) setRealDepartments(await realDeptsRes.json())
      } else {
        const [locsRes, typesRes, modelsRes, namesRes, deptsRes, prodSectionsRes, expiringEmailsRes, expiredEmailsRes, rulesRes, realDeptsRes, categoriesRes, taskEmailsRes, boardMembersRes, systemRes, annCategoriesRes, surveysRes, ticketCategoriesRes] = await Promise.all([
          ...calibrationFetches,
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
        if (prodSectionsRes.ok) setProductionSections(await prodSectionsRes.json())
        if (expiringEmailsRes.ok) setExpiringEmails(await expiringEmailsRes.json())
        if (expiredEmailsRes.ok) setExpiredEmails(await expiredEmailsRes.json())
        if (rulesRes.ok) setNotificationRules(await rulesRes.json())
        if (realDeptsRes.ok) setRealDepartments(await realDeptsRes.json())
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
          setSystemNotice({
            enabled: settings['system_notice_enabled'] === 'true',
            title: settings['system_notice_title'] || '',
            message: settings['system_notice_message'] || ''
          })
        }
      }
    } catch (error) {
      console.error('Ayarlar yüklenirken hata:', error)
    }
  }

  // LDAP Sync fonksiyonları
  const loadLdapSyncStatus = async () => {
    try {
      const res = await fetch('/api/admin/ldap-sync')
      if (res.ok) {
        const data = await res.json()
        setLdapSyncResult(data)
      }
    } catch {
      // Sessiz hata - ilk açılışta normal
    }
  }

  const handleLdapSync = async () => {
    setLdapSyncing(true)
    try {
      const res = await fetch('/api/admin/ldap-sync', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        setLdapSyncResult(data)
        toast.success(`LDAP Sync tamamlandı: ${data.created} yeni, ${data.updated} güncellendi`)
      } else {
        toast.error(data.error || 'Senkronizasyon başarısız')
      }
    } catch {
      toast.error('LDAP sunucusuna bağlanılamadı')
    } finally {
      setLdapSyncing(false)
    }
  }

  // Mesai formu yetkili kullanıcı fonksiyonları
  const loadOvertimeAuthUsers = async () => {
    try {
      const res = await fetch('/api/overtime/authorized-users')
      if (res.ok) {
        const data = await res.json()
        setOvertimeAuthUsers(Array.isArray(data) ? data : [])
      }
    } catch {
      // Sessizce devam et
    }
  }

  const loadOvertimeAllUsers = async () => {
    if (overtimeUsersLoaded) return
    try {
      const res = await fetch('/api/users?source=db')
      if (res.ok) {
        const data = await res.json()
        const users = Array.isArray(data) ? data : data.data || []
        setOvertimeAllUsers(users)
        setOvertimeUsersLoaded(true)
      }
    } catch {
      toast.error('Kullanıcı listesi yüklenemedi')
    }
  }

  const handleAddOvertimeAuth = async (userId: string) => {
    setOvertimeAdding(userId)
    try {
      const res = await fetch('/api/overtime/authorized-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Yetki eklenemedi')
      }
      toast.success('Kullanıcı yetkilendirildi')
      await loadOvertimeAuthUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bir hata oluştu')
    } finally {
      setOvertimeAdding(null)
    }
  }

  const handleRemoveOvertimeAuth = async (userId: string) => {
    setOvertimeRemoving(userId)
    try {
      const res = await fetch('/api/overtime/authorized-users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Yetki kaldırılamadı')
      }
      toast.success('Yetki kaldırıldı')
      await loadOvertimeAuthUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bir hata oluştu')
    } finally {
      setOvertimeRemoving(null)
    }
  }

  // System notice handlers
  const handleSaveSystemNotice = async () => {
    setSavingSettings(true)
    try {
      const requests = [
        fetch('/api/system/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'system_notice_enabled', value: systemNotice.enabled ? 'true' : 'false', category: 'dashboard' }) }),
        fetch('/api/system/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'system_notice_title', value: systemNotice.title, category: 'dashboard' }) }),
        fetch('/api/system/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'system_notice_message', value: systemNotice.message, category: 'dashboard' }) }),
      ]
      const responses = await Promise.all(requests)
      if (responses.every(res => res.ok)) {
        setNoticeEdited(false)
        toast.success('Sistem notu kaydedildi')
      } else {
        toast.error('Sistem notu kaydedilirken hata oluştu')
      }
    } catch {
      toast.error('Sistem notu kaydedilirken hata oluştu')
    } finally {
      setSavingSettings(false)
    }
  }

  // Notification email handlers
  const handleAddExpiringEmail = async () => {
    if (!newExpiringEmail || !newExpiringEmail.includes('@')) {
      toast.error('Geçerli bir e-posta adresi giriniz')
      return
    }
    setAddingExpiringEmail(true)
    try {
      const res = await fetch('/api/settings/notification-emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newExpiringEmail, category: 'EXPIRING' }) })
      if (res.ok) {
        toast.success('E-posta adresi eklendi (Süresi Yaklaşanlar)')
        setNewExpiringEmail('')
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'E-posta eklenirken hata oluştu')
      }
    } catch {
      toast.error('E-posta eklenirken hata oluştu')
    } finally {
      setAddingExpiringEmail(false)
    }
  }

  const handleAddExpiredEmail = async () => {
    if (!newExpiredEmail || !newExpiredEmail.includes('@')) {
      toast.error('Geçerli bir e-posta adresi giriniz')
      return
    }
    setAddingExpiredEmail(true)
    try {
      const res = await fetch('/api/settings/notification-emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newExpiredEmail, category: 'EXPIRED' }) })
      if (res.ok) {
        toast.success('E-posta adresi eklendi (Süresi Dolanlar)')
        setNewExpiredEmail('')
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'E-posta eklenirken hata oluştu')
      }
    } catch {
      toast.error('E-posta eklenirken hata oluştu')
    } finally {
      setAddingExpiredEmail(false)
    }
  }

  const handleDeleteNotificationEmail = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/notification-emails/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('E-posta adresi silindi')
        loadData()
      } else {
        toast.error('E-posta silinirken hata oluştu')
      }
    } catch {
      toast.error('E-posta silinirken hata oluştu')
    }
  }

  // Notification rule handlers
  const handleAddNotificationRule = async () => {
    setAddingRule(true)
    try {
      const res = await fetch('/api/settings/notification-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRule) })
      if (res.ok) {
        toast.success('Bildirim kuralı eklendi')
        setNewRule({ type: 'EXPIRING', period: 'BEFORE', days: 7, repeatWeekly: false })
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kural eklenirken hata oluştu')
      }
    } catch {
      toast.error('Kural eklenirken hata oluştu')
    } finally {
      setAddingRule(false)
    }
  }

  const handleDeleteNotificationRule = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/notification-rules/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Bildirim kuralı silindi')
        loadData()
      } else {
        toast.error('Kural silinirken hata oluştu')
      }
    } catch {
      toast.error('Kural silinirken hata oluştu')
    }
  }

  // Task category handlers
  const handleAddTaskCategory = async () => {
    if (!newCategory.name) {
      toast.error('Kategori adı zorunludur')
      return
    }
    setAddingCategory(true)
    try {
      const res = await fetch('/api/tasks/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCategory) })
      if (res.ok) {
        toast.success('Kategori eklendi')
        setNewCategory({ name: '', description: '', color: '#3b82f6' })
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kategori eklenirken hata oluştu')
      }
    } catch {
      toast.error('Kategori eklenirken hata oluştu')
    } finally {
      setAddingCategory(false)
    }
  }

  const handleDeleteTaskCategory = async (id: string) => {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return
    try {
      const res = await fetch(`/api/tasks/categories?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Kategori silindi')
        loadData()
      } else {
        toast.error('Kategori silinirken hata oluştu')
      }
    } catch {
      toast.error('Kategori silinirken hata oluştu')
    }
  }

  // Task notification email handlers
  const handleAddTaskNotificationEmail = async () => {
    if (!newTaskEmail || !newTaskEmail.includes('@')) {
      toast.error('Geçerli bir e-posta adresi giriniz')
      return
    }
    setAddingTaskEmail(true)
    try {
      const res = await fetch('/api/tasks/notification-emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newTaskEmail }) })
      if (res.ok) {
        toast.success('E-posta adresi eklendi')
        setNewTaskEmail('')
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'E-posta eklenirken hata oluştu')
      }
    } catch {
      toast.error('E-posta eklenirken hata oluştu')
    } finally {
      setAddingTaskEmail(false)
    }
  }

  const handleDeleteTaskNotificationEmail = async (id: string) => {
    if (!confirm('Bu e-posta adresini silmek istediğinizden emin misiniz?')) return
    try {
      const res = await fetch(`/api/tasks/notification-emails?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('E-posta adresi silindi')
        loadData()
      } else {
        toast.error('E-posta silinirken hata oluştu')
      }
    } catch {
      toast.error('E-posta silinirken hata oluştu')
    }
  }

  // Board member handlers
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
      const res = await fetch('/api/suggestions/board-members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newBoardMember) })
      if (res.ok) {
        toast.success('Öneri Kurulu üyesi eklendi')
        setNewBoardMember({ email: '', name: '', department: '', role: '' })
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Üye eklenirken hata oluştu')
      }
    } catch {
      toast.error('Üye eklenirken hata oluştu')
    } finally {
      setAddingBoardMember(false)
    }
  }

  const handleDeleteBoardMember = async (id: string) => {
    if (!confirm('Bu üyeyi Öneri Kurulundan çıkarmak istediğinizden emin misiniz?')) return
    try {
      const res = await fetch(`/api/suggestions/board-members?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Üye kuruldan çıkarıldı')
        loadData()
      } else {
        toast.error('Üye silinirken hata oluştu')
      }
    } catch {
      toast.error('Üye silinirken hata oluştu')
    }
  }

  // Announcement category handlers
  const handleAddAnnouncementCategory = async () => {
    if (!newAnnouncementCategory.name) {
      toast.error('Kategori adı zorunludur')
      return
    }
    setAddingAnnouncementCategory(true)
    try {
      const res = await fetch('/api/announcements/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAnnouncementCategory) })
      if (res.ok) {
        toast.success('Duyuru kategorisi eklendi')
        setNewAnnouncementCategory({ name: '', color: '#3b82f6' })
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kategori eklenirken hata oluştu')
      }
    } catch {
      toast.error('Kategori eklenirken hata oluştu')
    } finally {
      setAddingAnnouncementCategory(false)
    }
  }

  const handleDeleteAnnouncementCategory = async (id: string) => {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return
    try {
      const res = await fetch(`/api/announcements/categories?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Kategori silindi')
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kategori silinirken hata oluştu')
      }
    } catch {
      toast.error('Kategori silinirken hata oluştu')
    }
  }

  // IT Ticket category handlers
  const handleAddTicketCategory = async () => {
    if (!newTicketCategory.name) {
      toast.error('Kategori adı zorunludur')
      return
    }
    setAddingTicketCategory(true)
    try {
      const res = await fetch('/api/tickets/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTicketCategory) })
      if (res.ok) {
        toast.success('Kategori eklendi')
        setNewTicketCategory({ name: '', description: '', color: '#3b82f6', defaultPriority: 'NORMAL' })
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kategori eklenirken hata oluştu')
      }
    } catch {
      toast.error('Kategori eklenirken hata oluştu')
    } finally {
      setAddingTicketCategory(false)
    }
  }

  const handleDeleteTicketCategory = async (id: string) => {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return
    try {
      const res = await fetch(`/api/tickets/categories?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Kategori silindi')
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Kategori silinirken hata oluştu')
      }
    } catch {
      toast.error('Kategori silinirken hata oluştu')
    }
  }

  // Survey handlers
  const handleDeleteSurvey = async (id: string) => {
    if (!confirm('Bu anketi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) return
    try {
      const res = await fetch(`/api/surveys/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Anket silindi')
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Anket silinirken hata oluştu')
      }
    } catch {
      toast.error('Anket silinirken hata oluştu')
    }
  }

  // CRUD handlers for calibration items
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
      else if (editingType === 'production-section') {
        endpoint = '/api/settings/production-sections'
        body.departmentId = formData.departmentId || null
        body.isHurdaTarget = formData.isHurdaTarget
      }

      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

      if (res.ok) {
        toast.success('Başarıyla eklendi')
        setIsAddDialogOpen(false)
        resetForm()
        await loadData()
      } else {
        toast.error('Eklenirken bir hata oluştu')
      }
    } catch {
      toast.error('Eklenirken bir hata oluştu')
    }
  }

  const handleEdit = async () => {
    try {
      let endpoint = ''
      let body: any = { name: formData.name, code: formData.code, isActive: editingItem.isActive, sortOrder: editingItem.sortOrder }

      if (editingType === 'location') endpoint = `/api/settings/locations/${editingItem.id}`
      else if (editingType === 'device-type') endpoint = `/api/settings/device-types/${editingItem.id}`
      else if (editingType === 'device-model') {
        endpoint = `/api/settings/device-models/${editingItem.id}`
        body.manufacturer = formData.manufacturer
      }
      else if (editingType === 'device-name') endpoint = `/api/settings/device-names/${editingItem.id}`
      else if (editingType === 'department') endpoint = `/api/settings/departments/${editingItem.id}`
      else if (editingType === 'production-section') {
        endpoint = `/api/settings/production-sections/${editingItem.id}`
        body.departmentId = formData.departmentId || null
        body.isHurdaTarget = formData.isHurdaTarget
      }

      const res = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

      if (res.ok) {
        toast.success('Başarıyla güncellendi')
        setIsEditDialogOpen(false)
        setEditingItem(null)
        resetForm()
        await loadData()
      } else {
        toast.error('Güncellenirken bir hata oluştu')
      }
    } catch {
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
      else if (type === 'production-section') endpoint = `/api/settings/production-sections/${id}`

      const res = await fetch(endpoint, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Başarıyla silindi')
        await loadData()
      } else {
        toast.error('Silinirken bir hata oluştu')
      }
    } catch {
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
    setFormData({ name: item.name, code: item.code || '', manufacturer: item.manufacturer || '', description: item.description || '', color: item.color || '#3b82f6', departmentId: item.departmentId || '', isHurdaTarget: !!item.isHurdaTarget })
    setIsEditDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({ name: '', code: '', manufacturer: '', description: '', color: '#3b82f6', departmentId: '', isHurdaTarget: false })
  }

  // Email test
  const handleSendTestEmail = async () => {
    if (!emailTest.email) {
      toast.error('E-posta adresi gerekli')
      return
    }
    setEmailTest({ ...emailTest, sending: true })
    try {
      const res = await fetch('/api/email/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailTest.email, name: emailTest.name || 'Test Kullanıcı' }) })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Test e-postası başarıyla gönderildi!')
        setEmailTest({ email: '', name: '', sending: false })
      } else {
        toast.error(data.error || 'E-posta gönderilemedi')
        setEmailTest({ ...emailTest, sending: false })
      }
    } catch {
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
    if (editingType === 'production-section') return 'Bölüm'
    if (editingType === 'task-category') return 'Görev Kategorisi'
    if (editingType === 'announcement-category') return 'Duyuru Kategorisi'
    return ''
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight">Ayarlar</h1>
          <p className="text-muted-foreground">Sistem ve modül ayarlarını yönetin</p>
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

      {/* Kalite kullanıcıları için sadece Kalibrasyon Ayarları göster */}
      {isKaliteUser && (
        <>
          {/* Kalibrasyon Ayarları */}
          <CollapsibleSection
            title="Kalibrasyon Ayarları"
            description="Kalibrasyon modülü için gerekli tanımlamalar"
            icon={Gauge}
            iconBgColor="bg-blue-100 dark:bg-blue-900"
            iconColor="text-blue-600 dark:text-blue-400"
            externalLink="/calibration"
            defaultOpen={true}
          >
            <CalibrationSettingsPanel
              locations={locations}
              deviceTypes={deviceTypes}
              deviceModels={deviceModels}
              deviceNames={deviceNames}
              departments={departments}
              productionSections={productionSections}
              expiringEmails={expiringEmails}
              expiredEmails={expiredEmails}
              notificationRules={notificationRules}
              locationSearch={locationSearch}
              setLocationSearch={setLocationSearch}
              deviceTypeSearch={deviceTypeSearch}
              setDeviceTypeSearch={setDeviceTypeSearch}
              deviceModelSearch={deviceModelSearch}
              setDeviceModelSearch={setDeviceModelSearch}
              deviceNameSearch={deviceNameSearch}
              setDeviceNameSearch={setDeviceNameSearch}
              departmentSearch={departmentSearch}
              setDepartmentSearch={setDepartmentSearch}
              productionSectionSearch={productionSectionSearch}
              setProductionSectionSearch={setProductionSectionSearch}
              newExpiringEmail={newExpiringEmail}
              setNewExpiringEmail={setNewExpiringEmail}
              addingExpiringEmail={addingExpiringEmail}
              newExpiredEmail={newExpiredEmail}
              setNewExpiredEmail={setNewExpiredEmail}
              addingExpiredEmail={addingExpiredEmail}
              newRule={newRule}
              setNewRule={setNewRule}
              addingRule={addingRule}
              onAddExpiringEmail={handleAddExpiringEmail}
              onAddExpiredEmail={handleAddExpiredEmail}
              onDeleteEmail={handleDeleteNotificationEmail}
              onAddRule={handleAddNotificationRule}
              onDeleteRule={handleDeleteNotificationRule}
              onOpenAddDialog={openAddDialog}
              onOpenEditDialog={openEditDialog}
              onDeleteItem={handleDelete}
            />
          </CollapsibleSection>
        </>
      )}

      {!isKaliteUser && <>
      {/* Dashboard Ayarları */}
      <CollapsibleSection
        title="Dashboard Ayarları"
        description="Sistem durumu ve genel ayarlar"
        icon={LayoutDashboard}
        iconBgColor="bg-indigo-100 dark:bg-indigo-900"
        iconColor="text-indigo-600 dark:text-indigo-400"
        externalLink="/dashboard"
      >
        <DashboardSettingsPanel
          systemNotice={systemNotice}
          setSystemNotice={setSystemNotice}
          noticeEdited={noticeEdited}
          setNoticeEdited={setNoticeEdited}
          savingSettings={savingSettings}
          onSaveSystemNotice={handleSaveSystemNotice}
        />
      </CollapsibleSection>

      {/* Duyuru Sistemi Ayarları */}
      <CollapsibleSection
        title="Duyuru Sistemi Ayarları"
        description="Duyuru kategorileri ve anket yönetimi"
        icon={Megaphone}
        iconBgColor="bg-amber-100 dark:bg-amber-900"
        iconColor="text-amber-600 dark:text-amber-400"
        externalLink="/announcements"
      >
        <AnnouncementSettingsPanel
          categories={announcementCategories}
          surveys={surveys}
          newCategory={newAnnouncementCategory}
          setNewCategory={setNewAnnouncementCategory}
          addingCategory={addingAnnouncementCategory}
          categorySearch={announcementCategorySearch}
          setCategorySearch={setAnnouncementCategorySearch}
          surveySearch={surveySearch}
          setSurveySearch={setSurveySearch}
          onAddCategory={handleAddAnnouncementCategory}
          onDeleteCategory={handleDeleteAnnouncementCategory}
          onDeleteSurvey={handleDeleteSurvey}
        />
      </CollapsibleSection>

      {/* IT Ticket Ayarları */}
      <CollapsibleSection
        title="IT Ticket Ayarları"
        description="IT destek talep kategorileri ve ayarları"
        icon={Headphones}
        iconBgColor="bg-purple-100 dark:bg-purple-900"
        iconColor="text-purple-600 dark:text-purple-400"
        externalLink="/it-support"
      >
        <ITTicketSettingsPanel
          ticketCategories={ticketCategories}
          newTicketCategory={newTicketCategory}
          setNewTicketCategory={setNewTicketCategory}
          addingTicketCategory={addingTicketCategory}
          ticketCategorySearch={ticketCategorySearch}
          setTicketCategorySearch={setTicketCategorySearch}
          onAddCategory={handleAddTicketCategory}
          onDeleteCategory={handleDeleteTicketCategory}
        />
      </CollapsibleSection>

      {/* Kalibrasyon Ayarları */}
      <CollapsibleSection
        title="Kalibrasyon Ayarları"
        description="Kalibrasyon modülü için gerekli tanımlamalar"
        icon={Gauge}
        iconBgColor="bg-blue-100 dark:bg-blue-900"
        iconColor="text-blue-600 dark:text-blue-400"
        externalLink="/calibration"
      >
        <CalibrationSettingsPanel
          locations={locations}
          deviceTypes={deviceTypes}
          deviceModels={deviceModels}
          deviceNames={deviceNames}
          departments={departments}
          productionSections={productionSections}
          expiringEmails={expiringEmails}
          expiredEmails={expiredEmails}
          notificationRules={notificationRules}
          locationSearch={locationSearch}
          setLocationSearch={setLocationSearch}
          deviceTypeSearch={deviceTypeSearch}
          setDeviceTypeSearch={setDeviceTypeSearch}
          deviceModelSearch={deviceModelSearch}
          setDeviceModelSearch={setDeviceModelSearch}
          deviceNameSearch={deviceNameSearch}
          setDeviceNameSearch={setDeviceNameSearch}
          departmentSearch={departmentSearch}
          setDepartmentSearch={setDepartmentSearch}
          productionSectionSearch={productionSectionSearch}
          setProductionSectionSearch={setProductionSectionSearch}
          newExpiringEmail={newExpiringEmail}
          setNewExpiringEmail={setNewExpiringEmail}
          addingExpiringEmail={addingExpiringEmail}
          newExpiredEmail={newExpiredEmail}
          setNewExpiredEmail={setNewExpiredEmail}
          addingExpiredEmail={addingExpiredEmail}
          newRule={newRule}
          setNewRule={setNewRule}
          addingRule={addingRule}
          onAddExpiringEmail={handleAddExpiringEmail}
          onAddExpiredEmail={handleAddExpiredEmail}
          onDeleteEmail={handleDeleteNotificationEmail}
          onAddRule={handleAddNotificationRule}
          onDeleteRule={handleDeleteNotificationRule}
          onOpenAddDialog={openAddDialog}
          onOpenEditDialog={openEditDialog}
          onDeleteItem={handleDelete}
        />
      </CollapsibleSection>

      {/* Öneri Sistemi Ayarları */}
      <CollapsibleSection
        title="Öneri Sistemi Ayarları"
        description="Sürekli iyileştirme merkezi ve onay akışı ayarları"
        icon={Lightbulb}
        iconBgColor="bg-emerald-100 dark:bg-emerald-900"
        iconColor="text-emerald-600 dark:text-emerald-400"
        externalLink="/suggestions"
      >
        <SuggestionSettingsPanel
          boardMembers={suggestionBoardMembers}
          newBoardMember={newBoardMember}
          setNewBoardMember={setNewBoardMember}
          addingBoardMember={addingBoardMember}
          boardMemberSearch={boardMemberSearch}
          setBoardMemberSearch={setBoardMemberSearch}
          onAddMember={handleAddBoardMember}
          onDeleteMember={handleDeleteBoardMember}
        />
      </CollapsibleSection>

      {/* Planlı Görevler Ayarları */}
      <CollapsibleSection
        title="Planlı Görevler Ayarları"
        description="Planlı görevler modülü için kategori tanımlamaları"
        icon={CalendarCheck}
        iconBgColor="bg-purple-100 dark:bg-purple-900"
        iconColor="text-purple-600 dark:text-purple-400"
        externalLink="/tasks"
      >
        <TaskSettingsPanel
          categories={taskCategories}
          notificationEmails={taskNotificationEmails}
          newCategory={newCategory}
          setNewCategory={setNewCategory}
          addingCategory={addingCategory}
          categorySearch={taskCategorySearch}
          setCategorySearch={setTaskCategorySearch}
          newEmail={newTaskEmail}
          setNewEmail={setNewTaskEmail}
          addingEmail={addingTaskEmail}
          onAddCategory={handleAddTaskCategory}
          onDeleteCategory={handleDeleteTaskCategory}
          onAddEmail={handleAddTaskNotificationEmail}
          onDeleteEmail={handleDeleteTaskNotificationEmail}
        />
      </CollapsibleSection>

      {/* İV Ayarları */}
      <CollapsibleSection
        title="İV Ayarları"
        description="Görev tanımları ve İnsan Varlıkları yapılandırması"
        icon={Briefcase}
        iconBgColor="bg-indigo-100 dark:bg-indigo-900"
        iconColor="text-indigo-600 dark:text-indigo-400"
        externalLink="/personnel"
      >
        <div className="text-center py-6">
          <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground mb-4">
            Personel formlarında kullanılan görev tanımlarını, bölüm detaylarını ve diğer İV ayarlarını yönetin.
          </p>
          <Link href="/settings/hr">
            <Button>
              <Briefcase className="h-4 w-4 mr-2" />
              İV Ayarlarını Yönet
            </Button>
          </Link>
        </div>
      </CollapsibleSection>

      {/* Mesai Formu Onay Pozisyonları */}
      <CollapsibleSection
        title="Mesai Formu Onay Pozisyonları"
        description="Mesai formu onay zincirinde pozisyonlara kullanıcı atama"
        icon={UserCheck}
        iconBgColor="bg-cyan-100 dark:bg-cyan-900"
        iconColor="text-cyan-600 dark:text-cyan-400"
        externalLink="/forms/overtime"
      >
        <div className="text-center py-6">
          <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground mb-4">
            Mesai formu onay sürecinde her pozisyona bir kullanıcı atanmalıdır.
            Atanmamış pozisyon varsa formlar onaya gönderilemez.
          </p>
          <Link href="/settings/approval-positions">
            <Button>
              <UserCheck className="h-4 w-4 mr-2" />
              Onay Pozisyonlarını Yönet
            </Button>
          </Link>
        </div>
      </CollapsibleSection>

      {/* Mesai Formu Yetkilendirme */}
      <CollapsibleSection
        title="Mesai Formu Yetkilendirme"
        description="Mesai formu oluşturabilecek kullanıcıları belirleyin"
        icon={Clock}
        iconBgColor="bg-orange-100 dark:bg-orange-900"
        iconColor="text-orange-600 dark:text-orange-400"
        externalLink="/forms/overtime"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Aşağıda listelenen kullanıcılar mesai formu oluşturabilir. Admin ve Super Admin kullanıcılar her zaman yetkilidir.
          </p>

          {/* Yetkili kullanıcı listesi */}
          {overtimeAuthUsers.length > 0 && (
            <div className="border rounded-lg divide-y">
              {overtimeAuthUsers.map((auth) => (
                <div key={auth.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{auth.user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {auth.user.department || '-'} {auth.user.jobTitle ? `/ ${auth.user.jobTitle}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRemoveOvertimeAuth(auth.userId)}
                    disabled={overtimeRemoving !== null}
                  >
                    {overtimeRemoving === auth.userId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {overtimeAuthUsers.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg">
              Henüz yetkili kullanıcı eklenmedi. Sadece Admin kullanıcılar mesai formu oluşturabilir.
            </div>
          )}

          {/* Kullanıcı arama ve ekleme */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Kullanıcı Ekle</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="İsim veya email ile ara..."
                value={overtimeUserSearch}
                onChange={(e) => setOvertimeUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {overtimeUserSearch.length >= 2 && (
              <div className="max-h-48 overflow-y-auto border rounded-md">
                {(() => {
                  const authUserIds = new Set(overtimeAuthUsers.map(a => a.userId))
                  const q = overtimeUserSearch.toLowerCase()
                  const filtered = overtimeAllUsers.filter(u =>
                    !authUserIds.has(u.id) &&
                    (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
                  ).slice(0, 20)

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        Sonuç bulunamadı
                      </div>
                    )
                  }

                  return filtered.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-3 py-2 border-b last:border-0 hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.department || '-'} {u.jobTitle ? `/ ${u.jobTitle}` : ''}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600 hover:text-green-800 hover:bg-green-50 flex-shrink-0"
                        onClick={() => handleAddOvertimeAuth(u.id)}
                        disabled={overtimeAdding !== null}
                      >
                        {overtimeAdding === u.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))
                })()}
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Yangın Güvenliği Ayarları */}
      <CollapsibleSection
        title="Yangın Güvenliği Ayarları"
        description="Yangın güvenliği modülü için gerekli tanımlamalar"
        icon={Flame}
        iconBgColor="bg-orange-100 dark:bg-orange-900"
        iconColor="text-orange-600 dark:text-orange-400"
        externalLink="/fire-safety"
      >
        <div className="text-center py-8 text-muted-foreground">
          <Flame className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Yangın Güvenliği modülü yakında eklenecek</p>
          <p className="text-sm">Bu bölümde ekipman tipleri, kontrol periyotları vb. ayarlar yer alacak</p>
        </div>
      </CollapsibleSection>

      {/* E-Posta Ayarları */}
      <CollapsibleSection
        title="E-Posta Ayarları"
        description="SMTP yapılandırması ve bildirim ayarları"
        icon={Mail}
        iconBgColor="bg-green-100 dark:bg-green-900"
        iconColor="text-green-600 dark:text-green-400"
      >
        <EmailSettingsPanel
          emailTest={emailTest}
          setEmailTest={setEmailTest}
          onSendTestEmail={handleSendTestEmail}
        />
      </CollapsibleSection>

      {/* Active Directory Senkronizasyonu */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle>Active Directory Senkronizasyonu</CardTitle>
                <CardDescription>LDAP kullanıcılarını veritabanıyla senkronize edin</CardDescription>
              </div>
            </div>
            <Button onClick={handleLdapSync} disabled={ldapSyncing}>
              {ldapSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Senkronize ediliyor...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Şimdi Senkronize Et
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Active Directory&apos;deki tüm aktif kullanıcıları veritabanına senkronize eder. Otomatik olarak her 6 saatte bir çalışır. Yeni çalışan eklendiğinde manuel olarak da tetikleyebilirsiniz.
            </p>

            {ldapSyncResult && ldapSyncResult.lastSyncAt && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {ldapSyncResult.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : ldapSyncResult.status === 'failed' ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : ldapSyncResult.status === 'running' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : null}
                  <span className="text-sm font-medium">
                    {ldapSyncResult.status === 'completed' ? 'Son senkronizasyon başarılı' :
                     ldapSyncResult.status === 'failed' ? 'Son senkronizasyon başarısız' :
                     ldapSyncResult.status === 'running' ? 'Senkronizasyon devam ediyor...' : 'Henüz çalıştırılmadı'}
                  </span>
                  {ldapSyncResult.lastSyncAt && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(ldapSyncResult.lastSyncAt).toLocaleString('tr-TR')}
                      {ldapSyncResult.duration !== undefined && ` (${ldapSyncResult.duration}s)`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-md bg-green-50 dark:bg-green-950 p-3 text-center">
                    <div className="text-lg font-bold text-green-700 dark:text-green-400">{ldapSyncResult.created}</div>
                    <div className="text-xs text-green-600 dark:text-green-500">Yeni eklenen</div>
                  </div>
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-center">
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-400">{ldapSyncResult.updated}</div>
                    <div className="text-xs text-blue-600 dark:text-blue-500">Güncellenen</div>
                  </div>
                  <div className="rounded-md bg-orange-50 dark:bg-orange-950 p-3 text-center">
                    <div className="text-lg font-bold text-orange-700 dark:text-orange-400">{ldapSyncResult.deactivated}</div>
                    <div className="text-xs text-orange-600 dark:text-orange-500">Devre dışı</div>
                  </div>
                  <div className="rounded-md bg-gray-50 dark:bg-gray-900 p-3 text-center">
                    <div className="text-lg font-bold">{ldapSyncResult.totalLdap}</div>
                    <div className="text-xs text-muted-foreground">LDAP toplam</div>
                  </div>
                </div>

                {ldapSyncResult.errors > 0 && ldapSyncResult.errorDetails && ldapSyncResult.errorDetails.length > 0 && (
                  <div className="rounded-md bg-red-50 dark:bg-red-950 p-3">
                    <div className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">{ldapSyncResult.errors} hata</div>
                    <div className="text-xs text-red-600 dark:text-red-500 space-y-0.5">
                      {ldapSyncResult.errorDetails.slice(0, 5).map((err, i) => (
                        <div key={i}>{err}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </>}

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
            {editingType === 'production-section' && (
              <div className="space-y-2">
                <Label htmlFor="departmentId">Departman *</Label>
                <select
                  id="departmentId"
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Seçiniz</option>
                  {realDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            )}
            {editingType === 'production-section' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isHurdaTarget"
                  checked={formData.isHurdaTarget}
                  onChange={(e) => setFormData({ ...formData, isHurdaTarget: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isHurdaTarget" className="text-sm font-normal">
                  Hurda hedef bölümü (Kalibrasyon &quot;Karar: Hurda&quot;da cihaz buraya taşınır — tek bölüm işaretli olabilir)
                </Label>
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
            {editingType === 'production-section' && (
              <div className="space-y-2">
                <Label htmlFor="edit-departmentId">Departman *</Label>
                <select
                  id="edit-departmentId"
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Seçiniz</option>
                  {realDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            )}
            {editingType === 'production-section' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-isHurdaTarget"
                  checked={formData.isHurdaTarget}
                  onChange={(e) => setFormData({ ...formData, isHurdaTarget: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-isHurdaTarget" className="text-sm font-normal">
                  Hurda hedef bölümü (Kalibrasyon &quot;Karar: Hurda&quot;da cihaz buraya taşınır — tek bölüm işaretli olabilir)
                </Label>
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
