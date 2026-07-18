'use client'

// PR-JOBAPP-INPUT-FOCUS: Bölüm 1 — Kişisel ve Aile Bilgileri.
// Zorunluluk yıldızı MERKEZİ şemadan (isRequiredField) sürülür.

import { FormQuestionCard } from '@/components/forms/multi-step/FormQuestionCard'
import { FormShortText } from '@/components/forms/multi-step/question-types/FormShortText'
import { FormDateInput } from '@/components/forms/multi-step/FormDateInput'
import { FormNumberInput } from '@/components/forms/multi-step/FormNumberInput'
import { FormSegmentControl } from '@/components/forms/multi-step/FormSegmentControl'
import { FormConditionalField } from '@/components/forms/multi-step/FormConditionalField'
import {
  GENDER_OPTIONS,
  BLOOD_TYPE_OPTIONS,
  MILITARY_STATUS_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  YES_NO_OPTIONS,
} from '../constants'
import { isRequiredField } from '../required-fields'
import type { SectionProps } from '../types'

export function SectionKisiselAile({ form, onChange }: SectionProps) {
  return (
    <>
      <FormQuestionCard number={1} title="Ad Soyad" isRequired={isRequiredField('fullName')}>
        <FormShortText value={form.fullName} onChange={(v) => onChange({ fullName: v })} placeholder="Ad ve soyadınız" />
      </FormQuestionCard>
      <FormQuestionCard number={2} title="Cinsiyet" isRequired={isRequiredField('gender')}>
        <FormSegmentControl options={GENDER_OPTIONS as unknown as { value: string; label: string }[]} value={form.gender} onChange={(v) => onChange({ gender: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={3} title="Doğum Yeri" isRequired={isRequiredField('birthPlace')}>
        <FormShortText value={form.birthPlace} onChange={(v) => onChange({ birthPlace: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={4} title="Doğum Tarihi" isRequired={isRequiredField('birthDate')}>
        <FormDateInput value={form.birthDate} onChange={(v) => onChange({ birthDate: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={5} title="Uyruğu" isRequired={isRequiredField('nationality')}>
        <FormShortText value={form.nationality} onChange={(v) => onChange({ nationality: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={6} title="TC Kimlik No" isRequired={isRequiredField('tcKimlikNo')}>
        <FormShortText
          value={form.tcKimlikNo}
          onChange={(v) => onChange({ tcKimlikNo: v })}
          maxLength={11}
          inputMode="numeric"
          onlyDigits
          placeholder="11 haneli"
        />
      </FormQuestionCard>
      <FormQuestionCard number={7} title="Kan Grubu" isRequired={isRequiredField('bloodType')}>
        <FormSegmentControl options={BLOOD_TYPE_OPTIONS as unknown as { value: string; label: string }[]} value={form.bloodType} onChange={(v) => onChange({ bloodType: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={8} title="Askerlik Durumu" isRequired={isRequiredField('militaryStatus')}>
        <FormSegmentControl options={MILITARY_STATUS_OPTIONS as unknown as { value: string; label: string }[]} value={form.militaryStatus} onChange={(v) => onChange({ militaryStatus: v })} />
        <FormConditionalField when={form.militaryStatus === 'POSTPONED'}>
          <div className="mt-3">
            <label className="block text-xs text-slate-500 mb-1">Tecil Bitiş Tarihi</label>
            <FormDateInput value={form.militaryPostponeDate} onChange={(v) => onChange({ militaryPostponeDate: v })} />
          </div>
        </FormConditionalField>
      </FormQuestionCard>
      <FormQuestionCard number={9} title="Medeni Durum" isRequired={isRequiredField('maritalStatus')}>
        <FormSegmentControl options={MARITAL_STATUS_OPTIONS as unknown as { value: string; label: string }[]} value={form.maritalStatus} onChange={(v) => onChange({ maritalStatus: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={10} title="Çocuk Sayısı" isRequired={isRequiredField('numberOfChildren')}>
        <FormNumberInput value={form.numberOfChildren} onChange={(v) => onChange({ numberOfChildren: v })} min={0} max={20} />
      </FormQuestionCard>
      <FormConditionalField when={form.maritalStatus === 'MARRIED'}>
        <FormQuestionCard number={11} title="Eşiniz çalışıyor mu?">
          <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.spouseWorking} onChange={(v) => onChange({ spouseWorking: v })} />
          <FormConditionalField when={form.spouseWorking === 'true'}>
            <div className="mt-3">
              <label className="block text-xs text-slate-500 mb-1">Eşinizin Mesleği</label>
              <FormShortText value={form.spouseOccupation} onChange={(v) => onChange({ spouseOccupation: v })} />
            </div>
          </FormConditionalField>
        </FormQuestionCard>
      </FormConditionalField>
    </>
  )
}
