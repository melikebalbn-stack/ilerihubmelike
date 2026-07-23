// ==========================================
// Settings Module Types
// ==========================================

export interface Location {
  id: string
  name: string
  code: string | null
  isActive: boolean
  sortOrder: number
}

export interface DeviceType {
  id: string
  name: string
  code: string | null
  isActive: boolean
  sortOrder: number
}

export interface DeviceModel {
  id: string
  name: string
  manufacturer: string | null
  code: string | null
  isActive: boolean
  sortOrder: number
}

export interface DeviceName {
  id: string
  name: string
  code: string | null
  isActive: boolean
  sortOrder: number
}

export interface CalibrationDepartment {
  id: string
  name: string
  code: string | null
  isActive: boolean
  sortOrder: number
}

export interface ProductionSection {
  id: string
  name: string
  code: string | null
  departmentId: string | null
  department: { id: string; name: string } | null
  isActive: boolean
  sortOrder: number
}

export interface NotificationEmail {
  id: string
  email: string
  name: string | null
  category: 'EXPIRING' | 'EXPIRED'
  isActive: boolean
}

export interface NotificationRule {
  id: string
  type: 'EXPIRING' | 'EXPIRED'
  period: 'BEFORE' | 'AFTER'
  days: number
  repeatWeekly: boolean
  isActive: boolean
}

export interface TaskCategory {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  isActive: boolean
  sortOrder: number
  _count?: { tasks: number }
}

export interface SuggestionBoardMember {
  id: string
  email: string
  name: string
  department: string | null
  role: string | null
  isActive: boolean
}

export interface AnnouncementCategory {
  id: string
  name: string
  color: string | null
  icon: string | null
  isActive: boolean
  sortOrder: number
  _count?: { announcements: number }
}

export interface TicketCategory {
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

export interface Survey {
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

export interface SystemNotice {
  enabled: boolean
  title: string
  message: string
}

export type EditingType =
  | 'location'
  | 'device-type'
  | 'device-model'
  | 'device-name'
  | 'department'
  | 'production-section'
  | 'task-category'
  | 'announcement-category'
  | 'ticket-category'
  | null

export interface SettingsFormData {
  name: string
  code: string
  manufacturer: string
  description: string
  color: string
  departmentId: string
}

export interface EmailTestData {
  email: string
  name: string
  sending: boolean
}
