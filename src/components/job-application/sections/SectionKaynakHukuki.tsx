'use client'

// PR-JOBAPP-INPUT-FOCUS: Bölüm 3 — Kaynak, Ehliyet ve Hukuki Durum.

import { FormQuestionCard } from '@/components/forms/multi-step/FormQuestionCard'
import { FormShortText } from '@/components/forms/multi-step/question-types/FormShortText'
import { FormLongText } from '@/components/forms/multi-step/question-types/FormLongText'
import { FormDateInput } from '@/components/forms/multi-step/FormDateInput'
import { FormSegmentControl } from '@/components/forms/multi-step/FormSegmentControl'
import { FormConditionalField } from '@/components/forms/multi-step/FormConditionalField'
import { REFERRAL_SOURCE_OPTIONS, YES_NO_OPTIONS } from '../constants'
import type { SectionProps } from '../types'

export function SectionKaynakHukuki({ form, onChange }: SectionProps) {
  return (
    <>
      <FormQuestionCard number={1} title="Bize Nasıl Ulaştınız?">
        <FormSegmentControl options={REFERRAL_SOURCE_OPTIONS as unknown as { value: string; label: string }[]} value={form.referralSource} onChange={(v) => onChange({ referralSource: v })} />
        <FormConditionalField when={form.referralSource === 'OTHER'}>
          <div className="mt-3">
            <label className="block text-xs text-slate-500 mb-1">Lütfen belirtin</label>
            <FormShortText value={form.referralSourceOther} onChange={(v) => onChange({ referralSourceOther: v })} />
          </div>
        </FormConditionalField>
      </FormQuestionCard>
      <FormQuestionCard number={2} title="Üyelikler" helperText="Meslek kuruluşları, dernekler, sertifika programları vb.">
        <FormLongText value={form.memberships} onChange={(v) => onChange({ memberships: v })} rows={2} maxLength={500} />
      </FormQuestionCard>
      <FormQuestionCard number={3} title="Sürücü Belgeniz var mı?">
        <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.hasDriverLicense} onChange={(v) => onChange({ hasDriverLicense: v })} />
        <FormConditionalField when={form.hasDriverLicense === 'true'}>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Ehliyet Sınıfı</label>
              <FormShortText value={form.driverLicenseClass} onChange={(v) => onChange({ driverLicenseClass: v })} placeholder="Örn: B" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Alma Tarihi</label>
              <FormDateInput value={form.driverLicenseDate} onChange={(v) => onChange({ driverLicenseDate: v })} />
            </div>
          </div>
        </FormConditionalField>
      </FormQuestionCard>
      <FormQuestionCard number={4} title="Adli sicil kaydınız var mı?">
        <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.hasCriminalRecord} onChange={(v) => onChange({ hasCriminalRecord: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={5} title="Hüküm giydiniz mi?">
        <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.hasConviction} onChange={(v) => onChange({ hasConviction: v })} />
        <FormConditionalField when={form.hasConviction === 'true'}>
          <div className="mt-3">
            <label className="block text-xs text-slate-500 mb-1">Detay</label>
            <FormLongText value={form.convictionDetails} onChange={(v) => onChange({ convictionDetails: v })} rows={2} maxLength={500} />
          </div>
        </FormConditionalField>
      </FormQuestionCard>
      <FormQuestionCard number={6} title="Devam eden davanız var mı?">
        <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.hasOngoingCase} onChange={(v) => onChange({ hasOngoingCase: v })} />
      </FormQuestionCard>
    </>
  )
}
