import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
import { TemplateFormClient, type InitialTemplate } from '@/components/quality/TemplateFormClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TemplateDetailPage({ params }: Props) {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canManage = await hasPermission('quality.template.manage')
  const canRead = await hasPermission([
    'quality.template.manage',
    'quality.report.create',
  ])
  if (!canRead) redirect('/dashboard')

  const { id } = await params

  const [tpl, symbols] = await Promise.all([
    prisma.measurementTemplate.findUnique({
      where: { id },
      include: {
        characteristics: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { reports: true } },
      },
    }),
    prisma.qualitySymbol.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, key: true, nameTr: true, nameEn: true, svgContent: true },
    }),
  ])

  if (!tpl) notFound()

  const initial: InitialTemplate = {
    id: tpl.id,
    formNo: tpl.formNo,
    partName: tpl.partName,
    drawingNo: tpl.drawingNo,
    revision: tpl.revision,
    department: tpl.department,
    notes: tpl.notes,
    active: tpl.active,
    reportCount: tpl._count.reports,
    characteristics: tpl.characteristics.map((c) => ({
      id: c.id,
      orderIndex: c.orderIndex,
      department: c.department,
      inspectionTool: c.inspectionTool,
      sampleFreq: c.sampleFreq,
      critical: c.critical,
      symbolId: c.symbolId,
      charName: c.charName,
      nominal: c.nominal !== null ? c.nominal.toString() : null,
      maxValue: c.maxValue !== null ? c.maxValue.toString() : null,
      minValue: c.minValue !== null ? c.minValue.toString() : null,
      hasNumericRange: c.hasNumericRange,
    })),
  }

  return (
    <TemplateFormClient
      initial={initial}
      symbols={symbols}
      canDeactivate={canManage}
    />
  )
}
