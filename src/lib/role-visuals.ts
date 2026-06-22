import {
  Shield,
  ShieldCheck,
  Award,
  Server,
  GraduationCap,
  Users,
  ClipboardCheck,
  UserCog,
  User as UserIcon,
  Archive,
  BookUser,
  Calculator,
  Megaphone,
  Headphones,
  CalendarCheck,
  Ruler,
  Flame,
  Lock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface RoleVisual {
  Icon: LucideIcon
  tone: string
}

const ROLE_VISUAL: Record<string, RoleVisual> = {
  'super-admin':       { Icon: Shield,         tone: 'text-red-600 bg-red-50' },
  'admin':             { Icon: Shield,         tone: 'text-blue-600 bg-blue-50' },
  'bgys-sorumlusu':    { Icon: Award,          tone: 'text-purple-600 bg-purple-50' },
  'it-admin':          { Icon: Server,         tone: 'text-indigo-600 bg-indigo-50' },
  'akademi-admin':     { Icon: GraduationCap,  tone: 'text-emerald-600 bg-emerald-50' },
  'hr-yoneticisi':     { Icon: Users,          tone: 'text-pink-600 bg-pink-50' },
  'kalite-yoneticisi':     { Icon: ClipboardCheck, tone: 'text-amber-700 bg-amber-100' },
  'kalibrasyon-operatoru': { Icon: Ruler,          tone: 'text-orange-700 bg-orange-50' },
  'maliyet-uzmani':        { Icon: Calculator,     tone: 'text-violet-700 bg-violet-50' },
  'departman-muduru':      { Icon: UserCog,        tone: 'text-cyan-600 bg-cyan-50' },
  'kullanici':             { Icon: UserIcon,       tone: 'text-gray-600 bg-gray-100' },
}

const DEFAULT_VISUAL: RoleVisual = { Icon: Shield, tone: 'text-gray-600 bg-gray-100' }

export function getRoleVisual(slug: string): RoleVisual {
  return ROLE_VISUAL[slug] ?? DEFAULT_VISUAL
}

const MODULE_LABELS: Record<string, string> = {
  admin:          'Yönetim',
  akademi:        'Akademi',
  arsiv:          'Arşiv',
  bgys:           'BGYS',
  calisanrehberi: 'Çalışan Rehberi',
  costanalysis:   'Maliyet Analizi',
  duyuru:         'Duyurular',
  helpdesk:       'Helpdesk',
  izin:           'İzin Yönetimi',
  kalibrasyon:    'Kalibrasyon',
  yangin:         'Yangın Güvenliği',
}

export function moduleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module
}

const MODULE_ICONS: Record<string, LucideIcon> = {
  admin:          Lock,
  akademi:        GraduationCap,
  arsiv:          Archive,
  bgys:           ShieldCheck,
  calisanrehberi: BookUser,
  costanalysis:   Calculator,
  duyuru:         Megaphone,
  helpdesk:       Headphones,
  izin:           CalendarCheck,
  kalibrasyon:    Ruler,
  yangin:         Flame,
}

export function moduleIcon(module: string): LucideIcon {
  return MODULE_ICONS[module] ?? Shield
}

/** Rol slug'undan 2 karakterlik kompakt başlık (matris sütun başlığı için). */
export function roleAcronym(slug: string): string {
  const map: Record<string, string> = {
    'super-admin':           'SA',
    'admin':                 'AD',
    'bgys-sorumlusu':        'BG',
    'it-admin':              'IT',
    'akademi-admin':         'AK',
    'hr-yoneticisi':         'HR',
    'kalite-yoneticisi':     'KA',
    'kalibrasyon-operatoru': 'KO',
    'maliyet-uzmani':        'MU',
    'departman-muduru':      'DM',
    'kullanici':             'KU',
  }
  if (map[slug]) return map[slug]
  return slug.slice(0, 2).toUpperCase()
}
