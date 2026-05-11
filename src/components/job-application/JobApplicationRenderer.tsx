'use client'

// PR-JOBAPP-RENDERER: Public iş başvuru formu — multi-step orchestrator.
//
// Backend kontratı (POST /api/job-application, multipart/form-data):
// - Scalar alanlar string olarak FormData'ya append edilir.
// - Boolean'lar 'true' / 'false' string'i (backend === karşılaştırması yapıyor).
// - Tarihler ISO YYYY-MM-DD.
// - Array alanları (educationHistory, coursesAndSeminars, foreignLanguages,
//   computerSkills, workExperience, references) JSON.stringify edilir;
//   backend JSON.parse ile geri alır.
// - photo File object olarak append.
// - digitalSignature: PR-JOBAPP-RENDERER ile canvas pad PNG dataURL (önceki
//   'fullName|date|ts' string'inden değişti). Backend string saklar — admin
//   görüntüleme tarafında dataURL <img src> ile render edilmeli.

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Send, AlertCircle, CheckCircle2 } from 'lucide-react'
import { FormProgressBar } from '@/components/forms/multi-step/FormProgressBar'
import { FormQuestionCard } from '@/components/forms/multi-step/FormQuestionCard'
import { FormShortText } from '@/components/forms/multi-step/question-types/FormShortText'
import { FormLongText } from '@/components/forms/multi-step/question-types/FormLongText'
import { FormDateInput } from '@/components/forms/multi-step/FormDateInput'
import { FormNumberInput } from '@/components/forms/multi-step/FormNumberInput'
import { FormSegmentControl } from '@/components/forms/multi-step/FormSegmentControl'
import { FormCheckboxGroup } from '@/components/forms/multi-step/FormCheckboxGroup'
import { FormImageUpload } from '@/components/forms/multi-step/FormImageUpload'
import { FormRepeatableSection } from '@/components/forms/multi-step/FormRepeatableSection'
import { FormFixedKeyRecord } from '@/components/forms/multi-step/FormFixedKeyRecord'
import { FormConsentBlock } from '@/components/forms/multi-step/FormConsentBlock'
import { FormConditionalField } from '@/components/forms/multi-step/FormConditionalField'
import {
  GENDER_OPTIONS,
  BLOOD_TYPE_OPTIONS,
  MILITARY_STATUS_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  REFERRAL_SOURCE_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  LANGUAGE_LEVEL_OPTIONS,
  COMPUTER_LEVEL_OPTIONS,
  YES_NO_OPTIONS,
  EDUCATION_HISTORY_KEYS,
  DECLARATION_TEXT,
} from './constants'

// ---------- Type'lar ----------

type CourseRow = { institution: string; subject: string; duration: string; attendanceDate: string }
type LanguageRow = { language: string; reading: string; writing: string; speaking: string; learnedAt: string }
type ComputerRow = { program: string; level: string; learnedAt: string }
type WorkExpRow = {
  company: string
  position: string
  startDate: string
  endDate: string
  leavingReason: string
  lastSalary: string
}
type ReferenceRow = { name: string; company: string; position: string; phone: string }
type EducationEntry = {
  institution: string
  startDate: string
  endDate: string
  department: string
  gpa: string
}

