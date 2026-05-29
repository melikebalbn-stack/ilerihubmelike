import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { getOrCreateReportPdfBuffer } from '@/lib/quality/report-pdf-cache'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission('quality.report.read')
  if (error) return error

  const { id } = await params

  const report = await prisma.measurementReport.findUnique({
    where: { id },
    select: { id: true, finalizedAt: true },
  })

  if (!report) {
    return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 })
  }
  if (!report.finalizedAt) {
    return NextResponse.json(
      { error: 'Rapor henüz finalize edilmedi' },
      { status: 400 },
    )
  }

  const { buffer, filename } = await getOrCreateReportPdfBuffer(id)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-cache',
    },
  })
}
