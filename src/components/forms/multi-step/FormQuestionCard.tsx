'use client'

// PR-JOBAPP-REDESIGN: Generic soru wrapper (formerly SurveyQuestionCard).
// Büyük gri numara + başlık + helper + alt input.

import { ReactNode } from 'react'

interface Props {
  number: number
  title: string
  isRequired?: boolean
  helperText?: string
  children: ReactNode
}

export function FormQuestionCard({ number, title, isRequired, helperText, children }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="text-3xl font-medium text-slate-300 leading-none mt-0.5 select-none tabular-nums">
          {String(number).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-medium text-slate-900 leading-relaxed">
            {title}
            {isRequired && <span className="text-rose-500 ml-1" aria-label="zorunlu">*</span>}
          </h3>
          {helperText && <p className="mt-1 text-sm text-slate-500">{helperText}</p>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
