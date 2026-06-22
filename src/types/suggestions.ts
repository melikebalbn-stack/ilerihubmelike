// ==========================================
// Suggestions Module Types
// ==========================================

export interface Category {
  id: string
  name: string
  color: string
  icon?: string
}

export interface Suggestion {
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

export interface KaizenProject {
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

export interface NearMiss {
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

export interface FiveSArea {
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

export interface FiveSFinding {
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

export interface FiveSAudit {
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

export interface SuggestionStats {
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

export interface UploadedFile {
  name: string
  size: number
  type: string
  file: File
}

export interface SuggestionUpdate {
  id: string
  suggestionNumber: string
  title: string
  status: string
  statusLabel: string
  statusType: 'success' | 'error' | 'warning' | 'info'
  decisionDate: string
}

// Form types
export interface SuggestionFormData {
  title: string
  description: string
  currentSituation: string
  proposedSolution: string
  expectedBenefit: string
  estimatedSavings: string
  categoryId: string
  priority: string
  suggestionType: string
  isAnonymous: boolean
}

export interface KaizenFormData {
  title: string
  description: string
  projectType: string
  problemWhat: string
  problemWhy: string
  currentState: string
  targetState: string
  proposedSolution: string
  priority: string
}

export interface NearMissFormData {
  title: string
  description: string
  eventDate: string
  eventLocation: string
  eventType: string
  potentialSeverity: string
  whatHappened: string
  isAnonymous: boolean
}

export interface FiveSAreaFormData {
  name: string
  code: string
  description: string
  department: string
  location: string
  responsibleName: string
}

export interface FiveSAuditFormData {
  areaId: string
  auditDate: string
  auditType: string
  seiriScore: number
  seitonScore: number
  seisoScore: number
  seiketsuScore: number
  shitsukeScore: number
  seiriFindings: string
  seitonFindings: string
  seisoFindings: string
  seiketsuFindings: string
  shitsukeFindings: string
  strengths: string
  improvements: string
  notes: string
}

// View mode types
export type SuggestionViewMode = 'all' | 'my' | 'pending' | 'awaiting_my_approval'
export type KaizenViewMode = 'all' | 'my'
export type NearMissViewMode = 'all' | 'my' | 'open'
export type FiveSViewMode = 'all' | 'my'

// Checklist types
export type ChecklistScore = 0 | 1 | 2 | 3 | 4

export interface ChecklistItem {
  id: string
  text: string
  weight: number
}
