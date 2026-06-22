import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { getOrCreateReportPdfBuffer } from '@/lib/quality/report-pdf-cache'
import {
  sendMeasurementReportEmail,
  type EmailRecipient,
  type MeasurementReportEmailData,
} from '@/lib/email'
import { type ReportResult } from '@/components/quality/ReportResultBadge'

export const dynamic = 'force-dynamic'

const EmailBodySchema = z.object({
  recipients: z
    .array(z.string().trim().email({ message: 'Geçersiz e-posta' }))
    .min(1, 'En az 1 alıcı zorunlu')
    .max(20, 'En fazla 20 alıcı'),
  note: z.string().trim().max(2000).optional(),
})

function resolveSiteUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://172.16.16.33'
  return raw.replace(/\/+$/, '')
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission('quality.report.fill')
  if (error) return error

  const { id } = await params

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }

  const parsed = EmailBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Geçersiz girdi', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const report = await prisma.measurementReport.findUnique({
    where: { id },
    select: {
      id: true,
      reportNo: true,
      partName: true,
      drawingNo: true,
      revision: true,
      lotNo: true,
      result: true,
      finalizedAt: true,
      qrKey: true,
    },
  })
  if (!report) {
    return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 })
  }
  if (!report.finalizedAt) {
    return NextResponse.json(
      { error: 'Yalnızca finalize edilmiş raporlar mail ile gönderilebilir' },
      { status: 400 },
    )
  }

  let pdfBuffer: Buffer
  try {
    const cached = await getOrCreateReportPdfBuffer(id)
    pdfBuffer = cached.buffer
  } catch (e) {
    console.error('[quality-report-email] PDF üretimi başarısız:', e)
    return NextResponse.json(
      { error: 'PDF üretimi başarısız — mail gönderilemedi' },
      { status: 500 },
    )
  }

  const recipients: EmailRecipient[] = parsed.data.recipients.map((email) => ({
    email,
    name: email, // ad alanı yok; alıcı email'i kendi adı olarak kullan
  }))

  const data: MeasurementReportEmailData = {
    reportNo: report.reportNo,
    partName: report.partName,
    drawingNo: report.drawingNo,
    revision: report.revision,
    lotNo: report.lotNo,
    result: report.result as ReportResult,
    finalizedAt: report.finalizedAt,
    verifyUrl: `${resolveSiteUrl()}/kalite/verify/${report.qrKey}`,
    note: parsed.data.note ?? null,
  }

  const result = await sendMeasurementReportEmail(data, recipients, pdfBuffer)

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Mail gönderimi başarısız' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, recipients: recipients.length })
}
