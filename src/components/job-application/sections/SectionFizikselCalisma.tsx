'use client'

// PR-JOBAPP-INPUT-FOCUS: Bölüm 4 — Fiziksel Özellikler ve Çalışma Koşulları.
// İK talebi (2026-07): "Hobileriniz" (hobbies) formdan ÇIKARILDI (DB kolonu nullable korunur).
// S1-S7 zorunlu (merkezi şema).
//
// 2026-08: beden alanları serbest metinden SEÇİME çevrildi. Değerler TEK KAYNAK
// src/lib/envanter/beden-referans.ts'ten IMPORT edilir (dizi kopyalanmaz) — envanter
// beden profiliyle aynı ölçek kullanılsın diye. Serbest metinde "L" ile "34" aynı
// sütuna karışıyordu (alt beden alanında hem üst-beden hem alt-beden ölçeği görülmüştü).

import { useEffect } from 'react'
import { FormQuestionCard } from '@/components/forms/multi-step/FormQuestionCard'
import { FormNumberInput } from '@/components/forms/multi-step/FormNumberInput'
import { FormSegmentControl } from '@/components/forms/multi-step/FormSegmentControl'
import {
  UST_BEDENLER,
  AYAKKABI_NOLARI,
  altBedenSecenekleri,
} from '@/lib/envanter/beden-referans'
import { YES_NO_OPTIONS } from '../constants'
import { isRequiredField } from '../required-fields'
import type { SectionProps } from '../types'

const SELECT_CLS =
  'w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:border-[#1B4F72] focus:ring-0 outline-none transition-colors disabled:bg-slate-100 disabled:text-slate-400'

function BedenSelect({
  value,
  onChange,
  options,
  disabled,
  placeholder = 'Seçiniz',
}: {
  value: string
  onChange: (v: string) => void
  options: readonly string[]
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={SELECT_CLS}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

export function SectionFizikselCalisma({ form, onChange }: SectionProps) {
  // Alt beden seçenekleri CİNSİYETE bağlı (beden-referans.ts: MALE 44..60, FEMALE 34..54-56).
  const cinsiyetSecili = form.gender === 'MALE' || form.gender === 'FEMALE'
  const altSecenekler = cinsiyetSecili
    ? altBedenSecenekleri(form.gender as 'MALE' | 'FEMALE')
    : []

  // Cinsiyet sonradan değişirse, seçili alt beden yeni listede yoksa TEMİZLE —
  // aksi halde formda görünmeyen ama gönderilen bir değer kalırdı.
  useEffect(() => {
    if (!form.clothingSizeLower) return
    if (!cinsiyetSecili || !altSecenekler.includes(form.clothingSizeLower)) {
      onChange({ clothingSizeLower: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.gender])

  return (
    <>
      <FormQuestionCard number={1} title="Boy (cm)" isRequired={isRequiredField('height')}>
        <FormNumberInput value={form.height} onChange={(v) => onChange({ height: v })} min={100} max={250} />
      </FormQuestionCard>
      <FormQuestionCard number={2} title="Kilo (kg)" isRequired={isRequiredField('weight')}>
        <FormNumberInput value={form.weight} onChange={(v) => onChange({ weight: v })} min={30} max={250} />
      </FormQuestionCard>
      <FormQuestionCard number={3} title="Ayakkabı Numarası" isRequired={isRequiredField('shoeSize')}>
        <BedenSelect
          value={form.shoeSize}
          onChange={(v) => onChange({ shoeSize: v })}
          options={AYAKKABI_NOLARI}
        />
      </FormQuestionCard>
      <FormQuestionCard number={4} title="Üst Beden" isRequired={isRequiredField('clothingSizeUpper')}>
        <BedenSelect
          value={form.clothingSizeUpper}
          onChange={(v) => onChange({ clothingSizeUpper: v })}
          options={UST_BEDENLER}
        />
      </FormQuestionCard>
      <FormQuestionCard number={5} title="Alt Beden" isRequired={isRequiredField('clothingSizeLower')}>
        <BedenSelect
          value={form.clothingSizeLower}
          onChange={(v) => onChange({ clothingSizeLower: v })}
          options={altSecenekler}
          disabled={!cinsiyetSecili}
          placeholder={cinsiyetSecili ? 'Seçiniz' : 'Önce cinsiyet seçiniz'}
        />
        {!cinsiyetSecili && (
          <p className="mt-1 text-xs text-slate-500">
            Alt beden ölçeği cinsiyete göre değişir — 1. bölümdeki “Cinsiyet” alanını doldurun.
          </p>
        )}
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