interface FormState {
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

const EMPTY_EDUCATION_ENTRY: EducationEntry = {
  institution: '',
  startDate: '',
  endDate: '',
  department: '',
  gpa: '',
}

const initialEducationHistory: Record<string, EducationEntry> = Object.fromEntries(
  EDUCATION_HISTORY_KEYS.map((k) => [k.id, { ...EMPTY_EDUCATION_ENTRY }])
)

const initialState: FormState = {
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

const SECTION_TITLES = [
  'Kişisel ve Aile Bilgileri',
  'İletişim',
  'Kaynak, Ehliyet ve Hukuki Durum',
  'Fiziksel Özellikler ve Çalışma Koşulları',
  'İş Tercihleri ve Eğitim',
  'Deneyim, Akraba, İletişim Tercihi',
  'Beyan ve Fotoğraf',
] as const

interface Props {
  onSubmitted?: (applicationNumber: string) => void
}

export function JobApplicationRenderer({ onSubmitted }: Props = {}) {
  const [form, setForm] = useState<FormState>(initialState)
  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ applicationNumber: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalSteps = SECTION_TITLES.length
  const isFinalStep = currentStep === totalSteps - 1

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // ----- Validation (zorunlu alanlar) -----

  const canSubmit = useMemo(() => {
    return (
      form.fullName.trim().length > 0 &&
      form.declarationAccepted &&
      form.digitalSignature.length > 0
    )
  }, [form.fullName, form.declarationAccepted, form.digitalSignature])

  const canAdvanceFromStep = (step: number): boolean => {
    // Sadece adım 0'da fullName zorunlu (yoksa kullanıcı sonraki adıma geçemez)
    if (step === 0 && !form.fullName.trim()) return false
    return true
  }

  // ----- Submit -----

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Ad Soyad, beyan onayı ve imza zorunludur.')
      return
    }
    setSubmitting(true)
    setError(null)

    const fd = new FormData()
    const append = (k: string, v: string | boolean | null) => {
      if (v === null || v === '') return
      fd.append(k, typeof v === 'boolean' ? String(v) : v)
    }

    // Scalar string alanlar
    append('fullName', form.fullName.trim())
    append('birthPlace', form.birthPlace.trim())
    append('birthDate', form.birthDate)
    append('nationality', form.nationality.trim())
    append('tcKimlikNo', form.tcKimlikNo.trim())
    append('gender', form.gender)
    append('bloodType', form.bloodType)
    append('militaryStatus', form.militaryStatus)
    append('militaryPostponeDate', form.militaryPostponeDate)
    append('maritalStatus', form.maritalStatus)
    append('numberOfChildren', form.numberOfChildren)
    append('spouseWorking', form.spouseWorking)
    append('spouseOccupation', form.spouseOccupation.trim())
    append('homeAddress', form.homeAddress.trim())
    append('dependents', form.dependents.trim())
    append('mobilePhone', form.mobilePhone.trim())
    append('email', form.email.trim())
    append('workPhone', form.workPhone.trim())
    append('homePhone', form.homePhone.trim())
    append('referralSource', form.referralSource)
    append('referralSourceOther', form.referralSourceOther.trim())
    append('memberships', form.memberships.trim())
    append('hasDriverLicense', form.hasDriverLicense)
    append('driverLicenseClass', form.driverLicenseClass.trim())
    append('driverLicenseDate', form.driverLicenseDate)
    append('hasCriminalRecord', form.hasCriminalRecord)
    append('hasConviction', form.hasConviction)
    append('convictionDetails', form.convictionDetails.trim())
    append('hasOngoingCase', form.hasOngoingCase)
    append('height', form.height)
    append('weight', form.weight)
    append('shoeSize', form.shoeSize.trim())
    append('clothingSizeUpper', form.clothingSizeUpper.trim())
    append('clothingSizeLower', form.clothingSizeLower.trim())
    append('hasTravelRestriction', form.hasTravelRestriction)
    append('canWorkShifts', form.canWorkShifts)
    append('hobbies', form.hobbies.trim())
    append('availableStartDate', form.availableStartDate)
    append('expectedSalary', form.expectedSalary)
    append('requestedPosition', form.requestedPosition.trim())
    append('previouslyWorkedHere', form.previouslyWorkedHere)
    append('educationLevel', form.educationLevel)
    append('hasRelativesInCompany', form.hasRelativesInCompany)
    append('relativeName', form.relativeName.trim())
    fd.append('preferredContactGsm', String(form.preferredContactGsm))
    fd.append('preferredContactEmail', String(form.preferredContactEmail))
    append('preferredContactOther', form.preferredContactOther.trim())
    append('canContactLastEmployer', form.canContactLastEmployer)
    fd.append('declarationAccepted', String(form.declarationAccepted))
    append('digitalSignature', form.digitalSignature)
    append('signatureDate', form.signatureDate)

    // JSON array alanlar (backend JSON.parse ediyor)
    fd.append('educationHistory', JSON.stringify(form.educationHistory))
    fd.append('coursesAndSeminars', JSON.stringify(form.coursesAndSeminars.filter((r) => r.institution || r.subject)))
    fd.append('foreignLanguages', JSON.stringify(form.foreignLanguages.filter((r) => r.language)))
    fd.append('computerSkills', JSON.stringify(form.computerSkills.filter((r) => r.program)))
    fd.append('workExperience', JSON.stringify(form.workExperience.filter((r) => r.company || r.position)))
    fd.append('references', JSON.stringify(form.references.filter((r) => r.name || r.company)))

    if (form.photo) fd.append('photo', form.photo)

    try {
      const res = await fetch('/api/job-application', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Başvuru gönderilemedi.')
        return
      }
      setSubmitted({ applicationNumber: data.applicationNumber ?? '' })
      onSubmitted?.(data.applicationNumber ?? '')
    } catch {
      setError('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.')
    } finally {
      setSubmitting(false)
    }
  }

