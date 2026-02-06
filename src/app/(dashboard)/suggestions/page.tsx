"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  Lightbulb,
  ChevronLeft,
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  Trophy,
  Upload,
  FileText,
  Image,
  X,
  Paperclip,
  Target,
  Users,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Printer,
  User,
  Calendar,
  UserPlus
} from "lucide-react"
import { cn } from "@/lib/utils"
import { UserSearchCombobox, type ADUser } from "@/components/user-search-combobox"

// Types & Config
import type {
  Suggestion,
  Category,
  SuggestionStats,
  SuggestionUpdate,
  KaizenProject,
  NearMiss,
  FiveSArea,
  FiveSAudit,
  FiveSFinding,
  UploadedFile,
  SuggestionViewMode,
  KaizenViewMode,
  NearMissViewMode,
  FiveSViewMode,
  SuggestionFormData,
  KaizenFormData,
  NearMissFormData,
  FiveSAreaFormData,
  FiveSAuditFormData,
} from "@/types/suggestions"

import {
  moduleCards,
  fiveSChecklistItems,
  formatDate,
  formatFileSize,
  calculateScoreFromChecklist,
} from "@/lib/suggestions-config"

// Components
import { ModuleCards, SummaryStats } from "@/components/suggestions"
import { SuggestionsPanel, KaizenPanel, NearMissPanel, FiveSPanel } from "@/components/suggestions/panels"
import { CreateSuggestionDialog, CreateKaizenDialog, CreateNearMissDialog } from "@/components/suggestions/dialogs"

// ==========================================
// Main Component
// ==========================================

