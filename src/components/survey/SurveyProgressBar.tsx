'use client'

// PR-SURVEY-UI-REFACTOR: Sticky üst progress bar.
// Bölüm sayacı + yüzde + doldurma çubuğu.

interface Props {
  current: number // 0-indexli aktif bölüm
  total: number // toplam bölüm sayısı (final dahil)
  answeredCount: number
  totalQuestions: number
}

export function SurveyProgressBar({ current, total, answeredCount, totalQuestions }: Props) {
  const stepPct = total > 0 ? Math.round(((current + 1) / total) * 100) : 0
  const answerPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0

  return (
    <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-500">
            Bölüm <span className="font-medium text-slate-900">{Math.min(current + 1, total)}</span>
            <span className="text-slate-400"> / {total}</span>
          </span>
          <span className="text-slate-500">
            <span className="font-medium text-[#1B4F72]">{answeredCount}</span>
            <span className="text-slate-400"> / {totalQuestions} cevap ({answerPct}%)</span>
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1B4F72] transition-all duration-300 ease-out"
            style={{ width: `${stepPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