  // ----- Submitted state -----

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-xl font-medium text-slate-900 mb-2">Başvurunuz Alındı</h1>
          <p className="text-sm text-slate-500">
            Başvurunuz başarıyla kaydedildi.
            {submitted.applicationNumber && (
              <>
                {' '}Başvuru numaranız: <strong className="text-slate-900">{submitted.applicationNumber}</strong>.
              </>
            )}
          </p>
          <p className="text-xs text-slate-400 mt-4">
            İnsan Varlıkları ekibimiz değerlendirme sonrası sizinle iletişime geçecektir.
          </p>
        </div>
      </div>
    )
  }

  // ----- Section renderers -----

  let sectionContent: React.ReactNode = null
  let nextQuestionNumber = 1
  const NumberedCard = ({ title, required, helper, children }: { title: string; required?: boolean; helper?: string; children: React.ReactNode }) => {
    const n = nextQuestionNumber++
    return (
      <FormQuestionCard number={n} title={title} isRequired={required} helperText={helper}>
        {children}
      </FormQuestionCard>
    )
  }

  if (currentStep === 0) {
    sectionContent = (
      <>
        <NumberedCard title="Ad Soyad" required>
          <FormShortText value={form.fullName} onChange={(v) => update('fullName', v)} placeholder="Ad ve soyadınız" />
        </NumberedCard>
        <NumberedCard title="Cinsiyet">
          <FormSegmentControl options={GENDER_OPTIONS as unknown as { value: string; label: string }[]} value={form.gender} onChange={(v) => update('gender', v)} />
        </NumberedCard>
        <NumberedCard title="Doğum Yeri">
          <FormShortText value={form.birthPlace} onChange={(v) => update('birthPlace', v)} />
        </NumberedCard>
        <NumberedCard title="Doğum Tarihi">
          <FormDateInput value={form.birthDate} onChange={(v) => update('birthDate', v)} />
        </NumberedCard>
        <NumberedCard title="Uyruğu">
          <FormShortText value={form.nationality} onChange={(v) => update('nationality', v)} />
        </NumberedCard>
        <NumberedCard title="TC Kimlik No">
          <FormShortText value={form.tcKimlikNo} onChange={(v) => update('tcKimlikNo', v)} maxLength={11} />
        </NumberedCard>
        <NumberedCard title="Kan Grubu">
          <FormSegmentControl options={BLOOD_TYPE_OPTIONS as unknown as { value: string; label: string }[]} value={form.bloodType} onChange={(v) => update('bloodType', v)} />
        </NumberedCard>
        <NumberedCard title="Askerlik Durumu">
          <FormSegmentControl options={MILITARY_STATUS_OPTIONS as unknown as { value: string; label: string }[]} value={form.militaryStatus} onChange={(v) => update('militaryStatus', v)} />
          <FormConditionalField when={form.militaryStatus === 'POSTPONED'}>
            <div className="mt-3">
              <label className="block text-xs text-slate-500 mb-1">Tecil Bitiş Tarihi</label>
              <FormDateInput value={form.militaryPostponeDate} onChange={(v) => update('militaryPostponeDate', v)} />
            </div>
          </FormConditionalField>
        </NumberedCard>
        <NumberedCard title="Medeni Durum">
          <FormSegmentControl options={MARITAL_STATUS_OPTIONS as unknown as { value: string; label: string }[]} value={form.maritalStatus} onChange={(v) => update('maritalStatus', v)} />
        </NumberedCard>
        <NumberedCard title="Çocuk Sayısı">
          <FormNumberInput value={form.numberOfChildren} onChange={(v) => update('numberOfChildren', v)} min={0} max={20} />
        </NumberedCard>
        <FormConditionalField when={form.maritalStatus === 'MARRIED'}>
          <NumberedCard title="Eşiniz çalışıyor mu?">
            <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.spouseWorking} onChange={(v) => update('spouseWorking', v)} />
            <FormConditionalField when={form.spouseWorking === 'true'}>
              <div className="mt-3">
                <label className="block text-xs text-slate-500 mb-1">Eşinizin Mesleği</label>
                <FormShortText value={form.spouseOccupation} onChange={(v) => update('spouseOccupation', v)} />
              </div>
            </FormConditionalField>
          </NumberedCard>
        </FormConditionalField>
      </>
    )
  } else if (currentStep === 1) {
    sectionContent = (
      <>
        <NumberedCard title="Ev Adresi">
          <FormLongText value={form.homeAddress} onChange={(v) => update('homeAddress', v)} rows={3} maxLength={500} />
        </NumberedCard>
        <NumberedCard title="Yanınızda Bakmakla Yükümlü Olduğunuz Kişiler">
          <FormLongText value={form.dependents} onChange={(v) => update('dependents', v)} rows={2} maxLength={300} />
        </NumberedCard>
        <NumberedCard title="Cep Telefonu">
          <FormShortText value={form.mobilePhone} onChange={(v) => update('mobilePhone', v)} placeholder="05XX XXX XX XX" />
        </NumberedCard>
        <NumberedCard title="E-posta">
          <FormShortText value={form.email} onChange={(v) => update('email', v)} placeholder="ornek@mail.com" />
        </NumberedCard>
        <NumberedCard title="İş Telefonu">
          <FormShortText value={form.workPhone} onChange={(v) => update('workPhone', v)} />
        </NumberedCard>
        <NumberedCard title="Ev Telefonu">
          <FormShortText value={form.homePhone} onChange={(v) => update('homePhone', v)} />
        </NumberedCard>
      </>
    )
  } else if (currentStep === 2) {
    sectionContent = (
      <>
        <NumberedCard title="Bize Nasıl Ulaştınız?">
          <FormSegmentControl options={REFERRAL_SOURCE_OPTIONS as unknown as { value: string; label: string }[]} value={form.referralSource} onChange={(v) => update('referralSource', v)} />
          <FormConditionalField when={form.referralSource === 'OTHER'}>
            <div className="mt-3">
              <label className="block text-xs text-slate-500 mb-1">Lütfen belirtin</label>
              <FormShortText value={form.referralSourceOther} onChange={(v) => update('referralSourceOther', v)} />
            </div>
          </FormConditionalField>
        </NumberedCard>
        <NumberedCard title="Üyelikler" helper="Meslek kuruluşları, dernekler, sertifika programları vb.">
          <FormLongText value={form.memberships} onChange={(v) => update('memberships', v)} rows={2} maxLength={500} />
        </NumberedCard>
        <NumberedCard title="Sürücü Belgeniz var mı?">
          <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.hasDriverLicense} onChange={(v) => update('hasDriverLicense', v)} />
          <FormConditionalField when={form.hasDriverLicense === 'true'}>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Ehliyet Sınıfı</label>
                <FormShortText value={form.driverLicenseClass} onChange={(v) => update('driverLicenseClass', v)} placeholder="Örn: B" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Alma Tarihi</label>
                <FormDateInput value={form.driverLicenseDate} onChange={(v) => update('driverLicenseDate', v)} />
              </div>
            </div>
          </FormConditionalField>
        </NumberedCard>
        <NumberedCard title="Adli sicil kaydınız var mı?">
          <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.hasCriminalRecord} onChange={(v) => update('hasCriminalRecord', v)} />
        </NumberedCard>
        <NumberedCard title="Hüküm giydiniz mi?">
          <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.hasConviction} onChange={(v) => update('hasConviction', v)} />
          <FormConditionalField when={form.hasConviction === 'true'}>
            <div className="mt-3">
              <label className="block text-xs text-slate-500 mb-1">Detay</label>
              <FormLongText value={form.convictionDetails} onChange={(v) => update('convictionDetails', v)} rows={2} maxLength={500} />
            </div>
          </FormConditionalField>
        </NumberedCard>
        <NumberedCard title="Devam eden davanız var mı?">
          <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.hasOngoingCase} onChange={(v) => update('hasOngoingCase', v)} />
        </NumberedCard>
      </>
    )
  } else if (currentStep === 3) {
    sectionContent = (
      <>
        <NumberedCard title="Boy (cm)">
          <FormNumberInput value={form.height} onChange={(v) => update('height', v)} min={100} max={250} />
        </NumberedCard>
        <NumberedCard title="Kilo (kg)">
          <FormNumberInput value={form.weight} onChange={(v) => update('weight', v)} min={30} max={250} />
        </NumberedCard>
        <NumberedCard title="Ayakkabı Numarası">
          <FormShortText value={form.shoeSize} onChange={(v) => update('shoeSize', v)} />
        </NumberedCard>
        <NumberedCard title="Üst Beden">
          <FormShortText value={form.clothingSizeUpper} onChange={(v) => update('clothingSizeUpper', v)} />
        </NumberedCard>
        <NumberedCard title="Alt Beden">
          <FormShortText value={form.clothingSizeLower} onChange={(v) => update('clothingSizeLower', v)} />
        </NumberedCard>
        <NumberedCard title="Seyahat kısıtınız var mı?">
          <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.hasTravelRestriction} onChange={(v) => update('hasTravelRestriction', v)} />
        </NumberedCard>
        <NumberedCard title="Vardiya çalışabilir misiniz?">
          <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.canWorkShifts} onChange={(v) => update('canWorkShifts', v)} />
        </NumberedCard>
        <NumberedCard title="Hobileriniz">
          <FormLongText value={form.hobbies} onChange={(v) => update('hobbies', v)} rows={2} maxLength={500} />
        </NumberedCard>
      </>
    )
  } else if (currentStep === 4) {
    sectionContent = (
      <>
        <NumberedCard title="Başlayabileceğiniz tarih">
          <FormDateInput value={form.availableStartDate} onChange={(v) => update('availableStartDate', v)} />
        </NumberedCard>
        <NumberedCard title="Maaş Beklentisi (₺)">
          <FormNumberInput value={form.expectedSalary} onChange={(v) => update('expectedSalary', v)} min={0} step={500} />
        </NumberedCard>
        <NumberedCard title="Başvurulan Pozisyon">
          <FormShortText value={form.requestedPosition} onChange={(v) => update('requestedPosition', v)} />
        </NumberedCard>
        <NumberedCard title="Daha önce şirketimizde çalıştınız mı?">
          <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.previouslyWorkedHere} onChange={(v) => update('previouslyWorkedHere', v)} />
        </NumberedCard>
        <NumberedCard title="Eğitim Seviyesi">
          <FormSegmentControl options={EDUCATION_LEVEL_OPTIONS as unknown as { value: string; label: string }[]} value={form.educationLevel} onChange={(v) => update('educationLevel', v)} mobileColumns={1} />
        </NumberedCard>
        <NumberedCard title="Eğitim Geçmişi" helper="İlgili olan kademeleri doldurun, boş bırakabilirsiniz.">
          <FormFixedKeyRecord
            keys={EDUCATION_HISTORY_KEYS}
            fields={[
              { key: 'institution', label: 'Okul Adı' },
              { key: 'department', label: 'Bölüm' },
              { key: 'startDate', label: 'Başlangıç (yıl)', placeholder: '2014' },
              { key: 'endDate', label: 'Bitiş (yıl)', placeholder: '2018' },
              { key: 'gpa', label: 'Not Ortalaması' },
            ]}
            value={form.educationHistory}
            onChange={(v) => update('educationHistory', v as Record<string, EducationEntry>)}
          />
        </NumberedCard>
        <NumberedCard title="Staj, Kurs ve Seminerler">
          <FormRepeatableSection<CourseRow>
            value={form.coursesAndSeminars}
            onChange={(v) => update('coursesAndSeminars', v)}
            emptyRow={{ institution: '', subject: '', duration: '', attendanceDate: '' }}
            renderRow={(row, idx, onRowChange) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <FormShortText value={row.institution} onChange={(v) => onRowChange({ ...row, institution: v })} placeholder="Kurum" />
                <FormShortText value={row.subject} onChange={(v) => onRowChange({ ...row, subject: v })} placeholder="Konu" />
                <FormShortText value={row.duration} onChange={(v) => onRowChange({ ...row, duration: v })} placeholder="Süre" />
                <FormShortText value={row.attendanceDate} onChange={(v) => onRowChange({ ...row, attendanceDate: v })} placeholder="Yıl (örn. 2022)" />
              </div>
            )}
          />
        </NumberedCard>
        <NumberedCard title="Yabancı Dil Bilgisi">
          <FormRepeatableSection<LanguageRow>
            value={form.foreignLanguages}
            onChange={(v) => update('foreignLanguages', v)}
            emptyRow={{ language: '', reading: '', writing: '', speaking: '', learnedAt: '' }}
            renderRow={(row, idx, onRowChange) => (
              <div className="space-y-2">
                <FormShortText value={row.language} onChange={(v) => onRowChange({ ...row, language: v })} placeholder="Dil (Örn. İngilizce)" />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Okuma</label>
                    <FormSegmentControl options={LANGUAGE_LEVEL_OPTIONS as unknown as { value: string; label: string }[]} value={row.reading} onChange={(v) => onRowChange({ ...row, reading: v })} mobileColumns={1} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Yazma</label>
                    <FormSegmentControl options={LANGUAGE_LEVEL_OPTIONS as unknown as { value: string; label: string }[]} value={row.writing} onChange={(v) => onRowChange({ ...row, writing: v })} mobileColumns={1} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Konuşma</label>
                    <FormSegmentControl options={LANGUAGE_LEVEL_OPTIONS as unknown as { value: string; label: string }[]} value={row.speaking} onChange={(v) => onRowChange({ ...row, speaking: v })} mobileColumns={1} />
                  </div>
                </div>
                <FormShortText value={row.learnedAt} onChange={(v) => onRowChange({ ...row, learnedAt: v })} placeholder="Nerede öğrendiniz?" />
              </div>
            )}
          />
        </NumberedCard>
        <NumberedCard title="Bilgisayar Bilgisi">
          <FormRepeatableSection<ComputerRow>
            value={form.computerSkills}
            onChange={(v) => update('computerSkills', v)}
            emptyRow={{ program: '', level: '', learnedAt: '' }}
            renderRow={(row, idx, onRowChange) => (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <FormShortText value={row.program} onChange={(v) => onRowChange({ ...row, program: v })} placeholder="Program (Örn. Excel)" />
                <FormSegmentControl options={COMPUTER_LEVEL_OPTIONS as unknown as { value: string; label: string }[]} value={row.level} onChange={(v) => onRowChange({ ...row, level: v })} mobileColumns={2} />
                <FormShortText value={row.learnedAt} onChange={(v) => onRowChange({ ...row, learnedAt: v })} placeholder="Nerede öğrendiniz?" />
              </div>
            )}
          />
        </NumberedCard>
      </>
    )
  } else if (currentStep === 5) {
    sectionContent = (
      <>
        <NumberedCard title="İş Tecrübeleriniz">
          <FormRepeatableSection<WorkExpRow>
            value={form.workExperience}
            onChange={(v) => update('workExperience', v)}
            emptyRow={{ company: '', position: '', startDate: '', endDate: '', leavingReason: '', lastSalary: '' }}
            renderRow={(row, idx, onRowChange) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <FormShortText value={row.company} onChange={(v) => onRowChange({ ...row, company: v })} placeholder="Şirket" />
                <FormShortText value={row.position} onChange={(v) => onRowChange({ ...row, position: v })} placeholder="Pozisyon" />
                <FormShortText value={row.startDate} onChange={(v) => onRowChange({ ...row, startDate: v })} placeholder="Başlangıç (MM/YYYY)" />
                <FormShortText value={row.endDate} onChange={(v) => onRowChange({ ...row, endDate: v })} placeholder="Bitiş (MM/YYYY)" />
                <FormShortText value={row.leavingReason} onChange={(v) => onRowChange({ ...row, leavingReason: v })} placeholder="Ayrılış nedeni" />
                <FormShortText value={row.lastSalary} onChange={(v) => onRowChange({ ...row, lastSalary: v })} placeholder="Son maaş" />
              </div>
            )}
          />
        </NumberedCard>
        <NumberedCard title="Firma bünyesinde akraba/tanıdığınız var mı?">
          <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.hasRelativesInCompany} onChange={(v) => update('hasRelativesInCompany', v)} />
          <FormConditionalField when={form.hasRelativesInCompany === 'true'}>
            <div className="mt-3">
              <label className="block text-xs text-slate-500 mb-1">Adı</label>
              <FormShortText value={form.relativeName} onChange={(v) => update('relativeName', v)} />
            </div>
          </FormConditionalField>
        </NumberedCard>
        <NumberedCard title="Size nasıl ulaşabiliriz?">
          <FormCheckboxGroup
            items={[
              { key: 'preferredContactGsm', label: 'Cep telefonundan arayın' },
              { key: 'preferredContactEmail', label: 'E-posta ile yazın' },
            ]}
            value={{
              preferredContactGsm: form.preferredContactGsm,
              preferredContactEmail: form.preferredContactEmail,
            }}
            onChange={(next) => {
              update('preferredContactGsm', !!next.preferredContactGsm)
              update('preferredContactEmail', !!next.preferredContactEmail)
            }}
          />
          <div className="mt-3">
            <label className="block text-xs text-slate-500 mb-1">Diğer (belirtin)</label>
            <FormShortText value={form.preferredContactOther} onChange={(v) => update('preferredContactOther', v)} />
          </div>
        </NumberedCard>
        <NumberedCard title="Son işvereninizle iletişime geçebilir miyiz?">
          <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.canContactLastEmployer} onChange={(v) => update('canContactLastEmployer', v)} />
        </NumberedCard>
        <NumberedCard title="Aradığımızda referans verebilecek kişiler">
          <FormRepeatableSection<ReferenceRow>
            value={form.references}
            onChange={(v) => update('references', v)}
            emptyRow={{ name: '', company: '', position: '', phone: '' }}
            renderRow={(row, idx, onRowChange) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <FormShortText value={row.name} onChange={(v) => onRowChange({ ...row, name: v })} placeholder="Ad Soyad" />
                <FormShortText value={row.company} onChange={(v) => onRowChange({ ...row, company: v })} placeholder="Şirket" />
                <FormShortText value={row.position} onChange={(v) => onRowChange({ ...row, position: v })} placeholder="Pozisyon" />
                <FormShortText value={row.phone} onChange={(v) => onRowChange({ ...row, phone: v })} placeholder="Telefon" />
              </div>
            )}
          />
        </NumberedCard>
      </>
    )
  } else if (currentStep === 6) {
    sectionContent = (
      <>
        <NumberedCard title="Fotoğrafınız" helper="JPG / PNG, maks. 5 MB.">
          <FormImageUpload
            value={form.photo}
            onChange={(f) => update('photo', f)}
            maxSizeMB={5}
          />
        </NumberedCard>
        <FormQuestionCard number={nextQuestionNumber++} title="Beyan" isRequired>
          <FormConsentBlock
            declarationText={DECLARATION_TEXT}
            declarationAccepted={form.declarationAccepted}
            onDeclarationChange={(v) => update('declarationAccepted', v)}
            signatureDataUrl={form.digitalSignature}
            onSignatureChange={(url) => update('digitalSignature', url)}
            onSigned={(dateStr) => update('signatureDate', dateStr)}
          />
        </FormQuestionCard>
      </>
    )
  }

  // ----- Render -----

  return (
    <div className="min-h-screen bg-slate-50">
      <FormProgressBar
        current={currentStep}
        total={totalSteps}
        answeredCount={Math.min(currentStep + 1, totalSteps)}
        totalQuestions={totalSteps}
      />

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        {currentStep === 0 && (
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-medium text-slate-900">İş Başvuru Formu</h1>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-xl mx-auto">
              Lütfen aşağıdaki bilgileri eksiksiz doldurun. İnsan Varlıkları ekibimiz değerlendirme
              sonrası sizinle iletişime geçecektir.
            </p>
          </div>
        )}

        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider text-[#1B4F72] uppercase">
            Bölüm {currentStep + 1}
          </p>
          <h2 className="mt-1 text-xl font-medium text-slate-900">{SECTION_TITLES[currentStep]}</h2>
        </div>

        <div className="space-y-4">{sectionContent}</div>

        {error && (
          <div className="mt-4 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0 || submitting}
            className="flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Önceki
          </button>

          {!isFinalStep ? (
            <button
              type="button"
              onClick={() => {
                if (!canAdvanceFromStep(currentStep)) {
                  setError('Ad Soyad zorunludur.')
                  return
                }
                setError(null)
                setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))
              }}
              disabled={submitting}
              className="flex items-center gap-1 px-5 py-2.5 bg-[#1B4F72] text-white text-sm font-medium rounded-xl hover:bg-[#1B4F72]/90 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              Sonraki bölüm
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1B4F72] text-white text-sm font-medium rounded-xl hover:bg-[#1B4F72]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'Gönderiliyor...' : 'Başvuruyu Gönder'}
            </button>
          )}
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          ILERI Group · İnsan Varlıkları
        </p>
      </div>
    </div>
  )
}
