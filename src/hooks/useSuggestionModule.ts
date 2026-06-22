"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import type {
  Suggestion,
  Category,
  SuggestionStats,
  SuggestionUpdate,
  SuggestionFormData,
  SuggestionViewMode,
  UploadedFile,
  KaizenProject,
  NearMiss,
  FiveSArea,
  FiveSAudit,
  KaizenViewMode,
  NearMissViewMode,
  FiveSViewMode,
  KaizenFormData,
  NearMissFormData,
  FiveSAreaFormData,
  FiveSAuditFormData,
} from "@/types/suggestions"

// ==========================================
// Suggestions Module Hook
// ==========================================

export function useSuggestionModule() {
  // === STATE ===

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

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [fiveSAuditFiles, setFiveSAuditFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fiveSFileInputRef = useRef<HTMLInputElement>(null)

  // Form states
  const [suggestionForm, setSuggestionForm] = useState<SuggestionFormData>({
    title: '',
    description: '',
    currentSituation: '',
    proposedSolution: '',
    expectedBenefit: '',
    estimatedSavings: '',
    categoryId: '',
    priority: 'NORMAL',
    suggestionType: 'IMPROVEMENT',
    isAnonymous: false
  })

  const [kaizenForm, setKaizenForm] = useState<KaizenFormData>({
    title: '',
    description: '',
    projectType: 'INDIVIDUAL',
    problemWhat: '',
    problemWhy: '',
    currentState: '',
    targetState: '',
    proposedSolution: '',
    priority: 'NORMAL'
  })

  const [nearMissForm, setNearMissForm] = useState<NearMissFormData>({
    title: '',
    description: '',
    eventDate: new Date().toISOString().split('T')[0],
    eventLocation: '',
    eventType: 'OTHER',
    potentialSeverity: 'MODERATE',
    whatHappened: '',
    isAnonymous: false
  })

  const [fiveSAreaForm, setFiveSAreaForm] = useState<FiveSAreaFormData>({
    name: '',
    code: '',
    description: '',
    department: '',
    location: '',
    responsibleName: ''
  })

  const [fiveSAuditForm, setFiveSAuditForm] = useState<FiveSAuditFormData>({
    areaId: '',
    auditDate: new Date().toISOString().split('T')[0],
    auditType: 'REGULAR',
    seiriScore: 0,
    seitonScore: 0,
    seisoScore: 0,
    seiketsuScore: 0,
    shitsukeScore: 0,
    seiriFindings: '',
    seitonFindings: '',
    seisoFindings: '',
    seiketsuFindings: '',
    shitsukeFindings: '',
    strengths: '',
    improvements: '',
    notes: ''
  })

  // === DATA FETCHING ===

  const fetchSuggestions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ viewMode: suggestionViewMode })
      if (selectedCategory) params.append('categoryId', selectedCategory)
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

  // === FILE UPLOAD HANDLERS ===

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
      newFiles.push({
        name: file.name,
        size: file.size,
        type: file.type,
        file: file
      })
    }
    setUploadedFiles(prev => [...prev, ...newFiles])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
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
      newFiles.push({
        name: file.name,
        size: file.size,
        type: file.type,
        file: file
      })
    }
    setFiveSAuditFiles(prev => [...prev, ...newFiles])
    if (fiveSFileInputRef.current) {
      fiveSFileInputRef.current.value = ''
    }
  }

  const removeFiveSFile = (index: number) => {
    setFiveSAuditFiles(prev => prev.filter((_, i) => i !== index))
  }

  // === FORM HANDLERS ===

  const handleSuggestionSubmit = async (e: React.FormEvent) => {
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
        resetSuggestionForm()
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

  const handleKaizenSubmit = async (e: React.FormEvent) => {
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
        resetKaizenForm()
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

  const handleNearMissSubmit = async (e: React.FormEvent) => {
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
        resetNearMissForm()
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
      return false
    }

    try {
      const res = await fetch('/api/suggestions/five-s/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fiveSAreaForm)
      })

      if (res.ok) {
        toast.success('5S denetim alanı oluşturuldu!')
        resetFiveSAreaForm()
        fetchFiveSAreas()
        return true
      } else {
        const error = await res.json()
        toast.error(error.error || 'Bir hata oluştu')
        return false
      }
    } catch {
      toast.error('Alan oluşturulurken bir hata oluştu')
      return false
    }
  }

  const handleFiveSAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fiveSAuditForm.areaId) {
      toast.error('Denetim alanı seçiniz')
      return false
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
          return false
        }
      }

      const res = await fetch('/api/suggestions/five-s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fiveSAuditForm, attachments })
      })

      if (res.ok) {
        toast.success('5S denetimi başlatıldı!')
        resetFiveSAuditForm()
        fetchFiveSAudits()
        fetchFiveSAreas()
        return true
      } else {
        const error = await res.json()
        toast.error(error.error || 'Bir hata oluştu')
        return false
      }
    } catch {
      toast.error('Denetim başlatılırken bir hata oluştu')
      return false
    }
  }

  // === 5S ACTION PLAN ===

  const openActionPlan = async (audit: FiveSAudit) => {
    setActionPlanLoading(true)
    try {
      const res = await fetch(`/api/suggestions/five-s/${audit.id}/action-plan`)
      if (res.ok) {
        const data = await res.json()
        setSelectedAuditForAction(data)
        return true
      } else {
        toast.error('Aksiyon planı yüklenemedi')
        return false
      }
    } catch (error) {
      console.error('Aksiyon planı yüklenirken hata:', error)
      toast.error('Bir hata oluştu')
      return false
    } finally {
      setActionPlanLoading(false)
    }
  }

  const assignAction = async (findingId: string, assignedTo: string, assignedToName: string, dueDate: string, correctiveAction: string) => {
    if (!selectedAuditForAction) return false
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
        return true
      } else {
        const error = await res.json()
        toast.error(error.error || 'Aksiyon atanamadı')
        return false
      }
    } catch (error) {
      console.error('Aksiyon atanırken hata:', error)
      toast.error('Bir hata oluştu')
      return false
    }
  }

  const openAreaDetail = async (area: FiveSArea) => {
    setSelectedFiveSArea(area)
    try {
      const res = await fetch(`/api/suggestions/five-s?areaId=${area.id}`)
      if (res.ok) {
        const data = await res.json()
        setAreaAudits(data)
        return true
      }
    } catch (error) {
      console.error('Alan denetimleri yüklenirken hata:', error)
    }
    return false
  }

  // === RESET FUNCTIONS ===

  const resetSuggestionForm = () => {
    setSuggestionForm({
      title: '', description: '', currentSituation: '', proposedSolution: '',
      expectedBenefit: '', estimatedSavings: '', categoryId: '', priority: 'NORMAL',
      suggestionType: 'IMPROVEMENT', isAnonymous: false
    })
    setUploadedFiles([])
  }

  const resetKaizenForm = () => {
    setKaizenForm({
      title: '', description: '', projectType: 'INDIVIDUAL', problemWhat: '',
      problemWhy: '', currentState: '', targetState: '', proposedSolution: '', priority: 'NORMAL'
    })
    setUploadedFiles([])
  }

  const resetNearMissForm = () => {
    setNearMissForm({
      title: '', description: '', eventDate: new Date().toISOString().split('T')[0],
      eventLocation: '', eventType: 'OTHER', potentialSeverity: 'MODERATE',
      whatHappened: '', isAnonymous: false
    })
    setUploadedFiles([])
  }

  const resetFiveSAreaForm = () => {
    setFiveSAreaForm({
      name: '', code: '', description: '', department: '', location: '', responsibleName: ''
    })
  }

  const resetFiveSAuditForm = () => {
    setFiveSAuditForm({
      areaId: '', auditDate: new Date().toISOString().split('T')[0], auditType: 'REGULAR',
      seiriScore: 0, seitonScore: 0, seisoScore: 0, seiketsuScore: 0, shitsukeScore: 0,
      seiriFindings: '', seitonFindings: '', seisoFindings: '', seiketsuFindings: '', shitsukeFindings: '',
      strengths: '', improvements: '', notes: ''
    })
    setFiveSAuditFiles([])
  }

  // === COMPUTED VALUES ===

  const filteredSuggestions = suggestions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.suggestionNumber.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getModuleStats = (key: string) => {
    switch (key) {
      case 'mySuggestions': return suggestions.length
      case 'kaizen': return kaizenProjects.length
      case 'nearmiss': return nearMisses.length
      case 'fives': return fiveSAudits.length
      default: return 0
    }
  }

  // === RETURN ===

  return {
    // Data
    suggestions,
    filteredSuggestions,
    categories,
    stats,
    kaizenProjects,
    nearMisses,
    fiveSAudits,
    fiveSAreas,
    mySuggestionUpdates,
    pendingApprovalCount,
    selectedFiveSArea,
    areaAudits,
    selectedAuditForAction,

    // Loading
    loading,
    actionPlanLoading,

    // View modes
    suggestionViewMode,
    setSuggestionViewMode,
    kaizenViewMode,
    setKaizenViewMode,
    nearMissViewMode,
    setNearMissViewMode,
    fiveSViewMode,
    setFiveSViewMode,

    // Search & Filter
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,

    // Forms
    suggestionForm,
    setSuggestionForm,
    kaizenForm,
    setKaizenForm,
    nearMissForm,
    setNearMissForm,
    fiveSAreaForm,
    setFiveSAreaForm,
    fiveSAuditForm,
    setFiveSAuditForm,

    // File upload
    uploadedFiles,
    fiveSAuditFiles,
    fileInputRef,
    fiveSFileInputRef,
    handleFileSelect,
    removeFile,
    handleFiveSFileSelect,
    removeFiveSFile,

    // Submit handlers
    handleSuggestionSubmit,
    handleKaizenSubmit,
    handleNearMissSubmit,
    handleFiveSAreaSubmit,
    handleFiveSAuditSubmit,

    // Reset functions
    resetSuggestionForm,
    resetKaizenForm,
    resetNearMissForm,
    resetFiveSAreaForm,
    resetFiveSAuditForm,

    // 5S Actions
    openActionPlan,
    assignAction,
    openAreaDetail,
    setSelectedFiveSArea,
    setSelectedAuditForAction,

    // Refresh functions
    fetchSuggestions,
    fetchStats,
    fetchKaizenProjects,
    fetchNearMisses,
    fetchFiveSAudits,
    fetchFiveSAreas,

    // Stats helper
    getModuleStats,
  }
}
