/**
 * OFFB-3: Offboarding UI ortak sabitler.
 *
 * Enum→TR etiket eşlemeleri ve durum rozet metası. Hiçbir component-reference
 * (LucideIcon) içermez — server→client prop sınırından geçebilen düz veridir.
 */

export type OffboardingStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED'
export type OffboardingPersonnelType = 'ILERI_MEKANIK' | 'CONTRACTOR'
export type OffboardingSeparationType =
  | 'RESIGNATION'
  | 'TERMINATION'
  | 'RETIREMENT'
  | 'CONTRACT_END'
  | 'OTHER'

export const STATUS_LABELS: Record<OffboardingStatus, string> = {
  DRAFT: 'Taslak',
  IN_PROGRESS: 'İşlemde',
  COMPLETED: 'Tamamlandı',
}

/** Badge için Tailwind sınıfı (renkli durum rozeti). */
export const STATUS_BADGE_CLASS: Record<OffboardingStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 border-amber-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

export const PERSONNEL_TYPE_LABELS: Record<OffboardingPersonnelType, string> = {
  ILERI_MEKANIK: 'İleri Mekanik Personeli',
  CONTRACTOR: 'Yüklenici / Taşeron',
}

export const SEPARATION_TYPE_LABELS: Record<OffboardingSeparationType, string> = {
  RESIGNATION: 'İstifa',
  TERMINATION: 'Fesih',
  RETIREMENT: 'Emeklilik',
  CONTRACT_END: 'Sözleşme Bitimi',
  OTHER: 'Diğer',
}

export const PERSONNEL_TYPE_OPTIONS = Object.entries(PERSONNEL_TYPE_LABELS) as [
  OffboardingPersonnelType,
  string,
][]

export const SEPARATION_TYPE_OPTIONS = Object.entries(SEPARATION_TYPE_LABELS) as [
  OffboardingSeparationType,
  string,
][]
