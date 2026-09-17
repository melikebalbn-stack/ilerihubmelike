import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'

const ORG_UNIT_ID_IK = 'cmrzg1kr600037jpe4ge6rxe0' // İnsan Varlıkları Müdürlüğü (varsayılan)

export const dynamic = 'force-dynamic'

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

  // Sorumlu isim çözümü: yeni aksiyonlar Personnel'den, eski (Excel import) aksiyonlar OrgEmployee'den geliyor
  const orgEmployeeIdler = kpiler.flatMap(k => k.actions.map(a => a.responsibleId)).filter((id): id is string => !!id)
  const personelIdler = kpiler.flatMap(k => k.actions.map(a => a.sorumluPersonelId)).filter((id): id is string => !!id)
  const [orgEmployeeler, personeller] = await Promise.all([
    orgEmployeeIdler.length
      ? prisma.orgEmployee.findMany({ where: { id: { in: orgEmployeeIdler } }, select: { id: true, displayName: true } })
      : Promise.resolve([]),
    personelIdler.length
      ? prisma.personnel.findMany({ where: { id: { in: personelIdler } }, select: { id: true, adSoyad: true } })
      : Promise.resolve([]),
  ])
  const orgEmployeeAd = new Map(orgEmployeeler.map(s => [s.id, s.displayName]))
  const personelAd = new Map(personeller.map(p => [p.id, p.adSoyad]))

  const sonuc = kpiler.map(k => ({
    ...k,
    actions: k.actions.map(a => ({
      ...a,
      responsibleName: a.sorumluPersonelId
        ? personelAd.get(a.sorumluPersonelId) ?? null
        : a.responsibleId
          ? orgEmployeeAd.get(a.responsibleId) ?? null
          : null,
    })),
  }))

  return NextResponse.json({ kpiler: sonuc })
}

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
