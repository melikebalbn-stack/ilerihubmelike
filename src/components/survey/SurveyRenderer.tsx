'use client'

// PR-SURVEY-UI-REFACTOR: Multi-step survey orchestrator.
//
// Sorumluluk:
//   - Soruları bölümlere ayır + son adımı (final step) ekle
//   - Tek aktif step state'i (currentStep)
//   - Cevap state'i (answers + otherInputs) — submit kontratıyla aynı şekil
//   - Bölüm geçiş animasyonu (300ms opacity/translate)
//   - Submit endpoint'i çağır (mevcut /api/public/survey/[id]/submit)

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SurveyProgressBar } from './SurveyProgressBar'
import { SurveyQuestionCard } from './SurveyQuestionCard'
import { SurveyFinalStep } from './SurveyFinalStep'
import { SingleChoice } from './question-types/SingleChoice'
import { MultiChoice } from './question-types/MultiChoice'
import { ShortText } from './question-types/ShortText'
import { LongText } from './question-types/LongText'
import { LikertScale } from './question-types/LikertScale'
import { chunkQuestionsBySections, stripQuestionPrefix, type SurveyQuestionLite } from './sections'

interface Survey {
  id: string
  surveyNumber: string
  title: string
  description: string | null
  isAnonymous: boolean
  questions: SurveyQuestionLite[]
}

interface Department {
  id: string
  name: string
}

interface Props {
  survey: Survey
  departments: Department[]
  onSubmitted: () => void
}

type AnswersMap = Record<string, string | string[]>

function isAnswered(value: string | string[] | undefined, others: string[] | undefined): boolean {
  const otherFilled = (others ?? []).some((s) => s.trim().length > 0)
  if (Array.isArray(value)) return value.length > 0 || otherFilled
  if (typeof value === 'string') return value.trim().length > 0
  return otherFilled
}

