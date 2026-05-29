import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { ReportCreateSchema } from '@/lib/quality/quality-validators'
import { generateNextReportNo } from '@/lib/quality/quality-report-no'
import { Prisma } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quality/reports
 *
 * Filter: templateId, lotNo (exact), result (PENDING|OK|RED), drawingNo,
 *         from (ISO date), to (ISO date), page, limit.
 * Auth: quality.report.read.
 */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('quality.report.read')
  if (error) return error

  const { searchParams } = new URL(request.url)
  const templateId = searchParams.get('templateId')?.trim()
  const lotNo = searchParams.get('lotNo')?.trim()
  const resultParam = searchParams.get('result')?.trim()
  const drawingNo = searchParams.get('drawingNo')?.trim()
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

  const where: Prisma.MeasurementReportWhereInput = {}
  if (templateId) where.templateId = templateId
  if (lotNo) where.lotNo = lotNo
  if (drawingNo) where.drawingNo = drawingNo
  if (resultParam === 'PENDING' || resultParam === 'OK' || resultParam === 'RED') {
    where.result = resultParam
  }
  if (from || to) {
    where.measurementDate = {}
    if (from) (where.measurementDate as Prisma.DateTimeFilter).gte = new Date(from)
    if (to) (where.measurementDate as Prisma.DateTimeFilter).lte = new Date(to)
  }

  const [items, total] = await Promise.all([
    prisma.measurementReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        reportNo: true,
        templateId: true,
        formNo: true,
        partName: true,
        drawingNo: true,
        revision: true,
        lotNo: true,
        operatorNo: true,
        machine: true,
        measurementDate: true,
        result: true,
        finalizedAt: true,
        createdAt: true,
        _count: { select: { characteristics: true } },
      },
    }),
    prisma.measurementReport.count({ where }),
  ])

  return NextResponse.json({
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

/**
 * POST /api/quality/reports
 *
 * Body: ReportCreateSchema (templateId zorunlu, metadata opsiyonel).
 * Server akışı:
 *   1. Template + characteristics fetch (active templateId)
 *   2. Single $transaction içinde:
 *      a. pg_advisory_xact_lock ile atomik reportNo üret
 *      b. MeasurementReport oluştur (template metadata snapshot)
 *      c. Her template char → MeasurementReportChar (snapshot kopya)
 * Auth: quality.report.create.
 */
export async function POST(request: NextRequest) {
  const { session, error } = await requirePermission('quality.report.create')
  if (error) return error

  let parsed
  try {
    const json = await request.json()
    parsed = ReportCreateSchema.safeParse(json)
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

  const tpl = await prisma.measurementTemplate.findUnique({
    where: { id: body.templateId },
    include: { characteristics: { orderBy: { orderIndex: 'asc' } } },
  })
  if (!tpl) return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 })
  if (!tpl.active) {
    return NextResponse.json(
      { error: 'Pasif şablon — yeni rapor açılamaz' },
      { status: 400 },
    )
  }
  if (tpl.characteristics.length === 0) {
    return NextResponse.json(
      { error: 'Şablonun karakteristik satırı yok' },
      { status: 400 },
    )
  }

  const year = new Date().getFullYear()
  const qrKey = randomUUID()

  try {
    const created = await prisma.$transaction(async (tx) => {
      const reportNo = await generateNextReportNo(year, tx)

      const rep = await tx.measurementReport.create({
        data: {
          reportNo,
          templateId: tpl.id,
          // Snapshot metadata
          formNo: tpl.formNo,
          partName: tpl.partName,
          drawingNo: tpl.drawingNo,
          revision: tpl.revision,
          // Form data
          operatorNo: body.operatorNo ?? null,
          lotNo: body.lotNo ?? null,
          orderQty: body.orderQty ?? null,
          machine: body.machine ?? null,
          gaugeNo: body.gaugeNo ?? null,
          escalationContact: body.escalationContact ?? null,
          measurementDate: body.measurementDate ? new Date(body.measurementDate) : new Date(),
          qrKey,
          createdById: session.user.id,
        },
      })

      // Char snapshot
      await tx.measurementReportChar.createMany({
        data: tpl.characteristics.map((c) => ({
          reportId: rep.id,
          orderIndex: c.orderIndex,
          department: c.department,
          inspectionTool: c.inspectionTool,
          sampleFreq: c.sampleFreq,
          critical: c.critical,
          symbolId: c.symbolId,
          charName: c.charName,
          nominal: c.nominal,
          maxValue: c.maxValue,
          minValue: c.minValue,
          hasNumericRange: c.hasNumericRange,
          datum1: c.datum1,
          datum2: c.datum2,
          datum3: c.datum3,
          measurements: [],
          result: 'PENDING' as const,
        })),
      })

      return tx.measurementReport.findUnique({
        where: { id: rep.id },
        include: {
          characteristics: {
            orderBy: { orderIndex: 'asc' },
            include: { symbol: { select: { id: true, key: true, svgContent: true } } },
          },
        },
      })
    })

    return NextResponse.json({ report: created }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/quality/reports]', err)
    return NextResponse.json({ error: 'Rapor oluşturulamadı' }, { status: 500 })
  }
}
