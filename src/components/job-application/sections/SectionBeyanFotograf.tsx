'use client'

// PR-JOBAPP-INPUT-FOCUS: Bölüm 7 — Beyan ve Fotoğraf.
// İK talebi (2026-07): Fotoğraf ARTIK ZORUNLU (kamera öncelikli; galeri fallback FormImageUpload'da).

import { FormQuestionCard } from '@/components/forms/multi-step/FormQuestionCard'
import { FormImageUpload } from '@/components/forms/multi-step/FormImageUpload'
import { FormConsentBlock } from '@/components/forms/multi-step/FormConsentBlock'
import { DECLARATION_TEXT } from '../constants'
import { isRequiredField } from '../required-fields'
import type { SectionProps } from '../types'

export function SectionBeyanFotograf({ form, onChange }: SectionProps) {
  return (
    <>
      <FormQuestionCard number={1} title="Fotoğrafınız" isRequired={isRequiredField('photo')} helperText="Kameradan çekin (öneri) veya dosyadan seçin. JPG / PNG, maks. 5 MB.">
        <FormImageUpload
          value={form.photo}
          onChange={(f) => onChange({ photo: f })}
          maxSizeMB={5}
        />
      </FormQuestionCard>
      <FormQuestionCard number={2} title="Beyan" isRequired={isRequiredField('declaration')}>
        <FormConsentBlock
          declarationText={DECLARATION_TEXT}
          declarationAccepted={form.declarationAccepted}
          onDeclarationChange={(v) => onChange({ declarationAccepted: v })}
          signatureDataUrl={form.digitalSignature}
          onSignatureChange={(url) => onChange({ digitalSignature: url })}
          onSigned={(dateStr) => onChange({ signatureDate: dateStr })}
        />
      </FormQuestionCard>
    </>
  )
}
