'use client'

// PR-JOBAPP-INPUT-FOCUS: Bölüm 2 — İletişim.
// İK talebi (2026-07): "Bakmakla Yükümlü Kişiler" (dependents) ve "İş Telefonu" (workPhone)
// formdan ÇIKARILDI. DB kolonları nullable korunuyor (migration yok) — sadece UI'dan alındı.

import { FormQuestionCard } from '@/components/forms/multi-step/FormQuestionCard'
import { FormShortText } from '@/components/forms/multi-step/question-types/FormShortText'
import { FormLongText } from '@/components/forms/multi-step/question-types/FormLongText'
import { isRequiredField } from '../required-fields'
import type { SectionProps } from '../types'

export function SectionIletisim({ form, onChange }: SectionProps) {
  return (
    <>
      <FormQuestionCard number={1} title="Ev Adresi" isRequired={isRequiredField('homeAddress')}>
        <FormLongText value={form.homeAddress} onChange={(v) => onChange({ homeAddress: v })} rows={3} maxLength={500} />
      </FormQuestionCard>
      <FormQuestionCard number={2} title="Cep Telefonu" isRequired={isRequiredField('mobilePhone')}>
        <FormShortText
          value={form.mobilePhone}
          onChange={(v) => onChange({ mobilePhone: v })}
          placeholder="05XXXXXXXXX"
          inputMode="tel"
          onlyDigits
          maxLength={11}
        />
      </FormQuestionCard>
      <FormQuestionCard number={3} title="E-posta" isRequired={isRequiredField('email')}>
        <FormShortText
          value={form.email}
          onChange={(v) => onChange({ email: v })}
          placeholder="ornek@mail.com"
          inputMode="email"
        />
      </FormQuestionCard>
      <FormQuestionCard number={4} title="Ev Telefonu">
        <FormShortText
          value={form.homePhone}
          onChange={(v) => onChange({ homePhone: v })}
          inputMode="tel"
          onlyDigits
          maxLength={11}
        />
      </FormQuestionCard>
    </>
  )
}
