import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { type ReportResult } from '@/components/quality/ReportResultBadge'
import { type CharRow } from '@/components/quality/MeasurementGrid'
import { ReportDetailClient } from '@/components/quality/ReportDetailClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReportDetailPage({ params }: Props) {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission('quality.report.read'))) redirect('/dashboard')

  const canFinalize = await hasPermission('quality.report.fill')

  const { id } = await params
  const report = await prisma.measurementReport.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      finalizedBy: { select: { id: true, name: true, email: true } },
      characteristics: {
        orderBy: { orderIndex: 'asc' },
        include: {
          symbol: { select: { id: true, key: true, nameTr: true, svgContent: true } },
        },
      },
    },
  })
  if (!report) notFound()

  const fmt = (d: Date | null) =>
    d ? new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '—'

  const isLocked = report.finalizedAt !== null

  // Decimal → string normalize (client'a hep string)
  const chars: CharRow[] = report.characteristics.map((c) => {
    const raw = Array.isArray(c.measurements) ? c.measurements : []
    const measurements: (string | null)[] = Array.from({ length: 10 }, (_, i) => {
      const v = raw[i]
      if (v === null || v === undefined || v === '') return null
      return String(v)
    })
    return {
      id: c.id,
      orderIndex: c.orderIndex,
      charName: c.charName,
      critical: c.critical,
      symbol: c.symbol
        ? {
            id: c.symbol.id,
            key: c.symbol.key,
            nameTr: c.symbol.nameTr,
            svgContent: c.symbol.svgContent,
          }
        : null,
      nominal: c.nominal !== null ? c.nominal.toString() : null,
      maxValue: c.maxValue !== null ? c.maxValue.toString() : null,
      minValue: c.minValue !== null ? c.minValue.toString() : null,
      hasNumericRange: c.hasNumericRange,
      measurements,
      result: c.result as ReportResult,
    }
  })

  return (
    <div className="container mx-auto px-6 py-8 max-w-[1400px] space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-slate-500">
          <Link href="/kalite/raporlar">
            <ArrowLeft className="h-4 w-4 mr-1" /> Raporlar
          </Link>
        </Button>
      </div>

      <ReportDetailClient
        report={{
          id: report.id,
          reportNo: report.reportNo,
          partName: report.partName,
          drawingNo: report.drawingNo,
          revision: report.revision,
          result: report.result as ReportResult,
          finalizedAt: report.finalizedAt ? report.finalizedAt.toISOString() : null,
        }}
        initialCharacteristics={chars}
        canFinalize={canFinalize}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rapor Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Form No</dt>
              <dd className="font-mono mt-0.5">{report.formNo}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Lot No</dt>
              <dd className="font-mono mt-0.5">{report.lotNo ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Operatör</dt>
              <dd className="font-mono mt-0.5">{report.operatorNo ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Adet</dt>
              <dd className="tabular-nums mt-0.5">{report.orderQty ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Makina</dt>
              <dd className="mt-0.5">{report.machine ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Mastar No</dt>
              <dd className="font-mono mt-0.5">{report.gaugeNo ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Ölçüm Tarihi</dt>
              <dd className="mt-0.5">{fmt(report.measurementDate)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Finalize</dt>
              <dd className="mt-0.5">{fmt(report.finalizedAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {report.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notlar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
