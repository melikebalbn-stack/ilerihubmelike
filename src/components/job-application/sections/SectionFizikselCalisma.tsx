'use client'

// PR-JOBAPP-INPUT-FOCUS: Bölüm 4 — Fiziksel Özellikler ve Çalışma Koşulları.

import { FormQuestionCard } from '@/components/forms/multi-step/FormQuestionCard'
import { FormShortText } from '@/components/forms/multi-step/question-types/FormShortText'
import { FormLongText } from '@/components/forms/multi-step/question-types/FormLongText'
import { FormNumberInput } from '@/components/forms/multi-step/FormNumberInput'
import { FormSegmentControl } from '@/components/forms/multi-step/FormSegmentControl'
import { YES_NO_OPTIONS } from '../constants'
import type { SectionProps } from '../types'

export function SectionFizikselCalisma({ form, onChange }: SectionProps) {
  return (
    <>
      <FormQuestionCard number={1} title="Boy (cm)">
        <FormNumberInput value={form.height} onChange={(v) => onChange({ height: v })} min={100} max={250} />
      </FormQuestionCard>
      <FormQuestionCard number={2} title="Kilo (kg)">
        <FormNumberInput value={form.weight} onChange={(v) => onChange({ weight: v })} min={30} max={250} />
      </FormQuestionCard>
      <FormQuestionCard number={3} title="Ayakkabı Numarası">
        <FormShortText value={form.shoeSize} onChange={(v) => onChange({ shoeSize: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={4} title="Üst Beden">
        <FormShortText value={form.clothingSizeUpper} onChange={(v) => onChange({ clothingSizeUpper: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={5} title="Alt Beden">
        <FormShortText value={form.clothingSizeLower} onChange={(v) => onChange({ clothingSizeLower: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={6} title="Seyahat kısıtınız var mı?">
        <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.hasTravelRestriction} onChange={(v) => onChange({ hasTravelRestriction: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={7} title="Vardiya çalışabilir misiniz?">
        <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.canWorkShifts} onChange={(v) => onChange({ canWorkShifts: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={8} title="Hobileriniz">
        <FormLongText value={form.hobbies} onChange={(v) => onChange({ hobbies: v })} rows={2} maxLength={500} />
      </FormQuestionCard>
    </>
  )
}
