import {
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Lightbulb,
  RefreshCcw,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react"
import type { ChecklistItem } from "@/types/suggestions"

// ==========================================
// Status Configurations
// ==========================================

export const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
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

export const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Düşük', color: 'bg-gray-100 text-gray-600' },
  NORMAL: { label: 'Normal', color: 'bg-blue-100 text-blue-600' },
  HIGH: { label: 'Yüksek', color: 'bg-orange-100 text-orange-600' },
  CRITICAL: { label: 'Kritik', color: 'bg-red-100 text-red-600' },
}

export const pdcaConfig: Record<string, { label: string; color: string }> = {
  PLAN: { label: 'Planla', color: 'bg-blue-100 text-blue-800' },
  DO: { label: 'Uygula', color: 'bg-yellow-100 text-yellow-800' },
  CHECK: { label: 'Kontrol Et', color: 'bg-purple-100 text-purple-800' },
  ACT: { label: 'Önlem Al', color: 'bg-green-100 text-green-800' },
}

export const kaizenStatusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Taslak', color: 'bg-gray-100 text-gray-800' },
  PLANNING: { label: 'Planlanıyor', color: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'Devam Ediyor', color: 'bg-yellow-100 text-yellow-800' },
  CHECKING: { label: 'Kontrol', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Tamamlandı', color: 'bg-green-100 text-green-800' },
  STANDARDIZED: { label: 'Standart', color: 'bg-emerald-100 text-emerald-800' },
  CANCELLED: { label: 'İptal', color: 'bg-red-100 text-red-800' },
}

export const nearMissTypeConfig: Record<string, string> = {
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

export const severityConfig: Record<string, { label: string; color: string }> = {
  MINOR: { label: 'Hafif', color: 'bg-gray-100 text-gray-600' },
  MODERATE: { label: 'Orta', color: 'bg-yellow-100 text-yellow-600' },
  MAJOR: { label: 'Ciddi', color: 'bg-orange-100 text-orange-600' },
  CRITICAL: { label: 'Kritik', color: 'bg-red-100 text-red-600' },
  FATAL: { label: 'Ölümcül', color: 'bg-red-200 text-red-800' },
}

export const nearMissStatusConfig: Record<string, { label: string; color: string }> = {
  REPORTED: { label: 'Bildirildi', color: 'bg-blue-100 text-blue-800' },
  UNDER_INVESTIGATION: { label: 'Araştırılıyor', color: 'bg-yellow-100 text-yellow-800' },
  ACTION_REQUIRED: { label: 'Aksiyon Gerekli', color: 'bg-orange-100 text-orange-800' },
  IN_PROGRESS: { label: 'İşlemde', color: 'bg-purple-100 text-purple-800' },
  RESOLVED: { label: 'Çözüldü', color: 'bg-green-100 text-green-800' },
  CLOSED: { label: 'Kapatıldı', color: 'bg-gray-100 text-gray-800' },
}

// ==========================================
// Module Cards Configuration
// ==========================================

export const moduleCards = [
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
// 5S Checklist Items
// ==========================================

export const fiveSChecklistItems: Record<string, ChecklistItem[]> = {
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

// ==========================================
// Helper Functions
// ==========================================

export const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export const calculateScoreFromChecklist = (
  category: keyof typeof fiveSChecklistItems,
  checklistScores: Record<string, number>
): number => {
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