export function SurveyRenderer({ survey, departments, onSubmitted }: Props) {
  const sections = useMemo(() => chunkQuestionsBySections(survey.questions), [survey.questions])
  const totalSteps = sections.length + 1 // +1 = final step
  const totalQuestions = survey.questions.length

  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<AnswersMap>({})
  const [otherInputs, setOtherInputs] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Final step state
  const [isAnonymous, setIsAnonymous] = useState(true) // default ON
  const [respondentName, setRespondentName] = useState('')
  const [respondentDepartment, setRespondentDepartment] = useState('')

  // Step değişince üste scroll + animasyon trigger
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey((k) => k + 1)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep])

  const isFinalStep = currentStep === sections.length
  const activeSection = !isFinalStep ? sections[currentStep] : null

  const answeredCount = survey.questions.reduce((acc, q) => {
    return isAnswered(answers[q.id], otherInputs[q.id]) ? acc + 1 : acc
  }, 0)

  // Aktif bölümdeki zorunlu soruların hepsi cevaplı mı?
  const canAdvance =
    activeSection?.questions.every((q) => !q.isRequired || isAnswered(answers[q.id], otherInputs[q.id])) ?? true

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleMultiToggle = (questionId: string, optionId: string) => {
    setAnswers((prev) => {
      const cur = (prev[questionId] as string[]) ?? []
      const next = cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId]
      return { ...prev, [questionId]: next }
    })
  }

  const addOther = (questionId: string) => {
    setOtherInputs((prev) => ({ ...prev, [questionId]: [...(prev[questionId] ?? []), ''] }))
  }
  const updateOther = (questionId: string, idx: number, value: string) => {
    setOtherInputs((prev) => ({
      ...prev,
      [questionId]: (prev[questionId] ?? []).map((v, i) => (i === idx ? value : v)),
    }))
  }
  const removeOther = (questionId: string, idx: number) => {
    setOtherInputs((prev) => ({
      ...prev,
      [questionId]: (prev[questionId] ?? []).filter((_, i) => i !== idx),
    }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    // Mevcut kontratla uyumlu payload — others "other:" prefix'iyle eklenir
    const finalAnswers: AnswersMap = { ...answers }
    Object.entries(otherInputs).forEach(([qid, list]) => {
      const non = list.filter((v) => v.trim())
      if (non.length === 0) return
      const cur = (finalAnswers[qid] as string[]) ?? []
      finalAnswers[qid] = [...cur, ...non.map((v) => `other:${v.trim()}`)]
    })

    const sendIdentity = !survey.isAnonymous && !isAnonymous
    const payload = {
      answers: finalAnswers,
      respondentName: sendIdentity ? respondentName.trim() || null : null,
      respondentDepartment: sendIdentity ? respondentDepartment || null : null,
    }

    try {
      const res = await fetch(`/api/public/survey/${survey.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Anket gönderilemedi')
        return
      }
      onSubmitted()
    } catch {
      setError('Anket gönderilirken bir hata oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  const renderQuestionInput = (q: SurveyQuestionLite) => {
    const value = answers[q.id]
    switch (q.questionType) {
      case 'SINGLE_CHOICE':
      case 'YES_NO':
      case 'TRUE_FALSE':
      case 'DROPDOWN':
        return (
          <SingleChoice
            options={q.options}
            value={(value as string) ?? null}
            onChange={(opt) => handleAnswerChange(q.id, opt)}
            disabled={submitting}
          />
        )
      case 'MULTIPLE_CHOICE':
        return (
          <MultiChoice
            options={q.options}
            selected={(value as string[]) ?? []}
            onToggle={(opt) => handleMultiToggle(q.id, opt)}
            others={otherInputs[q.id] ?? []}
            onAddOther={() => addOther(q.id)}
            onUpdateOther={(i, v) => updateOther(q.id, i, v)}
            onRemoveOther={(i) => removeOther(q.id, i)}
            disabled={submitting}
          />
        )
      case 'TEXT_SHORT':
        return (
          <ShortText
            value={(value as string) ?? ''}
            onChange={(v) => handleAnswerChange(q.id, v)}
            disabled={submitting}
          />
        )
      case 'TEXT_LONG':
        return (
          <LongText
            value={(value as string) ?? ''}
            onChange={(v) => handleAnswerChange(q.id, v)}
            disabled={submitting}
          />
        )
      case 'RATING':
      case 'SCALE':
        return (
          <LikertScale
            min={1}
            max={q.questionType === 'SCALE' ? 10 : 5}
            value={(value as string) ?? ''}
            onChange={(v) => handleAnswerChange(q.id, v)}
            disabled={submitting}
          />
        )
      default:
        return (
          <ShortText
            value={(value as string) ?? ''}
            onChange={(v) => handleAnswerChange(q.id, v)}
            disabled={submitting}
          />
        )
    }
  }

  // Aktif bölümdeki sorular — soru numaraları toplam içindeki sırayı yansıtır
  const numberOfQuestion = (qid: string): number => {
    const idx = survey.questions.findIndex((q) => q.id === qid)
    return idx >= 0 ? idx + 1 : 0
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SurveyProgressBar
        current={currentStep}
        total={totalSteps}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
      />

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        {/* Header (yalnız ilk adımda) */}
        {currentStep === 0 && (
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-medium text-slate-900">{survey.title}</h1>
            {survey.description && (
              <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-xl mx-auto">
                {survey.description}
              </p>
            )}
            <p className="mt-3 text-xs text-slate-400 tabular-nums">{survey.surveyNumber}</p>
          </div>
        )}

        {/* Section / Final */}
        <div
          key={animKey}
          className="space-y-4 transition-all duration-300 ease-out animate-[fadeIn_.3s_ease-out]"
        >
          {!isFinalStep && activeSection && (
            <>
              <div>
                <p className="text-xs font-medium tracking-wider text-[#1B4F72] uppercase">
                  Bölüm {currentStep + 1}
                </p>
                <h2 className="mt-1 text-xl font-medium text-slate-900">{activeSection.title}</h2>
              </div>
              {activeSection.questions.map((q) => (
                <SurveyQuestionCard
                  key={q.id}
                  number={numberOfQuestion(q.id)}
                  title={stripQuestionPrefix(q.questionText)}
                  isRequired={q.isRequired}
                >
                  {renderQuestionInput(q)}
                </SurveyQuestionCard>
              ))}
            </>
          )}

          {isFinalStep && (
            <SurveyFinalStep
              surveyIsAnonymous={survey.isAnonymous}
              departments={departments}
              isAnonymous={isAnonymous}
              onAnonymousChange={setIsAnonymous}
              respondentName={respondentName}
              onNameChange={setRespondentName}
              respondentDepartment={respondentDepartment}
              onDepartmentChange={setRespondentDepartment}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Navigation (final step kendi submit butonuna sahip) */}
        {!isFinalStep && (
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0 || submitting}
              className="flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Önceki
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
              disabled={!canAdvance || submitting}
              className="flex items-center gap-1 px-5 py-2.5 bg-[#1B4F72] text-white text-sm font-medium rounded-xl hover:bg-[#1B4F72]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {currentStep === sections.length - 1 ? 'Son adıma geç' : 'Sonraki bölüm'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {isFinalStep && (
          <div className="mt-6 flex justify-start">
            <button
              type="button"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={submitting}
              className="flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Önceki bölüme dön
            </button>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-slate-400">
          ILERI Group · İnsan Varlıkları
        </p>
      </div>

      {/* @keyframes fadeIn — Tailwind arbitrary animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
