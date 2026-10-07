import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { requireKpiGoruntule } from '@/lib/yonetim/kpi-yetki'

const ORG_UNIT_ID_IK = 'cmrzg1kr600037jpe4ge6rxe0' // İnsan Varlıkları Müdürlüğü (varsayılan)

export const dynamic = 'force-dynamic'

// KPI-OZEL-ALAN: gelen {label} listesini {key, label}'a çevirir — key boşsa label'dan üretilir,
// çakışma olursa _2, _3... eklenir (ekrandan gelen label'lar benzersiz olmayabilir).
function ozelAlanlariNormalize(input: unknown): { key: string; label: string }[] {
  if (!Array.isArray(input)) return []
  const kullanilanKeyler = new Set<string>()
  const sonuc: { key: string; label: string }[] = []
  for (const ham of input as { key?: string; label?: string }[]) {
    const label = typeof ham?.label === 'string' ? ham.label.trim() : ''
    if (!label) continue
    const temelKey = typeof ham?.key === 'string' && ham.key.trim()
      ? ham.key.trim()
      : label.toLocaleLowerCase('tr').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'alan'
    let key = temelKey
    let i = 2
    while (kullanilanKeyler.has(key)) { key = `${temelKey}_${i}`; i++ }
    kullanilanKeyler.add(key)
    sonuc.push({ key, label })
  }
  return sonuc
}

export async function GET(request: Request) {
  const { error } = await requireKpiGoruntule()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const orgUnitId = searchParams.get('orgUnitId') || ORG_UNIT_ID_IK

  const kpiler = await prisma.kPIDefinition.findMany({
    where: { orgUnitId },
    include: {
      measurements: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
      baselines: { orderBy: { year: 'asc' } },
      actions: true,
      ozelAlanlar: { orderBy: { siraNo: 'asc' }, include: { degerler: true } },
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
  const frequency = body.frequency === 'quarterly' ? 'quarterly' : 'monthly'
  const oranYonu = body.oranYonu === 'H_G' ? 'H_G' : 'G_H'
  const ozelAlanlar = ozelAlanlariNormalize(body.ozelAlanlar)
  const oranPayKaynagi = typeof body.oranPayKaynagi === 'string' && body.oranPayKaynagi.trim()
    ? body.oranPayKaynagi.trim()
    : 'actual'

  const kpi = await prisma.kPIDefinition.create({
    data: {
      orgUnitId,
      name,
      unit: typeof body.unit === 'string' && body.unit.trim() ? body.unit.trim() : null,
      direction,
      frequency,
      gerceklesenEtiketi: typeof body.gerceklesenEtiketi === 'string' && body.gerceklesenEtiketi.trim() ? body.gerceklesenEtiketi.trim() : 'Gerçekleşen',
      hedefEtiketi: typeof body.hedefEtiketi === 'string' && body.hedefEtiketi.trim() ? body.hedefEtiketi.trim() : 'Hedef',
      oranYonu,
      oranPayKaynagi,
      ozelAlanlar: {
        create: ozelAlanlar.map((a, i) => ({ key: a.key, label: a.label, siraNo: i })),
      },
    },
    include: { ozelAlanlar: true },
  })

  return NextResponse.json({ kpi })
}
