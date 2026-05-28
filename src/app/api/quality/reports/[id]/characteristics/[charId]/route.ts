import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { CharUpdateSchema } from '@/lib/quality/quality-validators'
import { computeCharResult } from '@/lib/quality/quality-result'

export const dynamic = 'force-dynamic'

interface Ctx {
  params: Promise<{ id: string; charId: string }>
}

/**
 * PATCH /api/quality/reports/[id]/characteristics/[charId]
 *
 * Bir satırın measurements'ı güncellenir. Server-side computeCharResult
 * çağrılır — client'ın result'ı override edilir.
 * Finalize edilmiş raporda 400.
 * Auth: quality.report.fill.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { error } = await requirePermission('quality.report.fill')
  if (error) return error

  const { id, charId } = await params

  const report = await prisma.measurementReport.findUnique({
    where: { id },
    select: { id: true, finalizedAt: true },
  })
  if (!report) return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 })
  if (report.finalizedAt) {
    return NextResponse.json(
      { error: 'Rapor finalize edilmiş, güncellenemez' },
      { status: 400 },
    )
  }

  const charRow = await prisma.measurementReportChar.findUnique({
    where: { id: charId },
    select: {
      id: true,
      reportId: true,
      maxValue: true,
      minValue: true,
      hasNumericRange: true,
    },
  })
  if (!charRow || charRow.reportId !== id) {
    return NextResponse.json({ error: 'Karakteristik bulunamadı' }, { status: 404 })
  }

  let parsed
  try {
    const json = await request.json()
    parsed = CharUpdateSchema.safeParse(json)
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 })
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation hatası', detail: parsed.error.format() },
      { status: 400 },
    )
  }
  const body = parsed.data

  // Normalize: "" → null, "34,5" → "34.5"
  const normalized = body.measurements.map((m) =>
    m === null || m === '' ? null : (m as string).replace(',', '.'),
  )

  const newResult = computeCharResult(
    normalized,
    charRow.maxValue ? charRow.maxValue.toString() : null,
    charRow.minValue ? charRow.minValue.toString() : null,
    charRow.hasNumericRange,
  )

  const updated = await prisma.measurementReportChar.update({
    where: { id: charId },
    data: {
      measurements: normalized,
      result: newResult,
    },
  })

  return NextResponse.json({ characteristic: updated })
}
