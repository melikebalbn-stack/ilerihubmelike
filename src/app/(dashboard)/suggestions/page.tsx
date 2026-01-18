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
  DialogTrigger,
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
  Plus,
  Search,
  Filter,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  MessageSquare,
  ChevronRight,
  RefreshCcw,
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
  Shield,
  Bell,
  HelpCircle,
  BookOpen,
  CheckSquare,
  Printer,
  User,
  Calendar,
  UserPlus
} from "lucide-react"
import { cn } from "@/lib/utils"
import { UserSearchCombobox, type ADUser } from "@/components/user-search-combobox"

// ==========================================
// Types
// ==========================================

interface Category {
  id: string
  name: string
  color: string
  icon?: string
}

interface Suggestion {
  id: string
  suggestionNumber: string
  title: string
  description: string
  status: string
  priority: string
  suggestionType: string
  submittedByName: string
  submittedByDept?: string
  isAnonymous: boolean
  submittedAt: string
  estimatedSavings?: number
  category?: Category
  _count?: {
    comments: number
  }
}

interface KaizenProject {
  id: string
  projectNumber: string
  title: string
  description: string
  projectType: string
  pdcaStage: string
  status: string
  priority: string
  department?: string
  teamLeaderName?: string
  startDate?: string
  targetEndDate?: string
  createdAt: string
  _count?: {
    pdcaSteps: number
    attachments: number
  }
}

interface NearMiss {
  id: string
  reportNumber: string
  title: string
  description: string
  eventType: string
  potentialSeverity: string
  status: string
  eventLocation: string
  eventDate: string
  reportedByName: string
  isAnonymous: boolean
  reportedAt: string
  _count?: {
    attachments: number
    actions: number
  }
}

interface FiveSArea {
  id: string
  name: string
  code: string
  description?: string
  department?: string
  location?: string
  responsibleName?: string
  _count?: {
    audits: number
  }
  audits?: {
    auditDate: string
    totalScore: number
  }[]
}

interface FiveSFinding {
  id: string
  sCategory: string
  findingType: string
  description: string
  location?: string
  priority: string
  status: string
  correctiveAction?: string
  assignedTo?: string
  assignedToName?: string
  dueDate?: string
  completedDate?: string
  plannedTaskId?: string
  plannedTask?: {
    id: string
    title: string
    status: string
  }
}

interface FiveSAudit {
  id: string
  auditNumber: string
  auditDate: string
  auditType: string
  status: string
  totalScore: number
  auditorName: string
  seiriScore?: number
  seitonScore?: number
  seisoScore?: number
  seiketsuScore?: number
  shitsukeScore?: number
  seiriDetails?: string
  seitonDetails?: string
  seisoDetails?: string
  seiketsuDetails?: string
  shitsukeDetails?: string
  strengths?: string
  improvements?: string
  notes?: string
  actionPlanStatus?: string
  actionPlanCreatedAt?: string
  actionPlanCreatedBy?: string
  area?: {
    name: string
    code: string
  }
  findings?: FiveSFinding[]
}

interface Stats {
  overview: {
    total: number
    pending: number
    approved: number
    implemented: number
    rejected: number
    thisMonth: number
    totalSavings: number
  }
}

interface UploadedFile {
  name: string
  size: number
  type: string
  file: File
}

