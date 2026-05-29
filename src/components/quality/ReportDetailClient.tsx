'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
  /** quality.report.fill permission var mı (page server'da check edilip pass edilir) */
  canFinalize?: boolean
}

export function ReportDetailClient({
  report,
  initialCharacteristics,
  canFinalize = false,
}: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<CharRow[]>(() => [...initialCharacteristics])
  const [finalizedAt, setFinalizedAt] = useState<string | null>(report.finalizedAt)
  const [serverResult, setServerResult] = useState<ReportResult>(report.result)
  const [finalizing, setFinalizing] = useState(false)

  const isLocked = finalizedAt !== null

  const aggregatedResult: ReportResult = computeReportResult(
    rows.map((r) => r.result),
  )

  // Finalize edilmişse server-side persist edilmiş result kanonik.
  // Aksi halde client aggregator (canlı).
  const displayResult: ReportResult = isLocked ? serverResult : aggregatedResult

  const handleCharsChange = useCallback((next: CharRow[]) => {
    setRows(next)
  }, [])

  const allFilled = rows.every((r) => {
    if (!r.hasNumericRange) return true
    return r.measurements.every((m) => m !== null && m !== '')
  })

  const hasPending = rows.some((r) => r.result === 'PENDING')

  async function handleFinalize() {
    setFinalizing(true)
    try {
      const res = await fetch(`/api/quality/reports/${report.id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Finalize başarısız')

      // Response: { report: { result, finalizedAt, ... } }
      const finalized = json.report
      if (finalized) {
        setServerResult(finalized.result as ReportResult)
        setFinalizedAt(finalized.finalizedAt)
      }
      toast.success('Rapor finalize edildi')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Finalize başarısız')
    } finally {
      setFinalizing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#1B4F72]">{report.reportNo}</h1>
            <ReportResultBadge result={displayResult} />
            {isLocked && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Lock className="h-3 w-3" />
                Finalize edildi
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {report.partName} ({report.drawingNo}-{report.revision})
          </p>
        </div>

        {canFinalize && !isLocked && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={finalizing}
                className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
              >
                {finalizing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Raporu Finalize Et
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Raporu finalize et?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm">
                    <p>
                      Finalize sonrası ölçüm hücreleri ve metadata{' '}
                      <strong>değiştirilemez</strong>. Rapor sonucu kanonik olarak
                      DB'ye yazılır.
                    </p>
                    {!allFilled && (
                      <p className="text-amber-700">
                        ⚠ Bazı satırlarda tüm 10 ölçüm dolu değil — finalize sonrası
                        boş kalan slotlar düzeltilemez.
                      </p>
                    )}
                    {hasPending && (
                      <p className="text-amber-700">
                        ⚠ Bazı karakterler{' '}
                        <span className="font-semibold">Bekliyor</span> durumunda —
                        rapor sonucu <strong>Bekliyor</strong> olarak finalize
                        edilebilir.
                      </p>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <AlertDialogAction onClick={handleFinalize}>
                  Evet, finalize et
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <MeasurementGrid
        reportId={report.id}
        initialCharacteristics={rows}
        locked={isLocked}
        onCharsChange={handleCharsChange}
      />
    </div>
  )
}
