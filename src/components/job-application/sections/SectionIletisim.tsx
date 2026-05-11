'use client'

// PR-JOBAPP-INPUT-FOCUS: Bölüm 2 — İletişim.

import { FormQuestionCard } from '@/components/forms/multi-step/FormQuestionCard'
import { FormShortText } from '@/components/forms/multi-step/question-types/FormShortText'
import { FormLongText } from '@/components/forms/multi-step/question-types/FormLongText'
import type { SectionProps } from '../types'

export function SectionIletisim({ form, onChange }: SectionProps) {
  return (
    <>
      <FormQuestionCard number={1} title="Ev Adresi">
        <FormLongText value={form.homeAddress} onChange={(v) => onChange({ homeAddress: v })} rows={3} maxLength={500} />
      </FormQuestionCard>
      <FormQuestionCard number={2} title="Yanınızda Bakmakla Yükümlü Olduğunuz Kişiler">
        <FormLongText value={form.dependents} onChange={(v) => onChange({ dependents: v })} rows={2} maxLength={300} />
      </FormQuestionCard>
      <FormQuestionCard number={3} title="Cep Telefonu">
        <FormShortText value={form.mobilePhone} onChange={(v) => onChange({ mobilePhone: v })} placeholder="05XX XXX XX XX" />
      </FormQuestionCard>
      <FormQuestionCard number={4} title="E-posta">
        <FormShortText value={form.email} onChange={(v) => onChange({ email: v })} placeholder="ornek@mail.com" />
      </FormQuestionCard>
      <FormQuestionCard number={5} title="İş Telefonu">
        <FormShortText value={form.workPhone} onChange={(v) => onChange({ workPhone: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={6} title="Ev Telefonu">
        <FormShortText value={form.homePhone} onChange={(v) => onChange({ homePhone: v })} />
      </FormQuestionCard>
    </>
  )
}
