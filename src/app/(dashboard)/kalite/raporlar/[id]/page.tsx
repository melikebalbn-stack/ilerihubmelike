import { notFound, redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
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
      template: { select: { department: true } },
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
    <ReportDetailClient
      report={{
        id: report.id,
        reportNo: report.reportNo,
        formNo: report.formNo,
        partName: report.partName,
        drawingNo: report.drawingNo,
        revision: report.revision,
        templateDepartment: report.template?.department ?? null,
        lotNo: report.lotNo,
        operatorNo: report.operatorNo,
        orderQty: report.orderQty,
        machine: report.machine,
        gaugeNo: report.gaugeNo,
        escalationContact: report.escalationContact,
        measurementDate: report.measurementDate.toISOString(),
        notes: report.notes,
        controllerOpNo: report.controllerOpNo,
        qrKey: report.qrKey,
        result: report.result as ReportResult,
        finalizedAt: report.finalizedAt ? report.finalizedAt.toISOString() : null,
      }}
      initialCharacteristics={chars}
      canFinalize={canFinalize}
      verifyUrl={verifyUrl}
      qrDataUrl={qrDataUrl}
    />
  )
}
