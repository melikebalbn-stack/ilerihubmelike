'use client'

import { useCallback, useState } from 'react'
import { computeReportResult } from '@/lib/quality/quality-result'
import { ReportResultBadge, type ReportResult } from './ReportResultBadge'
import { MeasurementGrid, type CharRow } from './MeasurementGrid'

export interface ReportSummary {
  id: string
  reportNo: string
  partName: string
  drawingNo: string
  revision: string
  result: ReportResult
  finalizedAt: string | null
}

interface Props {
  report: ReportSummary
  initialCharacteristics: ReadonlyArray<CharRow>
}

/**
 * KALITE-4B Commit 3 — interactive wrapper.
 *   - Üst header badge'i grid değişikliğine göre canlı update
 *   - MeasurementGrid satır result'larını agregate eder
 *   - Finalize state Commit 4'te eklenecek
 */
export function ReportDetailClient({ report, initialCharacteristics }: Props) {
  const [rows, setRows] = useState<CharRow[]>(() => [...initialCharacteristics])
  const isLocked = report.finalizedAt !== null

  const aggregatedResult: ReportResult = computeReportResult(
    rows.map((r) => r.result),
  )

  // Eğer rapor finalize edilmişse server-side persist edilmiş result öncelikli.
  // Aksi halde client aggregator (canlı).
  const displayResult: ReportResult = isLocked ? report.result : aggregatedResult

  const handleCharsChange = useCallback((next: CharRow[]) => {
    setRows(next)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[#1B4F72]">{report.reportNo}</h1>
        <ReportResultBadge result={displayResult} />
      </div>
      <p className="text-sm text-slate-500 -mt-4">
        {report.partName} ({report.drawingNo}-{report.revision})
      </p>

      <MeasurementGrid
        reportId={report.id}
        initialCharacteristics={rows}
        locked={isLocked}
        onCharsChange={handleCharsChange}
      />
    </div>
  )
}
