import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
import { TemplateFormClient, type InitialTemplate } from '@/components/quality/TemplateFormClient'

export const dynamic = 'force-dynamic'

export default async function NewTemplatePage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission('quality.template.manage'))) return <YetkisizErisim permission="quality.template.manage" />

  const symbols = await prisma.qualitySymbol.findMany({
    where: { active: true },
    orderBy: { displayOrder: 'asc' },
    select: { id: true, key: true, nameTr: true, nameEn: true, svgContent: true },
  })

  const initial: InitialTemplate = {
    id: null,
    formNo: 'F18.8511',
    partName: '',
    drawingNo: '',
    revision: 'A',
    operation: '',
    department: null,
    notes: null,
    active: true,
    reportCount: 0,
    characteristics: [],
  }

  return <TemplateFormClient initial={initial} symbols={symbols} />
}
