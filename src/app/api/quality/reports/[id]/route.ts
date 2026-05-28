import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { ReportPatchSchema } from '@/lib/quality/quality-validators'

export const dynamic = 'force-dynamic'

interface Ctx {
  params: Promise<{ id: string }>
}

/**
 * GET /api/quality/reports/[id]
 *
 * Detay + characteristics. Auth: quality.report.read.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { error } = await requirePermission('quality.report.read')
  if (error) return error

  const { id } = await params
  const rep = await prisma.measurementReport.findUnique({
    where: { id },
    include: {
      characteristics: {
        orderBy: { orderIndex: 'asc' },
        include: { symbol: { select: { id: true, key: true, nameTr: true, svgContent: true } } },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      finalizedBy: { select: { id: true, name: true, email: true } },
    },
  })
  if (!rep) return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 })
  return NextResponse.json({ report: rep })
}

/**
 * PATCH /api/quality/reports/[id]
 *
 * Metadata güncelle (operator, lot, machine, gauge, notes, controllerOpNo).
 * Finalize edilmiş rapor → 400.
 * Auth: quality.report.fill.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { error } = await requirePermission('quality.report.fill')
  if (error) return error

  const { id } = await params
  const existing = await prisma.measurementReport.findUnique({
    where: { id },
    select: { id: true, finalizedAt: true },
  })
  if (!existing) return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 })
  if (existing.finalizedAt) {
    return NextResponse.json(
      { error: 'Rapor finalize edilmiş, güncellenemez' },
      { status: 400 },
    )
  }

  let parsed
  try {
    const json = await request.json()
    parsed = ReportPatchSchema.safeParse(json)
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

  const updated = await prisma.measurementReport.update({
    where: { id },
    data: {
      operatorNo: body.operatorNo,
      lotNo: body.lotNo,
      orderQty: body.orderQty,
      machine: body.machine,
      gaugeNo: body.gaugeNo,
      escalationContact: body.escalationContact,
      measurementDate: body.measurementDate ? new Date(body.measurementDate) : undefined,
      notes: body.notes,
      controllerOpNo: body.controllerOpNo,
    },
  })

  return NextResponse.json({ report: updated })
}

/**
 * DELETE /api/quality/reports/[id]
 *
 * Sadece PENDING raporlar silinebilir. Finalize edilmiş → 400.
 * Auth: quality.report.create.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { error } = await requirePermission('quality.report.create')
  if (error) return error

  const { id } = await params
  const existing = await prisma.measurementReport.findUnique({
    where: { id },
    select: { id: true, finalizedAt: true, result: true },
  })
  if (!existing) return NextResponse.json({ error: 'Rapor bulunamadı' }, { status: 404 })
  if (existing.finalizedAt || existing.result !== 'PENDING') {
    return NextResponse.json(
      { error: 'Finalize edilmiş rapor silinemez' },
      { status: 400 },
    )
  }

  // Cascade ile MeasurementReportChar'lar otomatik silinir
  await prisma.measurementReport.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
