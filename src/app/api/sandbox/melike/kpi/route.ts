import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ORG_UNIT_ID_IK = 'cmrzg1kr600037jpe4ge6rxe0' // İnsan Varlıkları Müdürlüğü (varsayılan)

export async function GET(request: Request) {
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

export async function POST(request: Request) {
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
