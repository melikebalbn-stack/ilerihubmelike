'use client'

// PR-JOBAPP-INPUT-FOCUS: Bölüm 6 — İş Deneyimi, Akraba, İletişim Tercihi, Referans.

import { FormQuestionCard } from '@/components/forms/multi-step/FormQuestionCard'
import { FormShortText } from '@/components/forms/multi-step/question-types/FormShortText'
import { FormSegmentControl } from '@/components/forms/multi-step/FormSegmentControl'
import { FormCheckboxGroup } from '@/components/forms/multi-step/FormCheckboxGroup'
import { FormRepeatableSection } from '@/components/forms/multi-step/FormRepeatableSection'
import { FormConditionalField } from '@/components/forms/multi-step/FormConditionalField'
import { YES_NO_OPTIONS } from '../constants'
import type { SectionProps, WorkExpRow, ReferenceRow } from '../types'

export function SectionDeneyimReferans({ form, onChange }: SectionProps) {
  return (
    <>
      <FormQuestionCard number={1} title="İş Tecrübeleriniz">
        <FormRepeatableSection<WorkExpRow>
          value={form.workExperience}
          onChange={(v) => onChange({ workExperience: v })}
          emptyRow={{ company: '', position: '', startDate: '', endDate: '', leavingReason: '', lastSalary: '' }}
          renderRow={(row, _idx, onRowChange) => (
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
      </FormQuestionCard>
      <FormQuestionCard number={2} title="Firma bünyesinde akraba/tanıdığınız var mı?">
        <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.hasRelativesInCompany} onChange={(v) => onChange({ hasRelativesInCompany: v })} />
        <FormConditionalField when={form.hasRelativesInCompany === 'true'}>
          <div className="mt-3">
            <label className="block text-xs text-slate-500 mb-1">Adı</label>
            <FormShortText value={form.relativeName} onChange={(v) => onChange({ relativeName: v })} />
          </div>
        </FormConditionalField>
      </FormQuestionCard>
      <FormQuestionCard number={3} title="Size nasıl ulaşabiliriz?">
        <FormCheckboxGroup
          items={[
            { key: 'preferredContactGsm', label: 'Cep telefonundan arayın' },
            { key: 'preferredContactEmail', label: 'E-posta ile yazın' },
          ]}
          value={{
            preferredContactGsm: form.preferredContactGsm,
            preferredContactEmail: form.preferredContactEmail,
          }}
          onChange={(next) =>
            onChange({
              preferredContactGsm: !!next.preferredContactGsm,
              preferredContactEmail: !!next.preferredContactEmail,
            })
          }
        />
        <div className="mt-3">
          <label className="block text-xs text-slate-500 mb-1">Diğer (belirtin)</label>
          <FormShortText value={form.preferredContactOther} onChange={(v) => onChange({ preferredContactOther: v })} />
        </div>
      </FormQuestionCard>
      <FormQuestionCard number={4} title="Son işvereninizle iletişime geçebilir miyiz?">
        <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.canContactLastEmployer} onChange={(v) => onChange({ canContactLastEmployer: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={5} title="Aradığımızda referans verebilecek kişiler">
        <FormRepeatableSection<ReferenceRow>
          value={form.references}
          onChange={(v) => onChange({ references: v })}
          emptyRow={{ name: '', company: '', position: '', phone: '' }}
          renderRow={(row, _idx, onRowChange) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <FormShortText value={row.name} onChange={(v) => onRowChange({ ...row, name: v })} placeholder="Ad Soyad" />
              <FormShortText value={row.company} onChange={(v) => onRowChange({ ...row, company: v })} placeholder="Şirket" />
              <FormShortText value={row.position} onChange={(v) => onRowChange({ ...row, position: v })} placeholder="Pozisyon" />
              <FormShortText value={row.phone} onChange={(v) => onRowChange({ ...row, phone: v })} placeholder="Telefon" />
            </div>
          )}
        />
      </FormQuestionCard>
    </>
  )
}
