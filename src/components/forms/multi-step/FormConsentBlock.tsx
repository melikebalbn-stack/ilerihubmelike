'use client'

// PR-JOBAPP-RENDERER: KVKK beyan metni + checkbox + signature pad.
// Submit zorunlu alan grubu — checkbox işaretli + signature dolu olmalı.

import { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { FormSignaturePad } from './FormSignaturePad'

interface Props {
  declarationText: string
  declarationAccepted: boolean
  onDeclarationChange: (v: boolean) => void
  signatureDataUrl: string
  onSignatureChange: (dataUrl: string) => void
  onSigned?: (dateStr: string) => void
  disabled?: boolean
  helper?: ReactNode
}

export function FormConsentBlock({
  declarationText,
  declarationAccepted,
  onDeclarationChange,
  signatureDataUrl,
  onSignatureChange,
  onSigned,
  disabled,
  helper,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-line max-h-72 overflow-y-auto">
        {declarationText}
      </div>

      <button
        type="button"
        onClick={() => onDeclarationChange(!declarationAccepted)}
        disabled={disabled}
        className={
          'w-full flex items-start gap-3 p-3 rounded-xl border transition-all duration-150 active:scale-[0.99] text-left ' +
          (declarationAccepted
            ? 'border-[#1B4F72] bg-[#1B4F72]/[0.06]'
            : 'border-slate-200 bg-white hover:border-[#1B4F72]/60')
        }
      >
        <span
          className={
            'flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ' +
            (declarationAccepted ? 'border-[#1B4F72] bg-[#1B4F72]' : 'border-slate-300')
          }
        >
          {declarationAccepted && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </span>
        <span className="text-sm text-slate-900">
          Yukarıdaki beyanı okudum, anladım ve kabul ediyorum.
          <span className="text-rose-500 ml-1">*</span>
        </span>
      </button>

      {declarationAccepted && (
        <div className="pt-2">
          <p className="text-sm font-medium text-slate-700 mb-2">
            İmza <span className="text-rose-500">*</span>
          </p>
          <FormSignaturePad
            value={signatureDataUrl}
            onChange={(url) => {
              onSignatureChange(url)
              if (url && onSigned) {
                const now = new Date()
                onSigned(now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR'))
              }
            }}
            disabled={disabled}
          />
        </div>
      )}

      {helper}
    </div>
  )
}
