import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import { ArrowLeft, Download, ExternalLink } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { type ReportResult } from '@/components/quality/ReportResultBadge'
import { type CharRow } from '@/components/quality/MeasurementGrid'
import { ReportDetailClient } from '@/components/quality/ReportDetailClient'

function resolveSiteUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://172.16.16.33'
  return raw.replace(/\/+$/, '')
}

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

  // QR + verify URL (yalnızca finalize sonrası)
  let verifyUrl: string | null = null
  let qrDataUrl: string | null = null
  if (isLocked) {
    verifyUrl = `${resolveSiteUrl()}/kalite/verify/${report.qrKey}`
    try {
      qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 256,
        margin: 1,
        errorCorrectionLevel: 'M',
      })
    } catch (e) {
      console.error('[report-detail] QR render failed:', e)
    }
  }

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
      department: c.department,
      inspectionTool: c.inspectionTool,
      sampleFreq: c.sampleFreq,
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

      {isLocked && verifyUrl && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Belge & Doğrulama</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-start gap-5">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Rapor doğrulama QR kodu"
                className="h-32 w-32 rounded border border-slate-200 bg-white p-1"
              />
            ) : (
              <div className="h-32 w-32 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
                QR oluşturulamadı
              </div>
            )}
            <div className="flex-1 space-y-3">
              <p className="text-sm text-slate-600">
                Bu rapor finalize edilmiştir. PDF'i indirip basabilir veya QR kodu paylaşabilirsiniz.
                Doğrulama sayfası raporun gerçekliğini ve sonucunu kamuya açık olarak gösterir.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild className="bg-[#1B4F72] hover:bg-[#1B4F72]/90">
                  <a
                    href={`/api/quality/reports/${report.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-4 w-4 mr-2" /> PDF İndir
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link
                    href={`/kalite/verify/${report.qrKey}`}
                    target="_blank"
                    prefetch={false}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" /> Doğrulama Sayfası
                  </Link>
                </Button>
              </div>
              <div className="text-xs text-slate-500 font-mono break-all">
                {verifyUrl}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
