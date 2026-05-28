import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { computeReportResult, type CharResult } from '@/lib/quality/quality-result'

export const dynamic = 'force-dynamic'

interface Ctx {
  params: Promise<{ id: string }>
}

/**
 * POST /api/quality/reports/[id]/finalize
 *
 * Raporu finalize eder:
 *   - Tüm karakteristik result'larını topla → computeReportResult
 *   - MeasurementReport.result + finalizedAt + finalizedById set
 *   - Tekrar finalize edilmiş raporu finalize etmek → 400
 *   - Hiç PENDING karakter varsa rapor sonucu PENDING; istemci sahnedeki
 *     uyarıyı kendisi gösterir, server yine de finalize eder
 *     (audit için anlık fotoğraf), ama belki kullanıcı kararına bırakmak
 *     daha mantıklı — şimdilik finalize'a izin veriyoruz, computeReportResult
 *     PENDING dönerse rapor PENDING olarak kalır
 *
 * Auth: quality.report.fill.
 *
 * PDF/QR generation YOK (KALITE-5'te eklenecek).
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requirePermission('quality.report.fill')
  if (error) return error

  const { id } = await params

  const report = await prisma.measurementReport.findUnique({
    where: { id },
    select: {
      id: true,
      finalizedAt: true,
      characteristics: {
        select: { result: true },
      },
    },
  })
  if (!report) return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 })
  if (report.finalizedAt) {
    return NextResponse.json(
      { error: 'Rapor zaten finalize edilmiş' },
      { status: 400 },
    )
  }
  if (report.characteristics.length === 0) {
    return NextResponse.json(
      { error: 'Karakteristik yok, finalize edilemez' },
      { status: 400 },
    )
  }

  const finalResult = computeReportResult(
    report.characteristics.map((c) => c.result as CharResult),
  )

  const updated = await prisma.measurementReport.update({
    where: { id },
    data: {
      result: finalResult,
      finalizedAt: new Date(),
      finalizedById: session.user.id,
    },
  })

  return NextResponse.json({
    report: {
      id: updated.id,
      reportNo: updated.reportNo,
      result: updated.result,
      finalizedAt: updated.finalizedAt,
      finalizedById: updated.finalizedById,
    },
  })
}
