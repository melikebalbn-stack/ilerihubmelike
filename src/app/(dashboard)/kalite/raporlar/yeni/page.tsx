import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
import { ReportCreateClient } from '@/components/quality/ReportCreateClient'

export const dynamic = 'force-dynamic'

export default async function NewReportPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission('quality.report.create'))) redirect('/dashboard')

  const templates = await prisma.measurementTemplate.findMany({
    where: { active: true },
    orderBy: [{ partName: 'asc' }, { revision: 'asc' }],
    select: {
      id: true,
      formNo: true,
      partName: true,
      drawingNo: true,
      revision: true,
      operation: true,
      department: true,
      _count: { select: { characteristics: true } },
    },
  })

  const choices = templates.map((t) => ({
    id: t.id,
    formNo: t.formNo,
    partName: t.partName,
    drawingNo: t.drawingNo,
    revision: t.revision,
    operation: t.operation,
    department: t.department,
    characteristicsCount: t._count.characteristics,
  }))

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <ReportCreateClient templates={choices} />
    </div>
  )
}