// ==========================================
// Config
// ==========================================

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  SUBMITTED: { label: 'Gönderildi', color: 'bg-blue-100 text-blue-800', icon: Clock },
  UNDER_REVIEW: { label: 'İnceleniyor', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
  PENDING_APPROVAL: { label: 'Onay Bekliyor', color: 'bg-orange-100 text-orange-800', icon: Clock },
  APPROVED: { label: 'Onaylandı', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  REJECTED: { label: 'Reddedildi', color: 'bg-red-100 text-red-800', icon: XCircle },
  IN_PROGRESS: { label: 'Uygulamada', color: 'bg-purple-100 text-purple-800', icon: TrendingUp },
  IMPLEMENTED: { label: 'Uygulandı', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  CLOSED: { label: 'Kapatıldı', color: 'bg-gray-100 text-gray-800', icon: XCircle },
  WITHDRAWN: { label: 'Geri Çekildi', color: 'bg-gray-100 text-gray-600', icon: XCircle },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Düşük', color: 'bg-gray-100 text-gray-600' },
  NORMAL: { label: 'Normal', color: 'bg-blue-100 text-blue-600' },
  HIGH: { label: 'Yüksek', color: 'bg-orange-100 text-orange-600' },
  CRITICAL: { label: 'Kritik', color: 'bg-red-100 text-red-600' },
}

const pdcaConfig: Record<string, { label: string; color: string }> = {
  PLAN: { label: 'Planla', color: 'bg-blue-100 text-blue-800' },
  DO: { label: 'Uygula', color: 'bg-yellow-100 text-yellow-800' },
  CHECK: { label: 'Kontrol Et', color: 'bg-purple-100 text-purple-800' },
  ACT: { label: 'Önlem Al', color: 'bg-green-100 text-green-800' },
}

const kaizenStatusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Taslak', color: 'bg-gray-100 text-gray-800' },
  PLANNING: { label: 'Planlanıyor', color: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'Devam Ediyor', color: 'bg-yellow-100 text-yellow-800' },
  CHECKING: { label: 'Kontrol', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Tamamlandı', color: 'bg-green-100 text-green-800' },
  STANDARDIZED: { label: 'Standart', color: 'bg-emerald-100 text-emerald-800' },
  CANCELLED: { label: 'İptal', color: 'bg-red-100 text-red-800' },
}

const nearMissTypeConfig: Record<string, string> = {
  FALLING: 'Düşme',
  SLIPPING: 'Kayma',
  TRIPPING: 'Takılma',
  COLLISION: 'Çarpışma',
  FALLING_OBJECT: 'Düşen Cisim',
  ELECTRICAL: 'Elektrik',
  FIRE: 'Yangın',
  CHEMICAL: 'Kimyasal',
  MACHINERY: 'Makine/Ekipman',
  VEHICLE: 'Araç',
  ERGONOMIC: 'Ergonomik',
  ENVIRONMENTAL: 'Çevresel',
  OTHER: 'Diğer',
}

const severityConfig: Record<string, { label: string; color: string }> = {
  MINOR: { label: 'Hafif', color: 'bg-gray-100 text-gray-600' },
  MODERATE: { label: 'Orta', color: 'bg-yellow-100 text-yellow-600' },
  MAJOR: { label: 'Ciddi', color: 'bg-orange-100 text-orange-600' },
  CRITICAL: { label: 'Kritik', color: 'bg-red-100 text-red-600' },
  FATAL: { label: 'Ölümcül', color: 'bg-red-200 text-red-800' },
}

const nearMissStatusConfig: Record<string, { label: string; color: string }> = {
  REPORTED: { label: 'Bildirildi', color: 'bg-blue-100 text-blue-800' },
  UNDER_INVESTIGATION: { label: 'Araştırılıyor', color: 'bg-yellow-100 text-yellow-800' },
  ACTION_REQUIRED: { label: 'Aksiyon Gerekli', color: 'bg-orange-100 text-orange-800' },
  IN_PROGRESS: { label: 'İşlemde', color: 'bg-purple-100 text-purple-800' },
  RESOLVED: { label: 'Çözüldü', color: 'bg-green-100 text-green-800' },
  CLOSED: { label: 'Kapatıldı', color: 'bg-gray-100 text-gray-800' },
}

// Module Cards Config
const moduleCards = [
  {
    id: 'suggestions',
    title: 'Öneriler',
    description: 'Şirketi geliştirmek için fikirlerinizi paylaşın',
    icon: Lightbulb,
    color: 'from-yellow-500 to-amber-600',
    bgColor: 'bg-gradient-to-br from-yellow-50 to-amber-50',
    borderColor: 'border-yellow-200 hover:border-yellow-400',
    iconBg: 'bg-yellow-100',
    stats: { label: 'Önerim', key: 'mySuggestions' }
  },
  {
    id: 'kaizen',
    title: 'Kaizen',
    description: 'PDCA döngüsü ile sürekli iyileştirme projeleri',
    icon: RefreshCcw,
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50',
    borderColor: 'border-blue-200 hover:border-blue-400',
    iconBg: 'bg-blue-100',
    stats: { label: 'Projelerim', key: 'kaizen' }
  },
  {
    id: 'nearmiss',
    title: 'Ramak Kala',
    description: 'İş güvenliği tehlikelerini hızlıca bildirin',
    icon: AlertTriangle,
    color: 'from-orange-500 to-red-600',
    bgColor: 'bg-gradient-to-br from-orange-50 to-red-50',
    borderColor: 'border-orange-200 hover:border-orange-400',
    iconBg: 'bg-orange-100',
    stats: { label: 'Bildirimlerim', key: 'nearmiss' }
  },
  {
    id: 'fives',
    title: '5S Denetim',
    description: 'Düzen, temizlik ve standartlaştırma denetimleri',
    icon: ClipboardCheck,
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-gradient-to-br from-emerald-50 to-teal-50',
    borderColor: 'border-emerald-200 hover:border-emerald-400',
    iconBg: 'bg-emerald-100',
    stats: { label: 'Denetimlerim', key: 'fives' }
  }
]

// ==========================================
// Main Component
// ==========================================

function SuggestionsPageContent() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeModule, setActiveModule] = useState<string | null>(null)

  // URL'deki module parametresini oku ve değişiklikleri dinle
  useEffect(() => {
    const moduleParam = searchParams.get('module')
    if (moduleParam && ['suggestions', 'kaizen', 'nearmiss', 'fives'].includes(moduleParam)) {
      setActiveModule(moduleParam)
    } else {
      // Eğer module parametresi yoksa ana sayfaya dön
      setActiveModule(null)
    }
  }, [searchParams, pathname])

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [suggestionViewMode, setSuggestionViewMode] = useState<'all' | 'my' | 'pending' | 'awaiting_my_approval'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  // Kaizen state
  const [kaizenProjects, setKaizenProjects] = useState<KaizenProject[]>([])
  const [kaizenViewMode, setKaizenViewMode] = useState<'all' | 'my'>('all')

  // Near Miss state
  const [nearMisses, setNearMisses] = useState<NearMiss[]>([])
  const [nearMissViewMode, setNearMissViewMode] = useState<'all' | 'my' | 'open'>('all')

  // 5S state
  const [fiveSAudits, setFiveSAudits] = useState<FiveSAudit[]>([])
  const [fiveSAreas, setFiveSAreas] = useState<FiveSArea[]>([])
  const [fiveSViewMode, setFiveSViewMode] = useState<'all' | 'my'>('all')

  // 5S Aksiyon Planı state
  const [isActionPlanOpen, setIsActionPlanOpen] = useState(false)
  const [selectedAuditForAction, setSelectedAuditForAction] = useState<FiveSAudit | null>(null)
  const [actionPlanLoading, setActionPlanLoading] = useState(false)

  // Loading state
  const [loading, setLoading] = useState(true)

  // Pending approval count state
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)

  // My suggestion updates state
  interface SuggestionUpdate {
    id: string
    suggestionNumber: string
    title: string
    status: string
    statusLabel: string
    statusType: 'success' | 'error' | 'warning' | 'info'
    decisionDate: string
  }
  const [mySuggestionUpdates, setMySuggestionUpdates] = useState<SuggestionUpdate[]>([])

  // Dialog states
  const [isCreateSuggestionOpen, setIsCreateSuggestionOpen] = useState(false)
  const [isCreateKaizenOpen, setIsCreateKaizenOpen] = useState(false)
  const [isCreateNearMissOpen, setIsCreateNearMissOpen] = useState(false)
  const [isCreateFiveSAreaOpen, setIsCreateFiveSAreaOpen] = useState(false)
  const [isCreateFiveSAuditOpen, setIsCreateFiveSAuditOpen] = useState(false)
  const [selectedFiveSArea, setSelectedFiveSArea] = useState<FiveSArea | null>(null)
  const [areaAudits, setAreaAudits] = useState<FiveSAudit[]>([])
  const [isAreaDetailOpen, setIsAreaDetailOpen] = useState(false)
  const [isFiveSGuideOpen, setIsFiveSGuideOpen] = useState(false)
  const [isKaizenGuideOpen, setIsKaizenGuideOpen] = useState(false)

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [fiveSAuditFiles, setFiveSAuditFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fiveSFileInputRef = useRef<HTMLInputElement>(null)

  // Form states
  const [suggestionForm, setSuggestionForm] = useState({
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

  const [kaizenForm, setKaizenForm] = useState({
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

  const [nearMissForm, setNearMissForm] = useState({
    title: '',
    description: '',
    eventDate: new Date().toISOString().split('T')[0],
    eventLocation: '',
    eventType: 'OTHER',
    potentialSeverity: 'MODERATE',
    whatHappened: '',
    isAnonymous: false
  })

  const [fiveSAreaForm, setFiveSAreaForm] = useState({
    name: '',
    code: '',
    description: '',
    department: '',
    location: '',
    responsibleName: ''
  })

  const [fiveSAuditForm, setFiveSAuditForm] = useState({
    areaId: '',
    auditDate: new Date().toISOString().split('T')[0],
    auditType: 'REGULAR',
    seiriScore: 0,
    seitonScore: 0,
    seisoScore: 0,
    seiketsuScore: 0,
    shitsukeScore: 0,
    // Uygunsuzluk alanları
    seiriFindings: '',
    seitonFindings: '',
    seisoFindings: '',
    seiketsuFindings: '',
    shitsukeFindings: '',
    strengths: '',
    improvements: '',
    notes: ''
  })

  // 5S Checklist Items
  const fiveSChecklistItems = {
    seiri: [
      { id: 'seiri_1', text: 'Gereksiz malzeme/araç-gereç yok', weight: 25 },
      { id: 'seiri_2', text: 'Bozuk/arızalı ekipman yok', weight: 25 },
      { id: 'seiri_3', text: 'Gereksiz stok birikimi yok', weight: 25 },
      { id: 'seiri_4', text: 'Kişisel eşyalar uygun yerde', weight: 25 },
    ],
    seiton: [
      { id: 'seiton_1', text: 'Malzemeler belirlenen yerlerde', weight: 25 },
      { id: 'seiton_2', text: 'Etiketleme ve işaretlemeler mevcut', weight: 25 },
      { id: 'seiton_3', text: 'Kolay erişim sağlanmış', weight: 25 },
      { id: 'seiton_4', text: 'Görsel yönetim uygulanıyor', weight: 25 },
    ],
    seiso: [
      { id: 'seiso_1', text: 'Zemin temiz ve düzenli', weight: 25 },
      { id: 'seiso_2', text: 'Masa ve ekipmanlar temiz', weight: 25 },
      { id: 'seiso_3', text: 'Temizlik malzemeleri mevcut', weight: 25 },
      { id: 'seiso_4', text: 'Temizlik programı uygulanıyor', weight: 25 },
    ],
    seiketsu: [
      { id: 'seiketsu_1', text: 'Yazılı standartlar mevcut', weight: 25 },
      { id: 'seiketsu_2', text: 'Görsel talimatlar asılı', weight: 25 },
      { id: 'seiketsu_3', text: 'Çalışanlar standartları biliyor', weight: 25 },
      { id: 'seiketsu_4', text: 'Standartlar güncel', weight: 25 },
    ],
    shitsuke: [
      { id: 'shitsuke_1', text: '5S aktiviteleri düzenli yapılıyor', weight: 25 },
      { id: 'shitsuke_2', text: 'Çalışanlar 5S\'e sahip çıkıyor', weight: 25 },
      { id: 'shitsuke_3', text: 'İyileştirme önerileri geliyor', weight: 25 },
      { id: 'shitsuke_4', text: 'Geçmiş denetimlere göre ilerleme var', weight: 25 },
    ]
  }

  type ChecklistScore = 0 | 1 | 2 | 3 | 4 // 0=N/A, 1=Yetersiz, 2=Geliştirilmeli, 3=İyi, 4=Mükemmel

  const [checklistScores, setChecklistScores] = useState<Record<string, ChecklistScore>>({})
  const [checklistNotes, setChecklistNotes] = useState<Record<string, string>>({})

  // Checklist puanlarından 5S puanlarını hesapla
  const calculateScoreFromChecklist = (category: keyof typeof fiveSChecklistItems): number => {
    const items = fiveSChecklistItems[category]
    let totalScore = 0
    let totalWeight = 0

    items.forEach(item => {
      const score = checklistScores[item.id]
      if (score !== undefined && score > 0) {
        totalScore += (score / 4) * item.weight
        totalWeight += item.weight
      } else if (score === 0) {
        // N/A - don't count
      } else {
        // Not scored yet - count as 0
        totalWeight += item.weight
      }
    })

    return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0
  }

  // Checklist değiştiğinde puanları güncelle
  useEffect(() => {
    if (Object.keys(checklistScores).length > 0) {
      setFiveSAuditForm(prev => ({
        ...prev,
        seiriScore: calculateScoreFromChecklist('seiri'),
        seitonScore: calculateScoreFromChecklist('seiton'),
        seisoScore: calculateScoreFromChecklist('seiso'),
        seiketsuScore: calculateScoreFromChecklist('seiketsu'),
        shitsukeScore: calculateScoreFromChecklist('shitsuke'),
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklistScores])

  // 5S Denetim Formunu Yazdır
  const printFiveSAuditForm = () => {
    const selectedArea = fiveSAreas.find(a => a.id === fiveSAuditForm.areaId)
    const totalScore = Math.round(
      (fiveSAuditForm.seiriScore + fiveSAuditForm.seitonScore + fiveSAuditForm.seisoScore +
       fiveSAuditForm.seiketsuScore + fiveSAuditForm.shitsukeScore) / 5
    )

    const getScoreLabel = (score: number) => {
      if (score === 0) return 'N/A'
      if (score === 1) return '1'
      if (score === 2) return '2'
      if (score === 3) return '3'
      return '4'
    }

    const getScoreBgColor = (itemId: string) => {
      const score = checklistScores[itemId]
      if (score === undefined) return '#fff'
      if (score === 0) return '#6b7280'
      if (score === 1) return '#ef4444'
      if (score === 2) return '#eab308'
      if (score === 3) return '#3b82f6'
      return '#22c55e'
    }

    const renderChecklistSection = (
      title: string,
      subtitle: string,
      bgColor: string,
      items: typeof fiveSChecklistItems.seiri,
      score: number,
      findings: string = ''
    ) => {
      return `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 12px; break-inside: avoid;">
          <div style="background: ${bgColor}; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="font-size: 14px;">${title}</strong>
              <div style="font-size: 11px; color: #666; margin-top: 2px;">${subtitle}</div>
            </div>
            <div style="font-size: 20px; font-weight: bold; color: ${score >= 80 ? '#16a34a' : score >= 60 ? '#ca8a04' : '#dc2626'};">${score}</div>
          </div>
          <div style="padding: 8px;">
            ${items.map(item => `
              <div style="display: flex; align-items: center; padding: 6px 0; border-bottom: 1px solid #f3f4f6;">
                <span style="flex: 1; font-size: 12px;">${item.text}</span>
                <div style="display: flex; gap: 4px;">
                  ${[0, 1, 2, 3, 4].map(s => `
                    <div style="
                      width: 24px;
                      height: 24px;
                      border-radius: 4px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 10px;
                      font-weight: 500;
                      border: 1px solid ${checklistScores[item.id] === s ? 'transparent' : '#d1d5db'};
                      background: ${checklistScores[item.id] === s ? getScoreBgColor(item.id) : '#fff'};
                      color: ${checklistScores[item.id] === s ? '#fff' : '#374151'};
                    ">${s === 0 ? 'N/A' : s}</div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
            ${findings ? `
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #d1d5db;">
                <div style="font-size: 10px; font-weight: 600; color: #dc2626; margin-bottom: 4px;">⚠️ Tespit Edilen Uygunsuzluklar:</div>
                <div style="font-size: 11px; color: #374151; white-space: pre-wrap; background: #fef2f2; padding: 6px 8px; border-radius: 4px;">${findings}</div>
              </div>
            ` : ''}
          </div>
        </div>
      `
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>5S Denetim Formu - ${selectedArea?.name || ''}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #333; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #10b981; }
          .title { font-size: 20px; font-weight: bold; color: #10b981; }
          .date { font-size: 11px; color: #666; }
          .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; padding: 15px; background: #f9fafb; border-radius: 8px; }
          .info-item label { font-size: 10px; color: #666; display: block; margin-bottom: 4px; }
          .info-item span { font-size: 13px; font-weight: 500; }
          .scores-summary { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 20px; padding: 15px; background: #ecfdf5; border-radius: 8px; }
          .score-item { text-align: center; }
          .score-item label { font-size: 10px; color: #666; display: block; }
          .score-item span { font-size: 18px; font-weight: bold; }
          .score-total { border-left: 2px solid #10b981; padding-left: 10px; }
          .notes-section { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; }
          .notes-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; min-height: 60px; }
          .notes-box label { font-size: 11px; font-weight: 600; color: #374151; display: block; margin-bottom: 8px; }
          .notes-box p { font-size: 11px; color: #4b5563; margin: 0; white-space: pre-wrap; }
          .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          .signature-box { text-align: center; }
          .signature-box label { font-size: 11px; color: #666; display: block; margin-bottom: 30px; }
          .signature-line { border-top: 1px solid #333; padding-top: 5px; font-size: 10px; }
          .criteria { margin-top: 15px; padding: 10px; background: #f3f4f6; border-radius: 6px; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">5S Denetim Formu</div>
          <div class="date">${new Date().toLocaleDateString('tr-TR')} - İLERİHub Kurumsal Portal</div>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <label>Denetim Alanı</label>
            <span>${selectedArea?.name || '-'} ${selectedArea?.code ? `(${selectedArea.code})` : ''}</span>
          </div>
          <div class="info-item">
            <label>Denetim Tarihi</label>
            <span>${fiveSAuditForm.auditDate ? new Date(fiveSAuditForm.auditDate).toLocaleDateString('tr-TR') : '-'}</span>
          </div>
          <div class="info-item">
            <label>Denetçi</label>
            <span>${session?.user?.name || '-'}</span>
          </div>
        </div>

        <div class="scores-summary">
          <div class="score-item">
            <label>1S Seiri</label>
            <span style="color: ${fiveSAuditForm.seiriScore >= 80 ? '#16a34a' : fiveSAuditForm.seiriScore >= 60 ? '#ca8a04' : '#dc2626'}">${fiveSAuditForm.seiriScore}</span>
          </div>
          <div class="score-item">
            <label>2S Seiton</label>
            <span style="color: ${fiveSAuditForm.seitonScore >= 80 ? '#16a34a' : fiveSAuditForm.seitonScore >= 60 ? '#ca8a04' : '#dc2626'}">${fiveSAuditForm.seitonScore}</span>
          </div>
          <div class="score-item">
            <label>3S Seiso</label>
            <span style="color: ${fiveSAuditForm.seisoScore >= 80 ? '#16a34a' : fiveSAuditForm.seisoScore >= 60 ? '#ca8a04' : '#dc2626'}">${fiveSAuditForm.seisoScore}</span>
          </div>
          <div class="score-item">
            <label>4S Seiketsu</label>
            <span style="color: ${fiveSAuditForm.seiketsuScore >= 80 ? '#16a34a' : fiveSAuditForm.seiketsuScore >= 60 ? '#ca8a04' : '#dc2626'}">${fiveSAuditForm.seiketsuScore}</span>
          </div>
          <div class="score-item">
            <label>5S Shitsuke</label>
            <span style="color: ${fiveSAuditForm.shitsukeScore >= 80 ? '#16a34a' : fiveSAuditForm.shitsukeScore >= 60 ? '#ca8a04' : '#dc2626'}">${fiveSAuditForm.shitsukeScore}</span>
          </div>
          <div class="score-item score-total">
            <label>TOPLAM</label>
            <span style="color: ${totalScore >= 80 ? '#16a34a' : totalScore >= 60 ? '#ca8a04' : '#dc2626'}">${totalScore}</span>
          </div>
        </div>

        ${renderChecklistSection('1S Seiri - Ayıkla', 'Gereksizleri ayır ve uzaklaştır', '#fef2f2', fiveSChecklistItems.seiri, fiveSAuditForm.seiriScore, fiveSAuditForm.seiriFindings)}
        ${renderChecklistSection('2S Seiton - Düzenle', 'Her şeyin bir yeri, her şey yerinde', '#fff7ed', fiveSChecklistItems.seiton, fiveSAuditForm.seitonScore, fiveSAuditForm.seitonFindings)}
        ${renderChecklistSection('3S Seiso - Temizle', 'Temizlik aynı zamanda denetimdir', '#fefce8', fiveSChecklistItems.seiso, fiveSAuditForm.seisoScore, fiveSAuditForm.seisoFindings)}
        ${renderChecklistSection('4S Seiketsu - Standartlaştır', 'İlk 3S\'i koruyacak standartlar', '#eff6ff', fiveSChecklistItems.seiketsu, fiveSAuditForm.seiketsuScore, fiveSAuditForm.seiketsuFindings)}
        ${renderChecklistSection('5S Shitsuke - Sürdür', 'Alışkanlık haline getir ve sürekli iyileştir', '#faf5ff', fiveSChecklistItems.shitsuke, fiveSAuditForm.shitsukeScore, fiveSAuditForm.shitsukeFindings)}

        <div class="notes-section">
          <div class="notes-box">
            <label>💪 Güçlü Yönler</label>
            <p>${fiveSAuditForm.strengths || '-'}</p>
          </div>
          <div class="notes-box">
            <label>📈 Gelişim Alanları</label>
            <p>${fiveSAuditForm.improvements || '-'}</p>
          </div>
        </div>

        ${fiveSAuditForm.notes ? `
          <div class="notes-box" style="margin-top: 15px;">
            <label>📝 Genel Notlar</label>
            <p>${fiveSAuditForm.notes}</p>
          </div>
        ` : ''}

        <div class="criteria">
          <strong>Puanlama Kriterleri:</strong> N/A = Uygulanamaz | 1 = Yetersiz (0-25%) | 2 = Geliştirilmeli (26-50%) | 3 = İyi (51-75%) | 4 = Mükemmel (76-100%)
        </div>

        <div class="signature-section">
          <div class="signature-box">
            <label>Denetçi İmzası</label>
            <div class="signature-line">${session?.user?.name || ''}</div>
          </div>
          <div class="signature-box">
            <label>Alan Sorumlusu İmzası</label>
            <div class="signature-line">${selectedArea?.responsibleName || ''}</div>
          </div>
        </div>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 250)
    }
  }

  // ==========================================
  // Data Fetching
  // ==========================================

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

  // 5S Aksiyon Planı fonksiyonları
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
        // Denetimi yeniden yükle
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
      // Max 10MB
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />
    return <FileText className="h-4 w-4" />
  }

  // ==========================================
  // Form Handlers
  // ==========================================

  const handleSuggestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!suggestionForm.title || !suggestionForm.description) {
      toast.error('Başlık ve açıklama zorunludur')
      return
    }

    try {
      // Önce dosyaları yükle
      let attachments = null
      if (uploadedFiles.length > 0) {
        const formData = new FormData()
        uploadedFiles.forEach(f => formData.append('files', f.file))

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          attachments = uploadData.files
        } else {
          toast.error('Dosyalar yüklenirken hata oluştu')
          return
        }
      }

      // Öneriyi oluştur
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...suggestionForm,
          attachments
        })
      })

      if (res.ok) {
        toast.success('Öneriniz başarıyla gönderildi!')
        setIsCreateSuggestionOpen(false)
        setSuggestionForm({
          title: '', description: '', currentSituation: '', proposedSolution: '',
          expectedBenefit: '', estimatedSavings: '', categoryId: '', priority: 'NORMAL',
          suggestionType: 'IMPROVEMENT', isAnonymous: false
        })
        setUploadedFiles([])
        fetchSuggestions()
        fetchStats()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Bir hata oluştu')
      }
    } catch {
      toast.error('Öneri gönderilirken bir hata oluştu')
    }
  }

  const handleKaizenSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!kaizenForm.title || !kaizenForm.description) {
      toast.error('Başlık ve açıklama zorunludur')
      return
    }

    try {
      const res = await fetch('/api/suggestions/kaizen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kaizenForm)
      })

      if (res.ok) {
        toast.success('Kaizen projesi oluşturuldu!')
        setIsCreateKaizenOpen(false)
        setKaizenForm({
          title: '', description: '', projectType: 'INDIVIDUAL', problemWhat: '',
          problemWhy: '', currentState: '', targetState: '', proposedSolution: '', priority: 'NORMAL'
        })
        setUploadedFiles([])
        fetchKaizenProjects()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Bir hata oluştu')
      }
    } catch {
      toast.error('Kaizen projesi oluşturulurken bir hata oluştu')
    }
  }

  const handleNearMissSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nearMissForm.title || !nearMissForm.description || !nearMissForm.eventLocation) {
      toast.error('Başlık, açıklama ve konum zorunludur')
      return
    }

    try {
      const res = await fetch('/api/suggestions/near-miss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nearMissForm)
      })

      if (res.ok) {
        toast.success('Ramak kala olayı bildirildi!')
        setIsCreateNearMissOpen(false)
        setNearMissForm({
          title: '', description: '', eventDate: new Date().toISOString().split('T')[0],
          eventLocation: '', eventType: 'OTHER', potentialSeverity: 'MODERATE',
          whatHappened: '', isAnonymous: false
        })
        setUploadedFiles([])
        fetchNearMisses()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Bir hata oluştu')
      }
    } catch {
      toast.error('Bildirim gönderilirken bir hata oluştu')
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
        setFiveSAreaForm({
          name: '', code: '', description: '', department: '', location: '', responsibleName: ''
        })
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
      // Önce dosyaları yükle
      let attachments = null
      if (fiveSAuditFiles.length > 0) {
        const formData = new FormData()
        fiveSAuditFiles.forEach(f => formData.append('files', f.file))

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

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
        body: JSON.stringify({
          ...fiveSAuditForm,
          attachments
        })
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

  const openAreaDetail = async (area: FiveSArea) => {
    setSelectedFiveSArea(area)
    setIsAreaDetailOpen(true)
    // Bu alana ait denetimleri getir
    try {
      const res = await fetch(`/api/suggestions/five-s?areaId=${area.id}`)
      if (res.ok) {
        const data = await res.json()
        setAreaAudits(data)
      }
    } catch (error) {
      console.error('Alan denetimleri yüklenirken hata:', error)
    }
  }

  // ==========================================
  // Helpers
  // ==========================================

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const filteredSuggestions = suggestions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.suggestionNumber.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Get module stats
  const getModuleStats = (key: string) => {
    switch (key) {
      case 'mySuggestions': return suggestions.length // Sadece kullanıcının görebildiği öneriler
      case 'kaizen': return kaizenProjects.length
      case 'nearmiss': return nearMisses.length
      case 'fives': return fiveSAudits.length
      default: return 0
    }
  }

  // Drag state
  const [isDragging, setIsDragging] = useState(false)

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
      'image/jpeg', 'image/png', 'image/gif',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} dosyası çok büyük (max 10MB)`)
        continue
      }
      // Tip kontrolü
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name} desteklenmeyen dosya tipi`)
        continue
      }
      newFiles.push({
        name: file.name,
        size: file.size,
        type: file.type,
        file: file
      })
    }
    if (newFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...newFiles])
      toast.success(`${newFiles.length} dosya eklendi`)
    }
  }

  // File Upload Component
  const FileUploadSection = () => (
    <div className="col-span-2 space-y-3">
      <Label className="flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Dosya Ekle
      </Label>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 hover:border-gray-300"
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Upload className={cn("h-8 w-8 mx-auto mb-2", isDragging ? "text-blue-500" : "text-gray-400")} />
        <p className={cn("text-sm", isDragging ? "text-blue-600" : "text-gray-600")}>
          {isDragging ? "Dosyayı buraya bırakın" : "Dosya yüklemek için tıklayın veya sürükleyin"}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          JPG, PNG, PDF, Word, Excel, PowerPoint (max 10MB)
        </p>
      </div>
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
            >
              {getFileIcon(file.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // 5S File Upload Handlers
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

  // 5S File Upload Component
  const FiveSFileUploadSection = () => (
    <div className="col-span-2 space-y-3 print:hidden">
      <Label className="flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Fotoğraf / Video / Dosya Ekle
      </Label>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50"
        )}
        onClick={() => fiveSFileInputRef.current?.click()}
      >
        <input
          ref={fiveSFileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.pdf,.doc,.docx"
          className="hidden"
          onChange={handleFiveSFileSelect}
        />
        <Upload className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
        <p className="text-sm text-gray-600">
          Dosya yüklemek için tıklayın
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Fotoğraf (JPG, PNG), Video (MP4, MOV), PDF, Word (max 10MB)
        </p>
      </div>
      {fiveSAuditFiles.length > 0 && (
        <div className="space-y-2">
          {fiveSAuditFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 bg-emerald-50 rounded-lg"
            >
              {getFileIcon(file.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFiveSFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ==========================================
  // Render
  // ==========================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl shadow-lg">
              <Lightbulb className="h-7 w-7 text-white" />
            </div>
            <span><span className="text-blue-600">ILERI</span> Sürekli İyileştirme Merkezi</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Öneri, Kaizen, Ramak Kala ve 5S sistemleri ile şirketimizi birlikte geliştirelim
          </p>
        </div>
        {activeModule && (
          <Button variant="outline" onClick={() => setActiveModule(null)}>
            <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
            Geri Dön
          </Button>
        )}
      </div>

      {/* Pending Approval Alert */}
      {!activeModule && pendingApprovalCount > 0 && (
        <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-full">
                  <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    {pendingApprovalCount} öneri onayınızı bekliyor
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Ekibinizden gelen önerileri değerlendirmeniz bekleniyor
                  </p>
                </div>
              </div>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => {
                  setActiveModule('suggestions')
                  setSuggestionViewMode('awaiting_my_approval')
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Önerileri Gör
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Önerilerimde Son Gelişmeler */}
      {!activeModule && mySuggestionUpdates.length > 0 && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-blue-800 dark:text-blue-200">
                    Önerilerinizde {mySuggestionUpdates.length} güncelleme var
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    {mySuggestionUpdates.find(u => u.statusType === 'success') ? 'Onaylanan önerileriniz var!' :
                     mySuggestionUpdates.find(u => u.statusType === 'error') ? 'Bazı önerileriniz değerlendirildi' :
                     'Önerilerinizin durumu güncellendi'}
                  </p>
                </div>
              </div>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setActiveModule('suggestions')
                  setSuggestionViewMode('my')
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Önerilerimi Gör
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {!activeModule && stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700">{stats.overview.implemented}</p>
                  <p className="text-xs text-green-600">Uygulanan Öneri</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-700">{kaizenProjects.filter(p => p.status === 'IN_PROGRESS').length}</p>
                  <p className="text-xs text-blue-600">Aktif Kaizen</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Shield className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-700">{nearMisses.filter(n => n.status !== 'CLOSED').length}</p>
                  <p className="text-xs text-orange-600">Açık Ramak Kala</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Trophy className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">
                    {stats.overview.totalSavings > 0 ? `${(stats.overview.totalSavings / 1000).toFixed(0)}K` : '0'} ₺
                  </p>
                  <p className="text-xs text-emerald-600">Toplam Tasarruf</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Module Cards */}
      {!activeModule && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {moduleCards.map((module) => {
            const Icon = module.icon
            const count = getModuleStats(module.stats.key)

            return (
              <Card
                key={module.id}
                className={cn(
                  "relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
                  module.bgColor,
                  module.borderColor,
                  "border-2"
                )}
                onClick={() => setActiveModule(module.id)}
              >
                <CardContent className="p-6">
                  {/* Background decoration */}
                  <div className="absolute -right-4 -top-4 opacity-10">
                    <Icon className="h-32 w-32" />
                  </div>

                  <div className="relative z-10">
                    <div className={cn("inline-flex p-3 rounded-xl mb-4", module.iconBg)}>
                      <Icon className={cn("h-6 w-6 bg-gradient-to-r bg-clip-text", module.color)} style={{ color: module.color.includes('yellow') ? '#d97706' : module.color.includes('blue') ? '#3b82f6' : module.color.includes('orange') ? '#ea580c' : '#059669' }} />
                    </div>

                    <h3 className="text-lg font-bold mb-1">{module.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {module.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold">{count}</p>
                        <p className="text-xs text-muted-foreground">{module.stats.label}</p>
                      </div>
                      <Button size="sm" variant="secondary" className="gap-1">
                        Gör
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ==========================================
          SUGGESTIONS MODULE
      ========================================== */}
      {activeModule === 'suggestions' && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={suggestionViewMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSuggestionViewMode('all')}
              >
                Tümü
              </Button>
              <Button
                variant={suggestionViewMode === 'my' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSuggestionViewMode('my')}
              >
                Önerilerim
              </Button>
              <Button
                variant={suggestionViewMode === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSuggestionViewMode('pending')}
              >
                Bekleyenler
              </Button>
              <Button
                variant={suggestionViewMode === 'awaiting_my_approval' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSuggestionViewMode('awaiting_my_approval')}
                className="border-orange-200 text-orange-600 hover:bg-orange-50"
              >
                <Clock className="h-4 w-4 mr-1" />
                Onayım Beklenen
              </Button>
            </div>
            <Button className="gap-2" onClick={() => setIsCreateSuggestionOpen(true)}>
              <Plus className="h-4 w-4" />
              Yeni Öneri
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Öneri ara..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Suggestions List */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="classic-spinner" />
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Henüz öneri bulunmuyor</p>
                  <Button className="mt-4" onClick={() => setIsCreateSuggestionOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    İlk Öneriyi Oluştur
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredSuggestions.map(suggestion => {
                const status = statusConfig[suggestion.status] || statusConfig.SUBMITTED
                const StatusIcon = status.icon
                const priority = priorityConfig[suggestion.priority] || priorityConfig.NORMAL

                return (
                  <Card key={suggestion.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground font-mono">
                              {suggestion.suggestionNumber}
                            </span>
                            {suggestion.category && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: suggestion.category.color + '20',
                                  color: suggestion.category.color
                                }}
                              >
                                {suggestion.category.name}
                              </span>
                            )}
                            <Badge className={priority.color} variant="secondary">
                              {priority.label}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-lg mb-1">{suggestion.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {suggestion.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{suggestion.submittedByName}</span>
                            {suggestion.submittedByDept && <span>• {suggestion.submittedByDept}</span>}
                            <span>• {formatDate(suggestion.submittedAt)}</span>
                            {(suggestion._count?.comments ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {suggestion._count?.comments}
                              </span>
                            )}
                            {suggestion.estimatedSavings && (
                              <span className="text-green-600 font-medium">
                                ~{suggestion.estimatedSavings.toLocaleString('tr-TR')} ₺
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={status.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => router.push(`/suggestions/${suggestion.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Detay
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          KAIZEN MODULE
      ========================================== */}
      {activeModule === 'kaizen' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={kaizenViewMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setKaizenViewMode('all')}
              >
                Tümü
              </Button>
              <Button
                variant={kaizenViewMode === 'my' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setKaizenViewMode('my')}
              >
                Projelerim
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2 text-teal-600 border-teal-300 hover:bg-teal-50"
                onClick={() => setIsKaizenGuideOpen(true)}
              >
                <HelpCircle className="h-4 w-4" />
                Kaizen Kılavuzu
              </Button>
              <Button className="gap-2" onClick={() => setIsCreateKaizenOpen(true)}>
                <Plus className="h-4 w-4" />
                Yeni Kaizen
              </Button>
            </div>
          </div>

          {/* Kaizen Projects List */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="classic-spinner" />
              </div>
            ) : kaizenProjects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <RefreshCcw className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Henüz Kaizen projesi bulunmuyor</p>
                  <Button className="mt-4" onClick={() => setIsCreateKaizenOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    İlk Kaizen Projesini Başlat
                  </Button>
                </CardContent>
              </Card>
            ) : (
              kaizenProjects.map(project => {
                const pdca = pdcaConfig[project.pdcaStage] || pdcaConfig.PLAN
                const status = kaizenStatusConfig[project.status] || kaizenStatusConfig.DRAFT
                const priority = priorityConfig[project.priority] || priorityConfig.NORMAL

                return (
                  <Card key={project.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground font-mono">
                              {project.projectNumber}
                            </span>
                            <Badge className={pdca.color}>{pdca.label}</Badge>
                            <Badge className={priority.color} variant="secondary">
                              {priority.label}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-lg mb-1">{project.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {project.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {project.teamLeaderName && <span>Lider: {project.teamLeaderName}</span>}
                            {project.department && <span>• {project.department}</span>}
                            <span>• {formatDate(project.createdAt)}</span>
                            {(project._count?.attachments ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <Paperclip className="h-3 w-3" />
                                {project._count?.attachments}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={status.color}>{status.label}</Badge>
                          <Button variant="ghost" size="sm" className="text-muted-foreground">
                            <Eye className="h-4 w-4 mr-1" />
                            Detay
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          NEAR MISS MODULE
      ========================================== */}
      {activeModule === 'nearmiss' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={nearMissViewMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNearMissViewMode('all')}
              >
                Tümü
              </Button>
              <Button
                variant={nearMissViewMode === 'my' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNearMissViewMode('my')}
              >
                Bildirimlerim
              </Button>
              <Button
                variant={nearMissViewMode === 'open' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNearMissViewMode('open')}
              >
                Açık Olanlar
              </Button>
            </div>
            <Button className="gap-2 bg-orange-600 hover:bg-orange-700" onClick={() => setIsCreateNearMissOpen(true)}>
              <AlertTriangle className="h-4 w-4" />
              Ramak Kala Bildir
            </Button>
          </div>

          {/* Near Miss List */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="classic-spinner" />
              </div>
            ) : nearMisses.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Henüz ramak kala bildirimi bulunmuyor</p>
                  <Button className="mt-4 bg-orange-600 hover:bg-orange-700" onClick={() => setIsCreateNearMissOpen(true)}>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    İlk Bildirimi Oluştur
                  </Button>
                </CardContent>
              </Card>
            ) : (
              nearMisses.map(report => {
                const status = nearMissStatusConfig[report.status] || nearMissStatusConfig.REPORTED
                const severity = severityConfig[report.potentialSeverity] || severityConfig.MODERATE
                const eventType = nearMissTypeConfig[report.eventType] || 'Diğer'

                return (
                  <Card key={report.id} className="hover:shadow-md transition-shadow border-l-4 border-l-orange-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground font-mono">
                              {report.reportNumber}
                            </span>
                            <Badge variant="outline">{eventType}</Badge>
                            <Badge className={severity.color}>{severity.label}</Badge>
                          </div>
                          <h3 className="font-semibold text-lg mb-1">{report.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {report.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{report.reportedByName}</span>
                            <span>• {report.eventLocation}</span>
                            <span>• {formatDate(report.eventDate)}</span>
                            {(report._count?.actions ?? 0) > 0 && (
                              <span className="text-orange-600 font-medium">
                                {report._count?.actions} aksiyon
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={status.color}>{status.label}</Badge>
                          <Button variant="ghost" size="sm" className="text-muted-foreground">
                            <Eye className="h-4 w-4 mr-1" />
                            Detay
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          5S MODULE
      ========================================== */}
      {activeModule === 'fives' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={fiveSViewMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiveSViewMode('all')}
              >
                Tümü
              </Button>
              <Button
                variant={fiveSViewMode === 'my' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiveSViewMode('my')}
              >
                Denetimlerim
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                onClick={() => setIsFiveSGuideOpen(true)}
              >
                <HelpCircle className="h-4 w-4" />
                5S Kılavuzu
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setIsCreateFiveSAreaOpen(true)}>
                <Plus className="h-4 w-4" />
                Alan Tanımla
              </Button>
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  if (fiveSAreas.length === 0) {
                    toast.error('Önce bir denetim alanı tanımlamalısınız')
                    setIsCreateFiveSAreaOpen(true)
                  } else {
                    setIsCreateFiveSAuditOpen(true)
                  }
                }}
              >
                <ClipboardCheck className="h-4 w-4" />
                Denetim Başlat
              </Button>
            </div>
          </div>

          {/* 5S Info Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            {['Seiri (Ayıkla)', 'Seiton (Düzenle)', 'Seiso (Temizle)', 'Seiketsu (Standartlaştır)', 'Shitsuke (Sürdür)'].map((s, i) => (
              <Card key={i} className="text-center">
                <CardContent className="p-4">
                  <div className="text-3xl font-bold mb-1">{i + 1}S</div>
                  <p className="text-xs text-muted-foreground">{s}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 5S Alanları */}
          {fiveSAreas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Denetim Alanları</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {fiveSAreas.map(area => (
                    <div
                      key={area.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors hover:border-emerald-300"
                      onClick={() => openAreaDetail(area)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{area.name}</span>
                        <Badge variant="outline">{area.code}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {area.department && <span>{area.department}</span>}
                        {area.location && <span> • {area.location}</span>}
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-muted-foreground">{area._count?.audits || 0} denetim</span>
                        {area.audits && area.audits[0] && (
                          <span className={cn(
                            "font-medium",
                            area.audits[0].totalScore >= 80 ? "text-green-600" : area.audits[0].totalScore >= 60 ? "text-yellow-600" : "text-red-600"
                          )}>
                            Son: {area.audits[0].totalScore} puan
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {fiveSAudits.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">5S Denetim Modülü</h3>
                <p className="text-muted-foreground mb-4">
                  {fiveSAreas.length === 0
                    ? 'Denetim alanları tanımlandıktan sonra 5S denetimleri başlatılabilir.'
                    : 'Henüz denetim yapılmamış. İlk 5S denetimini başlatın.'}
                </p>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={() => setIsCreateFiveSAreaOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Alan Tanımla
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      if (fiveSAreas.length === 0) {
                        toast.error('Önce bir denetim alanı tanımlamalısınız')
                        setIsCreateFiveSAreaOpen(true)
                      } else {
                        setIsCreateFiveSAuditOpen(true)
                      }
                    }}
                  >
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Denetim Başlat
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold">Son Denetimler</h3>
              {fiveSAudits.map(audit => (
                <Card key={audit.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground font-mono">{audit.auditNumber}</span>
                          <Badge variant="outline">{audit.area?.name}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Denetçi: {audit.auditorName} • {formatDate(audit.auditDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className={cn(
                            "text-2xl font-bold",
                            audit.totalScore >= 80 ? "text-green-600" : audit.totalScore >= 60 ? "text-yellow-600" : "text-red-600"
                          )}>
                            {audit.totalScore}
                          </div>
                          <p className="text-xs text-muted-foreground">Puan</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openActionPlan(audit)}
                          disabled={actionPlanLoading}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Detay
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                          onClick={() => openActionPlan(audit)}
                          disabled={actionPlanLoading}
                        >
                          <ClipboardList className="h-4 w-4 mr-1" />
                          Aksiyon Planı
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          CREATE SUGGESTION DIALOG
      ========================================== */}
      <Dialog open={isCreateSuggestionOpen} onOpenChange={setIsCreateSuggestionOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Yeni Öneri Oluştur
            </DialogTitle>
            <DialogDescription>
              Şirketi geliştirmek için önerinizi paylaşın
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSuggestionSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Öneri Başlığı *</Label>
                <Input
                  value={suggestionForm.title}
                  onChange={e => setSuggestionForm({ ...suggestionForm, title: e.target.value })}
                  placeholder="Kısa ve açıklayıcı bir başlık"
                />
              </div>
              <div>
                <Label>Kategori</Label>
                <Select
                  value={suggestionForm.categoryId || undefined}
                  onValueChange={v => setSuggestionForm({ ...suggestionForm, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kategori seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Öncelik</Label>
                <Select
                  value={suggestionForm.priority}
                  onValueChange={v => setSuggestionForm({ ...suggestionForm, priority: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Düşük</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">Yüksek</SelectItem>
                    <SelectItem value="CRITICAL">Kritik</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Öneri Açıklaması *</Label>
                <textarea
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                  value={suggestionForm.description}
                  onChange={e => setSuggestionForm({ ...suggestionForm, description: e.target.value })}
                  placeholder="Önerinizi detaylı açıklayın"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Mevcut Durum</Label>
                <textarea
                  className="w-full min-h-[60px] px-3 py-2 border rounded-md"
                  value={suggestionForm.currentSituation}
                  onChange={e => setSuggestionForm({ ...suggestionForm, currentSituation: e.target.value })}
                  placeholder="Şu anki süreç nasıl işliyor?"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Önerilen Çözüm</Label>
                <textarea
                  className="w-full min-h-[60px] px-3 py-2 border rounded-md"
                  value={suggestionForm.proposedSolution}
                  onChange={e => setSuggestionForm({ ...suggestionForm, proposedSolution: e.target.value })}
                  placeholder="Nasıl bir çözüm öneriyorsunuz?"
                />
              </div>
              <div>
                <Label>Beklenen Fayda</Label>
                <Input
                  value={suggestionForm.expectedBenefit}
                  onChange={e => setSuggestionForm({ ...suggestionForm, expectedBenefit: e.target.value })}
                  placeholder="Ne gibi faydalar sağlanacak?"
                />
              </div>
              <div>
                <Label>Tahmini Tasarruf (TL)</Label>
                <Input
                  type="number"
                  value={suggestionForm.estimatedSavings}
                  onChange={e => setSuggestionForm({ ...suggestionForm, estimatedSavings: e.target.value })}
                  placeholder="0"
                />
              </div>
              <FileUploadSection />
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="suggestionAnonymous"
                  checked={suggestionForm.isAnonymous}
                  onChange={e => setSuggestionForm({ ...suggestionForm, isAnonymous: e.target.checked })}
                />
                <Label htmlFor="suggestionAnonymous" className="cursor-pointer">
                  Anonim olarak gönder
                </Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsCreateSuggestionOpen(false)}>
                İptal
              </Button>
              <Button type="submit">Öneriyi Gönder</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          CREATE KAIZEN DIALOG
      ========================================== */}
      <Dialog open={isCreateKaizenOpen} onOpenChange={setIsCreateKaizenOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5 text-blue-500" />
              Yeni Kaizen Projesi
            </DialogTitle>
            <DialogDescription>
              PDCA döngüsü ile sürekli iyileştirme projesi başlatın
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleKaizenSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Proje Başlığı *</Label>
                <Input
                  value={kaizenForm.title}
                  onChange={e => setKaizenForm({ ...kaizenForm, title: e.target.value })}
                  placeholder="Kaizen projesi başlığı"
                />
              </div>
              <div>
                <Label>Proje Tipi</Label>
                <Select
                  value={kaizenForm.projectType}
                  onValueChange={v => setKaizenForm({ ...kaizenForm, projectType: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Bireysel Kaizen</SelectItem>
                    <SelectItem value="TEAM">Takım Kaizen</SelectItem>
                    <SelectItem value="PROJECT">Proje Kaizen</SelectItem>
                    <SelectItem value="QUICK">Hızlı Kaizen (Quick Win)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Öncelik</Label>
                <Select
                  value={kaizenForm.priority}
                  onValueChange={v => setKaizenForm({ ...kaizenForm, priority: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Düşük</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">Yüksek</SelectItem>
                    <SelectItem value="CRITICAL">Kritik</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Açıklama *</Label>
                <textarea
                  className="w-full min-h-[80px] px-3 py-2 border rounded-md"
                  value={kaizenForm.description}
                  onChange={e => setKaizenForm({ ...kaizenForm, description: e.target.value })}
                  placeholder="Projenin amacı ve kapsamı"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Problem Nedir? (Ne?)</Label>
                <textarea
                  className="w-full min-h-[60px] px-3 py-2 border rounded-md"
                  value={kaizenForm.problemWhat}
                  onChange={e => setKaizenForm({ ...kaizenForm, problemWhat: e.target.value })}
                  placeholder="Hangi problemi çözmeye çalışıyorsunuz?"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Neden Önemli? (Neden?)</Label>
                <textarea
                  className="w-full min-h-[60px] px-3 py-2 border rounded-md"
                  value={kaizenForm.problemWhy}
                  onChange={e => setKaizenForm({ ...kaizenForm, problemWhy: e.target.value })}
                  placeholder="Bu problem neden çözülmeli?"
                />
              </div>
              <div>
                <Label>Mevcut Durum</Label>
                <textarea
                  className="w-full min-h-[60px] px-3 py-2 border rounded-md"
                  value={kaizenForm.currentState}
                  onChange={e => setKaizenForm({ ...kaizenForm, currentState: e.target.value })}
                  placeholder="Şu anki durum"
                />
              </div>
              <div>
                <Label>Hedef Durum</Label>
                <textarea
                  className="w-full min-h-[60px] px-3 py-2 border rounded-md"
                  value={kaizenForm.targetState}
                  onChange={e => setKaizenForm({ ...kaizenForm, targetState: e.target.value })}
                  placeholder="Ulaşmak istediğiniz durum"
                />
              </div>
              <FileUploadSection />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsCreateKaizenOpen(false)}>
                İptal
              </Button>
              <Button type="submit">Projeyi Başlat</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          CREATE NEAR MISS DIALOG
      ========================================== */}
      <Dialog open={isCreateNearMissOpen} onOpenChange={setIsCreateNearMissOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Ramak Kala Olay Bildirimi
            </DialogTitle>
            <DialogDescription>
              Kaza olmadan önce tespit ettiğiniz tehlikeli durumu bildirin
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleNearMissSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Olay Başlığı *</Label>
                <Input
                  value={nearMissForm.title}
                  onChange={e => setNearMissForm({ ...nearMissForm, title: e.target.value })}
                  placeholder="Kısa bir başlık"
                />
              </div>
              <div>
                <Label>Olay Tarihi</Label>
                <Input
                  type="date"
                  value={nearMissForm.eventDate}
                  onChange={e => setNearMissForm({ ...nearMissForm, eventDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Konum *</Label>
                <Input
                  value={nearMissForm.eventLocation}
                  onChange={e => setNearMissForm({ ...nearMissForm, eventLocation: e.target.value })}
                  placeholder="Olayın gerçekleştiği yer"
                />
              </div>
              <div>
                <Label>Olay Tipi</Label>
                <Select
                  value={nearMissForm.eventType}
                  onValueChange={v => setNearMissForm({ ...nearMissForm, eventType: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(nearMissTypeConfig).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Potansiyel Ciddiyet</Label>
                <Select
                  value={nearMissForm.potentialSeverity}
                  onValueChange={v => setNearMissForm({ ...nearMissForm, potentialSeverity: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MINOR">Hafif</SelectItem>
                    <SelectItem value="MODERATE">Orta</SelectItem>
                    <SelectItem value="MAJOR">Ciddi</SelectItem>
                    <SelectItem value="CRITICAL">Kritik</SelectItem>
                    <SelectItem value="FATAL">Ölümcül</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Olay Açıklaması *</Label>
                <textarea
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                  value={nearMissForm.description}
                  onChange={e => setNearMissForm({ ...nearMissForm, description: e.target.value })}
                  placeholder="Olayı detaylı olarak anlatın"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Ne Oldu?</Label>
                <textarea
                  className="w-full min-h-[60px] px-3 py-2 border rounded-md"
                  value={nearMissForm.whatHappened}
                  onChange={e => setNearMissForm({ ...nearMissForm, whatHappened: e.target.value })}
                  placeholder="Olay nasıl gerçekleşti veya gerçekleşecekti?"
                />
              </div>
              <FileUploadSection />
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="nearMissAnonymous"
                  checked={nearMissForm.isAnonymous}
                  onChange={e => setNearMissForm({ ...nearMissForm, isAnonymous: e.target.checked })}
                />
                <Label htmlFor="nearMissAnonymous" className="cursor-pointer">
                  Anonim olarak bildir
                </Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsCreateNearMissOpen(false)}>
                İptal
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                Bildirimi Gönder
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          CREATE 5S AREA DIALOG
      ========================================== */}
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
                <textarea
                  className="w-full min-h-[60px] px-3 py-2 border rounded-md"
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
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsCreateFiveSAreaOpen(false)}>
                İptal
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                Alanı Oluştur
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          CREATE 5S AUDIT DIALOG - CHECKLIST BASED
      ========================================== */}
      <Dialog open={isCreateFiveSAuditOpen} onOpenChange={(open) => {
        setIsCreateFiveSAuditOpen(open)
        if (!open) {
          setChecklistScores({})
          setChecklistNotes({})
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={printFiveSAuditForm}
              >
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
                <Select
                  value={fiveSAuditForm.areaId}
                  onValueChange={v => setFiveSAuditForm({ ...fiveSAuditForm, areaId: v })}
                >
                  <SelectTrigger className="print:border-b print:border-t-0 print:border-x-0 print:rounded-none">
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
                  className="print:border-b print:border-t-0 print:border-x-0 print:rounded-none"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Denetçi</Label>
                <Input
                  value={session?.user?.name || ''}
                  disabled
                  className="bg-white print:border-b print:border-t-0 print:border-x-0 print:rounded-none"
                />
              </div>
            </div>

            {/* Puanlama Özeti */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg print:bg-white print:border">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">1S Seiri</p>
                <p className={cn("text-xl font-bold", fiveSAuditForm.seiriScore >= 80 ? "text-green-600" : fiveSAuditForm.seiriScore >= 60 ? "text-yellow-600" : "text-red-600")}>
                  {fiveSAuditForm.seiriScore}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">2S Seiton</p>
                <p className={cn("text-xl font-bold", fiveSAuditForm.seitonScore >= 80 ? "text-green-600" : fiveSAuditForm.seitonScore >= 60 ? "text-yellow-600" : "text-red-600")}>
                  {fiveSAuditForm.seitonScore}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">3S Seiso</p>
                <p className={cn("text-xl font-bold", fiveSAuditForm.seisoScore >= 80 ? "text-green-600" : fiveSAuditForm.seisoScore >= 60 ? "text-yellow-600" : "text-red-600")}>
                  {fiveSAuditForm.seisoScore}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">4S Seiketsu</p>
                <p className={cn("text-xl font-bold", fiveSAuditForm.seiketsuScore >= 80 ? "text-green-600" : fiveSAuditForm.seiketsuScore >= 60 ? "text-yellow-600" : "text-red-600")}>
                  {fiveSAuditForm.seiketsuScore}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">5S Shitsuke</p>
                <p className={cn("text-xl font-bold", fiveSAuditForm.shitsukeScore >= 80 ? "text-green-600" : fiveSAuditForm.shitsukeScore >= 60 ? "text-yellow-600" : "text-red-600")}>
                  {fiveSAuditForm.shitsukeScore}
                </p>
              </div>
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

            {/* Checklist */}
            <div className="space-y-4">
              {/* 1S - Seiri */}
              <div className="border rounded-lg overflow-hidden print:break-inside-avoid">
                <div className="bg-red-50 dark:bg-red-950/30 p-3 border-b flex items-center gap-3 print:bg-red-100">
                  <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm">1S</div>
                  <div>
                    <h4 className="font-semibold text-red-800 dark:text-red-200">Seiri - Ayıkla</h4>
                    <p className="text-xs text-red-600 dark:text-red-300">Gereksiz olanı ayır ve uzaklaştır</p>
                  </div>
                  <div className="ml-auto">
                    <span className={cn("text-xl font-bold", fiveSAuditForm.seiriScore >= 80 ? "text-green-600" : fiveSAuditForm.seiriScore >= 60 ? "text-yellow-600" : "text-red-600")}>
                      {fiveSAuditForm.seiriScore}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {fiveSChecklistItems.seiri.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded print:p-1">
                      <span className="flex-1 text-sm">{item.text}</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map(score => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setChecklistScores(prev => ({ ...prev, [item.id]: score as 0|1|2|3|4 }))}
                            className={cn(
                              "w-8 h-8 rounded text-xs font-medium border transition-colors print:w-6 print:h-6",
                              checklistScores[item.id] === score
                                ? score === 0 ? "bg-gray-500 text-white border-gray-500"
                                : score === 1 ? "bg-red-500 text-white border-red-500"
                                : score === 2 ? "bg-yellow-500 text-white border-yellow-500"
                                : score === 3 ? "bg-blue-500 text-white border-blue-500"
                                : "bg-green-500 text-white border-green-500"
                                : "bg-white hover:bg-muted border-gray-300"
                            )}
                          >
                            {score === 0 ? 'N/A' : score}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* 1S Uygunsuzluk Alanı */}
                  <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                    <label className="block text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                      Tespit Edilen Uygunsuzluklar
                    </label>
                    <textarea
                      className="w-full min-h-[60px] p-2 text-sm border border-red-200 dark:border-red-800 rounded-md bg-red-50/50 dark:bg-red-950/20 focus:ring-1 focus:ring-red-500 focus:border-red-500 resize-y"
                      placeholder="Bu alanda tespit edilen uygunsuzlukları yazın..."
                      value={fiveSAuditForm.seiriFindings}
                      onChange={e => setFiveSAuditForm({ ...fiveSAuditForm, seiriFindings: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 2S - Seiton */}
              <div className="border rounded-lg overflow-hidden print:break-inside-avoid">
                <div className="bg-orange-50 dark:bg-orange-950/30 p-3 border-b flex items-center gap-3 print:bg-orange-100">
                  <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">2S</div>
                  <div>
                    <h4 className="font-semibold text-orange-800 dark:text-orange-200">Seiton - Düzenle</h4>
                    <p className="text-xs text-orange-600 dark:text-orange-300">Her şeyin bir yeri, her şey yerinde</p>
                  </div>
                  <div className="ml-auto">
                    <span className={cn("text-xl font-bold", fiveSAuditForm.seitonScore >= 80 ? "text-green-600" : fiveSAuditForm.seitonScore >= 60 ? "text-yellow-600" : "text-red-600")}>
                      {fiveSAuditForm.seitonScore}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {fiveSChecklistItems.seiton.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded print:p-1">
                      <span className="flex-1 text-sm">{item.text}</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map(score => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setChecklistScores(prev => ({ ...prev, [item.id]: score as 0|1|2|3|4 }))}
                            className={cn(
                              "w-8 h-8 rounded text-xs font-medium border transition-colors print:w-6 print:h-6",
                              checklistScores[item.id] === score
                                ? score === 0 ? "bg-gray-500 text-white border-gray-500"
                                : score === 1 ? "bg-red-500 text-white border-red-500"
                                : score === 2 ? "bg-yellow-500 text-white border-yellow-500"
                                : score === 3 ? "bg-blue-500 text-white border-blue-500"
                                : "bg-green-500 text-white border-green-500"
                                : "bg-white hover:bg-muted border-gray-300"
                            )}
                          >
                            {score === 0 ? 'N/A' : score}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* 2S Uygunsuzluk Alanı */}
                  <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800">
                    <label className="block text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">
                      Tespit Edilen Uygunsuzluklar
                    </label>
                    <textarea
                      className="w-full min-h-[60px] p-2 text-sm border border-orange-200 dark:border-orange-800 rounded-md bg-orange-50/50 dark:bg-orange-950/20 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 resize-y"
                      placeholder="Bu alanda tespit edilen uygunsuzlukları yazın..."
                      value={fiveSAuditForm.seitonFindings}
                      onChange={e => setFiveSAuditForm({ ...fiveSAuditForm, seitonFindings: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 3S - Seiso */}
              <div className="border rounded-lg overflow-hidden print:break-inside-avoid">
                <div className="bg-yellow-50 dark:bg-yellow-950/30 p-3 border-b flex items-center gap-3 print:bg-yellow-100">
                  <div className="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center font-bold text-sm">3S</div>
                  <div>
                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Seiso - Temizle</h4>
                    <p className="text-xs text-yellow-600 dark:text-yellow-300">Temizlik aynı zamanda denetimdir</p>
                  </div>
                  <div className="ml-auto">
                    <span className={cn("text-xl font-bold", fiveSAuditForm.seisoScore >= 80 ? "text-green-600" : fiveSAuditForm.seisoScore >= 60 ? "text-yellow-600" : "text-red-600")}>
                      {fiveSAuditForm.seisoScore}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {fiveSChecklistItems.seiso.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded print:p-1">
                      <span className="flex-1 text-sm">{item.text}</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map(score => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setChecklistScores(prev => ({ ...prev, [item.id]: score as 0|1|2|3|4 }))}
                            className={cn(
                              "w-8 h-8 rounded text-xs font-medium border transition-colors print:w-6 print:h-6",
                              checklistScores[item.id] === score
                                ? score === 0 ? "bg-gray-500 text-white border-gray-500"
                                : score === 1 ? "bg-red-500 text-white border-red-500"
                                : score === 2 ? "bg-yellow-500 text-white border-yellow-500"
                                : score === 3 ? "bg-blue-500 text-white border-blue-500"
                                : "bg-green-500 text-white border-green-500"
                                : "bg-white hover:bg-muted border-gray-300"
                            )}
                          >
                            {score === 0 ? 'N/A' : score}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* 3S Uygunsuzluk Alanı */}
                  <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800">
                    <label className="block text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">
                      Tespit Edilen Uygunsuzluklar
                    </label>
                    <textarea
                      className="w-full min-h-[60px] p-2 text-sm border border-yellow-200 dark:border-yellow-800 rounded-md bg-yellow-50/50 dark:bg-yellow-950/20 focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 resize-y"
                      placeholder="Bu alanda tespit edilen uygunsuzlukları yazın..."
                      value={fiveSAuditForm.seisoFindings}
                      onChange={e => setFiveSAuditForm({ ...fiveSAuditForm, seisoFindings: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 4S - Seiketsu */}
              <div className="border rounded-lg overflow-hidden print:break-inside-avoid">
                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 border-b flex items-center gap-3 print:bg-blue-100">
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">4S</div>
                  <div>
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200">Seiketsu - Standartlaştır</h4>
                    <p className="text-xs text-blue-600 dark:text-blue-300">İlk 3S&apos;i koruyacak standartlar</p>
                  </div>
                  <div className="ml-auto">
                    <span className={cn("text-xl font-bold", fiveSAuditForm.seiketsuScore >= 80 ? "text-green-600" : fiveSAuditForm.seiketsuScore >= 60 ? "text-yellow-600" : "text-red-600")}>
                      {fiveSAuditForm.seiketsuScore}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {fiveSChecklistItems.seiketsu.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded print:p-1">
                      <span className="flex-1 text-sm">{item.text}</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map(score => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setChecklistScores(prev => ({ ...prev, [item.id]: score as 0|1|2|3|4 }))}
                            className={cn(
                              "w-8 h-8 rounded text-xs font-medium border transition-colors print:w-6 print:h-6",
                              checklistScores[item.id] === score
                                ? score === 0 ? "bg-gray-500 text-white border-gray-500"
                                : score === 1 ? "bg-red-500 text-white border-red-500"
                                : score === 2 ? "bg-yellow-500 text-white border-yellow-500"
                                : score === 3 ? "bg-blue-500 text-white border-blue-500"
                                : "bg-green-500 text-white border-green-500"
                                : "bg-white hover:bg-muted border-gray-300"
                            )}
                          >
                            {score === 0 ? 'N/A' : score}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* 4S Uygunsuzluk Alanı */}
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                    <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                      Tespit Edilen Uygunsuzluklar
                    </label>
                    <textarea
                      className="w-full min-h-[60px] p-2 text-sm border border-blue-200 dark:border-blue-800 rounded-md bg-blue-50/50 dark:bg-blue-950/20 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y"
                      placeholder="Bu alanda tespit edilen uygunsuzlukları yazın..."
                      value={fiveSAuditForm.seiketsuFindings}
                      onChange={e => setFiveSAuditForm({ ...fiveSAuditForm, seiketsuFindings: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 5S - Shitsuke */}
              <div className="border rounded-lg overflow-hidden print:break-inside-avoid">
                <div className="bg-purple-50 dark:bg-purple-950/30 p-3 border-b flex items-center gap-3 print:bg-purple-100">
                  <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm">5S</div>
                  <div>
                    <h4 className="font-semibold text-purple-800 dark:text-purple-200">Shitsuke - Sürdür</h4>
                    <p className="text-xs text-purple-600 dark:text-purple-300">Alışkanlık haline getir ve sürekli iyileştir</p>
                  </div>
                  <div className="ml-auto">
                    <span className={cn("text-xl font-bold", fiveSAuditForm.shitsukeScore >= 80 ? "text-green-600" : fiveSAuditForm.shitsukeScore >= 60 ? "text-yellow-600" : "text-red-600")}>
                      {fiveSAuditForm.shitsukeScore}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {fiveSChecklistItems.shitsuke.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded print:p-1">
                      <span className="flex-1 text-sm">{item.text}</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map(score => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setChecklistScores(prev => ({ ...prev, [item.id]: score as 0|1|2|3|4 }))}
                            className={cn(
                              "w-8 h-8 rounded text-xs font-medium border transition-colors print:w-6 print:h-6",
                              checklistScores[item.id] === score
                                ? score === 0 ? "bg-gray-500 text-white border-gray-500"
                                : score === 1 ? "bg-red-500 text-white border-red-500"
                                : score === 2 ? "bg-yellow-500 text-white border-yellow-500"
                                : score === 3 ? "bg-blue-500 text-white border-blue-500"
                                : "bg-green-500 text-white border-green-500"
                                : "bg-white hover:bg-muted border-gray-300"
                            )}
                          >
                            {score === 0 ? 'N/A' : score}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* 5S Uygunsuzluk Alanı */}
                  <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800">
                    <label className="block text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                      Tespit Edilen Uygunsuzluklar
                    </label>
                    <textarea
                      className="w-full min-h-[60px] p-2 text-sm border border-purple-200 dark:border-purple-800 rounded-md bg-purple-50/50 dark:bg-purple-950/20 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-y"
                      placeholder="Bu alanda tespit edilen uygunsuzlukları yazın..."
                      value={fiveSAuditForm.shitsukeFindings}
                      onChange={e => setFiveSAuditForm({ ...fiveSAuditForm, shitsukeFindings: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notlar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:break-inside-avoid">
              <div>
                <Label>Güçlü Yönler</Label>
                <textarea
                  className="w-full min-h-[80px] px-3 py-2 border rounded-md print:min-h-[60px]"
                  value={fiveSAuditForm.strengths}
                  onChange={e => setFiveSAuditForm({ ...fiveSAuditForm, strengths: e.target.value })}
                  placeholder="Alanın güçlü yönleri..."
                />
              </div>
              <div>
                <Label>İyileştirme Alanları</Label>
                <textarea
                  className="w-full min-h-[80px] px-3 py-2 border rounded-md print:min-h-[60px]"
                  value={fiveSAuditForm.improvements}
                  onChange={e => setFiveSAuditForm({ ...fiveSAuditForm, improvements: e.target.value })}
                  placeholder="Geliştirilmesi gereken alanlar..."
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Genel Notlar</Label>
                <textarea
                  className="w-full min-h-[60px] px-3 py-2 border rounded-md"
                  value={fiveSAuditForm.notes}
                  onChange={e => setFiveSAuditForm({ ...fiveSAuditForm, notes: e.target.value })}
                  placeholder="Ek notlar..."
                />
              </div>
              {/* Dosya Yükleme */}
              <FiveSFileUploadSection />
            </div>

            {/* Puanlama Açıklaması */}
            <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg print:bg-gray-100">
              <p className="font-medium mb-1">Puanlama Kriterleri:</p>
              <div className="flex gap-4 flex-wrap">
                <span><strong>N/A</strong> = Uygulanamaz</span>
                <span><strong>1</strong> = Yetersiz (0-25%)</span>
                <span><strong>2</strong> = Geliştirilmeli (26-50%)</span>
                <span><strong>3</strong> = İyi (51-75%)</span>
                <span><strong>4</strong> = Mükemmel (76-100%)</span>
              </div>
            </div>

            {/* İmza Alanı - Sadece yazdırma için */}
            <div className="hidden print:grid grid-cols-2 gap-8 pt-8 border-t">
              <div>
                <p className="text-sm mb-8">Denetçi İmza:</p>
                <div className="border-b border-black"></div>
                <p className="text-xs mt-1">{session?.user?.name}</p>
              </div>
              <div>
                <p className="text-sm mb-8">Alan Sorumlusu İmza:</p>
                <div className="border-b border-black"></div>
                <p className="text-xs mt-1">Ad Soyad</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t print:hidden">
              <Button type="button" variant="outline" onClick={() => setIsCreateFiveSAuditOpen(false)}>
                İptal
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                Denetimi Kaydet
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          5S AREA DETAIL DIALOG
      ========================================== */}
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
              {/* Alan Bilgileri */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Departman</p>
                  <p className="font-medium">{selectedFiveSArea.department || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Konum</p>
                  <p className="font-medium">{selectedFiveSArea.location || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sorumlu</p>
                  <p className="font-medium">{selectedFiveSArea.responsibleName || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Toplam Denetim</p>
                  <p className="font-medium">{selectedFiveSArea._count?.audits || 0}</p>
                </div>
              </div>

              {/* Yeni Denetim Butonu */}
              <div className="flex justify-end">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    setFiveSAuditForm({ ...fiveSAuditForm, areaId: selectedFiveSArea.id })
                    setIsAreaDetailOpen(false)
                    setIsCreateFiveSAuditOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Bu Alan İçin Denetim Başlat
                </Button>
              </div>

              {/* Denetim Geçmişi */}
              <div>
                <h4 className="font-semibold mb-3">Denetim Geçmişi</h4>
                {areaAudits.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Bu alan için henüz denetim yapılmamış</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {areaAudits.map(audit => (
                      <div key={audit.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="text-sm font-mono text-muted-foreground">{audit.auditNumber}</span>
                            <p className="text-sm">Denetçi: {audit.auditorName} • {formatDate(audit.auditDate)}</p>
                          </div>
                          <div className={cn(
                            "text-2xl font-bold",
                            audit.totalScore >= 80 ? "text-green-600" : audit.totalScore >= 60 ? "text-yellow-600" : "text-red-600"
                          )}>
                            {audit.totalScore}
                          </div>
                        </div>
                        {/* 5S Puanları Detay */}
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs">
                          <div className="p-2 bg-muted rounded">
                            <p className="text-muted-foreground">Seiri</p>
                            <p className={cn("font-bold", (audit.seiriScore ?? 0) >= 80 ? "text-green-600" : (audit.seiriScore ?? 0) >= 60 ? "text-yellow-600" : "text-red-600")}>
                              {audit.seiriScore ?? '-'}
                            </p>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <p className="text-muted-foreground">Seiton</p>
                            <p className={cn("font-bold", (audit.seitonScore ?? 0) >= 80 ? "text-green-600" : (audit.seitonScore ?? 0) >= 60 ? "text-yellow-600" : "text-red-600")}>
                              {audit.seitonScore ?? '-'}
                            </p>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <p className="text-muted-foreground">Seiso</p>
                            <p className={cn("font-bold", (audit.seisoScore ?? 0) >= 80 ? "text-green-600" : (audit.seisoScore ?? 0) >= 60 ? "text-yellow-600" : "text-red-600")}>
                              {audit.seisoScore ?? '-'}
                            </p>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <p className="text-muted-foreground">Seiketsu</p>
                            <p className={cn("font-bold", (audit.seiketsuScore ?? 0) >= 80 ? "text-green-600" : (audit.seiketsuScore ?? 0) >= 60 ? "text-yellow-600" : "text-red-600")}>
                              {audit.seiketsuScore ?? '-'}
                            </p>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <p className="text-muted-foreground">Shitsuke</p>
                            <p className={cn("font-bold", (audit.shitsukeScore ?? 0) >= 80 ? "text-green-600" : (audit.shitsukeScore ?? 0) >= 60 ? "text-yellow-600" : "text-red-600")}>
                              {audit.shitsukeScore ?? '-'}
                            </p>
                          </div>
                        </div>
                        {/* Notlar */}
                        {(audit.strengths || audit.improvements || audit.notes) && (
                          <div className="mt-3 pt-3 border-t text-sm space-y-2">
                            {audit.strengths && (
                              <div>
                                <span className="text-muted-foreground">Güçlü Yönler: </span>
                                <span>{audit.strengths}</span>
                              </div>
                            )}
                            {audit.improvements && (
                              <div>
                                <span className="text-muted-foreground">İyileştirme: </span>
                                <span>{audit.improvements}</span>
                              </div>
                            )}
                            {audit.notes && (
                              <div>
                                <span className="text-muted-foreground">Not: </span>
                                <span>{audit.notes}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAreaDetailOpen(false)}>
              Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          5S GUIDE DIALOG
      ========================================== */}
      <Dialog open={isFiveSGuideOpen} onOpenChange={setIsFiveSGuideOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-6 w-6 text-emerald-500" />
              5S Denetimi Nasıl Yapılır?
            </DialogTitle>
            <DialogDescription>
              5S metodolojisi ve denetim sürecine ilişkin kapsamlı kılavuz
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* 5S Nedir? */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <h3 className="font-semibold text-lg text-emerald-800 dark:text-emerald-200 mb-2">5S Nedir?</h3>
              <p className="text-sm text-muted-foreground">
                5S, Japonya&apos;da geliştirilen ve iş yerinde düzen, temizlik ve verimliliği artırmayı hedefleyen bir yönetim metodolojisidir.
                Beş Japonca kelimeden oluşur: <strong>Seiri, Seiton, Seiso, Seiketsu</strong> ve <strong>Shitsuke</strong>.
                Bu yöntem sayesinde iş güvenliği artar, verimlilik yükselir ve israf azalır.
              </p>
            </div>

            {/* 5S Adımları */}
            <div className="space-y-4">
              {/* 1S - Seiri */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-red-50 dark:bg-red-950/30 p-4 border-b border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-lg">1S</div>
                    <div>
                      <h4 className="font-semibold text-red-800 dark:text-red-200">Seiri (整理) - Ayıkla</h4>
                      <p className="text-sm text-red-600 dark:text-red-300">Gereksiz olanı ayır ve uzaklaştır</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Ne Yapılmalı?</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Çalışma alanındaki tüm malzemeleri gözden geçirin</li>
                      <li>Gerekli ve gereksiz olanları ayırın</li>
                      <li>Kullanılmayan, bozuk veya fazla malzemeleri belirleyin</li>
                      <li>Gereksiz olanları &quot;Kırmızı Etiket&quot; ile işaretleyin</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Denetimde Kontrol Edilecekler:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Kullanılmayan malzeme var mı?</li>
                      <li>Bozuk veya arızalı ekipman var mı?</li>
                      <li>Gereksiz stok birikimi var mı?</li>
                      <li>Kişisel eşyalar uygun yerde mi?</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 2S - Seiton */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-orange-50 dark:bg-orange-950/30 p-4 border-b border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg">2S</div>
                    <div>
                      <h4 className="font-semibold text-orange-800 dark:text-orange-200">Seiton (整頓) - Düzenle</h4>
                      <p className="text-sm text-orange-600 dark:text-orange-300">Her şeyin bir yeri, her şey yerinde</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Ne Yapılmalı?</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Her malzeme için sabit bir yer belirleyin</li>
                      <li>Sık kullanılanları kolay erişilebilir yere koyun</li>
                      <li>Etiketleme ve görsel işaretleme yapın</li>
                      <li>Ergonomik düzenleme yapın</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Denetimde Kontrol Edilecekler:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Malzemeler belirlenen yerlerde mi?</li>
                      <li>Etiketleme ve işaretlemeler mevcut mu?</li>
                      <li>Kolay erişim sağlanmış mı?</li>
                      <li>Görsel yönetim uygulanıyor mu?</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 3S - Seiso */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-yellow-50 dark:bg-yellow-950/30 p-4 border-b border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-500 text-white flex items-center justify-center font-bold text-lg">3S</div>
                    <div>
                      <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Seiso (清掃) - Temizle</h4>
                      <p className="text-sm text-yellow-600 dark:text-yellow-300">Temizlik aynı zamanda denetimdir</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Ne Yapılmalı?</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Çalışma alanını düzenli temizleyin</li>
                      <li>Temizlik sırasında anormallikleri tespit edin</li>
                      <li>Kirlilik kaynaklarını belirleyin ve önleyin</li>
                      <li>Temizlik sorumluluklarını dağıtın</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Denetimde Kontrol Edilecekler:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Zemin, masa ve ekipmanlar temiz mi?</li>
                      <li>Toz, yağ veya kir birikimi var mı?</li>
                      <li>Temizlik malzemeleri mevcut mu?</li>
                      <li>Temizlik programı uygulanıyor mu?</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 4S - Seiketsu */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 border-b border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-lg">4S</div>
                    <div>
                      <h4 className="font-semibold text-blue-800 dark:text-blue-200">Seiketsu (清潔) - Standartlaştır</h4>
                      <p className="text-sm text-blue-600 dark:text-blue-300">İlk 3S&apos;i koruyacak standartlar oluştur</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Ne Yapılmalı?</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Ayıklama, düzenleme ve temizlik için standartlar belirleyin</li>
                      <li>Görsel standartlar ve talimatlar oluşturun</li>
                      <li>Kontrol listeleri hazırlayın</li>
                      <li>En iyi uygulamaları belgeleyin</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Denetimde Kontrol Edilecekler:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Yazılı standartlar mevcut mu?</li>
                      <li>Görsel talimatlar asılı mı?</li>
                      <li>Çalışanlar standartları biliyor mu?</li>
                      <li>Standartlar güncel mi?</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 5S - Shitsuke */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-purple-50 dark:bg-purple-950/30 p-4 border-b border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-lg">5S</div>
                    <div>
                      <h4 className="font-semibold text-purple-800 dark:text-purple-200">Shitsuke (躾) - Sürdür (Disiplin)</h4>
                      <p className="text-sm text-purple-600 dark:text-purple-300">Alışkanlık haline getir ve sürekli iyileştir</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Ne Yapılmalı?</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>5S&apos;i günlük işin bir parçası yapın</li>
                      <li>Düzenli eğitimler verin</li>
                      <li>Periyodik denetimler yapın</li>
                      <li>Başarıları ödüllendirin ve paylaşın</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Denetimde Kontrol Edilecekler:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>5S aktiviteleri düzenli yapılıyor mu?</li>
                      <li>Çalışanlar 5S&apos;e sahip çıkıyor mu?</li>
                      <li>İyileştirme önerileri geliyor mu?</li>
                      <li>Geçmiş denetimlere göre ilerleme var mı?</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Puanlama Kriterleri */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-500" />
                Puanlama Kriterleri
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">80-100</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Mükemmel</p>
                  <p className="text-xs text-muted-foreground">Standartlar tam uygulanıyor</p>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">60-79</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">Geliştirilmeli</p>
                  <p className="text-xs text-muted-foreground">Bazı iyileştirmeler gerekli</p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">0-59</p>
                  <p className="text-sm text-red-700 dark:text-red-300">Yetersiz</p>
                  <p className="text-xs text-muted-foreground">Acil iyileştirme gerekli</p>
                </div>
              </div>
            </div>

            {/* Denetim Adımları */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <CheckSquare className="h-5 w-5" />
                Denetim Nasıl Yapılır?
              </h3>
              <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                <li><strong>Hazırlık:</strong> Denetim alanını ve önceki denetim sonuçlarını inceleyin</li>
                <li><strong>Gözlem:</strong> Alanı fiziksel olarak dolaşın, fotoğraf çekin</li>
                <li><strong>Puanlama:</strong> Her 5S kriteri için 0-100 arası puan verin</li>
                <li><strong>Bulgular:</strong> Olumlu yönleri ve iyileştirme alanlarını not edin</li>
                <li><strong>Geri Bildirim:</strong> Sonuçları alan sorumlusuyla paylaşın</li>
                <li><strong>Takip:</strong> Aksiyonların takibini yapın</li>
              </ol>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setIsFiveSGuideOpen(false)}>
              Anladım, Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kaizen Kılavuzu Dialog */}
      <Dialog open={isKaizenGuideOpen} onOpenChange={setIsKaizenGuideOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-teal-700">
              <BookOpen className="h-6 w-6" />
              Kaizen Kılavuzu - Sürekli İyileştirme
            </DialogTitle>
            <DialogDescription>
              Kaizen metodolojisi ve PDCA döngüsü hakkında bilgi edinin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Kaizen Nedir */}
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 rounded-lg p-4">
              <h3 className="font-semibold text-teal-800 dark:text-teal-200 mb-2 flex items-center gap-2">
                <RefreshCcw className="h-5 w-5" />
                Kaizen Nedir?
              </h3>
              <p className="text-sm text-muted-foreground">
                Kaizen, Japonca &quot;kai&quot; (değişim) ve &quot;zen&quot; (iyi) kelimelerinin birleşiminden oluşur.
                <strong> &quot;Sürekli iyileştirme&quot;</strong> anlamına gelir. Küçük, sürekli ve artımlı iyileştirmelerle
                büyük sonuçlar elde etmeyi hedefler. Herkesin katılımıyla yapılan bu iyileştirmeler,
                işletmenin tüm süreçlerinde verimliliği ve kaliteyi artırır.
              </p>
            </div>

            {/* Kaizen Prensipleri */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4 bg-teal-50/50 dark:bg-teal-950/20">
                <h4 className="font-semibold text-teal-700 dark:text-teal-300 mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Temel Prensipler
                </h4>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckSquare className="h-4 w-4 text-teal-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Gemba:</strong> Sorunu yerinde gör, yerinde çöz</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckSquare className="h-4 w-4 text-teal-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Muda:</strong> İsrafı ortadan kaldır</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckSquare className="h-4 w-4 text-teal-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Standardizasyon:</strong> En iyi yöntemi belirle ve uygula</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckSquare className="h-4 w-4 text-teal-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Katılım:</strong> Herkes iyileştirmeye katkıda bulunur</span>
                  </li>
                </ul>
              </div>

              <div className="border rounded-lg p-4 bg-cyan-50/50 dark:bg-cyan-950/20">
                <h4 className="font-semibold text-cyan-700 dark:text-cyan-300 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  7 Muda (İsraf Türleri)
                </h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>1. <strong>Aşırı Üretim:</strong> Gereğinden fazla üretmek</li>
                  <li>2. <strong>Bekleme:</strong> Boş bekleyen süreçler</li>
                  <li>3. <strong>Taşıma:</strong> Gereksiz malzeme hareketi</li>
                  <li>4. <strong>İşleme:</strong> Fazla veya yanlış işlem</li>
                  <li>5. <strong>Stok:</strong> Aşırı envanter tutmak</li>
                  <li>6. <strong>Hareket:</strong> Gereksiz insan hareketi</li>
                  <li>7. <strong>Hata:</strong> Kusurlu ürün/hizmet</li>
                </ul>
              </div>
            </div>

            {/* PDCA Döngüsü */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <RefreshCcw className="h-5 w-5 text-teal-600" />
                PDCA Döngüsü (Deming Döngüsü)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Plan */}
                <div className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/30 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">P</div>
                    <h4 className="font-semibold text-blue-700 dark:text-blue-300">Plan (Planla)</h4>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Sorunu tanımla ve analiz et</li>
                    <li>• Kök nedeni belirle (5 Neden)</li>
                    <li>• Hedefleri belirle</li>
                    <li>• Çözüm alternatiflerini değerlendir</li>
                    <li>• Uygulama planı oluştur</li>
                  </ul>
                </div>

                {/* Do */}
                <div className="border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/30 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">D</div>
                    <h4 className="font-semibold text-green-700 dark:text-green-300">Do (Uygula)</h4>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Planı küçük ölçekte test et</li>
                    <li>• Pilot uygulama yap</li>
                    <li>• Verileri topla</li>
                    <li>• Değişiklikleri dokümante et</li>
                    <li>• Sorunları kaydet</li>
                  </ul>
                </div>

                {/* Check */}
                <div className="border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/30 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">C</div>
                    <h4 className="font-semibold text-amber-700 dark:text-amber-300">Check (Kontrol Et)</h4>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Sonuçları hedeflerle karşılaştır</li>
                    <li>• Başarı kriterlerini değerlendir</li>
                    <li>• Beklenmeyen sonuçları analiz et</li>
                    <li>• Öğrenilen dersleri belirle</li>
                    <li>• Veri analizi yap</li>
                  </ul>
                </div>

                {/* Act */}
                <div className="border-l-4 border-l-purple-500 bg-purple-50 dark:bg-purple-950/30 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm">A</div>
                    <h4 className="font-semibold text-purple-700 dark:text-purple-300">Act (Önlem Al)</h4>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Başarılı uygulamayı standartlaştır</li>
                    <li>• Prosedürleri güncelle</li>
                    <li>• Eğitimleri yaygınlaştır</li>
                    <li>• Diğer alanlara yay</li>
                    <li>• Yeni döngü için hazırlan</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 5 Neden Analizi */}
            <div className="border rounded-lg p-4 bg-orange-50/50 dark:bg-orange-950/20">
              <h3 className="font-semibold text-orange-700 dark:text-orange-300 mb-3 flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                5 Neden (5 Why) Analizi
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Sorunun kök nedenini bulmak için &quot;Neden?&quot; sorusunu 5 kez sorma tekniğidir.
              </p>
              <div className="bg-white dark:bg-gray-900 rounded p-3 text-sm">
                <p className="font-medium mb-2">Örnek: Makine durdu</p>
                <ol className="space-y-1 text-muted-foreground">
                  <li><strong>Neden 1:</strong> Sigorta attı → Neden?</li>
                  <li><strong>Neden 2:</strong> Motor aşırı yüklendi → Neden?</li>
                  <li><strong>Neden 3:</strong> Rulman arızalandı → Neden?</li>
                  <li><strong>Neden 4:</strong> Yağlama yapılmadı → Neden?</li>
                  <li><strong>Neden 5:</strong> Bakım planı yoktu → <span className="text-orange-600 font-semibold">KÖK NEDEN</span></li>
                </ol>
              </div>
            </div>

            {/* Kaizen Projesi Nasıl Başlatılır */}
            <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-teal-600" />
                Kaizen Projesi Nasıl Başlatılır?
              </h3>
              <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                <li><strong>Problem Tanımla:</strong> Ne, nerede, ne zaman, kim, nasıl, neden sorularını yanıtla</li>
                <li><strong>Mevcut Durumu Analiz Et:</strong> Veri topla, akışı çiz, israfları belirle</li>
                <li><strong>Hedef Belirle:</strong> SMART hedefler koy (Spesifik, Ölçülebilir, Ulaşılabilir, Relevant, Zamanlı)</li>
                <li><strong>Kök Neden Bul:</strong> 5 Neden analizi yap</li>
                <li><strong>Çözüm Geliştir:</strong> Beyin fırtınası yap, alternatifleri değerlendir</li>
                <li><strong>Uygula ve Ölç:</strong> Pilot uygulama yap, sonuçları kaydet</li>
                <li><strong>Standartlaştır:</strong> Başarılı uygulamayı dokümante et ve yaygınlaştır</li>
              </ol>
            </div>

            {/* Proje Türleri */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-teal-700 dark:text-teal-300 mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Bireysel Kaizen
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Kendi iş alanınızdaki küçük iyileştirmeler</li>
                  <li>• Hızlı uygulanabilir değişiklikler</li>
                  <li>• Günlük iş akışını kolaylaştırma</li>
                </ul>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-teal-700 dark:text-teal-300 mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Takım Kaizen
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Departmanlar arası projeler</li>
                  <li>• Daha kapsamlı iyileştirmeler</li>
                  <li>• Haftalık toplantılarla ilerleme takibi</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setIsKaizenGuideOpen(false)}>
              Anladım, Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          5S AKSIYON PLANI DIALOG
      ========================================== */}
      <Dialog open={isActionPlanOpen} onOpenChange={setIsActionPlanOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-orange-500" />
              5S Aksiyon Planı
            </DialogTitle>
            <DialogDescription>
              {selectedAuditForAction?.auditNumber} - {selectedAuditForAction?.area?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedAuditForAction && (
            <div className="space-y-6 mt-4">
              {/* Denetim Özeti */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className={cn("text-2xl font-bold", selectedAuditForAction.seiriScore! >= 80 ? "text-green-600" : selectedAuditForAction.seiriScore! >= 60 ? "text-yellow-600" : "text-red-600")}>
                    {selectedAuditForAction.seiriScore || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">1S Ayıkla</p>
                </div>
                <div className="text-center">
                  <div className={cn("text-2xl font-bold", selectedAuditForAction.seitonScore! >= 80 ? "text-green-600" : selectedAuditForAction.seitonScore! >= 60 ? "text-yellow-600" : "text-red-600")}>
                    {selectedAuditForAction.seitonScore || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">2S Düzenle</p>
                </div>
                <div className="text-center">
                  <div className={cn("text-2xl font-bold", selectedAuditForAction.seisoScore! >= 80 ? "text-green-600" : selectedAuditForAction.seisoScore! >= 60 ? "text-yellow-600" : "text-red-600")}>
                    {selectedAuditForAction.seisoScore || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">3S Temizle</p>
                </div>
                <div className="text-center">
                  <div className={cn("text-2xl font-bold", selectedAuditForAction.seiketsuScore! >= 80 ? "text-green-600" : selectedAuditForAction.seiketsuScore! >= 60 ? "text-yellow-600" : "text-red-600")}>
                    {selectedAuditForAction.seiketsuScore || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">4S Standart</p>
                </div>
                <div className="text-center">
                  <div className={cn("text-2xl font-bold", selectedAuditForAction.shitsukeScore! >= 80 ? "text-green-600" : selectedAuditForAction.shitsukeScore! >= 60 ? "text-yellow-600" : "text-red-600")}>
                    {selectedAuditForAction.shitsukeScore || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">5S Sürdür</p>
                </div>
              </div>

              {/* Uygunsuzluklar (Details'dan) */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Tespit Edilen Uygunsuzluklar
                </h4>

                {/* 1S Uygunsuzlukları */}
                {selectedAuditForAction.seiriDetails && (
                  <ActionFindingCard
                    category="SEIRI"
                    categoryName="1S - Ayıkla"
                    description={selectedAuditForAction.seiriDetails}
                    findings={selectedAuditForAction.findings?.filter(f => f.sCategory === 'SEIRI') || []}
                    onAssign={assignAction}
                    auditId={selectedAuditForAction.id}
                    color="red"
                  />
                )}

                {/* 2S Uygunsuzlukları */}
                {selectedAuditForAction.seitonDetails && (
                  <ActionFindingCard
                    category="SEITON"
                    categoryName="2S - Düzenle"
                    description={selectedAuditForAction.seitonDetails}
                    findings={selectedAuditForAction.findings?.filter(f => f.sCategory === 'SEITON') || []}
                    onAssign={assignAction}
                    auditId={selectedAuditForAction.id}
                    color="orange"
                  />
                )}

                {/* 3S Uygunsuzlukları */}
                {selectedAuditForAction.seisoDetails && (
                  <ActionFindingCard
                    category="SEISO"
                    categoryName="3S - Temizle"
                    description={selectedAuditForAction.seisoDetails}
                    findings={selectedAuditForAction.findings?.filter(f => f.sCategory === 'SEISO') || []}
                    onAssign={assignAction}
                    auditId={selectedAuditForAction.id}
                    color="yellow"
                  />
                )}

                {/* 4S Uygunsuzlukları */}
                {selectedAuditForAction.seiketsuDetails && (
                  <ActionFindingCard
                    category="SEIKETSU"
                    categoryName="4S - Standartlaştır"
                    description={selectedAuditForAction.seiketsuDetails}
                    findings={selectedAuditForAction.findings?.filter(f => f.sCategory === 'SEIKETSU') || []}
                    onAssign={assignAction}
                    auditId={selectedAuditForAction.id}
                    color="blue"
                  />
                )}

                {/* 5S Uygunsuzlukları */}
                {selectedAuditForAction.shitsukeDetails && (
                  <ActionFindingCard
                    category="SHITSUKE"
                    categoryName="5S - Sürdür"
                    description={selectedAuditForAction.shitsukeDetails}
                    findings={selectedAuditForAction.findings?.filter(f => f.sCategory === 'SHITSUKE') || []}
                    onAssign={assignAction}
                    auditId={selectedAuditForAction.id}
                    color="purple"
                  />
                )}

                {/* Hiç uygunsuzluk yoksa */}
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

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsActionPlanOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 5S Aksiyon Bulgu Kartı Bileşeni
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
    assignedTo: '',
    assignedToName: '',
    dueDate: '',
    correctiveAction: ''
  })
  const [findingId, setFindingId] = useState<string | null>(null)

  const colorClasses: Record<string, { bg: string, border: string, text: string }> = {
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' }
  }

  const colors = colorClasses[color] || colorClasses.red

  // Mevcut bulguyu bul
  const existingFinding = findings[0]

  const handleCreateAndAssign = async () => {
    if (!assignForm.assignedTo || !assignForm.dueDate) {
      toast.error('Sorumlu ve tarih zorunludur')
      return
    }

    // Önce bulgu oluştur (yoksa)
    if (!existingFinding) {
      try {
        const res = await fetch(`/api/suggestions/five-s/${auditId}/action-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            findings: [{
              sCategory: category,
              description: description,
              findingType: 'NON_CONFORMITY',
              priority: 'NORMAL'
            }]
          })
        })
        if (res.ok) {
          const data = await res.json()
          // Yeni oluşturulan bulguya aksiyon ata
          if (data.findings && data.findings[0]) {
            onAssign(data.findings[0].id, assignForm.assignedTo, assignForm.assignedToName, assignForm.dueDate, assignForm.correctiveAction)
          }
        }
      } catch {
        toast.error('Bulgu oluşturulamadı')
      }
    } else {
      // Mevcut bulguya aksiyon ata
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

            {/* Mevcut aksiyon bilgisi */}
            {existingFinding?.assignedTo && (
              <div className="mt-3 p-2 bg-white/50 rounded border">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {existingFinding.assignedToName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {existingFinding.dueDate ? new Date(existingFinding.dueDate).toLocaleDateString('tr-TR') : '-'}
                  </span>
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

          {/* Aksiyon Atama Butonu */}
          {!existingFinding?.assignedTo && !isAssigning && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAssigning(true)}
              className="shrink-0"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Aksiyon Ata
            </Button>
          )}
        </div>

        {/* Aksiyon Atama Formu */}
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
                <Input
                  type="date"
                  value={assignForm.dueDate}
                  onChange={e => setAssignForm({ ...assignForm, dueDate: e.target.value })}
                />
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
              <Button size="sm" variant="ghost" onClick={() => setIsAssigning(false)}>
                İptal
              </Button>
              <Button size="sm" onClick={handleCreateAndAssign}>
                Kaydet ve Görev Oluştur
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Suspense ile sarmalanmış ana export
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
