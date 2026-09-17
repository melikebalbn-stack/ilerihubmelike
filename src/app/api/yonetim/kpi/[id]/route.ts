import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

// DELETE: KPI tanımını sil. Veri değiştirir → kpi.manage.
// KPIMeasurement / KPIYearlyBaseline / KPIAction, KPIDefinition'a onDelete: Cascade ile bağlı —
// bu satırı silmek hepsini birlikte siler.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission(PERMISSION_KEYS.KPI_MANAGE)
  if (error) return error

  const { id } = await params
  const mevcut = await prisma.kPIDefinition.findUnique({ where: { id }, select: { id: true } })
  if (!mevcut) return NextResponse.json({ error: 'KPI bulunamadı' }, { status: 404 })

  await prisma.kPIDefinition.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
