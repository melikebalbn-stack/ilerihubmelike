'use client'

// PR-JOBAPP-INPUT-FOCUS: Bölüm 5 — İş Tercihleri, Eğitim, Yetkinlikler.

import { FormQuestionCard } from '@/components/forms/multi-step/FormQuestionCard'
import { FormShortText } from '@/components/forms/multi-step/question-types/FormShortText'
import { FormDateInput } from '@/components/forms/multi-step/FormDateInput'
import { FormNumberInput } from '@/components/forms/multi-step/FormNumberInput'
import { FormSegmentControl } from '@/components/forms/multi-step/FormSegmentControl'
import { FormRepeatableSection } from '@/components/forms/multi-step/FormRepeatableSection'
import { FormFixedKeyRecord } from '@/components/forms/multi-step/FormFixedKeyRecord'
import {
  EDUCATION_LEVEL_OPTIONS,
  LANGUAGE_LEVEL_OPTIONS,
  COMPUTER_LEVEL_OPTIONS,
  YES_NO_OPTIONS,
  EDUCATION_HISTORY_KEYS,
} from '../constants'
import type { SectionProps, EducationEntry, CourseRow, LanguageRow, ComputerRow } from '../types'

export function SectionTercihEgitim({ form, onChange }: SectionProps) {
  return (
    <>
      <FormQuestionCard number={1} title="Başlayabileceğiniz tarih">
        <FormDateInput value={form.availableStartDate} onChange={(v) => onChange({ availableStartDate: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={2} title="Maaş Beklentisi (₺)">
        <FormNumberInput value={form.expectedSalary} onChange={(v) => onChange({ expectedSalary: v })} min={0} step={500} />
      </FormQuestionCard>
      <FormQuestionCard number={3} title="Başvurulan Pozisyon">
        <FormShortText value={form.requestedPosition} onChange={(v) => onChange({ requestedPosition: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={4} title="Daha önce şirketimizde çalıştınız mı?">
        <FormSegmentControl options={YES_NO_OPTIONS as unknown as { value: string; label: string }[]} value={form.previouslyWorkedHere} onChange={(v) => onChange({ previouslyWorkedHere: v })} />
      </FormQuestionCard>
      <FormQuestionCard number={5} title="Eğitim Seviyesi">
        <FormSegmentControl options={EDUCATION_LEVEL_OPTIONS as unknown as { value: string; label: string }[]} value={form.educationLevel} onChange={(v) => onChange({ educationLevel: v })} mobileColumns={1} />
      </FormQuestionCard>
      <FormQuestionCard number={6} title="Eğitim Geçmişi" helperText="İlgili olan kademeleri doldurun, boş bırakabilirsiniz.">
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
          onChange={(v) => onChange({ educationHistory: v as Record<string, EducationEntry> })}
        />
      </FormQuestionCard>
      <FormQuestionCard number={7} title="Staj, Kurs ve Seminerler">
        <FormRepeatableSection<CourseRow>
          value={form.coursesAndSeminars}
          onChange={(v) => onChange({ coursesAndSeminars: v })}
          emptyRow={{ institution: '', subject: '', duration: '', attendanceDate: '' }}
          renderRow={(row, _idx, onRowChange) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <FormShortText value={row.institution} onChange={(v) => onRowChange({ ...row, institution: v })} placeholder="Kurum" />
              <FormShortText value={row.subject} onChange={(v) => onRowChange({ ...row, subject: v })} placeholder="Konu" />
              <FormShortText value={row.duration} onChange={(v) => onRowChange({ ...row, duration: v })} placeholder="Süre" />
              <FormShortText value={row.attendanceDate} onChange={(v) => onRowChange({ ...row, attendanceDate: v })} placeholder="Yıl (örn. 2022)" />
            </div>
          )}
        />
      </FormQuestionCard>
      <FormQuestionCard number={8} title="Yabancı Dil Bilgisi">
        <FormRepeatableSection<LanguageRow>
          value={form.foreignLanguages}
          onChange={(v) => onChange({ foreignLanguages: v })}
          emptyRow={{ language: '', reading: '', writing: '', speaking: '', learnedAt: '' }}
          renderRow={(row, _idx, onRowChange) => (
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
      </FormQuestionCard>
      <FormQuestionCard number={9} title="Bilgisayar Bilgisi">
        <FormRepeatableSection<ComputerRow>
          value={form.computerSkills}
          onChange={(v) => onChange({ computerSkills: v })}
          emptyRow={{ program: '', level: '', learnedAt: '' }}
          renderRow={(row, _idx, onRowChange) => (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <FormShortText value={row.program} onChange={(v) => onRowChange({ ...row, program: v })} placeholder="Program (Örn. Excel)" />
              <FormSegmentControl options={COMPUTER_LEVEL_OPTIONS as unknown as { value: string; label: string }[]} value={row.level} onChange={(v) => onRowChange({ ...row, level: v })} mobileColumns={2} />
              <FormShortText value={row.learnedAt} onChange={(v) => onRowChange({ ...row, learnedAt: v })} placeholder="Nerede öğrendiniz?" />
            </div>
          )}
        />
      </FormQuestionCard>
    </>
  )
}