function SuggestionsPageContent() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeModule, setActiveModule] = useState<string | null>(null)

  // URL module param
  useEffect(() => {
    const moduleParam = searchParams.get('module')
    if (moduleParam && ['suggestions', 'kaizen', 'nearmiss', 'fives'].includes(moduleParam)) {
      setActiveModule(moduleParam)
    } else {
      setActiveModule(null)
    }
  }, [searchParams, pathname])

  // ==========================================
  // State
  // ==========================================

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stats, setStats] = useState<SuggestionStats | null>(null)
  const [suggestionViewMode, setSuggestionViewMode] = useState<SuggestionViewMode>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [mySuggestionUpdates, setMySuggestionUpdates] = useState<SuggestionUpdate[]>([])
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)

  // Kaizen state
  const [kaizenProjects, setKaizenProjects] = useState<KaizenProject[]>([])
  const [kaizenViewMode, setKaizenViewMode] = useState<KaizenViewMode>('all')

  // Near Miss state
  const [nearMisses, setNearMisses] = useState<NearMiss[]>([])
  const [nearMissViewMode, setNearMissViewMode] = useState<NearMissViewMode>('all')

  // 5S state
  const [fiveSAudits, setFiveSAudits] = useState<FiveSAudit[]>([])
  const [fiveSAreas, setFiveSAreas] = useState<FiveSArea[]>([])
  const [fiveSViewMode, setFiveSViewMode] = useState<FiveSViewMode>('all')
  const [selectedFiveSArea, setSelectedFiveSArea] = useState<FiveSArea | null>(null)
  const [areaAudits, setAreaAudits] = useState<FiveSAudit[]>([])
  const [selectedAuditForAction, setSelectedAuditForAction] = useState<FiveSAudit | null>(null)
  const [actionPlanLoading, setActionPlanLoading] = useState(false)

  // Loading state
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [isCreateSuggestionOpen, setIsCreateSuggestionOpen] = useState(false)
  const [isCreateKaizenOpen, setIsCreateKaizenOpen] = useState(false)
  const [isCreateNearMissOpen, setIsCreateNearMissOpen] = useState(false)
  const [isCreateFiveSAreaOpen, setIsCreateFiveSAreaOpen] = useState(false)
  const [isCreateFiveSAuditOpen, setIsCreateFiveSAuditOpen] = useState(false)
  const [isAreaDetailOpen, setIsAreaDetailOpen] = useState(false)
  const [isFiveSGuideOpen, setIsFiveSGuideOpen] = useState(false)
  const [isKaizenGuideOpen, setIsKaizenGuideOpen] = useState(false)
  const [isActionPlanOpen, setIsActionPlanOpen] = useState(false)

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [fiveSAuditFiles, setFiveSAuditFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fiveSFileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // 5S Checklist state
  const [checklistScores, setChecklistScores] = useState<Record<string, 0|1|2|3|4>>({})

  // Form states
  const [suggestionForm, setSuggestionForm] = useState<SuggestionFormData>({
    title: '', description: '', currentSituation: '', proposedSolution: '',
    expectedBenefit: '', estimatedSavings: '', categoryId: '', priority: 'NORMAL',
    suggestionType: 'IMPROVEMENT', isAnonymous: false
  })

  const [kaizenForm, setKaizenForm] = useState<KaizenFormData>({
    title: '', description: '', projectType: 'INDIVIDUAL', problemWhat: '',
    problemWhy: '', currentState: '', targetState: '', proposedSolution: '', priority: 'NORMAL'
  })

  const [nearMissForm, setNearMissForm] = useState<NearMissFormData>({
    title: '', description: '', eventDate: new Date().toISOString().split('T')[0],
    eventLocation: '', eventType: 'OTHER', potentialSeverity: 'MODERATE',
    whatHappened: '', isAnonymous: false
  })

  const [fiveSAreaForm, setFiveSAreaForm] = useState<FiveSAreaFormData>({
    name: '', code: '', description: '', department: '', location: '', responsibleName: ''
  })

  const [fiveSAuditForm, setFiveSAuditForm] = useState<FiveSAuditFormData>({
    areaId: '', auditDate: new Date().toISOString().split('T')[0], auditType: 'REGULAR',
    seiriScore: 0, seitonScore: 0, seisoScore: 0, seiketsuScore: 0, shitsukeScore: 0,
    seiriFindings: '', seitonFindings: '', seisoFindings: '', seiketsuFindings: '', shitsukeFindings: '',
    strengths: '', improvements: '', notes: ''
  })

  // ==========================================
  // Data Fetching
  // ==========================================

  const fetchSuggestions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ viewMode: suggestionViewMode })
      if (selectedCategory && selectedCategory !== 'all') params.append('categoryId', selectedCategory)
      const res = await fetch(`/api/suggestions?${params}`)
      if (res.ok) setSuggestions(await res.json())
    } catch (error) {
      console.error('Öneriler yüklenirken hata:', error)
    }
  }, [suggestionViewMode, selectedCategory])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/suggestions/categories')
      if (res.ok) setCategories(await res.json())
    } catch (error) {
      console.error('Kategoriler yüklenirken hata:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/suggestions/stats')
      if (res.ok) setStats(await res.json())
    } catch (error) {
      console.error('İstatistikler yüklenirken hata:', error)
    }
  }

  const fetchPendingApprovalCount = async () => {
    try {
      const res = await fetch('/api/suggestions?viewMode=awaiting_my_approval&limit=100')
      if (res.ok) {
        const data = await res.json()
        setPendingApprovalCount(Array.isArray(data) ? data.length : 0)
      }
    } catch (error) {
      console.error('Bekleyen onay sayısı yüklenirken hata:', error)
    }
  }

  const fetchMySuggestionUpdates = async () => {
    try {
      const res = await fetch('/api/suggestions/my-updates?limit=5')
      if (res.ok) {
        const data = await res.json()
        setMySuggestionUpdates(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Öneri güncellemeleri yüklenirken hata:', error)
    }
  }

  const fetchKaizenProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams({ viewMode: kaizenViewMode })
      const res = await fetch(`/api/suggestions/kaizen?${params}`)
      if (res.ok) setKaizenProjects(await res.json())
    } catch (error) {
      console.error('Kaizen projeleri yüklenirken hata:', error)
    }
  }, [kaizenViewMode])

  const fetchNearMisses = useCallback(async () => {
    try {
      const params = new URLSearchParams({ viewMode: nearMissViewMode })
      const res = await fetch(`/api/suggestions/near-miss?${params}`)
      if (res.ok) setNearMisses(await res.json())
    } catch (error) {
      console.error('Ramak kala bildirimleri yüklenirken hata:', error)
    }
  }, [nearMissViewMode])

  const fetchFiveSAudits = useCallback(async () => {
    try {
      const params = new URLSearchParams({ viewMode: fiveSViewMode })
      const res = await fetch(`/api/suggestions/five-s?${params}`)
      if (res.ok) setFiveSAudits(await res.json())
    } catch (error) {
      console.error('5S denetimleri yüklenirken hata:', error)
    }
  }, [fiveSViewMode])

  const fetchFiveSAreas = async () => {
    try {
      const res = await fetch('/api/suggestions/five-s/areas')
      if (res.ok) setFiveSAreas(await res.json())
    } catch (error) {
      console.error('5S alanları yüklenirken hata:', error)
    }
  }

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        fetchSuggestions(),
        fetchCategories(),
        fetchStats(),
        fetchKaizenProjects(),
        fetchNearMisses(),
        fetchFiveSAudits(),
        fetchFiveSAreas(),
        fetchPendingApprovalCount(),
        fetchMySuggestionUpdates()
      ])
      setLoading(false)
    }
    loadData()
  }, [fetchSuggestions, fetchKaizenProjects, fetchNearMisses, fetchFiveSAudits])

  // ==========================================
  // File Upload Handlers
  // ==========================================

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newFiles: UploadedFile[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} dosyası çok büyük (max 10MB)`)
        continue
      }
      newFiles.push({ name: file.name, size: file.size, type: file.type, file: file })
    }
    setUploadedFiles(prev => [...prev, ...newFiles])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return
    const newFiles: UploadedFile[] = []
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} dosyası çok büyük (max 10MB)`)
        continue
      }
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name} desteklenmeyen dosya tipi`)
        continue
      }
      newFiles.push({ name: file.name, size: file.size, type: file.type, file: file })
    }
    if (newFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...newFiles])
      toast.success(`${newFiles.length} dosya eklendi`)
    }
  }

  const handleFiveSFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newFiles: UploadedFile[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} çok büyük (max 10MB)`)
        continue
      }
      newFiles.push({ name: file.name, size: file.size, type: file.type, file: file })
    }
    setFiveSAuditFiles(prev => [...prev, ...newFiles])
    if (fiveSFileInputRef.current) fiveSFileInputRef.current.value = ''
  }

  const removeFiveSFile = (index: number) => {
    setFiveSAuditFiles(prev => prev.filter((_, i) => i !== index))
  }

  // ==========================================
  // Form Handlers
  // ==========================================

  const handleSuggestionSubmit = async (e: React.FormEvent): Promise<boolean> => {
    e.preventDefault()
    if (!suggestionForm.title || !suggestionForm.description) {
      toast.error('Başlık ve açıklama zorunludur')
      return false
    }
    try {
      let attachments = null
      if (uploadedFiles.length > 0) {
        const formData = new FormData()
        uploadedFiles.forEach(f => formData.append('files', f.file))
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          attachments = uploadData.files
        } else {
          toast.error('Dosyalar yüklenirken hata oluştu')
          return false
        }
      }
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...suggestionForm, attachments })
      })
      if (res.ok) {
        toast.success('Öneriniz başarıyla gönderildi!')
        setSuggestionForm({
          title: '', description: '', currentSituation: '', proposedSolution: '',
          expectedBenefit: '', estimatedSavings: '', categoryId: '', priority: 'NORMAL',
          suggestionType: 'IMPROVEMENT', isAnonymous: false
        })
        setUploadedFiles([])
        fetchSuggestions()
        fetchStats()
        return true
      } else {
        const error = await res.json()
        toast.error(error.error || 'Bir hata oluştu')
        return false
      }
    } catch {
      toast.error('Öneri gönderilirken bir hata oluştu')
      return false
    }
  }

  const handleKaizenSubmit = async (e: React.FormEvent): Promise<boolean> => {
    e.preventDefault()
    if (!kaizenForm.title || !kaizenForm.description) {
      toast.error('Başlık ve açıklama zorunludur')
      return false
    }
    try {
      const res = await fetch('/api/suggestions/kaizen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kaizenForm)
      })
      if (res.ok) {
        toast.success('Kaizen projesi oluşturuldu!')
        setKaizenForm({
          title: '', description: '', projectType: 'INDIVIDUAL', problemWhat: '',
          problemWhy: '', currentState: '', targetState: '', proposedSolution: '', priority: 'NORMAL'
        })
        fetchKaizenProjects()
        return true
      } else {
        const error = await res.json()
        toast.error(error.error || 'Bir hata oluştu')
        return false
      }
    } catch {
      toast.error('Kaizen projesi oluşturulurken bir hata oluştu')
      return false
    }
  }

  const handleNearMissSubmit = async (e: React.FormEvent): Promise<boolean> => {
    e.preventDefault()
    if (!nearMissForm.title || !nearMissForm.description || !nearMissForm.eventLocation) {
      toast.error('Başlık, açıklama ve konum zorunludur')
      return false
    }
    try {
      const res = await fetch('/api/suggestions/near-miss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nearMissForm)
      })
      if (res.ok) {
        toast.success('Ramak kala olayı bildirildi!')
        setNearMissForm({
          title: '', description: '', eventDate: new Date().toISOString().split('T')[0],
          eventLocation: '', eventType: 'OTHER', potentialSeverity: 'MODERATE',
          whatHappened: '', isAnonymous: false
        })
        fetchNearMisses()
        return true
      } else {
        const error = await res.json()
        toast.error(error.error || 'Bir hata oluştu')
        return false
      }
    } catch {
      toast.error('Bildirim gönderilirken bir hata oluştu')
      return false
    }
  }

  const handleFiveSAreaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fiveSAreaForm.name || !fiveSAreaForm.code) {
      toast.error('Alan adı ve kodu zorunludur')
      return
    }
    try {
      const res = await fetch('/api/suggestions/five-s/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fiveSAreaForm)
      })
      if (res.ok) {
        toast.success('5S denetim alanı oluşturuldu!')
        setIsCreateFiveSAreaOpen(false)
        setFiveSAreaForm({ name: '', code: '', description: '', department: '', location: '', responsibleName: '' })
        fetchFiveSAreas()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Bir hata oluştu')
      }
    } catch {
      toast.error('Alan oluşturulurken bir hata oluştu')
    }
  }

  const handleFiveSAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fiveSAuditForm.areaId) {
      toast.error('Denetim alanı seçiniz')
      return
    }
    try {
      let attachments = null
      if (fiveSAuditFiles.length > 0) {
        const formData = new FormData()
        fiveSAuditFiles.forEach(f => formData.append('files', f.file))
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          attachments = uploadData.files
        } else {
          toast.error('Dosyalar yüklenirken hata oluştu')
          return
        }
      }
      const res = await fetch('/api/suggestions/five-s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fiveSAuditForm, attachments })
      })
      if (res.ok) {
        toast.success('5S denetimi başlatıldı!')
        setIsCreateFiveSAuditOpen(false)
        setFiveSAuditForm({
          areaId: '', auditDate: new Date().toISOString().split('T')[0], auditType: 'REGULAR',
          seiriScore: 0, seitonScore: 0, seisoScore: 0, seiketsuScore: 0, shitsukeScore: 0,
          seiriFindings: '', seitonFindings: '', seisoFindings: '', seiketsuFindings: '', shitsukeFindings: '',
          strengths: '', improvements: '', notes: ''
        })
        setFiveSAuditFiles([])
        setChecklistScores({})
        fetchFiveSAudits()
        fetchFiveSAreas()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Bir hata oluştu')
      }
    } catch {
      toast.error('Denetim başlatılırken bir hata oluştu')
    }
  }

  // ==========================================
  // 5S Action Plan
  // ==========================================

  const openActionPlan = async (audit: FiveSAudit) => {
    setActionPlanLoading(true)
    try {
      const res = await fetch(`/api/suggestions/five-s/${audit.id}/action-plan`)
      if (res.ok) {
        const data = await res.json()
        setSelectedAuditForAction(data)
        setIsActionPlanOpen(true)
      } else {
        toast.error('Aksiyon planı yüklenemedi')
      }
    } catch (error) {
      console.error('Aksiyon planı yüklenirken hata:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setActionPlanLoading(false)
    }
  }

  const assignAction = async (findingId: string, assignedTo: string, assignedToName: string, dueDate: string, correctiveAction: string) => {
    if (!selectedAuditForAction) return
    try {
      const res = await fetch(`/api/suggestions/five-s/${selectedAuditForAction.id}/action-plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingId, assignedTo, assignedToName, dueDate, correctiveAction })
      })
      if (res.ok) {
        toast.success('Aksiyon atandı ve planlı görev oluşturuldu')
        openActionPlan(selectedAuditForAction)
        fetchFiveSAudits()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Aksiyon atanamadı')
      }
    } catch (error) {
      console.error('Aksiyon atanırken hata:', error)
      toast.error('Bir hata oluştu')
    }
  }

  const openAreaDetail = async (area: FiveSArea) => {
    setSelectedFiveSArea(area)
    setIsAreaDetailOpen(true)
    try {
      const res = await fetch(`/api/suggestions/five-s?areaId=${area.id}`)
      if (res.ok) setAreaAudits(await res.json())
    } catch (error) {
      console.error('Alan denetimleri yüklenirken hata:', error)
    }
  }

  // ==========================================
  // Checklist Score Update Effect
  // ==========================================

  useEffect(() => {
    if (Object.keys(checklistScores).length > 0) {
      setFiveSAuditForm(prev => ({
        ...prev,
        seiriScore: calculateScoreFromChecklist('seiri', checklistScores),
        seitonScore: calculateScoreFromChecklist('seiton', checklistScores),
        seisoScore: calculateScoreFromChecklist('seiso', checklistScores),
        seiketsuScore: calculateScoreFromChecklist('seiketsu', checklistScores),
        shitsukeScore: calculateScoreFromChecklist('shitsuke', checklistScores),
      }))
    }
  }, [checklistScores])

  // ==========================================
  // Helpers
  // ==========================================

  const getModuleStats = (key: string) => {
    switch (key) {
      case 'mySuggestions': return suggestions.length
      case 'kaizen': return kaizenProjects.length
      case 'nearmiss': return nearMisses.length
      case 'fives': return fiveSAudits.length
      default: return 0
    }
  }

  const handleModuleSelect = (moduleId: string) => {
    router.push(`/suggestions?module=${moduleId}`)
  }

  const handleBackToHub = () => {
    router.push('/suggestions')
  }

  const printFiveSAuditForm = () => {
    window.print()
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />
    return <FileText className="h-4 w-4" />
  }

  // ==========================================
  // Render
  // ==========================================

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-6">
          {activeModule ? (
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={handleBackToHub}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Geri
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">
                  {moduleCards.find(m => m.id === activeModule)?.title || 'Modül'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {moduleCards.find(m => m.id === activeModule)?.description}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center">
                <Lightbulb className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Öneriler & Sürekli İyileştirme</h1>
                <p className="text-sm text-muted-foreground">Fikirlerinizi paylaşın, değişimi başlatın</p>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {!activeModule ? (
          <div className="space-y-6">
            {/* Summary Stats */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Trophy className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
                    <div className="text-2xl font-bold">{stats.overview.total}</div>
                    <p className="text-xs text-muted-foreground">Toplam Öneri</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Target className="h-6 w-6 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold">{stats.overview.implemented}</div>
                    <p className="text-xs text-muted-foreground">Uygulanan</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Users className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                    <div className="text-2xl font-bold">{stats.overview.thisMonth}</div>
                    <p className="text-xs text-muted-foreground">Bu Ay</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <BarChart3 className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                    <div className="text-2xl font-bold">
                      {stats.overview.totalSavings ? `${(stats.overview.totalSavings / 1000).toFixed(0)}K` : '0'}
                    </div>
                    <p className="text-xs text-muted-foreground">Toplam Tasarruf (₺)</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Module Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {moduleCards.map(module => {
                const Icon = module.icon
                return (
                  <Card
                    key={module.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-lg border-2",
                      module.bgColor,
                      module.borderColor
                    )}
                    onClick={() => handleModuleSelect(module.id)}
                  >
                    <CardContent className="p-5">
                      <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center mb-3", module.iconBg)}>
                        <Icon className={cn("h-6 w-6 bg-gradient-to-r bg-clip-text", module.color)} />
                      </div>
                      <h3 className="font-bold text-lg mb-1">{module.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{module.description}</p>
                      <div className="text-sm font-medium">
                        {getModuleStats(module.stats.key)} {module.stats.label}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Suggestions Module */}
            {activeModule === 'suggestions' && (
              <SuggestionsPanel
                suggestions={suggestions}
                categories={categories}
                loading={loading}
                viewMode={suggestionViewMode}
                searchQuery={searchQuery}
                selectedCategory={selectedCategory}
                pendingApprovalCount={pendingApprovalCount}
                mySuggestionUpdates={mySuggestionUpdates}
                onViewModeChange={setSuggestionViewMode}
                onSearchChange={setSearchQuery}
                onCategoryChange={setSelectedCategory}
                onCreateNew={() => setIsCreateSuggestionOpen(true)}
              />
            )}

            {/* Kaizen Module */}
            {activeModule === 'kaizen' && (
              <KaizenPanel
                projects={kaizenProjects}
                loading={loading}
                viewMode={kaizenViewMode}
                onViewModeChange={setKaizenViewMode}
                onCreateNew={() => setIsCreateKaizenOpen(true)}
                onOpenGuide={() => setIsKaizenGuideOpen(true)}
              />
            )}

            {/* Near Miss Module */}
            {activeModule === 'nearmiss' && (
              <NearMissPanel
                nearMisses={nearMisses}
                loading={loading}
                viewMode={nearMissViewMode}
                onViewModeChange={setNearMissViewMode}
                onCreateNew={() => setIsCreateNearMissOpen(true)}
              />
            )}

            {/* 5S Module */}
            {activeModule === 'fives' && (
              <FiveSPanel
                audits={fiveSAudits}
                areas={fiveSAreas}
                loading={loading}
                actionPlanLoading={actionPlanLoading}
                viewMode={fiveSViewMode}
                onViewModeChange={setFiveSViewMode}
                onCreateArea={() => setIsCreateFiveSAreaOpen(true)}
                onCreateAudit={() => setIsCreateFiveSAuditOpen(true)}
                onOpenGuide={() => setIsFiveSGuideOpen(true)}
                onOpenAreaDetail={openAreaDetail}
                onOpenActionPlan={openActionPlan}
              />
            )}
          </>
        )}
      </div>

      {/* ==========================================
          DIALOGS
      ========================================== */}

      {/* Create Suggestion Dialog */}
      <CreateSuggestionDialog
        open={isCreateSuggestionOpen}
        onOpenChange={setIsCreateSuggestionOpen}
        form={suggestionForm}
        setForm={setSuggestionForm}
        categories={categories}
        uploadedFiles={uploadedFiles}
        isDragging={isDragging}
        fileInputRef={fileInputRef}
        onFileSelect={handleFileSelect}
        onRemoveFile={removeFile}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onSubmit={handleSuggestionSubmit}
      />

      {/* Create Kaizen Dialog */}
      <CreateKaizenDialog
        open={isCreateKaizenOpen}
        onOpenChange={setIsCreateKaizenOpen}
        form={kaizenForm}
        setForm={setKaizenForm}
        onSubmit={handleKaizenSubmit}
      />

      {/* Create Near Miss Dialog */}
      <CreateNearMissDialog
        open={isCreateNearMissOpen}
        onOpenChange={setIsCreateNearMissOpen}
        form={nearMissForm}
        setForm={setNearMissForm}
        onSubmit={handleNearMissSubmit}
      />

      {/* Create 5S Area Dialog */}
      <Dialog open={isCreateFiveSAreaOpen} onOpenChange={setIsCreateFiveSAreaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-500" />
              Yeni Denetim Alanı Tanımla
            </DialogTitle>
            <DialogDescription>
              5S denetimi yapılacak alanı tanımlayın
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFiveSAreaSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Alan Adı *</Label>
                <Input
                  value={fiveSAreaForm.name}
                  onChange={e => setFiveSAreaForm({ ...fiveSAreaForm, name: e.target.value })}
                  placeholder="Örn: Üretim Hattı 1"
                />
              </div>
              <div>
                <Label>Alan Kodu *</Label>
                <Input
                  value={fiveSAreaForm.code}
                  onChange={e => setFiveSAreaForm({ ...fiveSAreaForm, code: e.target.value.toUpperCase() })}
                  placeholder="Örn: UH1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Açıklama</Label>
                <Textarea
                  value={fiveSAreaForm.description}
                  onChange={e => setFiveSAreaForm({ ...fiveSAreaForm, description: e.target.value })}
                  placeholder="Alan hakkında kısa açıklama"
                />
              </div>
              <div>
                <Label>Departman</Label>
                <Input
                  value={fiveSAreaForm.department}
                  onChange={e => setFiveSAreaForm({ ...fiveSAreaForm, department: e.target.value })}
                  placeholder="Örn: Üretim"
                />
              </div>
              <div>
                <Label>Konum</Label>
                <Input
                  value={fiveSAreaForm.location}
                  onChange={e => setFiveSAreaForm({ ...fiveSAreaForm, location: e.target.value })}
                  placeholder="Örn: A Blok, 1. Kat"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Sorumlu Kişi</Label>
                <Input
                  value={fiveSAreaForm.responsibleName}
                  onChange={e => setFiveSAreaForm({ ...fiveSAreaForm, responsibleName: e.target.value })}
                  placeholder="Alan sorumlusunun adı"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateFiveSAreaOpen(false)}>
                İptal
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                Alanı Oluştur
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create 5S Audit Dialog - Checklist Based */}
      <Dialog open={isCreateFiveSAuditOpen} onOpenChange={(open) => {
        setIsCreateFiveSAuditOpen(open)
        if (!open) {
          setChecklistScores({})
          setFiveSAuditFiles([])
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible">
          <DialogHeader className="print:mb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <ClipboardCheck className="h-6 w-6 text-emerald-500 print:hidden" />
                5S Denetim Formu
              </DialogTitle>
              <Button type="button" variant="outline" size="sm" onClick={printFiveSAuditForm}>
                <Printer className="h-4 w-4 mr-2" />
                Yazdır
              </Button>
            </div>
            <DialogDescription className="print:hidden">
              Her maddeyi değerlendirin: 1=Yetersiz, 2=Geliştirilmeli, 3=İyi, 4=Mükemmel, N/A=Uygulanamaz
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFiveSAuditSubmit} className="space-y-6 mt-4">
            {/* Denetim Bilgileri */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg print:bg-white print:border">
              <div>
                <Label className="text-xs text-muted-foreground">Denetim Alanı *</Label>
                <Select value={fiveSAuditForm.areaId} onValueChange={v => setFiveSAuditForm({ ...fiveSAuditForm, areaId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alan seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {fiveSAreas.map(area => (
                      <SelectItem key={area.id} value={area.id}>{area.name} ({area.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Denetim Tarihi</Label>
                <Input
                  type="date"
                  value={fiveSAuditForm.auditDate}
                  onChange={e => setFiveSAuditForm({ ...fiveSAuditForm, auditDate: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Denetçi</Label>
                <Input value={session?.user?.name || ''} disabled className="bg-white" />
              </div>
            </div>

            {/* Puanlama Özeti */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg print:bg-white print:border">
              {['seiri', 'seiton', 'seiso', 'seiketsu', 'shitsuke'].map((s, i) => {
                const score = fiveSAuditForm[`${s}Score` as keyof typeof fiveSAuditForm] as number
                return (
                  <div key={s} className="text-center">
                    <p className="text-xs text-muted-foreground">{i + 1}S {s.charAt(0).toUpperCase() + s.slice(1)}</p>
                    <p className={cn("text-xl font-bold", score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600")}>
                      {score}
                    </p>
                  </div>
                )
              })}
              <div className="text-center border-l">
                <p className="text-xs text-muted-foreground font-medium">TOPLAM</p>
                <p className={cn(
                  "text-2xl font-bold",
                  Math.round((fiveSAuditForm.seiriScore + fiveSAuditForm.seitonScore + fiveSAuditForm.seisoScore + fiveSAuditForm.seiketsuScore + fiveSAuditForm.shitsukeScore) / 5) >= 80 ? "text-green-600" :
                  Math.round((fiveSAuditForm.seiriScore + fiveSAuditForm.seitonScore + fiveSAuditForm.seisoScore + fiveSAuditForm.seiketsuScore + fiveSAuditForm.shitsukeScore) / 5) >= 60 ? "text-yellow-600" : "text-red-600"
                )}>
                  {Math.round((fiveSAuditForm.seiriScore + fiveSAuditForm.seitonScore + fiveSAuditForm.seisoScore + fiveSAuditForm.seiketsuScore + fiveSAuditForm.shitsukeScore) / 5)}
                </p>
              </div>
            </div>

            {/* 5S Checklists - Compact */}
            {(['seiri', 'seiton', 'seiso', 'seiketsu', 'shitsuke'] as const).map((category, idx) => {
              const colors = {
                seiri: { bg: 'bg-red-50', header: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
                seiton: { bg: 'bg-orange-50', header: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
                seiso: { bg: 'bg-yellow-50', header: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
                seiketsu: { bg: 'bg-blue-50', header: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
                shitsuke: { bg: 'bg-purple-50', header: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' }
              }[category]
              const titles = {
                seiri: 'Seiri - Ayıkla',
                seiton: 'Seiton - Düzenle',
                seiso: 'Seiso - Temizle',
                seiketsu: 'Seiketsu - Standartlaştır',
                shitsuke: 'Shitsuke - Sürdür'
              }
              const score = fiveSAuditForm[`${category}Score` as keyof typeof fiveSAuditForm] as number

              return (
                <div key={category} className={cn("border rounded-lg overflow-hidden", colors.border)}>
                  <div className={cn("p-3 flex items-center gap-3", colors.header)}>
                    <div className={cn("w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-sm",
                      category === 'seiri' ? 'bg-red-500' : category === 'seiton' ? 'bg-orange-500' :
                      category === 'seiso' ? 'bg-yellow-500' : category === 'seiketsu' ? 'bg-blue-500' : 'bg-purple-500'
                    )}>{idx + 1}S</div>
                    <h4 className={cn("font-semibold", colors.text)}>{titles[category]}</h4>
                    <span className={cn("ml-auto text-xl font-bold", score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600")}>
                      {score}
                    </span>
                  </div>
                  <div className={cn("p-3 space-y-2", colors.bg)}>
                    {fiveSChecklistItems[category].map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-white/50 rounded">
                        <span className="flex-1 text-sm">{item.text}</span>
                        <div className="flex gap-1">
                          {[0, 1, 2, 3, 4].map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setChecklistScores(prev => ({ ...prev, [item.id]: s as 0|1|2|3|4 }))}
                              className={cn(
                                "w-8 h-8 rounded text-xs font-medium border transition-colors",
                                checklistScores[item.id] === s
                                  ? s === 0 ? "bg-gray-500 text-white" : s === 1 ? "bg-red-500 text-white" :
                                    s === 2 ? "bg-yellow-500 text-white" : s === 3 ? "bg-blue-500 text-white" : "bg-green-500 text-white"
                                  : "bg-white hover:bg-muted border-gray-300"
                              )}
                            >
                              {s === 0 ? 'N/A' : s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className={cn("mt-3 pt-3 border-t", colors.border)}>
                      <Label className="text-xs">Tespit Edilen Uygunsuzluklar</Label>
                      <Textarea
                        className="mt-1"
                        placeholder="Bu alanda tespit edilen uygunsuzlukları yazın..."
                        value={fiveSAuditForm[`${category}Findings` as keyof typeof fiveSAuditForm] as string}
                        onChange={e => setFiveSAuditForm({ ...fiveSAuditForm, [`${category}Findings`]: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Notlar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Güçlü Yönler</Label>
                <Textarea
                  value={fiveSAuditForm.strengths}
                  onChange={e => setFiveSAuditForm({ ...fiveSAuditForm, strengths: e.target.value })}
                  placeholder="Alanın güçlü yönleri..."
                />
              </div>
              <div>
                <Label>İyileştirme Alanları</Label>
                <Textarea
                  value={fiveSAuditForm.improvements}
                  onChange={e => setFiveSAuditForm({ ...fiveSAuditForm, improvements: e.target.value })}
                  placeholder="Geliştirilmesi gereken alanlar..."
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Genel Notlar</Label>
                <Textarea
                  value={fiveSAuditForm.notes}
                  onChange={e => setFiveSAuditForm({ ...fiveSAuditForm, notes: e.target.value })}
                  placeholder="Ek notlar..."
                />
              </div>
            </div>

            <DialogFooter className="print:hidden">
              <Button type="button" variant="outline" onClick={() => setIsCreateFiveSAuditOpen(false)}>
                İptal
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                Denetimi Kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5S Area Detail Dialog */}
      <Dialog open={isAreaDetailOpen} onOpenChange={setIsAreaDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-500" />
              {selectedFiveSArea?.name}
              <Badge variant="outline" className="ml-2">{selectedFiveSArea?.code}</Badge>
            </DialogTitle>
            <DialogDescription>
              {selectedFiveSArea?.description || 'Denetim alanı detayları ve geçmiş denetimleri'}
            </DialogDescription>
          </DialogHeader>

          {selectedFiveSArea && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                {selectedFiveSArea.department && (
                  <div><span className="text-xs text-muted-foreground">Departman:</span><p className="font-medium">{selectedFiveSArea.department}</p></div>
                )}
                {selectedFiveSArea.location && (
                  <div><span className="text-xs text-muted-foreground">Konum:</span><p className="font-medium">{selectedFiveSArea.location}</p></div>
                )}
                {selectedFiveSArea.responsibleName && (
                  <div><span className="text-xs text-muted-foreground">Sorumlu:</span><p className="font-medium">{selectedFiveSArea.responsibleName}</p></div>
                )}
                <div><span className="text-xs text-muted-foreground">Toplam Denetim:</span><p className="font-medium">{selectedFiveSArea._count?.audits || 0}</p></div>
              </div>

              {areaAudits.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Denetim Geçmişi</h4>
                  <div className="space-y-2">
                    {areaAudits.map(audit => (
                      <div key={audit.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <span className="text-xs text-muted-foreground font-mono">{audit.auditNumber}</span>
                          <p className="text-sm">{audit.auditorName} • {formatDate(audit.auditDate)}</p>
                        </div>
                        <div className={cn(
                          "text-xl font-bold",
                          audit.totalScore >= 80 ? "text-green-600" : audit.totalScore >= 60 ? "text-yellow-600" : "text-red-600"
                        )}>
                          {audit.totalScore}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAreaDetailOpen(false)}>Kapat</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => {
              setIsAreaDetailOpen(false)
              setFiveSAuditForm(prev => ({ ...prev, areaId: selectedFiveSArea?.id || '' }))
              setIsCreateFiveSAuditOpen(true)
            }}>
              Denetim Başlat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5S Action Plan Dialog */}
      <Dialog open={isActionPlanOpen} onOpenChange={setIsActionPlanOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-orange-500" />
              5S Aksiyon Planı
              {selectedAuditForAction && (
                <Badge variant="outline" className="ml-2">{selectedAuditForAction.auditNumber}</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Uygunsuzluklara aksiyon atayın ve takip edin
            </DialogDescription>
          </DialogHeader>

          {selectedAuditForAction && (
            <div className="space-y-6 mt-4">
              {/* Score Summary */}
              <div className="grid grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
                {['seiri', 'seiton', 'seiso', 'seiketsu', 'shitsuke'].map((s, i) => {
                  const score = selectedAuditForAction[`${s}Score` as keyof typeof selectedAuditForAction] as number || 0
                  return (
                    <div key={s} className="text-center">
                      <div className={cn("text-2xl font-bold", score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600")}>
                        {score}
                      </div>
                      <p className="text-xs text-muted-foreground">{i + 1}S</p>
                    </div>
                  )
                })}
              </div>

              {/* Findings */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Tespit Edilen Uygunsuzluklar
                </h4>

                {(['seiri', 'seiton', 'seiso', 'seiketsu', 'shitsuke'] as const).map((category, idx) => {
                  const details = selectedAuditForAction[`${category}Details` as keyof typeof selectedAuditForAction] as string
                  if (!details) return null

                  const findings = selectedAuditForAction.findings?.filter(f => f.sCategory === category.toUpperCase()) || []

                  return (
                    <ActionFindingCard
                      key={category}
                      category={category.toUpperCase()}
                      categoryName={`${idx + 1}S - ${category.charAt(0).toUpperCase() + category.slice(1)}`}
                      description={details}
                      findings={findings}
                      onAssign={assignAction}
                      auditId={selectedAuditForAction.id}
                      color={category === 'seiri' ? 'red' : category === 'seiton' ? 'orange' :
                             category === 'seiso' ? 'yellow' : category === 'seiketsu' ? 'blue' : 'purple'}
                    />
                  )
                })}

                {!selectedAuditForAction.seiriDetails && !selectedAuditForAction.seitonDetails &&
                 !selectedAuditForAction.seisoDetails && !selectedAuditForAction.seiketsuDetails &&
                 !selectedAuditForAction.shitsukeDetails && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                    <p>Bu denetimde uygunsuzluk tespit edilmemiş.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActionPlanOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5S Guide Dialog */}
      <Dialog open={isFiveSGuideOpen} onOpenChange={setIsFiveSGuideOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              5S Kılavuzu
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {[
              { s: '1S - Seiri (Ayıkla)', desc: 'Gereksiz olanı ayır ve uzaklaştır. Çalışma alanında ihtiyaç duyulmayan malzeme, araç-gereç ve ekipmanları belirleyin ve ortamdan uzaklaştırın.', color: 'red' },
              { s: '2S - Seiton (Düzenle)', desc: 'Her şeyin bir yeri, her şey yerinde. Kalan malzemeleri kullanım sıklığına göre düzenleyin, etiketleyin ve kolay erişilebilir hale getirin.', color: 'orange' },
              { s: '3S - Seiso (Temizle)', desc: 'Temizlik aynı zamanda denetimdir. Çalışma alanını düzenli olarak temizleyin ve temizlik sırasında olası problemleri tespit edin.', color: 'yellow' },
              { s: '4S - Seiketsu (Standartlaştır)', desc: 'İlk 3S\'i koruyacak standartlar oluşturun. Görsel talimatlar, kontrol listeleri ve prosedürlerle standartları belgeleyin.', color: 'blue' },
              { s: '5S - Shitsuke (Sürdür)', desc: 'Alışkanlık haline getir ve sürekli iyileştir. Düzenli denetimler, eğitimler ve sürekli iyileştirme kültürünü benimseyin.', color: 'purple' }
            ].map((item, i) => (
              <div key={i} className={cn("p-4 rounded-lg border", `border-${item.color}-200 bg-${item.color}-50`)}>
                <h4 className={cn("font-semibold mb-2", `text-${item.color}-800`)}>{item.s}</h4>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsFiveSGuideOpen(false)}>Anladım</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kaizen Guide Dialog */}
      <Dialog open={isKaizenGuideOpen} onOpenChange={setIsKaizenGuideOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-teal-500" />
              Kaizen Kılavuzu
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-muted-foreground">
              Kaizen, Japonca&apos;da &quot;sürekli iyileştirme&quot; anlamına gelir. PDCA (Plan-Do-Check-Act) döngüsü ile sistematik iyileştirmeler yapın.
            </p>
            {[
              { step: 'Plan (Planla)', desc: 'Problemi tanımlayın, mevcut durumu analiz edin, hedef belirleyin ve çözüm planı oluşturun.', color: 'blue' },
              { step: 'Do (Uygula)', desc: 'Planladığınız çözümü küçük ölçekte uygulayın ve verileri toplayın.', color: 'yellow' },
              { step: 'Check (Kontrol Et)', desc: 'Sonuçları analiz edin, hedeflerle karşılaştırın ve sapmaları belirleyin.', color: 'purple' },
              { step: 'Act (Önlem Al)', desc: 'Başarılı ise standardize edin, değilse döngüyü tekrarlayın.', color: 'green' }
            ].map((item, i) => (
              <div key={i} className={cn("p-4 rounded-lg border", `border-${item.color}-200 bg-${item.color}-50`)}>
                <h4 className={cn("font-semibold mb-2", `text-${item.color}-800`)}>{item.step}</h4>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsKaizenGuideOpen(false)}>Anladım</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==========================================
// Action Finding Card Component
// ==========================================

function ActionFindingCard({
  category,
  categoryName,
  description,
  findings,
  onAssign,
  auditId,
  color
}: {
  category: string
  categoryName: string
  description: string
  findings: FiveSFinding[]
  onAssign: (findingId: string, assignedTo: string, assignedToName: string, dueDate: string, correctiveAction: string) => void
  auditId: string
  color: string
}) {
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignForm, setAssignForm] = useState({
    assignedTo: '', assignedToName: '', dueDate: '', correctiveAction: ''
  })

  const colorClasses: Record<string, { bg: string, border: string, text: string }> = {
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' }
  }
  const colors = colorClasses[color] || colorClasses.red
  const existingFinding = findings[0]

  const handleCreateAndAssign = async () => {
    if (!assignForm.assignedTo || !assignForm.dueDate) {
      toast.error('Sorumlu ve tarih zorunludur')
      return
    }
    if (!existingFinding) {
      try {
        const res = await fetch(`/api/suggestions/five-s/${auditId}/action-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            findings: [{ sCategory: category, description, findingType: 'NON_CONFORMITY', priority: 'NORMAL' }]
          })
        })
        if (res.ok) {
          const data = await res.json()
          if (data.findings?.[0]) {
            onAssign(data.findings[0].id, assignForm.assignedTo, assignForm.assignedToName, assignForm.dueDate, assignForm.correctiveAction)
          }
        }
      } catch {
        toast.error('Bulgu oluşturulamadı')
      }
    } else {
      onAssign(existingFinding.id, assignForm.assignedTo, assignForm.assignedToName, assignForm.dueDate, assignForm.correctiveAction)
    }
    setIsAssigning(false)
  }

  return (
    <Card className={cn("border", colors.border)}>
      <CardContent className={cn("p-4", colors.bg)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h5 className={cn("font-semibold mb-2", colors.text)}>{categoryName}</h5>
            <p className="text-sm whitespace-pre-wrap">{description}</p>

            {existingFinding?.assignedTo && (
              <div className="mt-3 p-2 bg-white/50 rounded border">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{existingFinding.assignedToName}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{existingFinding.dueDate ? formatDate(existingFinding.dueDate) : '-'}</span>
                  <Badge variant={existingFinding.status === 'COMPLETED' ? 'default' : 'outline'}>
                    {existingFinding.status === 'COMPLETED' ? 'Tamamlandı' : existingFinding.status === 'IN_PROGRESS' ? 'Devam Ediyor' : 'Bekliyor'}
                  </Badge>
                </div>
                {existingFinding.correctiveAction && (
                  <p className="text-xs text-muted-foreground mt-1">{existingFinding.correctiveAction}</p>
                )}
              </div>
            )}
          </div>

          {!existingFinding?.assignedTo && !isAssigning && (
            <Button size="sm" variant="outline" onClick={() => setIsAssigning(true)} className="shrink-0">
              <UserPlus className="h-4 w-4 mr-1" />
              Aksiyon Ata
            </Button>
          )}
        </div>

        {isAssigning && (
          <div className="mt-4 p-4 bg-white rounded-lg border space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sorumlu Kişi *</Label>
                <UserSearchCombobox
                  value={assignForm.assignedTo}
                  onSelect={(user: ADUser | null) => setAssignForm({
                    ...assignForm,
                    assignedTo: user?.email || '',
                    assignedToName: user?.name || ''
                  })}
                  placeholder="Kişi seçin..."
                />
              </div>
              <div>
                <Label className="text-xs">Hedef Tarih *</Label>
                <Input type="date" value={assignForm.dueDate} onChange={e => setAssignForm({ ...assignForm, dueDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Düzeltici Faaliyet</Label>
              <Textarea
                value={assignForm.correctiveAction}
                onChange={e => setAssignForm({ ...assignForm, correctiveAction: e.target.value })}
                placeholder="Yapılması gereken düzeltici faaliyet..."
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setIsAssigning(false)}>İptal</Button>
              <Button size="sm" onClick={handleCreateAndAssign}>Kaydet ve Görev Oluştur</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ==========================================
// Main Export with Suspense
// ==========================================

export default function SuggestionsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="classic-spinner" />
      </div>
    }>
      <SuggestionsPageContent />
    </Suspense>
  )
}
