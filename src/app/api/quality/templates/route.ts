import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { TemplateUpsertSchema } from '@/lib/quality/quality-validators'
import { Prisma } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quality/templates
 *
 * Filter: active (default=true), partName (contains), drawingNo (exact),
 *         formNo (exact), page, limit
 * Auth: quality.template.manage VEYA quality.report.create (her ikisi de okuyabilir)
 */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission([
    'quality.template.manage',
    'quality.report.create',
  ])
  if (error) return error

  const { searchParams } = new URL(request.url)
  const activeParam = searchParams.get('active')
  const partName = searchParams.get('partName')?.trim()
  const drawingNo = searchParams.get('drawingNo')?.trim()
  const formNo = searchParams.get('formNo')?.trim()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

  const where: Prisma.MeasurementTemplateWhereInput = {}
  if (activeParam !== 'all') where.active = activeParam === 'false' ? false : true
  if (partName) where.partName = { contains: partName, mode: 'insensitive' }
  if (drawingNo) where.drawingNo = drawingNo
  if (formNo) where.formNo = formNo

  const [items, total] = await Promise.all([
    prisma.measurementTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        formNo: true,
        partName: true,
        drawingNo: true,
        revision: true,
        department: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { characteristics: true, reports: true } },
      },
    }),
    prisma.measurementTemplate.count({ where }),
  ])

  return NextResponse.json({
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

/**
 * POST /api/quality/templates
 *
 * Body: TemplateUpsertSchema (formNo, partName, drawingNo, revision,
 *       department?, notes?, characteristics[])
 * Atomik: template + characteristics tek transaction.
 * Auth: quality.template.manage
 */
export async function POST(request: NextRequest) {
  const { session, error } = await requirePermission('quality.template.manage')
  if (error) return error

  let parsed
  try {
    const json = await request.json()
    parsed = TemplateUpsertSchema.safeParse(json)
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

  try {
    const created = await prisma.$transaction(async (tx) => {
      const tpl = await tx.measurementTemplate.create({
        data: {
          formNo: body.formNo,
          partName: body.partName,
          drawingNo: body.drawingNo,
          revision: body.revision,
          department: body.department ?? null,
          notes: body.notes ?? null,
          active: true,
          createdById: session.user.id,
        },
      })
      await tx.measurementTemplateChar.createMany({
        data: body.characteristics.map((c) => ({
          templateId: tpl.id,
          orderIndex: c.orderIndex,
          department: c.department ?? null,
          inspectionTool: c.inspectionTool ?? null,
          sampleFreq: c.sampleFreq ?? null,
          critical: c.critical ?? false,
          symbolId: c.symbolId ?? null,
          charName: c.charName,
          nominal: c.nominal ? c.nominal.replace(',', '.') : null,
          maxValue: c.maxValue ? c.maxValue.replace(',', '.') : null,
          minValue: c.minValue ? c.minValue.replace(',', '.') : null,
          hasNumericRange: c.hasNumericRange ?? true,
          datum1: c.datum1 ?? null,
          datum2: c.datum2 ?? null,
          datum3: c.datum3 ?? null,
        })),
      })
      return tx.measurementTemplate.findUnique({
        where: { id: tpl.id },
        include: { characteristics: { orderBy: { orderIndex: 'asc' } } },
      })
    })

    return NextResponse.json({ template: created }, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Bu formNo + drawingNo + revision kombinasyonu zaten mevcut' },
        { status: 409 },
      )
    }
    console.error('[POST /api/quality/templates]', err)
    return NextResponse.json({ error: 'Şablon oluşturulamadı' }, { status: 500 })
  }
}
