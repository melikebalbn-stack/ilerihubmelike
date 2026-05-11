'use client'

// PR-JOBAPP-INPUT-FOCUS: Slim orchestrator.
//
// PR-JOBAPP-RENDERER'da NumberedCard helper'ı renderer fonksiyonu içinde
// tanımlıydı — her render'da yeni reference üretip child input'ları
// remount ediyordu (focus kaybı, her keystroke'ta input'u yeniden mount).
//
// Fix:
//   - 7 section ayrı top-level component dosyasında (./sections/*)
//   - SECTIONS array module-scope sabit (Component referansları stabil)
//   - onChange useCallback ile memoized (identity stabil)
//   - form state + nav + submit yalnız bu orchestrator'da
//
// Backend kontratı (POST /api/job-application, multipart/form-data) aynı.

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Loader2, Send, AlertCircle, CheckCircle2 } from 'lucide-react'
import { FormProgressBar } from '@/components/forms/multi-step/FormProgressBar'
import { SectionKisiselAile } from './sections/SectionKisiselAile'
import { SectionIletisim } from './sections/SectionIletisim'
import { SectionKaynakHukuki } from './sections/SectionKaynakHukuki'
import { SectionFizikselCalisma } from './sections/SectionFizikselCalisma'
import { SectionTercihEgitim } from './sections/SectionTercihEgitim'
import { SectionDeneyimReferans } from './sections/SectionDeneyimReferans'
import { SectionBeyanFotograf } from './sections/SectionBeyanFotograf'
import { initialFormState, type FormState, type SectionProps } from './types'

const SECTIONS: ReadonlyArray<{
  title: string
  Component: React.ComponentType<SectionProps>
}> = [
  { title: 'Kişisel ve Aile Bilgileri', Component: SectionKisiselAile },
  { title: 'İletişim', Component: SectionIletisim },
  { title: 'Kaynak, Ehliyet ve Hukuki Durum', Component: SectionKaynakHukuki },
  { title: 'Fiziksel Özellikler ve Çalışma Koşulları', Component: SectionFizikselCalisma },
  { title: 'İş Tercihleri ve Eğitim', Component: SectionTercihEgitim },
  { title: 'Deneyim, Akraba, İletişim Tercihi', Component: SectionDeneyimReferans },
  { title: 'Beyan ve Fotoğraf', Component: SectionBeyanFotograf },
]

interface Props {
  onSubmitted?: (applicationNumber: string) => void
}

export function JobApplicationRenderer({ onSubmitted }: Props = {}) {
  const [form, setForm] = useState<FormState>(initialFormState)
  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ applicationNumber: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalSteps = SECTIONS.length
  const isFinalStep = currentStep === totalSteps - 1
  const ActiveSection = SECTIONS[currentStep].Component

  // KRİTİK: onChange identity stable olmalı — yoksa section component'leri
  // her keystroke'ta re-render olur (focus kaybetmez, sadece performans).
  const onChange = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  // PR-JOBAPP-UX-FIXES: Bölüm değişiminde üste smooth scroll.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [currentStep])

  const canSubmit =
    form.fullName.trim().length > 0 &&
    form.declarationAccepted &&
    form.digitalSignature.length > 0

  const canAdvanceFromStep = (step: number): boolean => {
    if (step === 0 && !form.fullName.trim()) return false
    return true
  }

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

    fd.append('educationHistory', JSON.stringify(form.educationHistory))
    fd.append(
      'coursesAndSeminars',
      JSON.stringify(form.coursesAndSeminars.filter((r) => r.institution || r.subject))
    )
    fd.append('foreignLanguages', JSON.stringify(form.foreignLanguages.filter((r) => r.language)))
    fd.append('computerSkills', JSON.stringify(form.computerSkills.filter((r) => r.program)))
    fd.append(
      'workExperience',
      JSON.stringify(form.workExperience.filter((r) => r.company || r.position))
    )
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

  if (submitted) {
    const handleNewApplication = () => {
      // PR-JOBAPP-CAMERA-AND-SUCCESS: Tablet senaryosu — bir sonraki aday için
      // tüm form state'i sıfırla, ilk bölümden başla.
      setForm(initialFormState)
      setCurrentStep(0)
      setSubmitted(null)
      setError(null)
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-xl font-medium text-slate-900 mb-2">Başvurunuz Alındı</h1>
          <p className="text-sm text-slate-500">
            Başvurunuz başarıyla kaydedildi.
            {submitted.applicationNumber && (
              <>
                {' '}Başvuru numaranız:{' '}
                <strong className="text-slate-900">{submitted.applicationNumber}</strong>.
              </>
            )}
          </p>
          <p className="text-xs text-slate-400 mt-4">
            İnsan Varlıkları ekibimiz değerlendirme sonrası sizinle iletişime geçecektir.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
            <button
              type="button"
              onClick={handleNewApplication}
              className="px-5 py-2.5 bg-[#1B4F72] text-white rounded-lg font-medium text-sm hover:bg-[#1B4F72]/90 transition-colors active:scale-[0.98]"
            >
              Yeni Başvuru Başlat
            </button>
            <Link
              href="/"
              className="px-5 py-2.5 border border-slate-300 rounded-lg font-medium text-sm text-slate-700 hover:bg-slate-50 transition-colors text-center"
            >
              Anasayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
              Lütfen aşağıdaki bilgileri eksiksiz doldurun. İnsan Varlıkları ekibimiz
              değerlendirme sonrası sizinle iletişime geçecektir.
            </p>
          </div>
        )}

        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider text-[#1B4F72] uppercase">
            Bölüm {currentStep + 1}
          </p>
          <h2 className="mt-1 text-xl font-medium text-slate-900">{SECTIONS[currentStep].title}</h2>
        </div>

        <div className="space-y-4">
          <ActiveSection form={form} onChange={onChange} />
        </div>

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
