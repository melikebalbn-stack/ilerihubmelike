'use client'

// PR-JOBAPP-INPUT-FOCUS: Bölüm 4 — Fiziksel Özellikler ve Çalışma Koşulları.
// İK talebi (2026-07): "Hobileriniz" (hobbies) formdan ÇIKARILDI (DB kolonu nullable korunur).
// S1-S7 zorunlu (merkezi şema).

import { FormQuestionCard } from '@/components/forms/multi-step/FormQuestionCard'
import { FormShortText } from '@/components/forms/multi-step/question-types/FormShortText'
import { FormNumberInput } from '@/components/forms/multi-step/FormNumberInput'
import { FormSegmentControl } from '@/components/forms/multi-step/FormSegmentControl'
import { YES_NO_OPTIONS } from '../constants'
import { isRequiredField } from '../required-fields'
import type { SectionProps } from '../types'

export function SectionFizikselCalisma({ form, onChange }: SectionProps) {
  return (
    <>
      <FormQuestionCard number={1} title="Boy (cm)" isRequired={isRequiredField('height')}>
        <FormNumberInput value={form.height} onChange={(v) => onChange({ height: v })} min={100} max={250} />
      </FormQuestionCard>
      <FormQuestionCard number={2} title="Kilo (kg)" isRequired={isRequiredField('weight')}>
        <FormNumberInput value={form.weight} onChange={(v) => onChange({ weight: v })} min={30} max={250} />
      </FormQuestionCard>
      <FormQuestionCard number={3} title="Ayakkabı Numarası" isRequired={isRequiredField('shoeSize')}>
        <FormShortText value={form.shoeSize} onChange={(v) => onChange({ shoeSize: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={4} title="Üst Beden" isRequired={isRequiredField('clothingSizeUpper')}>
        <FormShortText value={form.clothingSizeUpper} onChange={(v) => onChange({ clothingSizeUpper: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={5} title="Alt Beden" isRequired={isRequiredField('clothingSizeLower')}>
        <FormShortText value={form.clothingSizeLower} onChange={(v) => onChange({ clothingSizeLower: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={6} title="Seyahat kısıtınız var mı?" isRequired={isRequiredField('hasTravelRestriction')}>
        <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.hasTravelRestriction} onChange={(v) => onChange({ hasTravelRestriction: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={7} title="Vardiya çalışabilir misiniz?" isRequired={isRequiredField('canWorkShifts')}>
        <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.canWorkShifts} onChange={(v) => onChange({ canWorkShifts: v })} />
      </FormQuestionCard>
    </>
  )
}
