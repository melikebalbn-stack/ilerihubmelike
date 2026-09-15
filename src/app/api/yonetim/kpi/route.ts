import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'

const ORG_UNIT_ID_IK = 'cmrzg1kr600037jpe4ge6rxe0' // İnsan Varlıkları Müdürlüğü (varsayılan)

export const dynamic = 'force-dynamic'

// GET: seçilen departmanın KPI'ları + ölçüm/baseline/aksiyonları.
// Görüntüleme için kpi.view VEYA kpi.manage yeterli (yönetenler de görür).
export async function GET(request: Request) {
  const { error } = await requirePermission([PERMISSION_KEYS.KPI_VIEW, PERMISSION_KEYS.KPI_MANAGE])
  if (error) return error

  const { searchParams } = new URL(request.url)
  const orgUnitId = searchParams.get('orgUnitId') || ORG_UNIT_ID_IK

  const kpiler = await prisma.kPIDefinition.findMany({
    where: { orgUnitId },
    include: {
      measurements: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
      baselines: { orderBy: { year: 'asc' } },
      actions: true,
    },
    orderBy: { name: 'asc' },
  })

  const sorumluIdler = kpiler.flatMap(k => k.actions.map(a => a.responsibleId)).filter((id): id is string => !!id)
  const sorumlular = sorumluIdler.length
    ? await prisma.orgEmployee.findMany({ where: { id: { in: sorumluIdler } }, select: { id: true, displayName: true } })
    : []
  const sorumluAd = new Map(sorumlular.map(s => [s.id, s.displayName]))

  const sonuc = kpiler.map(k => ({
    ...k,
    actions: k.actions.map(a => ({ ...a, responsibleName: a.responsibleId ? sorumluAd.get(a.responsibleId) ?? null : null })),
  }))

  return NextResponse.json({ kpiler: sonuc })
}

// POST: yeni KPI tanımı. Veri değiştirir → kpi.manage şart.
export async function POST(request: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.KPI_MANAGE)
  if (error) return error

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'KPI adı zorunludur' }, { status: 400 })
  }
  const direction = body.direction === 'lower_is_better' ? 'lower_is_better' : 'higher_is_better'
  const orgUnitId = typeof body.orgUnitId === 'string' && body.orgUnitId ? body.orgUnitId : ORG_UNIT_ID_IK

  const kpi = await prisma.kPIDefinition.create({
    data: {
      orgUnitId,
      name,
      unit: typeof body.unit === 'string' && body.unit.trim() ? body.unit.trim() : null,
      direction,
      frequency: 'monthly',
    },
  })

  return NextResponse.json({ kpi })
}
