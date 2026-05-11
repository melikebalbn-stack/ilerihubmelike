// PR-JOBAPP-INPUT-FOCUS: Section component'leri için ortak tipler + initial state.
// JobApplicationRenderer'dan extract — section'ların inline tanımlı NumberedCard
// helper'ı her render'da yeni reference üretiyordu (focus kaybı). Section'lar
// artık top-level, prop drilling ile bu types'ı paylaşır.

export type CourseRow = {
  institution: string
  subject: string
  duration: string
  attendanceDate: string
}
export type LanguageRow = {
  language: string
  reading: string
  writing: string
  speaking: string
  learnedAt: string
}
export type ComputerRow = { program: string; level: string; learnedAt: string }
export type WorkExpRow = {
  company: string
  position: string
  startDate: string
  endDate: string
  leavingReason: string
  lastSalary: string
}
export type ReferenceRow = { name: string; company: string; position: string; phone: string }
export type EducationEntry = {
  institution: string
  startDate: string
  endDate: string
  department: string
  gpa: string
}

export interface FormState {
  // Kimlik
  fullName: string
  birthPlace: string
  birthDate: string
  nationality: string
  tcKimlikNo: string
  gender: string
  bloodType: string

  // Askerlik
  militaryStatus: string
  militaryPostponeDate: string

  // Aile
  maritalStatus: string
  numberOfChildren: string
  spouseWorking: string
  spouseOccupation: string

  // İletişim & adres
  homeAddress: string
  dependents: string
  mobilePhone: string
  email: string
  workPhone: string
  homePhone: string

  // Kaynak
  referralSource: string
  referralSourceOther: string
  memberships: string

  // Ehliyet
  hasDriverLicense: string
  driverLicenseClass: string
  driverLicenseDate: string

  // Adli sicil
  hasCriminalRecord: string
  hasConviction: string
  convictionDetails: string
  hasOngoingCase: string

  // Fiziksel
  height: string
  weight: string
  shoeSize: string
  clothingSizeUpper: string
  clothingSizeLower: string

  // Çalışma koşulları
  hasTravelRestriction: string
  canWorkShifts: string
  hobbies: string

  // İş tercihi
  availableStartDate: string
  expectedSalary: string
  requestedPosition: string
  previouslyWorkedHere: string

  // Eğitim
  educationLevel: string
  educationHistory: Record<string, EducationEntry>
  coursesAndSeminars: CourseRow[]
  foreignLanguages: LanguageRow[]
  computerSkills: ComputerRow[]

  // İş tecrübesi
  workExperience: WorkExpRow[]

  // Akraba
  hasRelativesInCompany: string
  relativeName: string

  // İletişim tercihi
  preferredContactGsm: boolean
  preferredContactEmail: boolean
  preferredContactOther: string

  // Son işveren
  canContactLastEmployer: string
  references: ReferenceRow[]

  // Beyan + imza + foto
  declarationAccepted: boolean
  digitalSignature: string // base64 PNG dataURL
  signatureDate: string
  photo: File | null
}

export interface SectionProps {
  form: FormState
  onChange: (patch: Partial<FormState>) => void
}

const EMPTY_EDUCATION_ENTRY: EducationEntry = {
  institution: '',
  startDate: '',
  endDate: '',
  department: '',
  gpa: '',
}

import { EDUCATION_HISTORY_KEYS } from './constants'

const initialEducationHistory: Record<string, EducationEntry> = Object.fromEntries(
  EDUCATION_HISTORY_KEYS.map((k) => [k.id, { ...EMPTY_EDUCATION_ENTRY }])
)

export const initialFormState: FormState = {
  fullName: '',
  birthPlace: '',
  birthDate: '',
  nationality: '',
  tcKimlikNo: '',
  gender: '',
  bloodType: '',
  militaryStatus: '',
  militaryPostponeDate: '',
  maritalStatus: '',
  numberOfChildren: '',
  spouseWorking: '',
  spouseOccupation: '',
  homeAddress: '',
  dependents: '',
  mobilePhone: '',
  email: '',
  workPhone: '',
  homePhone: '',
  referralSource: '',
  referralSourceOther: '',
  memberships: '',
  hasDriverLicense: '',
  driverLicenseClass: '',
  driverLicenseDate: '',
  hasCriminalRecord: '',
  hasConviction: '',
  convictionDetails: '',
  hasOngoingCase: '',
  height: '',
  weight: '',
  shoeSize: '',
  clothingSizeUpper: '',
  clothingSizeLower: '',
  hasTravelRestriction: '',
  canWorkShifts: '',
  hobbies: '',
  availableStartDate: '',
  expectedSalary: '',
  requestedPosition: '',
  previouslyWorkedHere: '',
  educationLevel: '',
  educationHistory: initialEducationHistory,
  coursesAndSeminars: Array.from({ length: 3 }, () => ({
    institution: '',
    subject: '',
    duration: '',
    attendanceDate: '',
  })),
  foreignLanguages: Array.from({ length: 3 }, () => ({
    language: '',
    reading: '',
    writing: '',
    speaking: '',
    learnedAt: '',
  })),
  computerSkills: Array.from({ length: 5 }, () => ({ program: '', level: '', learnedAt: '' })),
  workExperience: Array.from({ length: 5 }, () => ({
    company: '',
    position: '',
    startDate: '',
    endDate: '',
    leavingReason: '',
    lastSalary: '',
  })),
  hasRelativesInCompany: '',
  relativeName: '',
  preferredContactGsm: false,
  preferredContactEmail: false,
  preferredContactOther: '',
  canContactLastEmployer: '',
  references: Array.from({ length: 3 }, () => ({ name: '', company: '', position: '', phone: '' })),
  declarationAccepted: false,
  digitalSignature: '',
  signatureDate: '',
  photo: null,
}
