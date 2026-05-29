import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { TemplatePatchSchema } from '@/lib/quality/quality-validators'

export const dynamic = 'force-dynamic'

interface Ctx {
  params: Promise<{ id: string }>
}

/**
 * GET /api/quality/templates/[id]
 *
 * Detay + characteristics. Auth: template.manage VEYA report.create.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { error } = await requirePermission([
    'quality.template.manage',
    'quality.report.create',
  ])
  if (error) return error

  const { id } = await params
  const tpl = await prisma.measurementTemplate.findUnique({
    where: { id },
    include: {
      characteristics: {
        orderBy: { orderIndex: 'asc' },
        include: { symbol: { select: { id: true, key: true, nameTr: true, svgContent: true } } },
      },
      _count: { select: { reports: true } },
    },
  })
  if (!tpl) return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 })
  return NextResponse.json({ template: tpl })
}

/**
 * PATCH /api/quality/templates/[id]
 *
 * Şablon metadata güncelle. characteristics verilirse FULL REPLACE (transaction:
 * önce tüm characteristics silinir, sonra yenisi insert edilir).
 * Auth: quality.template.manage.
 *
 * NOT: Mevcut raporlar etkilenmez — onlar snapshot kopya tutar (KALITE-1 design).
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { error } = await requirePermission('quality.template.manage')
  if (error) return error

  const { id } = await params
  let parsed
  try {
    const json = await request.json()
    parsed = TemplatePatchSchema.safeParse(json)
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

  const existing = await prisma.measurementTemplate.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 })

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.measurementTemplate.update({
        where: { id },
        data: {
          formNo: body.formNo ?? undefined,
          partName: body.partName ?? undefined,
          drawingNo: body.drawingNo ?? undefined,
          revision: body.revision ?? undefined,
          department: body.department !== undefined ? body.department : undefined,
          notes: body.notes !== undefined ? body.notes : undefined,
        },
      })

      if (body.characteristics) {
        // Full replace
        await tx.measurementTemplateChar.deleteMany({ where: { templateId: id } })
        await tx.measurementTemplateChar.createMany({
          data: body.characteristics.map((c) => ({
            templateId: id,
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
      }

      return tx.measurementTemplate.findUnique({
        where: { id },
        include: { characteristics: { orderBy: { orderIndex: 'asc' } } },
      })
    })

    return NextResponse.json({ template: updated })
  } catch (err) {
    console.error('[PATCH /api/quality/templates/[id]]', err)
    return NextResponse.json({ error: 'Şablon güncellenemedi' }, { status: 500 })
  }
}

/**
 * DELETE /api/quality/templates/[id]
 *
 * Soft delete: active=false. Hard delete yapılmaz çünkü MeasurementReport.templateId
 * FK Restrict ile bağlı; raporlar varsa hard delete fail eder.
 * Auth: quality.template.manage.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { error } = await requirePermission('quality.template.manage')
  if (error) return error

  const { id } = await params
  const existing = await prisma.measurementTemplate.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 })

  await prisma.measurementTemplate.update({
    where: { id },
    data: { active: false },
  })

  return NextResponse.json({ success: true })
}
